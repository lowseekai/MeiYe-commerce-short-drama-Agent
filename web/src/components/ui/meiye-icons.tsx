import type { ReactNode, SVGProps } from "react";

/**
 * 造幕 统一图标：24 栅格、1.6 描边、圆角端点；强调部分用 currentColor 低透明度填充（双色调），
 * 不使用渐变，明暗主题下自动跟随文字颜色。
 */
export type MeiyeIconProps = SVGProps<SVGSVGElement> & { size?: number | string };

function Svg({ size = 24, strokeWidth = 1.6, children, ...props }: MeiyeIconProps & { children: ReactNode }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{children}</svg>;
}

const tone = { fill: "currentColor", fillOpacity: 0.16, stroke: "none" } as const;
const solid = { fill: "currentColor", stroke: "none" } as const;

/* ------------------------------ 画布节点 ------------------------------ */

export function TextNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}><path d="M5.5 7.2V5.5h13v1.7" /><path d="M12 5.5v13" /><path d="M9.4 18.5h5.2" /></Svg>;
}

export function DrawingNodeIcon(props: MeiyeIconProps) {
    const body = "M15.4 4.7a2 2 0 0 1 2.8 0l1.1 1.1a2 2 0 0 1 0 2.8L9.4 18.5l-4.6 1 1-4.6Z";
    return <Svg {...props}><path d={body} {...tone} /><path d={body} /><path d="m13.6 6.5 3.9 3.9" /></Svg>;
}

export function ScriptNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
        <rect x="6.2" y="7.2" width="5" height="4" rx="1" {...tone} />
        <rect x="6.2" y="7.2" width="5" height="4" rx="1" />
        <rect x="12.8" y="7.2" width="5" height="4" rx="1" />
        <path d="M6.2 14.6h11.6M6.2 17h7" />
    </Svg>;
}

export function FrameNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M4 8.5v-2A2.5 2.5 0 0 1 6.5 4h2M15.5 4h2A2.5 2.5 0 0 1 20 6.5v2M20 15.5v2a2.5 2.5 0 0 1-2.5 2.5h-2M8.5 20h-2A2.5 2.5 0 0 1 4 17.5v-2" />
        <rect x="8" y="8" width="8" height="8" rx="1.8" {...tone} />
        <rect x="8" y="8" width="8" height="8" rx="1.8" />
    </Svg>;
}

export function FolderNodeIcon(props: MeiyeIconProps) {
    const body = "M3.5 7.8a2.3 2.3 0 0 1 2.3-2.3h3.4a2 2 0 0 1 1.5.7l1.1 1.3h6.4a2.3 2.3 0 0 1 2.3 2.3v7.4a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3Z";
    return <Svg {...props}><path d={body} {...tone} /><path d={body} /><path d="M3.5 10.6h17" /></Svg>;
}

export function ImageNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.5" y="4.5" width="17" height="15" rx="3.2" />
        <path d="M3.9 16.3 8 12.2a1.6 1.6 0 0 1 2.3 0l6.6 6.8" {...tone} />
        <path d="M3.9 16.3 8 12.2a1.6 1.6 0 0 1 2.3 0l6.6 6.8M14.3 16.2l1.5-1.5a1.6 1.6 0 0 1 2.3 0l2.2 2.2" />
        <circle cx="15.8" cy="8.9" r="1.6" {...solid} />
    </Svg>;
}

export function ProductDetailNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="5.5" y="3" width="13" height="18" rx="2.8" />
        <rect x="8" y="5.8" width="8" height="6" rx="1.4" {...tone} />
        <rect x="8" y="5.8" width="8" height="6" rx="1.4" />
        <path d="M8 15h8M8 18h5" />
    </Svg>;
}

export function ProductReplicaNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.5" y="7" width="11.5" height="13.5" rx="2.6" {...tone} />
        <rect x="3.5" y="7" width="11.5" height="13.5" rx="2.6" />
        <path d="M8.5 4h8.2a2.8 2.8 0 0 1 2.8 2.8V15" />
        <path d="M20.6 1.1c.2 1.1.6 1.5 1.6 1.6-1 .1-1.4.5-1.6 1.6-.2-1.1-.6-1.5-1.6-1.6 1-.1 1.4-.5 1.6-1.6Z" {...solid} />
    </Svg>;
}

