import { ShopCanvasGlyph } from "./shop-canvas-glyph";
import { useEffect, useRef, useState } from "react";
import { Tooltip } from "antd";

import { localForageStorageForScope } from "@/lib/localforage-storage";
import { getActiveUserScope } from "@/lib/user-scope";
import { createClientUUID } from "@/lib/client-id";
import { upsertTextMessage } from "@/lib/canvas/cloud-agent-events";
import type { CloudAgentChatMessage } from "@/components/canvas/canvas-cloud-agent-chat-ui";
import { useCommerceAdminModels } from "@/pages/ecommerce/admin-models";
import { cancelAgentRun, createAgentRun, getAgentProfile, sendAgentMessage, subscribeAgentEvents, type AgentRun, type CreateAgentRunInput } from "@/services/api/agent";
import { logicalModelIDForConfig, modelOptionName, modelDisplayName, selectableModelsByCapability, resolveModelRequestConfig, type AiConfig } from "@/stores/use-config-store";
import { useShopAgentStore } from "./shop-agent-store";

type Pending = { input: CreateAgentRunInput; parentId?: string };
type Session = { messages: CloudAgentChatMessage[]; run: AgentRun | null; cursor: number; pending: Pending | null };
const EMPTY: Session = { messages: [], run: null, cursor: 0, pending: null };
const KEY = "shop-canvas-assistant-v1";
const terminal = (run: AgentRun | null) => !run || (!run.cleanupPending && ["completed", "failed", "cancelled", "rejected"].includes(run.status));

