import { ChevronLeft, ChevronRight, Pause, Play } from "lucide-react";
import { useEffect, useState } from "react";

export const LOGIN_SLIDES = [
    { id: "ecommerce", title: "电商 Agent，让好产品被看见", description: "从商品图到整套视觉，主图、详情页与品牌风格一气呵成。", alt: "光影中的香水与护肤品创意广告" },
    { id: "canvas", title: "画布助手，让灵感自由生长", description: "在无限画布上连接想法，与 AI 一起把构思变成作品。", alt: "自然与未来建筑相融的创意空间" },
    { id: "video", title: "AI 视频，让每一帧都有故事", description: "从一句描述、一张参考，到有情绪、有镜头感的动态画面。", alt: "电影感运动人物与辽阔自然场景" },
    { id: "product", title: "商品视觉，把细节变成吸引力", description: "探索场景、光影与构图，创造属于你的产品表达。", alt: "球鞋与创意场景组成的商业摄影" },
    { id: "inspiration", title: "灵感创作，让想象不设边界", description: "捕捉每一个大胆念头，让还未出现的世界先被看见。", alt: "鲸鱼游弋于云海的幻想世界" },
] as const;

const SLIDE_DURATION = 7000;

export function LoginShowcase({ active }: { active: boolean }) {
    const [reducedMotion, setReducedMotion] = useState(false);
    const [index, setIndex] = useState(0);
    const [requestedIndex, setRequestedIndex] = useState(0);
    const [readySlides, setReadySlides] = useState<Set<number>>(() => new Set());
    const [paused, setPaused] = useState(false);
    const [hidden, setHidden] = useState(false);
    const playing = active && !paused && !hidden && !reducedMotion;
    const currentReady = readySlides.has(index);
    const waitingForImage = requestedIndex !== index;

    useEffect(() => {
        const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onPreference = () => setReducedMotion(preference.matches);
        onPreference();
        preference.addEventListener("change", onPreference);
        return () => preference.removeEventListener("change", onPreference);
    }, []);

    useEffect(() => {
        const onVisibility = () => setHidden(document.visibilityState !== "visible");
        onVisibility();
        document.addEventListener("visibilitychange", onVisibility);
        return () => document.removeEventListener("visibilitychange", onVisibility);
    }, []);

    useEffect(() => {
        if (active && !hidden && readySlides.has(requestedIndex)) setIndex(requestedIndex);
    }, [active, hidden, readySlides, requestedIndex]);

    useEffect(() => {
        if (!playing || !currentReady || waitingForImage) return;
        const timer = window.setTimeout(() => setRequestedIndex((index + 1) % LOGIN_SLIDES.length), SLIDE_DURATION);
        return () => window.clearTimeout(timer);
    }, [index, playing, currentReady, waitingForImage]);

    const select = (value: number) => setRequestedIndex((value + LOGIN_SLIDES.length) % LOGIN_SLIDES.length);
    const prepareImage = async (image: HTMLImageElement, itemIndex: number) => {
        // Keep the current picture visible until its replacement is decoded.
        if (image.decode) await image.decode().catch(() => undefined);
        if (!image.isConnected) return;
        setReadySlides((ready) => ready.has(itemIndex) ? ready : new Set([...ready, itemIndex]));
    };

    return (
        <section className="meiye-login-showcase" aria-label="造幕 创作能力展示" aria-roledescription="轮播">
            {LOGIN_SLIDES.map((slide, itemIndex) => (
                <div key={slide.id} className={`meiye-login-media${itemIndex === index ? " is-active" : ""}`} aria-hidden={itemIndex !== index}>
                    <img src={`/login-showcase/${slide.id}.webp`} alt={slide.alt} width="1024" height="1024" loading="eager" decoding="async" fetchPriority={itemIndex === 0 ? "high" : "auto"} onLoad={(event) => void prepareImage(event.currentTarget, itemIndex)} />
                </div>
            ))}
            <div className="meiye-login-media-shade" />
            <div className="meiye-login-showcase-arrows">
                <button type="button" onClick={() => select(requestedIndex - 1)} aria-label="上一张"><ChevronLeft size={22} /></button>
                <button type="button" onClick={() => select(requestedIndex + 1)} aria-label="下一张"><ChevronRight size={22} /></button>
            </div>
            <div className="meiye-login-caption">
                <div className="meiye-login-caption-stack" aria-live={playing ? "off" : "polite"}>
                    {LOGIN_SLIDES.map((slide, itemIndex) => (
                        <div key={slide.id} className={`meiye-login-caption-item${itemIndex === index ? " is-active" : ""}`} aria-hidden={itemIndex !== index}>
                            <h3>{slide.title}</h3>
                            <p>{slide.description}</p>
                        </div>
                    ))}
                </div>
                <div className="meiye-login-playback">
                    <div className="meiye-login-dots" aria-label="选择展示内容">
                        {LOGIN_SLIDES.map((item, itemIndex) => <button key={item.id} type="button" className={itemIndex === index ? "is-active" : ""} aria-label={`第 ${itemIndex + 1} 张：${item.title}`} aria-pressed={itemIndex === index} onClick={() => select(itemIndex)}><span /></button>)}
                    </div>
                    {!reducedMotion ? <button type="button" className="meiye-login-pause" onClick={() => setPaused((value) => !value)} aria-label={paused ? "播放轮播" : "暂停轮播"}>{paused ? <Play size={13} /> : <Pause size={13} />}</button> : null}
                </div>
            </div>
        </section>
    );
}