export function CharacterNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.5" y="5" width="17" height="14" rx="3" />
        <circle cx="9.3" cy="10.6" r="2.1" {...tone} />
        <circle cx="9.3" cy="10.6" r="2.1" />
        <path d="M6.2 16.2c.6-1.5 1.7-2.3 3.1-2.3s2.5.8 3.1 2.3M14.6 10h3M14.6 13.2h2.2" />
    </Svg>;
}

export function VideoNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3" y="5.5" width="13.5" height="13" rx="3" {...tone} />
        <rect x="3" y="5.5" width="13.5" height="13" rx="3" />
        <path d="m16.5 10.3 3.3-2.1a.8.8 0 0 1 1.2.7v6.2a.8.8 0 0 1-1.2.7l-3.3-2.1" />
        <path d="M8.4 9.7v4.6l3.7-2.3Z" {...solid} />
    </Svg>;
}

export function ConversionNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}><path d="M4.5 9H18m-3-3.5L18.5 9 15 12.5M19.5 15H6m3-3.5L5.5 15 9 18.5" /></Svg>;
}

export function BatchTableNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M3.5 7.5a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v2h-17Z" {...tone} />
        <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
        <path d="M3.5 9.5h17M3.5 14.5h17M9.5 9.5v10" />
    </Svg>;
}

export function PrevisNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M12 3.3 19.5 7.5 12 11.7 4.5 7.5Z" {...tone} />
        <path d="M12 3.3 19.5 7.5v9L12 20.7l-7.5-4.2v-9Z" />
        <path d="M4.5 7.5 12 11.7l7.5-4.2M12 11.7v9" />
    </Svg>;
}

export function AudioNodeIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M9 17.6V6.3l10-2.1v11.2M9 9.4l10-2.1" />
        <circle cx="6.8" cy="17.6" r="2.3" {...tone} /><circle cx="6.8" cy="17.6" r="2.3" />
        <circle cx="16.8" cy="15.4" r="2.3" {...tone} /><circle cx="16.8" cy="15.4" r="2.3" />
    </Svg>;
}

/* ------------------------------ 首页创作类型 ------------------------------ */

export function AgentModeIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}>
        <rect x="4" y="6.5" width="16" height="12" rx="4.5" {...tone} />
        <rect x="4" y="6.5" width="16" height="12" rx="4.5" />
        <path d="M12 3v3.5M9.5 15.4c1.5.9 3.5.9 5 0" />
        <circle cx="9.2" cy="11.8" r="1.2" {...solid} /><circle cx="14.8" cy="11.8" r="1.2" {...solid} />
    </Svg>;
}
export const ImageModeIcon = ({ size = 20, ...props }: MeiyeIconProps) => <ImageNodeIcon size={size} strokeWidth={1.7} {...props} />;
export const VideoModeIcon = ({ size = 20, ...props }: MeiyeIconProps) => <VideoNodeIcon size={size} strokeWidth={1.7} {...props} />;
export const MusicModeIcon = ({ size = 20, ...props }: MeiyeIconProps) => <AudioNodeIcon size={size} strokeWidth={1.7} {...props} />;

export function AudioModeIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}><path d="M4 10v4M8 7v10M12 4v16M16 7v10M20 10v4" /></Svg>;
}

export function SkillIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}>
        <path d="m4 20 9.5-9.5M15 9l1.5 1.5" />
        <path d="M15.2 3.4c.25 1.3.75 1.8 2 2-1.25.2-1.75.7-2 2-.25-1.3-.75-1.8-2-2 1.25-.2 1.75-.7 2-2Z" {...solid} />
        <path d="M19.6 9.6c.18.9.5 1.25 1.4 1.4-.9.15-1.22.5-1.4 1.4-.18-.9-.5-1.25-1.4-1.4.9-.15 1.22-.5 1.4-1.4Z" {...solid} />
    </Svg>;
}

/* ------------------------------ 侧边栏导航 ------------------------------ */

export function NavCreateIcon({ size = 20, ...props }: MeiyeIconProps) {
    const star = "M12 3.2c.6 4.4 3 6.8 7.4 7.4-4.4.6-6.8 3-7.4 7.4-.6-4.4-3-6.8-7.4-7.4 4.4-.6 6.8-3 7.4-7.4Z";
    return <Svg size={size} strokeWidth={1.7} {...props}><path d={star} {...tone} /><path d={star} /><circle cx="19" cy="19" r="1.4" {...solid} /></Svg>;
}

