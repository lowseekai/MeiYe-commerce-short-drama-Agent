// 创作页消息流：用户消息、媒体结果、生成中占位、引用素材与预览。

import { conversationTimeFormatter, type CreationMessage } from "./creation-types";
import { creationMessageNeedsResultSync } from "./creation-conversations";
import { creationImageLayout } from "./creation-image-layout";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import {
    AlertCircle,
    AlertTriangle,
    CircleStop,
    CloudOff,
    Copy,
    Download,
    Ellipsis,
    FileText,
    Film,
    Image as ImageIcon,
    ImageOff,
    ImagePlus,
    Info,
    Maximize2,
    Music2,
    Pencil,
    RefreshCw,
    RotateCcw,
    SquarePen,
    Trash2,
    UserRound,
    X,
    type LucideIcon,
    Blocks,
} from "lucide-react";
import { MeiyeConfirmDialog } from "@/components/ui/meiye-confirm-dialog";
import { pickerModelDisplayName } from "@/components/model-picker";
import { useEffectiveConfig } from "@/stores/use-config-store";
import { queryGenerationTask } from "@/services/api/task-center";
import { GenerationToolCard, type GenerationToolStatus } from "@/components/ai/generation-tool-card";
import { GenerationPhaseSteps } from "@/components/ai/generation-phase-steps";
import { GenerationImagePreview } from "@/components/ai/generation-image-preview";
import { MessageReasoning } from "@/components/ai/message-reasoning";
import { AIMessageMarkdown } from "@/components/ai/ai-message-markdown";
import { WorkingDots } from "@/components/ai/working-indicator";
import { UserAvatar } from "@/components/layout/user-avatar";
import { generationErrorMessage } from "@/lib/generation-error";
import { isGenerationCostUncertainError } from "@/lib/canvas/canvas-generation-batch";
import { generationPhaseHint, generationPhaseLabel, generationPhaseStep, generationTaskPhase, generationTaskSavingState, generationTaskShowsProgress, type GenerationPhase } from "@/lib/generation-task-display";
import { useTaskElapsed } from "@/hooks/use-task-elapsed";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { currentLocale, translate } from "@/i18n";
import { useCopyText } from "@/hooks/use-copy-text";
import { type CreationReference, displayCreationPrompt } from "./creation-references";
import { useUserStore } from "@/stores/use-user-store";
import { type CreationAttachment, creationAttachmentKind, creationMediaAspectRatio, type CreationMode } from "./creation-assets";
import { getResourceAccess, resolveResourceAccessURL, resolveResourceUrl, resourceIdFromStorageKey } from "@/services/api/resources";
import { CachedResourceImage } from "@/components/cached-resource-image";
import { Tooltip } from "@/components/ui/base/tooltip";
import { useAssetStore, type Asset, type ImageAsset, type VideoAsset } from "@/stores/use-asset-store";
import { creationResultAssetIds, creationResultStorageKeys } from "@/lib/canvas/canvas-asset-handoff";
import { resolveMediaUrl } from "@/services/file-storage";
import { resolveImageUrl } from "@/services/image-storage";
import { Button, Dropdown, Popover, message } from "antd";
import { downloadBrowserMedia, startBrowserDownload } from "@/services/browser-download";
import { CanvasImagePreview, type CanvasImagePreviewNavigation } from "@/components/canvas/canvas-image-preview";
import { AppModal } from "@/components/ui/product/app-modal";
import { CREATION_IMAGE_ASSET_DND_TYPE } from "./creation-image-transfer";
import "./creation-workspace-messages.css";
import { creationResultEntries } from "./creation-result-urls";
import { CREATION_IMAGE_DRAG_TYPE } from "./creation-reference-drop";

