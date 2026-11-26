import { useEffect } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router";
import { X } from "lucide-react";

import { BrandLogo } from "@/components/brand/brand-logo";
import { AppModal } from "@/components/ui/product/app-modal";
import { useAppearanceStore } from "@/stores/use-appearance-store";
import { useThemeStore } from "@/stores/use-theme-store";
import { safeLoginNext, useLoginDialogStore } from "@/stores/use-login-dialog-store";
import { useUserStore } from "@/stores/use-user-store";
import { EmailLoginCard } from "./email-login-card";
import { LoginShowcase } from "./login-showcase";
import "./login-dialog.css";

export function LoginDialog({ open, onClose, next = "/" }: { open: boolean; onClose: () => void; next?: string }) {
    const theme = useThemeStore((state) => state.theme);
    const brandName = useAppearanceStore((state) => state.appearance.brandName) || "造幕";
    const navigate = useNavigate();
    const location = useLocation();
    const onSuccess = () => {
        onClose();
        const destination = safeLoginNext(next);
        if (destination !== location.pathname + location.search) navigate(destination, { replace: true });
    };

    return (
        <AppModal flush open={open} onCancel={onClose} centered footer={null} closable={false} width="min(1000px, calc(100vw - 40px))" className="meiye-login-modal" rootClassName="meiye-login-overlay" title={<span className="sr-only">欢迎登录{brandName}</span>}>
            <div className="meiye-login-dialog" data-theme={theme}>
                <LoginShowcase active={open} />
                <section className="meiye-login-panel" aria-label={`登录 ${brandName}`}>
                    <button type="button" className="meiye-login-close" aria-label="关闭登录弹窗" onClick={onClose}><X size={21} /></button>
                    <div className="meiye-login-brand">
                        <BrandLogo theme={theme} className="meiye-login-logo" alt="" fallback={<img src="/zaomu-logo.png" alt="" />} />
                        <span>{brandName}</span>
                    </div>
                    <h2>欢迎登录{brandName}</h2>
                    <EmailLoginCard next={next} onSuccess={onSuccess} />
                </section>
            </div>
        </AppModal>
    );
}

export function LoginDialogHost() {
    const { open, next, show, close } = useLoginDialogStore();
    const [params] = useSearchParams();
    const user = useUserStore((state) => state.user);
    const requested = params.get("login") === "1";
    const requestedNext = params.get("next");
    useEffect(() => {
        if (requested && !user) show(safeLoginNext(requestedNext));
    }, [requested, requestedNext, show, user]);
    const dismiss = () => {
        close();
        if (requested) {
            const remaining = new URLSearchParams(params);
            for (const name of ["login", "next", "wechat_error", "oauth_error"]) remaining.delete(name);
            setParams(remaining, { replace: true });
        }
    };
    useEffect(() => { if (user) close(); }, [user, close]);
    return <LoginDialog open={open && !user} onClose={dismiss} next={next} />;
}