export function NavDramaIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}>
        <rect x="3.5" y="8.5" width="17" height="11" rx="3" {...tone} />
        <rect x="3.5" y="8.5" width="17" height="11" rx="3" />
        <path d="m4 8.5 2.2-4.3 15 2.6-.7 1.7M9 4.9 7.4 8.5M14 5.8l-1.6 2.7" />
        <path d="M10.4 11.6v4.8l3.8-2.4Z" {...solid} />
    </Svg>;
}

export function NavCanvasIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}>
        <rect x="3" y="4" width="7" height="6" rx="2" {...tone} />
        <rect x="3" y="4" width="7" height="6" rx="2" />
        <rect x="14" y="14" width="7" height="6" rx="2" />
        <path d="M10 7h2.5A2.5 2.5 0 0 1 15 9.5V14" />
        <circle cx="6.5" cy="17" r="2.5" />
    </Svg>;
}

export function NavCommerceIcon({ size = 20, ...props }: MeiyeIconProps) {
    const bag = "M5.2 8h13.6l-1 10.4a2 2 0 0 1-2 1.6H8.2a2 2 0 0 1-2-1.6Z";
    return <Svg size={size} strokeWidth={1.7} {...props}><path d={bag} {...tone} /><path d={bag} /><path d="M9 10V7a3 3 0 0 1 6 0v3" /></Svg>;
}

export const NavImageIcon = ImageModeIcon;
export const NavVideoIcon = VideoModeIcon;

export function NavSkillsIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}>
        <path d="M12 3.5 20 8l-8 4.2L4 8Z" {...tone} />
        <path d="M12 3.5 20 8v8l-8 4.5L4 16V8Z" />
        <path d="M4 8l8 4.2L20 8M12 12.2v8.3" />
    </Svg>;
}

export function NavPluginsIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}>
        <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" {...tone} />
        <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </Svg>;
}

export function NavAssetsIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <FolderNodeIcon size={size} strokeWidth={1.7} {...props} />;
}

export function NavHistoryIcon({ size = 20, ...props }: MeiyeIconProps) {
    return <Svg size={size} strokeWidth={1.7} {...props}><path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3L4.5 9M4.5 4.8V9h4.2M12 8v4.2l2.8 1.8" /></Svg>;
}

/* ------------------------------ 通用操作（电商 Agent 页头、输入框参数、画布工具条） ------------------------------ */

export function HistoryIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <circle cx="12.2" cy="12" r="7.6" {...tone} />
        <path d="M4.6 12a7.6 7.6 0 1 0 2.3-5.4L4.6 8.8M4.6 4.9v3.9h3.9" />
        <path d="M12.2 8.3v3.9l2.7 1.7" />
    </Svg>;
}

export function PanelCollapseIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M3.5 7.7a3.2 3.2 0 0 1 3.2-3.2h2.6v15H6.7a3.2 3.2 0 0 1-3.2-3.2Z" {...tone} />
        <rect x="3.5" y="4.5" width="17" height="15" rx="3.2" />
        <path d="M9.3 4.5v15M15.8 9.6 13.4 12l2.4 2.4" />
    </Svg>;
}

export function PanelExpandIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M3.5 7.7a3.2 3.2 0 0 1 3.2-3.2h2.6v15H6.7a3.2 3.2 0 0 1-3.2-3.2Z" {...tone} />
        <rect x="3.5" y="4.5" width="17" height="15" rx="3.2" />
        <path d="M9.3 4.5v15M13.4 9.6l2.4 2.4-2.4 2.4" />
    </Svg>;
}

export function NewChatIcon(props: MeiyeIconProps) {
    const bubble = "M6 4.5h12a2.5 2.5 0 0 1 2.5 2.5v8a2.5 2.5 0 0 1-2.5 2.5h-7.4l-3.8 2.9v-2.9H6A2.5 2.5 0 0 1 3.5 15V7A2.5 2.5 0 0 1 6 4.5Z";
    return <Svg {...props}><path d={bubble} {...tone} /><path d={bubble} /><path d="M12 8.4v5.2M9.4 11h5.2" /></Svg>;
}

export function LayoutIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.5" y="4" width="17" height="16" rx="3" />
        <rect x="6.4" y="6.9" width="11.2" height="3.7" rx="1.2" {...tone} />
        <rect x="6.4" y="6.9" width="11.2" height="3.7" rx="1.2" />
        <rect x="6.4" y="13.2" width="4.6" height="4" rx="1.2" />
        <path d="M13.8 13.6h3.8M13.8 16.8h2.4" />
    </Svg>;
}

