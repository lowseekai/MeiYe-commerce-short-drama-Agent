import { WechatFilled } from "@ant-design/icons";
import { App } from "antd";
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

import { AppModal } from "@/components/ui/product/app-modal";
import { getAuthSession, getAuthSettings, weChatLoginURL } from "@/services/api/auth";
import { completePhoneAuth, startPhoneAuth } from "@/services/api/phone-auth";
import { safeLoginNext } from "@/stores/use-login-dialog-store";
import { useUserStore } from "@/stores/use-user-store";
import { DEFAULT_LOGIN_TERMS } from "./login-policies";

type PhoneLoginCardProps = {
    next?: string;
    onSuccess?: () => void;
};

export function PhoneLoginCard({ next: nextPath, onSuccess }: PhoneLoginCardProps = {}) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { message } = App.useApp();
    const next = safeLoginNext(nextPath ?? params.get("next"));
    const user = useUserStore((state) => state.user);
    const hydrated = useUserStore((state) => state.hydrated);
    const id = useId();
    const [phone, setPhone] = useState("");
    const [phoneTouched, setPhoneTouched] = useState(false);
    const [code, setCode] = useState("");
    const [ticket, setTicket] = useState("");
    const [sending, setSending] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [remaining, setRemaining] = useState(0);
    const [settings, setSettings] = useState<Awaited<ReturnType<typeof getAuthSettings>> | null>(null);
    const [settingsFailed, setSettingsFailed] = useState(false);
    const [feedback, setFeedback] = useState("");
    const [agreementAccepted, setAgreementAccepted] = useState(false);
    const [consentAttempt, setConsentAttempt] = useState(0);
    const [policyOpen, setPolicyOpen] = useState<"terms" | "ai" | null>(null);
    const sendInFlight = useRef(false);
    const submitInFlight = useRef(false);
    const completed = useRef(false);
    const mounted = useRef(true);
    const currentPhone = useRef("");
    const consentRef = useRef<HTMLInputElement>(null);
    const phoneRef = useRef<HTMLInputElement>(null);
    const codeRef = useRef<HTMLInputElement>(null);
    const phoneValid = /^1[3-9]\d{9}$/.test(phone);
    const smsReady = settings?.phoneAuthAvailable === true;
    const wechatReady = settings?.wechatAvailable === true;
    const canSubmit = smsReady && phoneValid && Boolean(ticket) && /^\d{6}$/.test(code);

    const finishLogin = useCallback(() => {
        if (completed.current) return;
        completed.current = true;
        if (onSuccess) onSuccess();
        else navigate(next, { replace: true });
    }, [navigate, next, onSuccess]);

    useEffect(() => {
        if (hydrated && user) finishLogin();
    }, [hydrated, user, finishLogin]);

    useEffect(() => {
        mounted.current = true;
        let cancelled = false;
        void getAuthSettings().then((value) => {
            if (!cancelled) setSettings(value);
        }).catch(() => {
            if (!cancelled) setSettingsFailed(true);
        });
        return () => {
            cancelled = true;
            mounted.current = false;
        };
    }, []);

    useEffect(() => {
        const error = params.get("wechat_error");
        if (error) setFeedback({
            expired: "微信授权已失效，请重新扫码",
            unavailable: "微信授权服务暂不可用，请稍后重试",
            account: "微信账号登录受限，请联系管理员",
            failed: "微信授权失败，请重新扫码或联系管理员",
        }[error] ?? "微信授权失败，请重新扫码或联系管理员");
    }, [params]);

    useEffect(() => {
        if (!remaining) return;
        const timer = window.setTimeout(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
        return () => window.clearTimeout(timer);
    }, [remaining]);

    useEffect(() => {
        if (!consentAttempt) return;
        const timer = window.setTimeout(() => setConsentAttempt(0), 4000);
        return () => window.clearTimeout(timer);
    }, [consentAttempt]);

    const requireConsent = () => {
        if (agreementAccepted) return true;
        setConsentAttempt((value) => value + 1);
        consentRef.current?.focus({ preventScroll: true });
        return false;
    };

    const changePhone = (value: string) => {
        const digits = value.replace(/\D/g, "");
        const normalized = (digits.startsWith("86") && digits.length === 13 ? digits.slice(2) : digits).slice(0, 11);
        if (normalized === currentPhone.current) return;
        currentPhone.current = normalized;
        setPhone(normalized);
        setCode("");
        setTicket("");
        setRemaining(0);
        setFeedback("");
    };

    const checkPhone = () => {
        setPhoneTouched(true);
        if (!phoneValid) {
            phoneRef.current?.focus();
            return false;
        }
        return true;
    };

    const checkSMS = () => {
        if (smsReady) return true;
        setFeedback(settingsFailed ? "登录方式加载失败，请刷新页面后重试" : settings ? "短信登录暂不可用，请使用微信登录或稍后重试" : "正在加载登录方式，请稍候");
        return false;
    };

    const sendCode = async () => {
        if (!requireConsent() || sendInFlight.current || remaining > 0 || submitInFlight.current) return;
        if (!checkSMS() || !checkPhone()) return;
        const requestedPhone = phone;
        sendInFlight.current = true;
        setSending(true);
        setRemaining(60);
        setFeedback("");
        setCode("");
        setTicket("");
        try {
            const result = await startPhoneAuth(`+86${requestedPhone}`);
            if (!mounted.current || currentPhone.current !== requestedPhone) return;
            setTicket(result.ticket);
            setRemaining(result.retryAfter);
            message.success("验证码已发送，请查看手机短信");
            codeRef.current?.focus();
        } catch (error) {
            if (mounted.current && currentPhone.current === requestedPhone) {
                setRemaining(0);
                setFeedback(error instanceof Error ? error.message : "验证码发送失败，请稍后重试");
            }
        } finally {
            sendInFlight.current = false;
            if (mounted.current) setSending(false);
        }
    };

    const submit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!requireConsent() || submitInFlight.current) return;
        if (!checkSMS() || !checkPhone()) return;
        if (!ticket || !/^\d{6}$/.test(code)) {
            setFeedback(!ticket ? "请先获取短信验证码" : "请输入 6 位短信验证码");
            codeRef.current?.focus();
            return;
        }
        submitInFlight.current = true;
        setSubmitting(true);
        setFeedback("");
        try {
            await completePhoneAuth({ ticket, phone: `+86${phone}`, code });
            const { applyUserSession } = await import("@/lib/user-session");
            await applyUserSession(await getAuthSession());
            message.success("登录成功");
            finishLogin();
        } catch (error) {
            if (mounted.current) setFeedback(error instanceof Error ? error.message : "登录失败，请检查验证码");
        } finally {
            submitInFlight.current = false;
            if (mounted.current) setSubmitting(false);
        }
    };

    const loginWithWeChat = () => {
        if (!requireConsent() || submitting) return;
        if (!wechatReady) {
            setFeedback(settingsFailed ? "登录方式加载失败，请刷新页面后重试" : settings ? "微信登录暂不可用，请使用短信登录或稍后重试" : "正在加载登录方式，请稍候");
            return;
        }
        window.location.assign(weChatLoginURL(next));
    };

    const availability = settingsFailed ? "登录方式加载失败，请刷新页面重试。"
        : !settings ? "正在加载登录方式…"
        : !smsReady ? "短信登录暂不可用。"
        : settings.phoneRegistrationEnabled ? "未注册的手机号将自动创建账号。" : "仅支持已注册手机号登录。";
    const wechatStatus = !settings ? "正在加载微信登录方式" : !wechatReady ? "微信登录暂不可用。"
        : settings.wechatRegistrationEnabled ? "使用微信扫码登录，首次使用将创建账号。" : "使用微信扫码登录已绑定账号。";
    const agreementTitle = settings?.agreementTitle?.trim() || "造幕 用户服务协议";
    const agreementContent = settings?.agreementContent?.trim();
    const agreementParagraphs = agreementContent ? agreementContent.split(/\n\s*\n/) : DEFAULT_LOGIN_TERMS;

    return (
        <>
            <form className={`phone-auth-form${onSuccess ? " is-modal" : ""}`} onSubmit={(event) => void submit(event)} noValidate>
                <div className="phone-auth-number-row" data-invalid={phoneTouched && !phoneValid}>
                    <label className="phone-auth-country">
                        <span className="sr-only">国家或地区区号</span>
                        <select aria-label="国家或地区区号" defaultValue="+86" disabled={submitting}>
                            <option value="+86">+86</option>
                        </select>
                    </label>
                    <label className="phone-auth-input-wrap">
                        <span className="sr-only">手机号码</span>
                        <input ref={phoneRef} type="tel" inputMode="numeric" autoComplete="tel-national" aria-label="手机号码"
                            aria-invalid={phoneTouched && !phoneValid} aria-describedby={phoneTouched && !phoneValid ? `${id}-phone-error` : undefined}
                            value={phone} disabled={submitting}
                            onChange={(event) => changePhone(event.target.value)} onBlur={() => { if (phone) setPhoneTouched(true); }}
                            placeholder="请输入手机号" maxLength={15} required />
                    </label>
                </div>
                <div className="phone-auth-field-note">
                    {phoneTouched && !phoneValid ? <p id={`${id}-phone-error`} className="phone-auth-error" role="alert">请输入有效的中国大陆 11 位手机号</p> : null}
                </div>

                <div className="phone-auth-code-row">
                    <label className="phone-auth-input-wrap">
                        <span className="sr-only">验证码</span>
                        <input ref={codeRef} type="text" inputMode="numeric" autoComplete="one-time-code" aria-label="验证码"
                            value={code} disabled={submitting} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setFeedback(""); }}
                            placeholder="请输入验证码" maxLength={6} required />
                    </label>
                    <button type="button" className="phone-auth-send" onClick={() => void sendCode()} disabled={sending || remaining > 0 || submitting} aria-busy={sending}>
                        {sending ? "发送中…" : remaining > 0 ? `${remaining} 秒后重发` : "发送验证码"}
                    </button>
                </div>
                <div className="phone-auth-feedback-slot">
                    {feedback ? <p className="phone-auth-feedback phone-auth-error" role="alert">{feedback}</p> : null}
                </div>

                <button type="submit" className="phone-auth-submit" data-ready={canSubmit && agreementAccepted} disabled={submitting} aria-busy={submitting}>
                    {submitting ? "登录中…" : "登录"}
                </button>
                <p className="phone-auth-availability" role="status">{availability}</p>
                <div className="phone-auth-divider"><span>其他登录方式</span></div>
                <button type="button" className="phone-auth-wechat" disabled={submitting} onClick={loginWithWeChat}
                    aria-label="微信登录" title="微信登录" aria-describedby={`${id}-wechat-status`}>
                    <WechatFilled aria-hidden="true" />
                </button>
                <p id={`${id}-wechat-status`} className={wechatReady ? "sr-only" : "phone-auth-availability"} role="status">{wechatStatus}</p>

                <div className="phone-auth-consent" data-error={consentAttempt > 0}>
                    {consentAttempt > 0 ? <span id={`${id}-consent-tip`} className="phone-auth-consent-tip" role="alert">请先勾选同意后再进行登录</span> : null}
                    <input ref={consentRef} id={`${id}-consent`} type="checkbox" checked={agreementAccepted} disabled={submitting}
                        aria-label="已阅读并同意用户服务协议、隐私政策、AI功能使用须知"
                        aria-describedby={consentAttempt > 0 ? `${id}-consent-tip` : undefined}
                        onChange={(event) => { setAgreementAccepted(event.target.checked); setConsentAttempt(0); }} />
                    <span className="phone-auth-consent-links">
                        <label htmlFor={`${id}-consent`}>已阅读并同意</label>
                        <button type="button" onClick={() => setPolicyOpen("terms")}>用户服务协议</button>、
                        <a href="/privacy" target="_blank" rel="noopener noreferrer">隐私政策</a>、
                        <button type="button" onClick={() => setPolicyOpen("ai")}>AI功能使用须知</button>
                    </span>
                </div>
            </form>
            <AppModal className="phone-auth-policy-modal" title={policyOpen === "ai" ? "AI功能使用须知" : agreementTitle}
                open={policyOpen !== null} onCancel={() => setPolicyOpen(null)} footer={null} centered width={560}>
                <div className="phone-auth-policy-content">
                    {policyOpen === "ai" ? <>
                        <p>造幕 提供电商 Agent、画布助手以及图片、视频等 AI 创作功能。不同模型和功能的能力、使用限制及积分消耗，以创作时页面展示的信息为准。</p>
                        <p>请仅上传、使用您拥有合法权利或已获得授权的文字、图片、音视频和其他素材，避免提交不必要的个人隐私或敏感信息。</p>
                        <p>AI 生成内容可能存在不准确、不完整或与预期不一致的情况。发布、商用或用于重要决策前，请自行检查内容、事实和相关权利。</p>
                        <p>请遵守平台规则及适用法律，不得使用相关功能制作违法、侵权、欺诈或其他有害内容。对外发布生成内容时，请按适用要求进行 AI 内容标识。</p>
                    </> : <>
                        {agreementParagraphs.map((paragraph, index) => <p key={index} style={{ whiteSpace: "pre-line" }}>{paragraph}</p>)}
                        <p><a href="/privacy" target="_blank" rel="noopener noreferrer">查看隐私政策</a></p>
                    </>}
                </div>
            </AppModal>
        </>
    );
}
