import { App, Button, Divider, Input } from "antd";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { TurnstileWidget } from "@/components/auth/turnstile-widget";
import { getAuthSession, getAuthSettings, login, weChatLoginURL, type AuthSettings } from "@/services/api/auth";
import { safeLoginNext } from "@/stores/use-login-dialog-store";
import { useUserStore } from "@/stores/use-user-store";

type EmailLoginCardProps = {
    next?: string;
    onSuccess?: () => void;
};

/** 邮箱 + 密码登录。服务端 /auth/login 的账号字段同时接受用户名与邮箱。 */
export function EmailLoginCard({ next: nextPath, onSuccess }: EmailLoginCardProps = {}) {
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const { message } = App.useApp();
    const next = safeLoginNext(nextPath ?? params.get("next"));
    const user = useUserStore((state) => state.user);
    const hydrated = useUserStore((state) => state.hydrated);

    const [settings, setSettings] = useState<AuthSettings | null>(null);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
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
    const turnstileOn = settings?.turnstileEnabled === true && Boolean(settings?.turnstileSiteKey);

    const submit = async (event: FormEvent) => {
        event.preventDefault();
        if (submitting) return;
        setFeedback("");
        if (!email.trim()) {
            setFeedback("请填写邮箱");
            return;
        }
        if (!password) {
            setFeedback("请填写密码");
            return;
        }
        if (turnstileOn && !turnstileToken) {
            setFeedback("请先完成人机验证");
            return;
        }
        setSubmitting(true);
        try {
            await login({ username: email.trim(), password, turnstileToken: turnstileToken || undefined });
            const { applyUserSession } = await import("@/lib/user-session");
            await applyUserSession(await getAuthSession());
            message.success("登录成功");
            if (onSuccess) onSuccess();
            else navigate(next, { replace: true });
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
        <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
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

            <div className="space-y-2">
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
                <p className="text-center text-xs text-foreground/60">
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