export function GlobeIcon(props: MeiyeIconProps) {
    const meridian = "M12 3.5c-2.3 2.3-3.5 5.1-3.5 8.5s1.2 6.2 3.5 8.5c2.3-2.3 3.5-5.1 3.5-8.5S14.3 5.8 12 3.5Z";
    return <Svg {...props}><path d={meridian} {...tone} /><circle cx="12" cy="12" r="8.5" /><path d={meridian} /><path d="M3.9 9.4h16.2M3.9 14.6h16.2" /></Svg>;
}

export function SettingsIcon(props: MeiyeIconProps) {
    const gear = "M10.5 5.7 10.8 3.5A8.6 8.6 0 0 1 13.2 3.5L13.5 5.7A6.5 6.5 0 0 1 15.4 6.5L17.2 5.1A8.6 8.6 0 0 1 18.9 6.8L17.5 8.6A6.5 6.5 0 0 1 18.3 10.5L20.5 10.8A8.6 8.6 0 0 1 20.5 13.2L18.3 13.5A6.5 6.5 0 0 1 17.5 15.4L18.9 17.2A8.6 8.6 0 0 1 17.2 18.9L15.4 17.5A6.5 6.5 0 0 1 13.5 18.3L13.2 20.5A8.6 8.6 0 0 1 10.8 20.5L10.5 18.3A6.5 6.5 0 0 1 8.6 17.5L6.8 18.9A8.6 8.6 0 0 1 5.1 17.2L6.5 15.4A6.5 6.5 0 0 1 5.7 13.5L3.5 13.2A8.6 8.6 0 0 1 3.5 10.8L5.7 10.5A6.5 6.5 0 0 1 6.5 8.6L5.1 6.8A8.6 8.6 0 0 1 6.8 5.1L8.6 6.5A6.5 6.5 0 0 1 10.5 5.7Z";
    return <Svg {...props}><path d={gear} {...tone} /><path d={gear} /><circle cx="12" cy="12" r="2.6" /></Svg>;
}

export function SlidersIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M4 7h7M15 7h5M4 12h3M11 12h9M4 17h9M17 17h3" />
        <circle cx="13" cy="7" r="2" {...tone} /><circle cx="13" cy="7" r="2" />
        <circle cx="9" cy="12" r="2" {...tone} /><circle cx="9" cy="12" r="2" />
        <circle cx="15" cy="17" r="2" {...tone} /><circle cx="15" cy="17" r="2" />
    </Svg>;
}

export function PaletteIcon(props: MeiyeIconProps) {
    const body = "M12 3.6c-4.8 0-8.5 3.6-8.5 8.2 0 4.5 3.6 8.2 8 8.2 1.3 0 2.1-.8 2.1-1.9 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8h2.1c2.2 0 4-1.8 4-4 0-3.4-3.8-6.1-8.5-6.1Z";
    return <Svg {...props}>
        <path d={body} {...tone} /><path d={body} />
        <circle cx="7.9" cy="11.6" r="1.15" {...solid} /><circle cx="10.4" cy="7.9" r="1.15" {...solid} /><circle cx="14.7" cy="8.1" r="1.15" {...solid} />
    </Svg>;
}

export function UploadIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M4 14.6h16v2.2a2.7 2.7 0 0 1-2.7 2.7H6.7A2.7 2.7 0 0 1 4 16.8Z" {...tone} />
        <path d="M4 14.6v2.2a2.7 2.7 0 0 0 2.7 2.7h10.6a2.7 2.7 0 0 0 2.7-2.7v-2.2" />
        <path d="M12 15.2V4.8M8.2 8.4 12 4.6l3.8 3.8" />
    </Svg>;
}

export function LightbulbIcon(props: MeiyeIconProps) {
    const bulb = "M12 3.6a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.1v.4h5v-.4c0-.8.4-1.6 1.1-2.1A6 6 0 0 0 12 3.6Z";
    return <Svg {...props}><path d={bulb} {...tone} /><path d={bulb} /><path d="M9.8 19.5h4.4M10.7 21.3h2.6" /></Svg>;
}

export function QueueIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.6" y="4.6" width="4" height="4" rx="1.3" />
        <rect x="3.6" y="10" width="4" height="4" rx="1.3" {...tone} />
        <rect x="3.6" y="10" width="4" height="4" rx="1.3" />
        <rect x="3.6" y="15.4" width="4" height="4" rx="1.3" />
        <path d="M10.8 6.6h9.6M10.8 12h9.6M10.8 17.4h6.4" />
    </Svg>;
}

