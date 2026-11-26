import { App, Button, Divider, Input, Segmented } from "antd";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { VerificationFields } from "@/components/auth/verification-fields";
import { getAuthSession, getAuthSettings, login, weChatLoginURL, type AuthSettings } from "@/services/api/auth";
import { emptyVerification, loginVerification, verificationMethods } from "@/services/api/verification";
import { safeLoginNext } from "@/stores/use-login-dialog-store";
import { useUserStore } from "@/stores/use-user-store";

type EmailLoginCardProps = {
    next?: string;
    onSuccess?: () => void;
};

type LoginMode = "password" | "email";

/** 邮箱登录：密码登录 + 邮箱验证码登录（验证码方式由后台「登录与注册 → 邮箱验证码登录」控制）。 */
export function EmailLoginCard({ next: nextPath, onSuccess }: EmailLoginCardProps = {}) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { message } = App.useApp();
    const next = safeLoginNext(nextPath ?? params.get("next"));
    const user = useUserStore((state) => state.user);
    const hydrated = useUserStore((state) => state.hydrated);

    const [settings, setSettings] = useState<AuthSettings | null>(null);
    const [mode, setMode] = useState<LoginMode>("password");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [verification, setVerification] = useState({ ...emptyVerification });
    const [turnstileToken, setTurnstileToken] = useState("");
    const [turnstileKey, setTurnstileKey] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [feedback, setFeedback] = useState("");

    useEffect(() => {
        let cancelled = false;
        void getAuthSettings()
            .then((value) => {
                if (!cancelled) setSettings(value);
            })
            .catch(() => {
                if (!cancelled) setFeedback("登录配置读取失败，请刷新页面重试");
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (!hydrated || !user) return;
        if (onSuccess) onSuccess();
        else navigate(next, { replace: true });
    }, [hydrated, user, navigate, next, onSuccess]);

    const emailReady = settings?.emailEnabled === true;
    const loginMethods = settings ? verificationMethods(settings, "login") : [];
    const codeLoginAvailable = loginMethods.includes("email");
    const activeMode: LoginMode = mode === "email" && codeLoginAvailable ? "email" : "password";
    const turnstileOn = settings?.turnstileEnabled === true && Boolean(settings?.turnstileSiteKey);

    const finish = async () => {
        const { applyUserSession } = await import("@/lib/user-session");
        await applyUserSession(await getAuthSession());
        message.success("登录成功");
        if (onSuccess) onSuccess();
        else navigate(next, { replace: true });
    };

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (submitting) return;
        setFeedback("");
        if (turnstileOn && !turnstileToken) {
            setFeedback("请先完成人机验证");
            return;
        }
        setSubmitting(true);
        try {
            if (activeMode === "email") {
                if (!verification.email.trim()) throw new Error("请填写邮箱");
                if (!verification.ticket) throw new Error("请先获取本次登录验证码");
                await loginVerification({ ...verification, turnstileToken: turnstileToken || undefined });
            } else {
                if (!email.trim()) throw new Error("请填写邮箱");
                if (!password) throw new Error("请填写密码");
                await login({ username: email.trim(), password, turnstileToken: turnstileToken || undefined });
            }
            await finish();
        } catch (error) {
            setFeedback(error instanceof Error ? error.message : "登录失败，请重试");
            if (turnstileOn) setTurnstileKey((value) => value + 1);
        } finally {
            setSubmitting(false);
        }
    };

    const registerURL = `/register?next=${encodeURIComponent(next)}`;
    const forgotURL = `/forgot-password?next=${encodeURIComponent(next)}`;

    return (
        <form onSubmit={submit} className="flex flex-col gap-4">
            {codeLoginAvailable ? (
                <Segmented
                    block
                    aria-label="登录方式"
                    value={activeMode}
                    disabled={submitting}
                    options={[
                        { value: "password", label: "密码登录" },
                        { value: "email", label: "邮箱验证码" },
                    ]}
                    onChange={(value) => {
                        setMode(value as LoginMode);
                        setFeedback("");
                        setVerification({ ...emptyVerification });
                    }}
                />
            ) : null}

            {activeMode === "email" ? (
                <VerificationFields
                    key="email-login"
                    purpose="login"
                    method="email"
                    value={verification}
                    onChange={setVerification}
                    disabled={submitting}
                />
            ) : (
                <>
                    <div className="flex flex-col gap-2">
                        <label htmlFor="email-login-account" className="auth-scene-label text-xs font-medium">
                            邮箱
                        </label>
                        <Input
                            id="email-login-account"
                            size="large"
                            type="email"
                            prefix={<Mail className="auth-scene-icon size-4" />}
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="请输入邮箱"
                            autoComplete="email"
                            disabled={submitting}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <div className="flex items-center justify-between gap-3">
                            <label htmlFor="email-login-password" className="auth-scene-label text-xs font-medium">
                                密码
                            </label>
                            {emailReady ? (
                                <Link to={forgotURL} className="auth-scene-link -my-2 inline-flex min-h-8 items-center rounded-sm text-xs font-medium transition-colors">
                                    忘记密码？
                                </Link>
                            ) : null}
                        </div>
                        <Input.Password
                            id="email-login-password"
                            size="large"
                            prefix={<LockKeyhole className="auth-scene-icon size-4" />}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="请输入密码"
                            autoComplete="current-password"
                            disabled={submitting}
                        />
                    </div>
                </>
            )}

            {turnstileOn ? <TurnstileWidget siteKey={settings?.turnstileSiteKey || ""} onToken={setTurnstileToken} resetKey={turnstileKey} /> : null}

            {feedback ? (
                <div role="status" className="text-xs leading-5 text-red-500">
                    {feedback}
                </div>
            ) : null}

            <Button type="primary" htmlType="submit" size="large" block loading={submitting} icon={<ArrowRight className="size-4" />} iconPlacement="end">
                登录
            </Button>

            {settings?.registrationEnabled ? (
                <p className="m-0 text-center text-xs text-foreground/60">
                    还没有账号？
                    <Link to={registerURL} className="auth-scene-link ml-1 font-medium">
                        立即注册
                    </Link>
                </p>
            ) : null}

            {settings?.wechatAvailable ? (
                <>
                    <Divider plain className="auth-scene-divider">
                        其他登录方式
                    </Divider>
                    <Button size="large" block href={weChatLoginURL(next)}>
                        微信登录
                    </Button>
                </>
            ) : null}
        </form>
    );
}