async function downloadCreationResult(storageKey: string | undefined, url: string, index: number, isVideo: boolean, mimeType?: string) {
    const extension =
        ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm", "video/quicktime": "mov" } as Record<string, string>)[mimeType?.split(";")[0] || ""] ||
        /\.(png|jpe?g|webp|gif|mp4|webm|mov)(?:[?#]|$)/i.exec(url)?.[1]?.toLowerCase() ||
        (isVideo ? "mp4" : "png");
    const fileName = `${translate("createWorkspace.result.fileName", { index: index + 1 })}.${extension}`;
    if (storageKey && resourceIdFromStorageKey(storageKey)) {
        await downloadBrowserMedia({ storageKey, fileName });
        return;
    }
    // 历史链接和本地资源没有下载签名，用 Blob 避免跨域链接导航当前页面。
    const response = await fetch(url);
    if (!response.ok) throw new Error(translate("createWorkspace.result.downloadFailedRetry"));
    const objectUrl = URL.createObjectURL(await response.blob());
    try {
        startBrowserDownload(objectUrl, fileName);
    } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    }
}

export function CreationMessageView({
    item,
    shotNumber,
    onRetryFailure,
    onRefreshResult,
    onRecoverMedia,
    refreshingResult = false,
    onCreateVariant,
    onEditUserMessage,
    onContinueCanvas,
    openingCanvas,
    batch,
}: {
    item: CreationMessage;
    shotNumber: number;
    onRetryFailure: () => void;
    onRefreshResult: () => void;
    onRecoverMedia: () => void;
    refreshingResult?: boolean;
    onCreateVariant: () => void;
    onEditUserMessage: (text: string) => void;
    onContinueCanvas: (ids?: string[]) => void;
    openingCanvas: boolean;
    batch?: CreationBatchActions;
}) {
    const brandName = useAppearanceStore((state) => state.appearance.brandName);
    const { t } = useTranslation();
    if (item.role === "user") return <CreationUserMessage item={item} shotNumber={shotNumber} onEditUserMessage={onEditUserMessage} />;
    const mode = item.mode || "text";
    const messageState = creationMessageState(item);
    const stateChip = messageState ? (
        <span className={`creation-message-state is-${messageState.tone}`}>
            {messageState.tone === "pending" || messageState.tone === "syncing" ? <i aria-hidden="true" /> : null}
            {messageState.label}
        </span>
    ) : null;
    const heading =
        mode !== "text" ? (
            <>
                {shotNumber > 0 ? <span className="creation-shot-badge">{t("createWorkspace.message.shotBadge", { number: shotNumber })}</span> : null}
                <span className="creation-message-mark is-yoru">
                    <img src="/yoru/yoru-body.png" alt={t("createWorkspace.message.yoruAvatar")} />
                </span>
                <strong>{mode === "image" ? t("create.message.imageGeneration") : t("create.message.videoGeneration")}</strong>
                {item.status === "done" ? <span className="creation-message-progress-copy">{mode === "video" ? t("createWorkspace.message.videoCreated") : t("createWorkspace.message.imageCreated")}</span> : null}
                {item.createdAt ? <time dateTime={item.createdAt}>{formatMessageTime(item.createdAt)}</time> : null}
                {stateChip}
            </>
        ) : (
            <>
                {shotNumber > 0 ? <span className="creation-shot-badge">{t("createWorkspace.message.shotBadge", { number: shotNumber })}</span> : null}
                <span className="creation-message-mark is-yoru">
                    <img src="/yoru/yoru-body.png" alt={t("createWorkspace.message.yoruAvatar")} />
                </span>
                <strong>{brandName}</strong>
                {item.createdAt ? <time dateTime={item.createdAt}>{formatMessageTime(item.createdAt)}</time> : null}
                {stateChip}
            </>
        );
    const toolStatus: GenerationToolStatus = item.status === "pending" ? "running" : item.status === "error" ? "error" : item.status === "cancelled" ? "cancelled" : "completed";
    return (
        <article className={`creation-assistant-message is-${mode}`} data-status={item.status || "done"}>
            {mode === "text" ? (
                <>
                    <div className="creation-message-heading">{heading}</div>
                    {item.reasoning ? (
                        <div className="creation-message-reasoning-wrap">
                            <MessageReasoning reasoning={item.reasoning} isStreaming={item.status === "streaming"} />
                        </div>
                    ) : null}
                    <div className="creation-message-content">
                        {item.content ? (
                            <AIMessageMarkdown isStreaming={item.status === "streaming"}>{item.content}</AIMessageMarkdown>
                        ) : (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                <WorkingDots dotSize={5} gap={2} />
                                <span>{t("createWorkspace.message.generating")}</span>
                            </span>
                        )}
                    </div>
                    {item.syncInterrupted && (item.status === "pending" || item.status === "streaming") ? (
                        <div className="creation-message-content">
                            <CreationSyncNotice refreshing={refreshingResult} onRefresh={onRefreshResult} onRetry={onRetryFailure} />
                        </div>
                    ) : null}
                </>
            ) : (
                <GenerationToolCard status={toolStatus} heading={heading}>
                    <MediaResult
                        item={item}
                        onRetryFailure={onRetryFailure}
                        onRefreshResult={onRefreshResult}
                        onRecoverMedia={onRecoverMedia}
                        refreshingResult={refreshingResult}
                        onCreateVariant={onCreateVariant}
                        onContinueCanvas={onContinueCanvas}
                        openingCanvas={openingCanvas}
                        batch={batch}
                    />
                </GenerationToolCard>
            )}
            {item.error && mode === "text" ? (
                <div className="creation-message-error">
                    <span>{generationErrorMessage(item.error)}</span>
                    <button type="button" onClick={onRetryFailure}>
                        <RefreshCw />
                        {t("createWorkspace.actions.regenerate")}
                    </button>
                </div>
            ) : null}
        </article>
    );
}

type CreationMessageStateTone = "pending" | "syncing" | "sync" | "error" | "cancelled";

// 消息头部的状态标签：区分“生成中 / 重新连接中 / 结果待同步 / 生成失败 / 已停止”，不把页面没跟上说成生成失败。
function creationMessageState(item: CreationMessage): { tone: CreationMessageStateTone; label: string } | null {
    if (item.mode === "image" && item.status === "pending" && item.generationImages?.length && item.generationImages.every((image) => image?.previewUrl)) return null;
    if (item.status === "pending" || item.status === "streaming")
        return item.syncInterrupted ? { tone: "syncing", label: translate("createWorkspace.status.reconnecting") } : item.status === "pending" ? { tone: "pending", label: translate("createWorkspace.status.generating") } : null;
    if (item.status === "cancelled") return { tone: "cancelled", label: translate("create.status.stopped") };
    if (item.status === "error") {
        if (creationMessageNeedsResultSync(item)) return { tone: "sync", label: translate("createWorkspace.status.resultPendingSync") };
        if (item.mediaRecoverable) return { tone: "sync", label: translate("createWorkspace.status.saveIncomplete") };
        return isGenerationCostUncertainError(item.error) ? { tone: "sync", label: "费用待核对" } : { tone: "error", label: translate("create.status.failed") };
    }
    return null;
}

function CreationSyncNotice({ refreshing, onRefresh, onRetry }: { refreshing: boolean; onRefresh: () => void; onRetry: () => void }) {
    const { t } = useTranslation();
    return (
        <div className="creation-sync-notice" role="status">
            <span>
                <CloudOff aria-hidden="true" />
                {t("createWorkspace.sync.interrupted")}
            </span>
            <button type="button" onClick={onRefresh} disabled={refreshing} aria-busy={refreshing || undefined}>
                <RefreshCw aria-hidden="true" className={refreshing ? "animate-spin" : undefined} />
                {refreshing ? t("createWorkspace.sync.refreshing") : t("createWorkspace.sync.refreshNow")}
            </button>
            {/* 原任务一直拿不到（例如已在任务中心删除）时的出口；点击后会先确认再次扣费。 */}
            <button type="button" className="is-quiet" onClick={onRetry}>
                {t("createWorkspace.actions.regenerate")}
            </button>
        </div>
    );
}

export function CreationUserMessage({ item, shotNumber, onEditUserMessage }: { item: CreationMessage; shotNumber: number; onEditUserMessage: (text: string) => void }) {
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState<"image" | "video">("image");
    const copyText = useCopyText();
    const visiblePrompt = displayCreationPrompt(item.content, item.references || []);
    const user = useUserStore((state) => state.user);
    const { t } = useTranslation();
    return (
        <article className="creation-user-message">
            <div className="creation-user-message-meta">
                {shotNumber > 0 ? <span className="creation-shot-badge">{t("createWorkspace.message.shotBadge", { number: shotNumber })}</span> : null}
                {item.createdAt ? <time dateTime={item.createdAt}>{formatMessageTime(item.createdAt)}</time> : null}
                <strong>{user?.displayName || t("create.message.you")}</strong>
                {user ? (
                    <UserAvatar user={user} className="creation-user-avatar" />
                ) : (
                    <span className="creation-user-avatar">
                        <UserRound />
                    </span>
                )}
            </div>
            <div className="creation-user-message-copy-wrap">
                <p>{visiblePrompt}</p>
            </div>
            {item.references?.length ? <CreationMessageReferences references={item.references} /> : null}
            {item.attachments?.length ? (
                <div className="creation-user-message-attachments">
                    {item.attachments.map((attachment) => {
                        const kind = creationAttachmentKind(attachment);
                        const previewable = kind === "image" || kind === "video";
                        const url = attachment.previewUrl || ("dataUrl" in attachment ? attachment.dataUrl : attachment.url) || "";
                        const imageUrl = kind === "image" ? resolveResourceUrl(attachment.storageKey, url) : "";
                        const previewUrl = kind === "image" ? imageUrl : url;
                        return (
                            <button
                                key={attachment.id}
                                type="button"
                                className={!previewable ? "is-file" : undefined}
                                onClick={() => {
                                    if (!previewable) return;
                                    setPreviewType(kind === "video" ? "video" : "image");
                                    setPreviewUrl(kind === "video" ? attachment.url || "" : previewUrl);
                                }}
                                aria-label={previewable ? t("createWorkspace.userMessage.previewAttachment", { name: attachment.name || t("createWorkspace.userMessage.attachment") }) : attachment.name || t("createWorkspace.userMessage.attachment")}
                                disabled={previewable && !previewUrl}
                            >
                                {kind === "video" ? (
                                    <video src={attachment.url || ""} poster={url !== attachment.url ? url : undefined} muted playsInline preload="metadata" />
                                ) : kind === "image" ? (
                                    <CachedResourceImage
                                        storageKey={attachment.storageKey}
                                        src={imageUrl}
                                        variant="thumbnail-small"
                                        alt={attachment.name || t("createWorkspace.userMessage.attachment")}
                                        width={44}
                                        height={44}
                                        loading="lazy"
                                        decoding="async"
                                    />
                                ) : kind === "audio" ? (
                                    <Music2 />
                                ) : (
                                    <FileText />
                                )}
                                {previewable ? (
                                    <span aria-hidden="true">
                                        <Maximize2 />
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
            ) : null}
            <div className="creation-user-message-actions">
                <Tooltip title={t("createWorkspace.userMessage.copyPrompt")}>
                    <button type="button" className="creation-user-message-copy" aria-label={t("createWorkspace.userMessage.copyPrompt")} onClick={() => copyText(visiblePrompt, t("createWorkspace.userMessage.promptCopied"))}>
                        <Copy />
                    </button>
                </Tooltip>
                <Tooltip title={t("createWorkspace.userMessage.editAndResend")}>
                    <button type="button" className="creation-user-message-edit" aria-label={t("createWorkspace.userMessage.editPrompt")} onClick={() => onEditUserMessage(visiblePrompt)}>
                        <Pencil />
                    </button>
                </Tooltip>
            </div>
            <CreationMediaPreviewModal url={previewUrl} type={previewType} onClose={() => setPreviewUrl("")} />
        </article>
    );
}

export function MediaResult({
    item,
    onRetryFailure,
    onRefreshResult,
    onRecoverMedia,
    refreshingResult = false,
    onCreateVariant,
    onContinueCanvas,
    openingCanvas,
    batch,
}: {
    item: CreationMessage;
    onRetryFailure: () => void;
    onRefreshResult: () => void;
    onRecoverMedia: () => void;
    refreshingResult?: boolean;
    onCreateVariant: () => void;
    onContinueCanvas: (ids?: string[]) => void;
    openingCanvas: boolean;
    batch?: CreationBatchActions;
}) {
    const { t } = useTranslation();
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [previewUrl, setPreviewUrl] = useState("");
    const [previewType, setPreviewType] = useState<"image" | "video">("image");
    // 正在预览的图片按 storageKey 定位，供左右切换；晚到的原图地址只更新仍在查看的那一张。
    const [previewKey, setPreviewKey] = useState("");
    const previewRequestRef = useRef(0);
    const assets = useAssetStore((state) => state.assets);
    const storedResultUrls = item.resultUrls || [];
    const resultStorageKeys = item.resultStorageKeys?.length ? item.resultStorageKeys : creationResultStorageKeys(assets, { messageId: item.id, taskIds: item.taskIds || [], resultUrls: storedResultUrls });
    // 展示地址按 storageKey 保存；effect 重跑（素材库更新、续签）时不回退到历史 hint。
    const [resolvedByKey, setResolvedByKey] = useState<Record<string, string>>({});
    const [failedByKey, setFailedByKey] = useState<Record<string, boolean>>({});

    useEffect(() => {
        let active = true;
        const timers: ReturnType<typeof setTimeout>[] = [];
        const updateResultUrl = (storageKey: string, url: string) => {
            if (!active || !url) return;
            setResolvedByKey((current) => (current[storageKey] === url ? current : { ...current, [storageKey]: url }));
        };
        const refreshRemote = async (index: number, storageKey: string): Promise<void> => {
            try {
                // 结果墙只展示服务器缩略图；点击放大时再单独申请原图。
                const access = await getResourceAccess(storageKey, "display", item.mode === "video" ? "original" : "thumbnail");
                if (!active) return;
                updateResultUrl(storageKey, resolveResourceAccessURL(access.url));
                const refreshAt = access.refreshAt ? new Date(access.refreshAt).getTime() : Number.NaN;
                const expiresAt = access.expiresAt ? new Date(access.expiresAt).getTime() : Number.NaN;
                const nextRefreshAt = Number.isFinite(refreshAt) ? refreshAt : expiresAt;
                const delay = Number.isFinite(nextRefreshAt) ? Math.max(10_000, nextRefreshAt - Date.now()) : 4 * 60_000;
                timers.push(setTimeout(() => void refreshRemote(index, storageKey), delay));
            } catch {
                if (!active) return;
                setFailedByKey((current) => (current[storageKey] ? current : { ...current, [storageKey]: true }));
                timers.push(setTimeout(() => void refreshRemote(index, storageKey), 60_000));
            }
        };
        if (!resultStorageKeys.length) {
            return () => {
                active = false;
            };
        }
        // 历史记录只把 URL 当作短期 hint；真正恢复依赖稳定 storageKey，展示 URL 由访问缓存按需续签。
        const resolver = item.mode === "video" ? resolveMediaUrl : resolveImageUrl;
        void Promise.all(
            resultStorageKeys.map(async (storageKey, index) => {
                if (resourceIdFromStorageKey(storageKey)) {
                    await refreshRemote(index, storageKey);
                    return;
                }
                const url = await resolver(storageKey, storedResultUrls[index] || "");
                updateResultUrl(storageKey, url);
            }),
        ).catch(() => {
            // 保留当前页面已有的 URL hint；若已过期，页面会走明确的媒体空态而不是回退到平台正文代理。
        });
        return () => {
            active = false;
            timers.forEach((timer) => clearTimeout(timer));
        };
    }, [item.id, item.mode, resultStorageKeys.join("|"), storedResultUrls.join("|")]);

    const isVideo = item.mode === "video";
    // 每个结果的加载状态与重试次数按 storageKey 记录；重试会换一个元素重新请求，并强制续签访问地址。
    const [mediaStates, setMediaStates] = useState<Record<string, "loaded" | "error">>({});
    const [mediaAttempts, setMediaAttempts] = useState<Record<string, number>>({});
    const [naturalRatios, setNaturalRatios] = useState<Record<string, number>>({});
    const [naturalSizes, setNaturalSizes] = useState<Record<string, { width: number; height: number }>>({});
    const config = useEffectiveConfig();
    const markResultMedia = (key: string, state: "loaded" | "error") => setMediaStates((current) => (current[key] === state ? current : { ...current, [key]: state }));
    const retryResultMedia = (key: string) => {
        setMediaStates(({ [key]: _failed, ...rest }) => rest);
        setMediaAttempts((current) => ({ ...current, [key]: (current[key] || 0) + 1 }));
        if (!resourceIdFromStorageKey(key)) return;
        void getResourceAccess(key, "display", isVideo ? "original" : "thumbnail", "", { forceRefresh: true })
            .then((access) => setResolvedByKey((current) => ({ ...current, [key]: resolveResourceAccessURL(access.url) })))
            .catch(() => markResultMedia(key, "error"));
    };
    const openImagePreview = async (key: string, thumbnailUrl: string) => {
        const request = ++previewRequestRef.current;
        setPreviewType("image");
        setPreviewKey(key);
        setPreviewUrl(thumbnailUrl);
        if (!resourceIdFromStorageKey(key)) return;
        try {
            const access = await getResourceAccess(key, "display", "original");
            if (previewRequestRef.current === request) setPreviewUrl(resolveResourceAccessURL(access.url));
        } catch {
            // 已打开的缩略图仍可查看；原图访问失败时保留当前预览。
        }
    };
    const closePreview = () => {
        previewRequestRef.current += 1;
        setPreviewKey("");
        setPreviewUrl("");
    };
    const fallbackRatio = creationAspectRatioValue(creationMediaAspectRatio(item.settings?.ratio, item.mode || "image"));
    const { entries: resultEntries, resolving } = creationResultEntries({ storageKeys: resultStorageKeys, storedUrls: storedResultUrls, resolvedByKey, failedByKey, isVideo, isRemoteKey: (storageKey) => Boolean(resourceIdFromStorageKey(storageKey)) });
    const alignedResultUrls = resultStorageKeys.length ? resultStorageKeys.map((storageKey) => resultEntries.find((entry) => entry.key === storageKey)?.url || "") : resultEntries.map((entry) => entry.url);
    const displayResultUrls = resultEntries.map((entry) => entry.url);
    const resultAssetIds = alignedResultUrls.length || resultStorageKeys.length ? creationResultAssetIds(assets, { messageId: item.id, taskIds: item.taskIds || [], resultUrls: alignedResultUrls, resultStorageKeys }) : [];
    const expectedResultCount = resultStorageKeys.length || alignedResultUrls.length;
    const canContinueWithResults = expectedResultCount > 0 && resultAssetIds.length === expectedResultCount;
    if (item.status === "pending" && (!expectedResultCount || item.mode === "image")) {
        const pending = <CreationMediaPending item={item} refreshing={refreshingResult} onRefresh={onRefreshResult} onRetry={onRetryFailure} />;
        if (item.mode === "image") {
            const count = Math.max(1, Math.min(10, Number(item.settings?.count) || 1), item.generationImages?.length || 0);
            return (
                <>
                    <div className="creation-media-result is-batch" style={{ "--creation-media-ratio": fallbackRatio, "--creation-image-width": `${creationImageLayout(fallbackRatio).width}px` } as CSSProperties}>
                        <div className="creation-image-result-grid creation-saving-previews">
                            {Array.from({ length: count }, (_, index) => {
                                const task = item.generationImages?.[index];
                                const slot = {
                                    ...item,
                                    settings: item.settings ? { ...item.settings, count: "1" } : undefined,
                                    taskIds: task ? [task.id] : [],
                                    generationStatus: task?.status,
                                    generationStage: task?.stage,
                                    generationMediaStage: task?.mediaStage,
                                    generationProgress: task?.progress,
                                };
                                const progress = <CreationMediaPending item={slot} refreshing={refreshingResult} onRefresh={onRefreshResult} onRetry={onRetryFailure} />;
                                const src = task?.previewUrl || item.generationPreviewUrls?.[index];
                                return (
                                    <div key={index} className="creation-saving-preview-slot">
                                        {src ? (
                                            <GenerationImagePreview
                                                src={src}
                                                alt={`生成图片 ${index + 1}`}
                                                onPreview={() => {
                                                    setPreviewType("image");
                                                    setPreviewUrl(src);
                                                }}
                                            >
                                                {progress}
                                            </GenerationImagePreview>
                                        ) : (
                                            progress
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <CreationMediaPreviewModal url={previewUrl} type="image" onClose={closePreview} />
                </>
            );
        }
        return item.mode !== "video" && item.generationPreviewUrls?.length ? (
            <div className="creation-saving-previews" style={{ "--creation-media-ratio": creationAspectRatioValue(creationMediaAspectRatio(item.settings?.ratio, "image")) } as CSSProperties}>
                {item.generationPreviewUrls.map((src) => (
                    <GenerationImagePreview key={src} src={src} alt="已生成的图片">
                        {pending}
                    </GenerationImagePreview>
                ))}
            </div>
        ) : (
            pending
        );
    }
    if ((item.status === "error" || item.status === "cancelled") && !expectedResultCount) return <CreationMediaFailure item={item} refreshing={refreshingResult} onRefresh={onRefreshResult} onRecoverMedia={onRecoverMedia} onRetry={onRetryFailure} />;
    // 远端结果首次解析中不显示空态，避免先闪「没有返回可预览结果」再出现结果。
    if (!expectedResultCount || (!displayResultUrls.length && !resolving))
        return (
            <CreationMediaNotice
                tone="neutral"
                icon={ImageOff}
                title={t("createWorkspace.result.emptyTitle")}
                description={item.taskIds?.length ? t("createWorkspace.result.emptyExpired") : t("createWorkspace.result.emptyNone")}
                actions={
                    item.taskIds?.length ? (
                        <>
                            <CreationNoticeButton primary icon={RefreshCw} busy={refreshingResult} busyLabel={t("createWorkspace.actions.fetching")} onClick={onRefreshResult}>
                                {t("createWorkspace.actions.refetch")}
                            </CreationNoticeButton>
                            <CreationNoticeButton icon={RotateCcw} onClick={onRetryFailure}>
                                {t("createWorkspace.actions.regenerate")}
                            </CreationNoticeButton>
                        </>
                    ) : (
                        <CreationNoticeButton primary icon={RotateCcw} onClick={onRetryFailure}>
                            {t("createWorkspace.actions.regenerate")}
                        </CreationNoticeButton>
                    )
                }
            />
        );
    const downloadEntry = (key: string, url: string, index: number) => {
        const storageKey = resultStorageKeys.includes(key) ? key : undefined;
        const resultIndex = resultStorageKeys.indexOf(key);
        const asset = assets.find((candidate) => candidate.id === resultAssetIds[resultIndex < 0 ? index : resultIndex]);
        const mimeType = asset && (asset.kind === "image" || asset.kind === "video") ? asset.data.mimeType : undefined;
        void downloadCreationResult(storageKey, url, index, isVideo, mimeType).catch((error) => message.error(error instanceof Error ? error.message : t("createWorkspace.result.downloadFailed")));
    };
    const firstSize = resultEntries.map((entry) => naturalSizes[entry.key]).find(Boolean);
    const settingPixels = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(item.settings?.ratio || "");
    const pixelWidth = settingPixels ? Number(settingPixels[1]) : firstSize?.width || 0;
    const pixelHeight = settingPixels ? Number(settingPixels[2]) : firstSize?.height || 0;
    const batchModel = batch && item.model ? pickerModelDisplayName(config, item.model) : "";
    const batchMeta = batch ? [batchModel, creationRatioLabel(item.settings?.ratio), isVideo ? (item.settings?.videoQuality ? `${item.settings.videoQuality}P` : "") : creationTierLabel(pixelWidth, pixelHeight)].filter(Boolean) : [];
    const videoKey = resultEntries[0]?.key || resultStorageKeys[0] || "video";
    const videoState = displayResultUrls[0] ? mediaStates[videoKey] || "loading" : "loading";
    // 远端地址还在解析的结果位先按同样尺寸占位，不让结果区塌成一行操作按钮。
    const pendingImageKeys = !isVideo && resolving ? resultStorageKeys.filter((storageKey) => !resultEntries.some((entry) => entry.key === storageKey)) : [];
    // 同一次生成有多张图时，预览里可用左右按钮或方向键循环切换。
    const previewIndex = previewType === "image" && previewUrl ? resultEntries.findIndex((entry) => entry.key === previewKey) : -1;
    const showPreviewEntry = (offset: number) => {
        const entry = resultEntries[(previewIndex + offset + resultEntries.length) % resultEntries.length];
        if (entry) void openImagePreview(entry.key, entry.url);
    };
    const previewNavigation: CanvasImagePreviewNavigation | undefined =
        previewIndex >= 0 && resultEntries.length > 1 ? { index: previewIndex, total: resultEntries.length, onPrevious: () => showPreviewEntry(-1), onNext: () => showPreviewEntry(1) } : undefined;
    return (
        <div className={`creation-media-result${batch ? " is-batch" : ""}`} style={batch && !isVideo ? ({ "--batch-columns": Math.min(4, Math.max(1, resultEntries.length + pendingImageKeys.length)) } as CSSProperties) : undefined}>
            {batch ? (
                <div className="creation-batch-meta">
                    <Tooltip title={batch.prompt.length > 24 ? batch.prompt : undefined} placement="top">
                        <strong>{batch.prompt || t("createWorkspace.batch.untitled")}</strong>
                    </Tooltip>
                    {batchMeta.map((value) => (
                        <span key={value}>{value}</span>
                    ))}
                    <CreationBatchDetails width={pixelWidth} height={pixelHeight} createdAt={item.createdAt} taskIds={item.taskIds || []} />
                </div>
            ) : null}
            {isVideo ? (
                <button
                    type="button"
                    className="creation-video-result"
                    data-media-state={videoState}
                    onClick={() => {
                        if (videoState === "error") return retryResultMedia(videoKey);
                        if (!displayResultUrls[0]) return;
                        setPreviewType("video");
                        setPreviewUrl(displayResultUrls[0]);
                    }}
                    aria-label={videoState === "error" ? t("createWorkspace.result.videoLoadFailedReload") : t("createWorkspace.result.previewVideoResult")}
                >
                    {displayResultUrls[0] ? (
                        <video key={`${videoKey}:${mediaAttempts[videoKey] || 0}`} muted preload="metadata" src={displayResultUrls[0]} onLoadedMetadata={() => markResultMedia(videoKey, "loaded")} onError={() => markResultMedia(videoKey, "error")} />
                    ) : null}
                    {videoState === "error" ? <CreationResultMediaError label={t("createWorkspace.result.videoLoadFailedRetry")} /> : null}
                    <span>
                        <Maximize2 />
                        {t("createWorkspace.result.previewVideo")}
                    </span>
                </button>
            ) : (
                <div className="creation-image-result-grid">
                    {resultEntries.map(({ key, url }, entryIndex) => (
                        <div
                            key={key}
                            role="button"
                            tabIndex={0}
                            className="creation-image-result"
                            onKeyDown={(event) => {
                                if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                                event.preventDefault();
                                if (mediaStates[key] === "error") return retryResultMedia(key);
                                if (mediaStates[key] === "loaded") void openImagePreview(key, url);
                            }}
                            draggable={Boolean(resultAssetIds[resultEntries.findIndex((entry) => entry.key === key)])}
                            onDragStart={(event) => {
                                const assetId = resultAssetIds[resultEntries.findIndex((entry) => entry.key === key)];
                                if (!assetId) {
                                    event.preventDefault();
                                    return;
                                }
                                event.dataTransfer.effectAllowed = "copy";
                                event.dataTransfer.setData(CREATION_IMAGE_ASSET_DND_TYPE, assetId);
                            }}
                            data-media-state={mediaStates[key] || "loading"}
                            style={creationResultTileStyle(naturalRatios[key] || creationResultAssetRatio(assets, key) || fallbackRatio)}
                            onClick={() => {
                                if (mediaStates[key] === "error") return retryResultMedia(key);
                                if (mediaStates[key] !== "loaded") return;
                                void openImagePreview(key, url);
                            }}
                            aria-label={mediaStates[key] === "error" ? t("createWorkspace.result.imageLoadFailedReload") : mediaStates[key] === "loaded" ? t("createWorkspace.result.previewImageResult") : t("createWorkspace.result.imageLoading")}
                            aria-busy={mediaStates[key] === "loaded" || mediaStates[key] === "error" ? undefined : true}
                        >
                            <img
                                key={`${key}:${mediaAttempts[key] || 0}`}
                                src={url}
                                alt={t("createWorkspace.result.imageAlt")}
                                draggable={mediaStates[key] === "loaded"}
                                onDragStart={(event) => {
                                    if (mediaStates[key] !== "loaded") {
                                        event.preventDefault();
                                        return;
                                    }
                                    event.dataTransfer.effectAllowed = "copy";
                                    event.dataTransfer.setData(CREATION_IMAGE_DRAG_TYPE, JSON.stringify({ messageId: item.id, resultKey: key }));
                                }}
                                decoding="async"
                                onLoad={(event) => {
                                    const { naturalWidth, naturalHeight } = event.currentTarget;
                                    if (naturalWidth > 0 && naturalHeight > 0) setNaturalRatios((current) => (current[key] === naturalWidth / naturalHeight ? current : { ...current, [key]: naturalWidth / naturalHeight }));
                                    // 结果墙显示的是缩略图，尺寸以素材记录为准；没有素材记录时才用加载到的像素。
                                    const assetSize = creationResultAssetSize(assets, key);
                                    const size = assetSize || { width: naturalWidth, height: naturalHeight };
                                    if (size.width > 0) setNaturalSizes((current) => (current[key]?.width === size.width && current[key]?.height === size.height ? current : { ...current, [key]: size }));
                                    markResultMedia(key, "loaded");
                                }}
                                onError={() => markResultMedia(key, "error")}
                            />
                            {mediaStates[key] === "error" ? <CreationResultMediaError label={t("createWorkspace.result.imageLoadFailedRetry")} /> : null}
                            {batch && mediaStates[key] === "loaded" ? (
                                <div className="creation-image-hover-actions" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
                                    <CreationDownloadHoverCard onDownload={() => downloadEntry(key, url, entryIndex)}>
                                        <button type="button" aria-label={t("createWorkspace.batch.downloadOriginal")} onClick={() => downloadEntry(key, url, entryIndex)}>
                                            <Download />
                                        </button>
                                    </CreationDownloadHoverCard>
                                    <button type="button" aria-label={t("createWorkspace.batch.useAsReference")} title={t("createWorkspace.batch.useAsReference")} onClick={() => batch.onUseAsReference(key, url)}>
                                        <ImagePlus />
                                    </button>
                                </div>
                            ) : (
                                <span>
                                    <Maximize2 />
                                </span>
                            )}
                        </div>
                    ))}
                    {pendingImageKeys.map((storageKey) => (
                        <i key={`pending:${storageKey}`} className="creation-image-result" data-media-state="loading" style={creationResultTileStyle(creationResultAssetRatio(assets, storageKey) || fallbackRatio)} aria-hidden="true" />
                    ))}
                </div>
            )}
            {batch ? (
                <div className="creation-batch-actions">
                    <button type="button" onClick={batch.onEditAgain}>
                        <SquarePen />
                        {t("createWorkspace.actions.editAgain")}
                    </button>
                    <button type="button" onClick={batch.onRegenerate}>
                        <RefreshCw />
                        {t("createWorkspace.batch.regenerate")}
                    </button>
                    <Dropdown
                        trigger={["click"]}
                        placement="bottomLeft"
                        rootClassName="creation-batch-menu"
                        menu={{
                            items: [
                                { key: "canvas", icon: <Blocks />, label: t("createWorkspace.result.addToCanvas"), disabled: !canContinueWithResults || openingCanvas },
                                { key: "download", icon: <Download />, label: isVideo ? t("createWorkspace.batch.downloadVideo") : t("createWorkspace.batch.downloadAll", { count: resultEntries.length }) },
                                { type: "divider" },
                                { key: "delete", icon: <Trash2 />, label: t("createWorkspace.batch.delete"), danger: true },
                            ],
                            onClick: ({ key }) => {
                                if (key === "canvas") onContinueCanvas(resultAssetIds);
                                else if (key === "download") resultEntries.forEach(({ key: entryKey, url }, index) => downloadEntry(entryKey, url, index));
                                else setDeleteOpen(true);
                            },
                        }}
                    >
                        <button type="button" className="creation-batch-more" aria-label={t("createWorkspace.batch.more")}>
                            <Ellipsis />
                        </button>
                    </Dropdown>
                    <MeiyeConfirmDialog
                        open={deleteOpen}
                        title={t("createWorkspace.batch.deleteTitle")}
                        description={isVideo ? t("createWorkspace.batch.deleteVideos", { count: expectedResultCount }) : t("createWorkspace.batch.deleteImages", { count: expectedResultCount })}
                        details={[t("createWorkspace.batch.deleteIrreversible"), t("createWorkspace.batch.deleteKeepsShared")]}
                        confirmText={t("createWorkspace.batch.deleteConfirm")}
                        onConfirm={() => batch.onDelete(resultAssetIds)}
                        onClose={() => setDeleteOpen(false)}
                    />
                </div>
            ) : (
                <div className="creation-media-actions">
                    <span>{isVideo ? t("createWorkspace.result.videoResult") : t("createWorkspace.result.imageCount", { count: displayResultUrls.length })}</span>
                    <Button type="link" size="small" loading={openingCanvas} disabled={!canContinueWithResults} title={canContinueWithResults ? undefined : t("createWorkspace.result.canvasNeedsSaved")} onClick={() => onContinueCanvas(resultAssetIds)}>
                        {t("createWorkspace.result.addToCanvas")}
                    </Button>
                    {resultEntries.map(({ key, url }, index) => (
                        <button
                            type="button"
                            key={`download-${key}`}
                            onClick={() => {
                                const storageKey = resultStorageKeys.includes(key) ? key : undefined;
                                const resultIndex = resultStorageKeys.indexOf(key);
                                const asset = assets.find((candidate) => candidate.id === resultAssetIds[resultIndex < 0 ? index : resultIndex]);
                                const mimeType = asset && (asset.kind === "image" || asset.kind === "video") ? asset.data.mimeType : undefined;
                                void downloadCreationResult(storageKey, url, index, isVideo, mimeType).catch((error) => message.error(error instanceof Error ? error.message : t("createWorkspace.result.downloadFailed")));
                            }}
                        >
                            {displayResultUrls.length > 1 ? (
                                t("createWorkspace.result.downloadIndex", { index: index + 1 })
                            ) : (
                                <>
                                    <Download />
                                    {t("createWorkspace.result.download")}
                                </>
                            )}
                        </button>
                    ))}
                </div>
            )}
            <CreationMediaPreviewModal url={previewUrl} type={previewType} previewSrc={previewIndex >= 0 ? resultEntries[previewIndex]?.url : undefined} navigation={previewNavigation} onClose={closePreview} />
        </div>
    );
}

export type CreationBatchActions = {
    /** 这批结果对应的提示词，显示在结果上方。 */
    prompt: string;
    onEditAgain: () => void;
    onRegenerate: () => void;
    /** 删除这批结果及其素材；失败时抛错，确认弹窗保留供重试。 */
    onDelete: (assetIds: string[]) => Promise<void>;
    onUseAsReference: (storageKey: string, url: string) => void;
};

/** 悬浮下载按钮时的说明卡：造幕 原图不加平台水印。 */
function CreationDownloadHoverCard({ children, onDownload }: { children: ReactNode; onDownload: () => void }) {
    const brandName = useAppearanceStore((state) => state.appearance.brandName) || "造幕";
    const { t } = useTranslation();
    return (
        <Popover
            trigger="hover"
            placement="bottom"
            arrow={false}
            mouseEnterDelay={0.25}
            rootClassName="creation-download-card-popover"
            content={
                <div className="creation-download-card">
                    <div className="creation-download-card-art" aria-hidden="true">
                        <i />
                        <i />
                        <i />
                        <span className="creation-download-card-brand">
                            <img src="/zaomu-logo.png" alt="" />
                            {brandName}
                        </span>
                    </div>
                    <strong>{t("createWorkspace.download.title")}</strong>
                    <p>{t("createWorkspace.download.description", { brand: brandName })}</p>
                    <button type="button" onClick={onDownload}>
                        <Download />
                        {t("createWorkspace.download.action")}
                    </button>
                </div>
            }
        >
            {children}
        </Popover>
    );
}

/**
 * 生成中卡片：按最终画面比例占位，标题跟随真实任务阶段（排队 / 生成 / 保存 / 载入），
 * 底部三段进度与耗时；页面与任务连接中断时给出“立即刷新”，不把等待中断说成失败。
 */
export function CreationMediaPending({ item, refreshing, onRefresh, onRetry }: { item: CreationMessage; refreshing: boolean; onRefresh: () => void; onRetry: () => void }) {
    const mode: CreationMode = item.mode || "image";
    const kind = mode === "video" ? "video" : "image";
    const phase: GenerationPhase = item.taskIds?.length ? generationTaskPhase({ status: item.generationStatus || "running", stage: item.generationStage, mediaStage: item.generationMediaStage }) : "submitting";
    const uncertain = phase === "uncertain";
    const progress =
        item.taskIds?.length &&
        typeof item.generationProgress === "number" &&
        generationTaskShowsProgress({ status: item.generationStatus || "running", stage: item.generationStage, mediaStage: item.generationMediaStage, progress: item.generationProgress })
            ? item.generationProgress
            : null;
    const elapsed = useTaskElapsed(item.createdAt);
    const { t } = useTranslation();
    const hint = mode === "image" && phase === "saving" ? undefined : generationPhaseHint(phase, kind, item.generationStage);
    const aspectRatio = creationMediaAspectRatio(item.settings?.ratio, mode);
    const specs = creationPendingSpecs(item);
    const Icon = mode === "video" ? Film : ImageIcon;
    return (
        <div
            className={`creation-media-pending is-${mode}`}
            data-phase={phase}
            data-saving={phase === "saving" ? generationTaskSavingState(item.generationStage) : undefined}
            data-sync={item.syncInterrupted ? "interrupted" : undefined}
            style={{ aspectRatio, "--creation-media-ratio": creationAspectRatioValue(aspectRatio) } as CSSProperties}
        >
            <span className="creation-media-pending-surface" aria-hidden="true" />
            {specs ? (
                <span className="creation-media-pending-spec">
                    <Icon aria-hidden="true" />
                    {specs}
                </span>
            ) : null}
            <span className="creation-media-pending-body">
                <span className="creation-media-pending-title" role="status">
                    {mode === "image" && phase === "saving" ? "正在载入图片" : generationPhaseLabel(phase, kind, item.generationStage)}
                </span>
                <span className="creation-media-pending-meta">{[progress !== null ? `${progress}%` : "", item.createdAt ? t("createWorkspace.pending.elapsed", { elapsed }) : ""].filter(Boolean).join(" · ")}</span>
                {hint ? <span className="creation-media-pending-hint">{hint}</span> : null}
            </span>
            <span className="creation-media-pending-foot">
                {item.syncInterrupted ? (
                    <CreationSyncNotice refreshing={refreshing} onRefresh={onRefresh} onRetry={onRetry} />
                ) : uncertain ? null : (
                    <GenerationPhaseSteps step={generationPhaseStep(phase)} progress={progress} labels={mode === "image" ? ["排队", "生成", "完成"] : undefined} />
                )}
            </span>
        </div>
    );
}

function creationAspectRatioValue(aspectRatio: string) {
    const [width, height] = aspectRatio.split("/").map((value) => Number(value.trim()));
    return width > 0 && height > 0 ? width / height : 1;
}

export function creationResultAssetSize(assets: Asset[], storageKey: string) {
    const asset = assets.find((candidate): candidate is ImageAsset | VideoAsset => (candidate.kind === "image" || candidate.kind === "video") && candidate.data.storageKey === storageKey);
    return asset && asset.data.width > 0 && asset.data.height > 0 ? { width: asset.data.width, height: asset.data.height } : undefined;
}

const COMMON_RATIOS: Array<[string, number]> = [
    ["1:1", 1],
    ["4:5", 0.8],
    ["3:4", 0.75],
    ["2:3", 2 / 3],
    ["9:16", 9 / 16],
    ["5:4", 1.25],
    ["4:3", 4 / 3],
    ["3:2", 1.5],
    ["16:9", 16 / 9],
    ["21:9", 21 / 9],
    ["1:2", 0.5],
    ["2:1", 2],
];

/** 用户选择的画面比例：像素写法（1024x1824）换算成 9:16 这类常用比例。 */
export function creationRatioLabel(value?: string) {
    const trimmed = (value || "").trim();
    const pixels = /^(\d+)\s*[x×*]\s*(\d+)$/i.exec(trimmed);
    if (!pixels) return trimmed && trimmed !== "auto" ? trimmed : translate("createWorkspace.batch.smartRatio");
    const ratio = Number(pixels[1]) / Number(pixels[2]);
    return COMMON_RATIOS.find(([, expected]) => Math.abs(ratio / expected - 1) < 0.035)?.[0] || `${pixels[1]}×${pixels[2]}`;
}

/** 按长边判断清晰度档位：1K≈1024–1824，2K≈2048–2752，4K≈3264–3840。 */
export function creationTierLabel(width: number, height: number) {
    const long = Math.max(width, height);
    if (!long) return "";
    return long >= 3000 ? "4K" : long >= 2000 ? "2K" : "1K";
}

/** 「详细信息」悬浮卡：尺寸、生成时间、消耗积分（打开时才读取任务计费）。 */
function CreationBatchDetails({ width, height, createdAt, taskIds }: { width: number; height: number; createdAt?: string; taskIds: string[] }) {
    const creditsEnabled = useUserStore((state) => state.features.creditsEnabled);
    const [credits, setCredits] = useState<number | null | undefined>(undefined);
    const { t } = useTranslation();
    const loadCredits = () => {
        if (!creditsEnabled || credits !== undefined || !taskIds.length) return;
        setCredits(null);
        void Promise.all(taskIds.map((id) => queryGenerationTask(id).catch(() => null))).then((tasks) => {
            const amounts = tasks.map((task) => task?.billing?.amountMicrocredits).filter((value): value is number => typeof value === "number");
            setCredits(amounts.length ? amounts.reduce((sum, value) => sum + value, 0) / 1_000_000 : NaN);
        });
    };
    const time = createdAt ? new Date(createdAt) : null;
    const timeLabel = time && Number.isFinite(time.getTime()) ? time.toLocaleString(currentLocale(), { hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).replaceAll("/", "-") : "—";
    const rows: Array<[string, string]> = [
        [t("createWorkspace.details.size"), width && height ? `${width} × ${height}` : "—"],
        [t("createWorkspace.details.createdAt"), timeLabel],
        ...(creditsEnabled
            ? [
                  [t("createWorkspace.details.credits"), credits === undefined || credits === null ? t("createWorkspace.details.loading") : Number.isNaN(credits) ? "—" : credits.toLocaleString(currentLocale(), { maximumFractionDigits: 2 })] as [
                      string,
                      string,
                  ],
              ]
            : []),
    ];
    return (
        <Popover
            trigger="hover"
            placement="bottomLeft"
            arrow={false}
            mouseEnterDelay={0.15}
            rootClassName="creation-batch-details-popover"
            onOpenChange={(open) => {
                if (open) loadCredits();
            }}
            content={
                <dl className="creation-batch-details">
                    {rows.map(([label, value]) => (
                        <div key={label}>
                            <dt>{label}</dt>
                            <dd>{value}</dd>
                        </div>
                    ))}
                </dl>
            }
        >
            <button type="button" className="creation-batch-details-trigger" onFocus={loadCredits}>
                {t("createWorkspace.details.trigger")}
                <Info aria-hidden="true" />
            </button>
        </Popover>
    );
}

export function creationResultAssetRatio(assets: Asset[], storageKey: string) {
    const asset = assets.find((candidate): candidate is ImageAsset | VideoAsset => (candidate.kind === "image" || candidate.kind === "video") && candidate.data.storageKey === storageKey);
    return asset && asset.data.width > 0 && asset.data.height > 0 ? asset.data.width / asset.data.height : undefined;
}

// 结果图块按真实比例预留宽高：已知素材尺寸优先，其次生成时选的画面比例；竖图按最大高度收窄宽度。
function creationResultTileStyle(ratio: number): CSSProperties {
    const layout = creationImageLayout(ratio);
    return { aspectRatio: String(layout.ratio), "--creation-result-ratio": layout.ratio, "--creation-image-width": `${layout.width}px` } as CSSProperties;
}

function CreationResultMediaError({ label }: { label: string }) {
    return (
        <em className="creation-result-media-error">
            <ImageOff aria-hidden="true" />
            {label}
        </em>
    );
}

function creationPendingSpecs(item: CreationMessage) {
    const settings = item.settings;
    if (!settings) return "";
    const ratio = settings.ratio && settings.ratio.toLowerCase() !== "auto" ? settings.ratio : "";
    if (item.mode === "video") return [ratio, settings.seconds ? translate("createWorkspace.pending.seconds", { seconds: settings.seconds }) : "", settings.videoQuality ? `${settings.videoQuality.replace(/p$/i, "")}P` : ""].filter(Boolean).join(" · ");
    const count = Number(settings.count) || 1;
    return [ratio, count > 1 ? translate("createWorkspace.pending.imageCount", { count }) : ""].filter(Boolean).join(" · ");
}

/**
 * 失败卡片按“下一步该做什么”分四类：
 * 作品可能已生成（页面没拿到结果）→ 重新获取；作品已生成但保存失败 → 重新保存；
 * 上游网关超时等费用不确定的失败 → 先核对再决定；后端确认失败 → 重新生成。
 */
function CreationMediaFailure({ item, refreshing, onRefresh, onRecoverMedia, onRetry }: { item: CreationMessage; refreshing: boolean; onRefresh: () => void; onRecoverMedia: () => void; onRetry: () => void }) {
    const { t } = useTranslation();
    // 没有错误信息时直接显示界面文案；生成错误原文仍交给 generationErrorMessage 归一化（中文下结果与原先一致）。
    const reason = item.error ? generationErrorMessage(item.error) : t("create.status.failed");
    if (item.status === "cancelled") {
        return (
            <CreationMediaNotice
                tone="neutral"
                icon={CircleStop}
                title={t("createWorkspace.failure.stoppedTitle")}
                description={item.content && item.content !== "已停止" ? item.content : t("createWorkspace.failure.stoppedHint")}
                actions={
                    <CreationNoticeButton icon={RotateCcw} onClick={onRetry}>
                        {t("createWorkspace.actions.regenerate")}
                    </CreationNoticeButton>
                }
            />
        );
    }
    if (creationMessageNeedsResultSync(item)) {
        return (
            <CreationMediaNotice
                tone="warning"
                icon={CloudOff}
                title={t("createWorkspace.failure.syncTitle")}
                description={t("createWorkspace.failure.syncDescription")}
                detail={reason ? t("createWorkspace.failure.reason", { reason }) : undefined}
                actions={
                    <>
                        <CreationNoticeButton primary icon={RefreshCw} busy={refreshing} busyLabel={t("createWorkspace.actions.fetching")} onClick={onRefresh}>
                            {t("createWorkspace.actions.refetch")}
                        </CreationNoticeButton>
                        <CreationNoticeButton icon={RotateCcw} onClick={onRetry}>
                            {t("createWorkspace.actions.regenerate")}
                        </CreationNoticeButton>
                    </>
                }
            />
        );
    }
    if (item.mediaRecoverable) {
        return (
            <CreationMediaNotice
                tone="warning"
                icon={AlertTriangle}
                title={t("createWorkspace.failure.saveTitle")}
                description={t("createWorkspace.failure.saveDescription")}
                detail={reason ? t("createWorkspace.failure.reason", { reason }) : undefined}
                actions={
                    <>
                        <CreationNoticeButton primary icon={RefreshCw} busy={refreshing} busyLabel={t("createWorkspace.actions.saving")} onClick={onRecoverMedia}>
                            {t("createWorkspace.actions.resave")}
                        </CreationNoticeButton>
                        <CreationNoticeButton icon={RotateCcw} onClick={onRetry}>
                            {t("createWorkspace.actions.regenerate")}
                        </CreationNoticeButton>
                    </>
                }
            />
        );
    }
    // 524 这类失败是同步请求被网关截断：上游可能仍在出图并计费，原任务也没有可回查的上游任务 ID。
    // 不能像普通失败一样把“重新生成”放在主按钮，否则一次超时会被点成两笔费用。
    if (isGenerationCostUncertainError(item.error)) {
        return (
            <CreationMediaNotice
                tone="warning"
                icon={AlertTriangle}
                title="上游超时，费用待核对"
                description="这次请求可能仍在上游执行并产生费用。使用平台积分时，冻结的积分会保留到核对完成后再结算或退回；重新生成会提交新任务并再次计费。"
                detail={reason ? `原因：${reason}` : undefined}
                actions={
                    <CreationNoticeButton icon={RotateCcw} onClick={onRetry}>
                        重新生成
                    </CreationNoticeButton>
                }
            />
        );
    }
    const started = Boolean(item.taskIds?.length);
    return (
        <CreationMediaNotice
            tone="error"
            icon={AlertCircle}
            title={started ? t("create.status.failed") : t("createWorkspace.failure.notStarted")}
            description={reason}
            actions={
                <CreationNoticeButton primary icon={RotateCcw} onClick={onRetry}>
                    {started ? t("createWorkspace.actions.regenerate") : t("createWorkspace.actions.editAgain")}
                </CreationNoticeButton>
            }
        />
    );
}

function CreationMediaNotice({ tone, icon: Icon, title, description, detail, actions }: { tone: "warning" | "error" | "neutral"; icon: LucideIcon; title: string; description: string; detail?: string; actions: ReactNode }) {
    return (
        <div className={`creation-media-notice is-${tone}`}>
            <span className="creation-media-notice-icon" aria-hidden="true">
                <Icon />
            </span>
            <div className="creation-media-notice-copy">
                <strong>{title}</strong>
                <p>{description}</p>
                {detail ? <small>{detail}</small> : null}
            </div>
            <div className="creation-media-notice-actions">{actions}</div>
        </div>
    );
}

function CreationNoticeButton({ primary = false, icon: Icon, busy = false, busyLabel, onClick, children }: { primary?: boolean; icon: LucideIcon; busy?: boolean; busyLabel?: string; onClick: () => void; children: ReactNode }) {
    return (
        <button type="button" className={primary ? "is-primary" : undefined} onClick={onClick} disabled={busy} aria-busy={busy || undefined}>
            <Icon aria-hidden="true" className={busy ? "animate-spin" : undefined} />
            {busy && busyLabel ? busyLabel : children}
        </button>
    );
}

export function CreationMessageReferences({ references }: { references: CreationReference[] }) {
    const { t } = useTranslation();
    return (
        <div className="creation-user-message-references" aria-label={t("createWorkspace.references.messageLabel")}>
            {references.map((reference) => {
                const Icon = reference.kind === "skill" ? Blocks : reference.kind === "image" ? ImageIcon : reference.kind === "video" ? Film : reference.kind === "audio" ? Music2 : FileText;
                const imageUrl = reference.kind === "image" ? resolveResourceUrl(reference.storageKey, reference.previewUrl) : reference.previewUrl;
                return (
                    <span key={reference.id} className="creation-user-message-reference">
                        {imageUrl && reference.kind === "video" ? (
                            <video src={imageUrl} muted playsInline preload="metadata" aria-label={reference.label} />
                        ) : imageUrl && reference.kind === "image" ? (
                            <CachedResourceImage storageKey={reference.storageKey} src={imageUrl} variant="thumbnail-small" alt="" loading="lazy" decoding="async" />
                        ) : (
                            <Icon />
                        )}
                        <span>{reference.label}</span>
                    </span>
                );
            })}
        </div>
    );
}

export function CreationMediaPreviewModal({ url, type, previewSrc, navigation, onClose }: { url: string; type: "image" | "video"; previewSrc?: string; navigation?: CanvasImagePreviewNavigation; onClose: () => void }) {
    const { t } = useTranslation();
    if (type === "image") return <CanvasImagePreview interactive src={url} previewSrc={previewSrc} alt={t("createWorkspace.preview.alt")} navigation={navigation} onClose={onClose} />;

    return (
        <AppModal flush open={Boolean(url)} title={null} footer={null} centered destroyOnHidden width="min(1160px, calc(100vw - 32px))" onCancel={onClose} className="creation-media-preview-modal">
            {url ? <video controls autoPlay className="creation-media-preview-video" src={url} /> : null}
        </AppModal>
    );
}

export function CreationAttachmentThumbnail({ item, onPreview, onRemove }: { item: CreationAttachment; onPreview: (type: "image" | "video", url: string) => void; onRemove: (id: string) => void }) {
    const { t } = useTranslation();
    const kind = creationAttachmentKind(item);
    const previewable = kind === "image" || kind === "video";
    const url = (kind === "video" ? item.url : item.previewUrl) || "";
    const imageUrl = kind === "image" ? resolveResourceUrl(item.storageKey, item.previewUrl) : "";
    const previewUrl = kind === "image" ? imageUrl : url;
    const size = "width" in item && "height" in item && item.width && item.height ? `${item.width}×${item.height}` : t("createWorkspace.attachments.sizeUnknown");
    const uploadStatus = resourceIdFromStorageKey(item.storageKey) ? t("createWorkspace.attachments.uploaded") : t("createWorkspace.attachments.waitingSync");
    const content =
        kind === "video" ? (
            <video src={item.url} poster={item.previewUrl !== item.url ? item.previewUrl : undefined} muted playsInline preload="metadata" aria-label={item.name} />
        ) : kind === "image" ? (
            <CachedResourceImage
                storageKey={item.storageKey}
                src={imageUrl}
                alt={item.name}
                loading="lazy"
                decoding="async"
                fallback={
                    <span className="creation-chat-file-icon">
                        <ImageIcon />
                    </span>
                }
            />
        ) : (
            <span className="creation-chat-file-icon">
                {kind === "audio" ? <Music2 /> : <FileText />}
                <em>{item.name}</em>
            </span>
        );
    return (
        <div className="creation-reference-card-content">
            {previewable ? (
                <button
                    type="button"
                    className="creation-reference-card-preview"
                    onClick={() => onPreview(kind === "video" ? "video" : "image", previewUrl)}
                    aria-label={t("createWorkspace.attachments.zoomPreview", { name: item.name })}
                    disabled={!previewUrl}
                >
                    {content}
                    <span aria-hidden="true">
                        <Maximize2 />
                    </span>
                </button>
            ) : (
                <div className="creation-reference-card-preview is-file" aria-label={item.name}>
                    {content}
                </div>
            )}
            {kind === "image" ? (
                <span className="creation-reference-card-metadata" title={`${item.name} · ${size} · ${uploadStatus}`}>
                    <strong>{item.name}</strong>
                    <small>
                        {size} · {uploadStatus}
                    </small>
                </span>
            ) : null}
            <button
                type="button"
                className="creation-reference-card-remove"
                onPointerDownCapture={(event) => event.stopPropagation()}
                onMouseDownCapture={(event) => event.stopPropagation()}
                onClick={(event) => {
                    event.stopPropagation();
                    onRemove(item.id);
                }}
                aria-label={t("createWorkspace.attachments.remove", { name: item.name })}
            >
                <X />
            </button>
        </div>
    );
}

export type CreationThinking = { title: string; hint: string; steps: string[]; activity: string };

export function thinkingFor(mode: CreationMode, brandName: string): CreationThinking {
    if (mode === "image")
        return {
            title: translate("createWorkspace.thinking.image.title"),
            hint: translate("createWorkspace.thinking.image.hint", { brand: brandName }),
            steps: [translate("createWorkspace.thinking.image.step1"), translate("createWorkspace.thinking.image.step2"), translate("createWorkspace.thinking.image.step3")],
            activity: translate("createWorkspace.thinking.image.activity"),
        };
    if (mode === "text")
        return {
            title: translate("createWorkspace.thinking.text.title"),
            hint: translate("createWorkspace.thinking.text.hint", { brand: brandName }),
            steps: [translate("createWorkspace.thinking.text.step1"), translate("createWorkspace.thinking.text.step2"), translate("createWorkspace.thinking.text.step3")],
            activity: translate("createWorkspace.thinking.text.activity"),
        };
    return {
        title: translate("createWorkspace.thinking.video.title"),
        hint: translate("createWorkspace.thinking.video.hint", { brand: brandName }),
        steps: [translate("createWorkspace.thinking.video.step1"), translate("createWorkspace.thinking.video.step2"), translate("createWorkspace.thinking.video.step3"), translate("createWorkspace.thinking.video.step4")],
        activity: translate("createWorkspace.thinking.video.activity"),
    };
}

export function formatMessageTime(value: string) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? conversationTimeFormatter.format(timestamp) : "";
}