export function ExportIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.5" y="4" width="17" height="4.6" rx="1.6" {...tone} />
        <rect x="3.5" y="4" width="17" height="4.6" rx="1.6" />
        <path d="M5.2 8.6v8.4a2.5 2.5 0 0 0 2.5 2.5h8.6a2.5 2.5 0 0 0 2.5-2.5V8.6" />
        <path d="M12 11.3v5.2M9.7 14.3 12 16.6l2.3-2.3" />
    </Svg>;
}

export function LayersIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M12 3.8 20.4 8.4 12 13 3.6 8.4Z" {...tone} />
        <path d="M12 3.8 20.4 8.4 12 13 3.6 8.4Z" />
        <path d="m3.6 12.2 8.4 4.6 8.4-4.6M3.6 15.9l8.4 4.6 8.4-4.6" />
    </Svg>;
}

export function PointerIcon(props: MeiyeIconProps) {
    const arrow = "M5.6 4.6 18.7 10.1a.6.6 0 0 1-.1 1.1l-5.4 1.6a1 1 0 0 0-.6.6l-1.9 5.3a.6.6 0 0 1-1.1 0Z";
    return <Svg {...props}><path d={arrow} {...tone} /><path d={arrow} /></Svg>;
}

export function HandIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M7.6 12.4h12.8v1.4c0 4-3 6.7-6.8 6.7h-1.2c-2.2 0-3.7-.8-5-2.3L5 15.4Z" {...tone} />
        <path d="M7.6 13.2V7.4a1.6 1.6 0 0 1 3.2 0v4.2M10.8 11.4V5.6a1.6 1.6 0 0 1 3.2 0v5.8M14 11.4V7.2a1.6 1.6 0 0 1 3.2 0v4.6" />
        <path d="M17.2 9.6a1.6 1.6 0 0 1 3.2 0v4.2c0 4-3 6.7-6.8 6.7h-1.2c-2.2 0-3.7-.8-5-2.3l-3-3.5a1.6 1.6 0 0 1 2.4-2.1l.8.9" />
    </Svg>;
}

export function ImagePlusIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <path d="M3.9 16.3 8 12.2a1.6 1.6 0 0 1 2.3 0l6.6 6.8" {...tone} />
        <path d="M20.5 11.8v4.5a3.2 3.2 0 0 1-3.2 3.2H6.7a3.2 3.2 0 0 1-3.2-3.2V7.7a3.2 3.2 0 0 1 3.2-3.2h5.5" />
        <path d="M3.9 16.3 8 12.2a1.6 1.6 0 0 1 2.3 0l6.6 6.8M14.3 16.2l1.5-1.5a1.6 1.6 0 0 1 2.3 0l2.2 2.2" />
        <path d="M18 3.2v5.6M15.2 6h5.6" />
    </Svg>;
}

export const TextToolIcon = TextNodeIcon;

export function UndoIcon(props: MeiyeIconProps) {
    return <Svg {...props}><path d="M9 14 4.5 9.5 9 5" /><path d="M4.8 9.5h9.7a5 5 0 0 1 0 10H11" /></Svg>;
}

export function RedoIcon(props: MeiyeIconProps) {
    return <Svg {...props}><path d="m15 14 4.5-4.5L15 5" /><path d="M19.2 9.5H9.5a5 5 0 0 0 0 10H13" /></Svg>;
}

export function RefreshIcon(props: MeiyeIconProps) {
    return <Svg {...props}><path d="M19.5 12a7.5 7.5 0 0 1-13.1 5M4.5 12a7.5 7.5 0 0 1 13.1-5" /><path d="M17.9 3.6v3.6h-3.6M6.1 20.4v-3.6h3.6" /></Svg>;
}

export function StyleLibraryIcon(props: MeiyeIconProps) {
    return <Svg {...props}>
        <rect x="3.5" y="3.5" width="7.4" height="7.4" rx="2.2" {...tone} />
        <rect x="3.5" y="3.5" width="7.4" height="7.4" rx="2.2" />
        <rect x="13.1" y="3.5" width="7.4" height="7.4" rx="2.2" />
        <rect x="3.5" y="13.1" width="7.4" height="7.4" rx="2.2" />
        <rect x="13.1" y="13.1" width="7.4" height="7.4" rx="2.2" />
    </Svg>;
}