/** 独立电商对话；不把电商画布伪装成通用画布 ID。 */
export function ShopCanvasAssistant({ scope, config }: { scope: string; config: AiConfig }) {
    const admin = useCommerceAdminModels(config);
    const models = selectableModelsByCapability(config, "text");
    const [selectedModel, setSelectedModel] = useState("");
    const model = models.includes(selectedModel) ? selectedModel : models.includes(admin.planningModel) ? admin.planningModel : models[0] || "";
    const preparedPrompt = useShopAgentStore((s) => s.prompt);
    const [session, setSession] = useState<Session>(EMPTY);
    const current = useRef<Session>(EMPTY);
    const [loaded, setLoaded] = useState(false);
    const [draft, setDraft] = useState(() => useShopAgentStore.getState().drafts[scope] || "");
    useEffect(() => {
        useShopAgentStore.getState().setDraft(scope, draft);
    }, [scope, draft]);
    useEffect(() => {
        if (preparedPrompt) {
            setDraft(preparedPrompt);
            useShopAgentStore.setState({ prompt: "" });
        }
    }, [preparedPrompt]);
    const [busy, setBusy] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [error, setError] = useState("");
    const writes = useRef<Promise<unknown>>(Promise.resolve());
    const sending = useRef(false);
    const preparing = useRef(false);
    const alive = useRef(false);
    const storage = localForageStorageForScope(scope);
    const update = (next: Session) => {
        current.current = next;
        setSession(next);
        const data = JSON.stringify(next);
        writes.current = writes.current.catch(() => undefined).then(() => storage.setItem(KEY, data));
        return writes.current;
    };
    useEffect(() => {
        alive.current = true;
        setLoaded(false);
        void Promise.resolve(storage.getItem(KEY))
            .then((raw) => {
                if (!alive.current) return;
                let value = EMPTY;
                try {
                    const parsed = raw ? (JSON.parse(String(raw)) as Session) : null;
                    if (parsed && Array.isArray(parsed.messages)) value = { messages: parsed.messages, run: parsed.run || null, cursor: Number(parsed.cursor) || 0, pending: parsed.pending || null };
                } catch {
                    /* Ignore invalid local cache. */
                }
                current.current = value;
                setSession(value);
                setLoaded(true);
            })
            .catch(() => {
                if (alive.current) setError("无法读取电商助手对话，请刷新重试");
            });
        return () => {
            alive.current = false;
        };
    }, [scope]);

    const runId = session.run?.id;
    useEffect(() => {
        if (!loaded || !runId) return;
        return subscribeAgentEvents(
            runId,
            (event) => {
                if (!alive.current || current.current.run?.id !== runId) return;
                const old = current.current;
                const payload = event.payload || {};
                let messages = old.messages;
                let run = old.run;
                if (["assistant_delta", "assistant_message", "assistant_snapshot"].includes(event.type)) {
                    const text = String(payload.text || payload.summary || payload.message || "");
                    messages = upsertTextMessage(messages, String(payload.messageId || event.eventId), text, event.type === "assistant_delta");
                }
                if (event.type === "run_status" && run) {
                    run = { ...run, status: (payload.status || run.status) as AgentRun["status"], cleanupPending: Boolean(payload.cleanupPending), failureMessage: String(payload.failureMessage || "") };
                }
                if ((event.type === "run_failed" || event.type === "error") && run) {
                    run = { ...run, status: "failed", failureMessage: String(payload.message || payload.text || "本轮对话失败") };
                }
                void update({ ...old, messages, run, cursor: Math.max(old.cursor, event.seq || 0) }).catch(() => {
                    if (alive.current) setError("对话状态未能保存到本机，请检查浏览器存储空间。");
                });
            },
            {
                after: current.current.cursor,
                onError: () => {
                    if (alive.current) setError("连接中断，刷新页面可继续查看本轮状态。");
                },
            },
        );
    }, [loaded, runId]);

    const dispatch = async (pending: Pending, retry = false) => {
        if (sending.current) return;
        sending.current = true;
        setBusy(true);
        setError("");
        try {
            await update(current.current);
            if (getActiveUserScope() !== scope) return;
            const result = pending.parentId ? await sendAgentMessage(pending.parentId, pending.input) : await createAgentRun(pending.input);
            if (!alive.current || getActiveUserScope() !== scope) return;
            await update({ ...current.current, run: result.run, cursor: 0, pending: null });
        } catch (cause) {
            if (!alive.current) return;
            const failure = cause as { status?: number; reason?: string; message?: string };
            const definitive = failure.reason === "agent_conversation_stale_parent" || (!retry && Boolean(failure.status && [400, 401, 403, 404, 422].includes(failure.status)));
            if (definitive) {
                const prior = current.current;
                const text = prior.messages.find((item) => item.id === pending.input.idempotencyKey)?.text || "";
                try {
                    await update({ ...prior, pending: null, messages: prior.messages.filter((item) => item.id !== pending.input.idempotencyKey) });
                    setDraft((value) => value || text);
                    setError(failure.message || "请求未被接受，请检查配置后重试。");
                } catch {
                    setError("无法更新请求记录，请检查浏览器存储空间。");
                }
            } else setError(cause instanceof Error ? `${cause.message}。可重试同一请求，不会新建另一条请求。` : "提交状态未确认，请重试同一请求。");
        } finally {
            sending.current = false;
            if (alive.current) setBusy(false);
        }
    };
    const submit = async () => {
        const text = draft.trim();
        if (!text || busy || preparing.current || !loaded || !terminal(session.run) || session.pending) return;
        if (!model) {
            setError(admin.problem || "电商助手模型正在加载或尚未配置");
            return;
        }
        preparing.current = true;
        setBusy(true);
        try {
            const profile = await getAgentProfile();
            if (!alive.current || getActiveUserScope() !== scope) return;
            const agentConfig = { ...config, model };
            const logicalModelId = logicalModelIDForConfig(agentConfig);
            const channel = resolveModelRequestConfig(agentConfig, model);
            const input: CreateAgentRunInput = {
                canvasId: "",
                profileRevision: profile.revision,
                permissionMode: "read_only",
                contextScope: [],
                pinnedSkillIds: [],
                model: modelOptionName(model) || undefined,
                ...(logicalModelId ? { logicalModelId } : channel.channelId ? { channelId: channel.channelId, channelModelKey: modelOptionName(model) } : {}),
                prompt: `你是 造幕 电商 Agent，专注商品主图、详情页、模特换装、多模特同款、一模多衣、三视图、姿势、换脸、印花提取、图像精修、商品视频复刻、视频脚本和剪辑。先识别任务与缺失素材，保持商品外观、材质、图案和规格事实一致。给出清晰可执行的方案和对应电商工具，不讨论影视短剧或通用技能。不能宣称已经生成、扣费或修改画布；用户在电商工具中选择模型、参数并确认后才提交。\n\n用户需求：${text}`,
                budget: { maxGenerationTasks: 0, maxVideoSeconds: 0 },
                idempotencyKey: createClientUUID(),
            };
            const pending = { input, parentId: current.current.run?.id };
            await update({ ...current.current, messages: [...current.current.messages, { id: input.idempotencyKey, role: "user", text }], pending });
            setDraft("");
            await dispatch(pending);
        } catch (cause) {
            if (alive.current) setError(cause instanceof Error ? cause.message : "无法准备对话，请重试");
        } finally {
            preparing.current = false;
            if (alive.current) setBusy(false);
        }
    };
    return (
        <section className="sp-canvas-chat" aria-label="电商助手对话">
            <label className="shop-agent-model">
                <span>策划模型</span>
                <select aria-label="电商 Agent 模型" value={model} onChange={(event) => setSelectedModel(event.target.value)} disabled={busy || !terminal(session.run)}>
                    {models.length ? (
                        models.map((value) => (
                            <option key={value} value={value}>
                                {modelDisplayName(config, value)}
                            </option>
                        ))
                    ) : (
                        <option value="">暂无可用文本模型</option>
                    )}
                </select>
            </label>
            <div className="sp-canvas-chat-messages" data-canvas-wheel-scroll aria-live="polite">
                {!session.messages.length ? (
                    <p>告诉我商品、目标平台和视觉需求，我可以帮你整理卖点与创作思路。</p>
                ) : (
                    session.messages
                        .filter((item) => item.role === "user" || item.role === "assistant")
                        .slice(-60)
                        .map((item) => (
                            <div key={item.id} className="sp-canvas-chat-message" data-role={item.role}>
                                {item.text}
                            </div>
                        ))
                )}
                {!terminal(session.run) ? <p role="status">{cancelling ? "正在停止本轮对话…" : "电商助手正在思考…"}</p> : null}
            </div>
            {session.run?.status === "failed" ? (
                <p className="sp-canvas-chat-error" role="alert">
                    {session.run.failureMessage || "对话失败，请重新描述需求。"}
                </p>
            ) : null}
            {error ? (
                <p className="sp-canvas-chat-error" role="alert">
                    {error}
                </p>
            ) : null}
            {session.pending ? (
                <button type="button" disabled={busy} onClick={() => void dispatch(session.pending!, true)}>
                    重试未确认的请求
                </button>
            ) : null}
            <div className="sp-canvas-chat-input">
                <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="描述商品或视觉需求"
                    aria-label="电商助手输入"
                    rows={2}
                    disabled={!loaded || Boolean(session.pending)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                            event.preventDefault();
                            void submit();
                        }
                    }}
                />
                {!terminal(session.run) ? (
                    <Tooltip title="停止当前回复">
                        <button
                            type="button"
                            aria-label="停止电商助手"
                            disabled={cancelling}
                            onClick={async () => {
                                if (!session.run) return;
                                setCancelling(true);
                                try {
                                    await cancelAgentRun(session.run.id);
                                } catch (cause) {
                                    setError(cause instanceof Error ? cause.message : "停止失败，请重试");
                                    setCancelling(false);
                                }
                            }}
                        >
                            <ShopCanvasGlyph name="stop" size={14} />
                        </button>
                    </Tooltip>
                ) : (
                    <Tooltip title="发送 · Enter；换行 · Shift Enter">
                        <button
                            type="button"
                            aria-label="发送给电商助手"
                            disabled={!loaded || busy || !draft.trim() || !terminal(session.run) || Boolean(session.pending)}
                            onClick={() => {
                                setCancelling(false);
                                void submit();
                            }}
                        >
                            {busy ? <ShopCanvasGlyph name="spinner" size={16} /> : <ShopCanvasGlyph name="send" size={16} />}
                        </button>
                    </Tooltip>
                )}
            </div>
        </section>
    );
}
