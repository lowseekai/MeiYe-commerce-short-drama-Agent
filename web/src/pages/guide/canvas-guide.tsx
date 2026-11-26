import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { ArrowUp, BookOpen, Lightbulb, Search } from "lucide-react";

import { CANVAS_SHORTCUT_CATEGORIES, CANVAS_SHORTCUTS } from "@/lib/canvas/canvas-shortcuts";

import {
    FigureFrame,
    MockAddMenu,
    MockAgent,
    MockAssetView,
    MockConnection,
    MockMainDock,
    MockMention,
    MockNextStepMenu,
    MockOverview,
    MockPromptPanel,
    MockQuickStart,
    MockRailPanel,
    MockScriptNode,
    MockShare,
    MockToolbox,
    MockTopBar,
    MockZoomDock,
} from "./canvas-guide-figures";
import "./canvas-guide.css";

type NavGroup = { title: string; items: { id: string; label: string }[] };

const NAV: NavGroup[] = [
    { title: "开始", items: [{ id: "overview", label: "认识画布" }, { id: "quick-start", label: "三步上手" }] },
    {
        title: "界面",
        items: [
            { id: "rail", label: "左侧导航栏" },
            { id: "topbar", label: "顶部栏" },
            { id: "dock", label: "底部工具栏" },
            { id: "zoom", label: "视图控制" },
        ],
    },
    {
        title: "创作",
        items: [
            { id: "nodes", label: "添加节点" },
            { id: "connect", label: "连线与引用" },
            { id: "generate", label: "生成内容" },
            { id: "script", label: "分镜脚本" },
            { id: "toolbox", label: "工具箱" },
        ],
    },
    {
        title: "管理与协作",
        items: [
            { id: "assets", label: "资产与素材" },
            { id: "agent", label: "Agent 助手" },
            { id: "share", label: "保存与分享" },
        ],
    },
    { title: "参考", items: [{ id: "shortcuts", label: "快捷键" }, { id: "faq", label: "常见问题" }] },
];

const ALL_IDS = NAV.flatMap((group) => group.items.map((item) => item.id));

function useActiveSection() {
    const [active, setActive] = useState(ALL_IDS[0]);
    useEffect(() => {
        const sections = ALL_IDS.map((id) => document.getElementById(id)).filter((element): element is HTMLElement => Boolean(element));
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActive(visible[0].target.id);
            },
            { rootMargin: "-15% 0px -70% 0px" },
        );
        sections.forEach((section) => observer.observe(section));
        return () => observer.disconnect();
    }, []);
    return active;
}

function Section({ id, eyebrow, title, lead, children }: { id: string; eyebrow: string; title: string; lead?: string; children: ReactNode }) {
    return (
        <section id={id} className="cg-section">
            <div className="cg-eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
            {lead ? <p className="cg-lead">{lead}</p> : null}
            {children}
        </section>
    );
}

function Tip({ children, title = "小贴士" }: { children: ReactNode; title?: string }) {
    return (
        <aside className="cg-tip">
            <Lightbulb />
            <div>
                <strong>{title}</strong>
                <p>{children}</p>
            </div>
        </aside>
    );
}

function Legend({ items }: { items: [string, string][] }) {
    return (
        <ol className="cg-legend">
            {items.map(([name, text], index) => (
                <li key={name}>
                    <span className="cg-legend-n">{index + 1}</span>
                    <div>
                        <strong>{name}</strong>
                        <p>{text}</p>
                    </div>
                </li>
            ))}
        </ol>
    );
}

function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
    return (
        <div className="cg-table">
            <table>
                <thead><tr>{head.map((cell) => <th key={cell}>{cell}</th>)}</tr></thead>
                <tbody>{rows.map((row, index) => <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>)}</tbody>
            </table>
        </div>
    );
}

function Kbd({ children }: { children: ReactNode }) {
    return <kbd className="cg-kbd">{children}</kbd>;
}

function ShortcutKeys({ keys }: { keys: string[][] }) {
    return (
        <span className="cg-keys">
            {keys.map((combo, index) => (
                <span key={index} className="cg-combo">
                    {index > 0 ? <i>或</i> : null}
                    {combo.map((key, keyIndex) => (
                        <span key={key}>{keyIndex > 0 ? <b>+</b> : null}<Kbd>{key}</Kbd></span>
                    ))}
                </span>
            ))}
        </span>
    );
}

function ShortcutsSection() {
    const [query, setQuery] = useState("");
    const groups = useMemo(() => {
        const q = query.trim().toLocaleLowerCase();
        return CANVAS_SHORTCUT_CATEGORIES.map((category) => ({
            category,
            items: CANVAS_SHORTCUTS.filter((item) => item.category === category.id && (!q || [item.title, item.description, item.keys.flat().join(" "), ...(item.keywords || [])].join(" ").toLocaleLowerCase().includes(q))),
        })).filter((group) => group.items.length);
    }, [query]);
    return (
        <Section id="shortcuts" eyebrow="参考" title="快捷键" lead="Windows 上按 Ctrl，Mac 上按 Cmd。在画布里按 ? 键也能随时打开这份清单。">
            <label className="cg-search">
                <Search />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索按键或操作，例如：缩放、复制" />
            </label>
            {groups.map(({ category, items }) => (
                <div key={category.id} className="cg-shortcut-group">
                    <h3>{category.label}<span>{category.description}</span></h3>
                    <div className="cg-shortcut-list">
                        {items.map((item) => (
                            <div key={item.id} className="cg-shortcut">
                                <div>
                                    <strong>{item.title}</strong>
                                    <p>{item.description}</p>
                                </div>
                                <ShortcutKeys keys={item.keys} />
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            {!groups.length ? <p className="cg-empty">没有找到匹配的快捷键</p> : null}
        </Section>
    );
}

const FAQ: [string, string][] = [
    ["画布需要手动保存吗？", "不需要。画布会自动同步，左上角显示云朵对勾就是已保存。想立刻保存可以按 Ctrl/Cmd + S。如果云朵变成断开的样子，点一下它查看原因。"],
    ["找不到刚才的节点了怎么办？", "点左下角的「适应画布」把所有节点放进视野，或按 Ctrl/Cmd + F 按名称搜索，回车即可定位。"],
    ["生成要花多少积分？", "生成按钮上会直接写出这次预计消耗的积分，例如「消耗 8 积分，生成」。余额显示在顶部右侧，点击可以充值。"],
    ["生成失败或一直在排队？", "打开左侧「任务」查看排队和运行中的任务，可以在这里取消。失败的节点可以在节点上方的工具栏里点「重新生成」。"],
    ["不小心删了东西？", "按 Ctrl/Cmd + Z 撤销，或用底部工具栏的撤销按钮。生成过的图片、视频在「资产」视图里也能找回。"],
    ["画布太乱了？", "点左下角的「自动整理节点」一键排版，或点「隐藏节点连线」让画面清爽一些。多选节点后还可以对齐、等距排列。"],
    ["可以导入其他平台的画布吗？", "可以。顶部右侧「导入第三方画布」支持 LibTV 和 TapNow 画布。"],
];

export default function CanvasGuidePage() {
    const active = useActiveSection();
    const [navOpen, setNavOpen] = useState(false);

    useEffect(() => {
        const previous = document.title;
        document.title = "画布使用说明 · 造幕";
        return () => { document.title = previous; };
    }, []);

    return (
        <div className="cg-root">
            <div className="cg-aurora" aria-hidden />
            <header className="cg-header">
                <Link to="/" className="cg-brand">
                    <img src="/zaomu-logo.png" alt="" />
                    <span>造幕</span>
                </Link>
                <span className="cg-header-sep" />
                <span className="cg-header-title"><BookOpen />画布使用说明</span>
                <button type="button" className="cg-nav-toggle" onClick={() => setNavOpen((value) => !value)}>目录</button>
                <Link to="/canvas" className="cg-header-cta">打开我的画布</Link>
            </header>

            <div className="cg-layout">
                <nav className={`cg-nav${navOpen ? " is-open" : ""}`} aria-label="文档目录">
                    {NAV.map((group) => (
                        <div key={group.title} className="cg-nav-group">
                            <div className="cg-nav-title">{group.title}</div>
                            {group.items.map((item) => (
                                <a key={item.id} href={`#${item.id}`} className={active === item.id ? "is-active" : ""} onClick={() => setNavOpen(false)}>
                                    {item.label}
                                </a>
                            ))}
                        </div>
                    ))}
                </nav>

                <main className="cg-main">
                    <div className="cg-hero">
                        <div className="cg-hero-tag">新手指南</div>
                        <h1>在一张无限画布上，<br />把想法变成图片、视频和成片</h1>
                        <p>画布由一个个「节点」组成。每个节点是一段文字、一张图、一段视频或一个工具，用线把它们连起来，就组成了一条创作流程。读完这份说明大约需要 8 分钟。</p>
                    </div>

                    <Section id="overview" eyebrow="开始" title="认识画布" lead="打开任意一个画布，你会看到下面这些区域。编号和下方说明一一对应。">
                        <FigureFrame tall caption="画布界面总览"><MockOverview /></FigureFrame>
                        <Legend
                            items={[
                                ["左侧导航栏", "回到主页，查看节点列表、素材库、任务进度和历史记录。"],
                                ["画布菜单与名称", "☰ 打开画布菜单；点名称可以改名；云朵图标表示保存状态。"],
                                ["画布 / 资产切换", "「画布」是创作区，「资产」把画布里生成的所有图片、视频按目录整理好。"],
                                ["搜索、导入、积分、专注、分享", "搜索节点、导入其他平台的画布、查看积分、进入专注模式、生成分享链接。"],
                                ["节点和连线", "画布的主体。节点之间的连线代表「把这个内容交给下一步使用」。"],
                                ["视图控制", "小地图、适应画布、自动整理、缩放比例，以及快捷键和本说明的入口。"],
                                ["底部工具栏", "切换选择 / 平移、撤销重做、添加节点、工具箱、素材库、外观设置等。"],
                                ["Agent 助手", "右下角的小助手。用自然语言告诉它要做什么，它能帮你在画布上搭建流程。"],
                            ]}
                        />
                    </Section>

                    <Section id="quick-start" eyebrow="开始" title="三步上手" lead="第一次使用，先跟着做一张图，熟悉基本流程。">
                        <FigureFrame><MockQuickStart /></FigureFrame>
                        <ol className="cg-steps-text">
                            <li><strong>添加一个图片节点。</strong>点底部工具栏的 <Kbd>+</Kbd>「添加节点」，选择「图片」。也可以直接<em>双击画布空白处</em>。</li>
                            <li><strong>写提示词。</strong>选中节点后下方会出现「图片生成」面板，在输入框里描述你想要的画面，越具体越好：主体、场景、光线、风格。</li>
                            <li><strong>点击生成。</strong>按钮上会写出预计消耗的积分。生成完成后图片直接显示在节点里，可以继续拖出连线做下一步，比如用这张图生成视频。</li>
                        </ol>
                        <Tip>想用自己的图片？直接把图片、视频或音频文件拖进画布，就会在松手的位置创建对应节点。也可以 Ctrl/Cmd + V 粘贴剪贴板里的图片。</Tip>
                    </Section>

                    <Section id="rail" eyebrow="界面" title="左侧导航栏" lead="点击图标会在左侧展开对应面板，再点一次同一个图标即可收起。">
                        <FigureFrame caption="打开「素材库」面板"><MockRailPanel /></FigureFrame>
                        <Table
                            head={["按钮", "用来做什么"]}
                            rows={[
                                ["主页", "回到 造幕 首页。"],
                                ["节点", "列出画布里的全部节点，可按名称、镜头、模型或标签搜索，点一下就跳到该节点。节点多了以后特别好用。"],
                                ["素材库", "你上传和收藏的图片、视频、音频、文本。可按类型筛选，选中后插入画布。"],
                                ["任务", "正在排队和运行的生成任务。生成慢的时候来这里看进度，也可以取消任务。"],
                                ["历史", "最近 30 条操作记录，包括 Agent 助手做过的事。"],
                                ["展开", "展开或收起整个工作区面板，收起后画布空间更大。"],
                            ]}
                        />
                    </Section>

                    <Section id="topbar" eyebrow="界面" title="顶部栏">
                        <FigureFrame><MockTopBar /></FigureFrame>
                        <Legend
                            items={[
                                ["画布菜单、名称、保存状态", "☰ 菜单里有新建画布、删除画布、保存、导入素材、搜索节点、撤销重做。点击画布名称或铅笔可以重命名，回车确认。云朵对勾表示「已同步」。"],
                                ["画布 / 资产", "在创作区和资产视图之间切换。窗口较窄时这组按钮会隐藏，可以从 ☰ 菜单切换。"],
                                ["右侧功能区", "放大镜搜索节点；「导入第三方画布」支持 LibTV 和 TapNow；积分余额点击可充值；专注模式会隐藏所有面板只留画布（按 Esc 退出）；最右侧是分享。"],
                            ]}
                        />
                    </Section>

                    <Section id="dock" eyebrow="界面" title="底部工具栏" lead="屏幕底部中间的这一排按钮是最常用的操作入口。">
                        <FigureFrame><MockMainDock labels /></FigureFrame>
                        <Table
                            head={["按钮", "说明"]}
                            rows={[
                                ["框选 / 抓手", "框选模式下在空白处拖动可以一次选中多个节点；抓手模式下拖动会移动画布。平时按住空格键拖动也能临时平移。"],
                                ["撤销 / 重做", "撤回或恢复上一步编辑。"],
                                ["添加节点 +", "创建文本、图片、视频、音频、分镜脚本等节点，详见「添加节点」。"],
                                ["工具箱", "去背景、提高清晰度、PSD 分层等现成的处理工具，详见「工具箱」。"],
                                ["素材库", "从素材库挑选内容插入画布。"],
                                ["工作区", "开关左侧的工作区面板。"],
                                ["画布外观", "切换浅色 / 深色主题，网格样式（点、线、空白），可设为新画布默认。"],
                                ["工具栏设置", "拖动调整按钮顺序，关掉不常用的入口。"],
                                ["清空画布", "删除画布上所有节点和连线，会先弹窗确认。选中节点时这里还会出现「删除选中节点」。"],
                            ]}
                        />
                    </Section>

                    <Section id="zoom" eyebrow="界面" title="视图控制" lead="左下角的工具条负责「怎么看」画布，不会改动任何内容。">
                        <FigureFrame><MockZoomDock labels /></FigureFrame>
                        <Table
                            head={["按钮", "说明"]}
                            rows={[
                                ["小地图", "显示整张画布的缩略图，点击缩略图快速跳转。"],
                                ["适应画布", "把所有节点缩放到刚好装进屏幕。找不到节点时先点它。"],
                                ["自动整理节点", "按连线关系自动排版，让流程从左到右整齐排列。"],
                                ["隐藏 / 显示连线", "节点很多时隐藏连线，画面更清爽。"],
                                ["缩小 / 百分比 / 放大", "点百分比会弹出滑杆，可以精确调整，或一键切到 25%、50%、100%、200%。滚动鼠标滚轮也能缩放。"],
                                ["快捷键", "打开快捷键中心。"],
                                ["使用说明", "在新标签页打开你正在看的这份文档。"],
                            ]}
                        />
                    </Section>

                    <Section id="nodes" eyebrow="创作" title="添加节点" lead="节点是画布的基本单位。常用的有下面几种：">
                        <FigureFrame caption="底部「+」打开的添加节点菜单"><MockAddMenu /></FigureFrame>
                        <Table
                            head={["节点", "适合做什么"]}
                            rows={[
                                ["文本", "写文案、剧情、提示词，也可以让 AI 生成或改写文字。"],
                                ["图片", "上传图片，或用提示词生成新图片。"],
                                ["视频", "用提示词和参考图生成视频。"],
                                ["音频", "生成配音、音效等音频。"],
                                ["分镜脚本", "把一段剧情自动拆成镜头表，再批量出图、出视频、合成成片。"],
                                ["角色卡", "从角色库插入固定角色，保证多张图里人物一致。"],
                                ["批量创作表", "汇总多张图片，批量换装或批量生成创意图。"],
                                ["一键详情 / 一键复刻", "电商场景：自动策划并逐屏生成详情页长图，或照着模板替换产品复刻。"],
                                ["转换", "在本地处理图片或视频格式。"],
                                ["绘图 / 文件夹 / 预演台", "在图上手绘标注、整理节点分组、搭建 3D 预演场景。"],
                            ]}
                        />
                        <p className="cg-p">除了「+」按钮，还可以这样创建节点：</p>
                        <ul className="cg-bullets">
                            <li><strong>双击</strong>画布空白处，直接弹出添加节点菜单。</li>
                            <li><strong>右键</strong>空白处，可以添加节点、上传到这里、从素材库插入、粘贴。</li>
                            <li><strong>拖入文件</strong>：图片、视频、音频会在松手的位置变成节点。</li>
                            <li><strong>粘贴</strong>：Ctrl/Cmd + V 粘贴复制的节点、文字或图片。</li>
                        </ul>
                    </Section>

                    <Section id="connect" eyebrow="创作" title="连线与引用" lead="连线的意思是「把左边节点的内容交给右边节点使用」。比如把参考图连到视频节点，视频就会参考这张图生成。">
                        <FigureFrame caption="从节点右侧的圆点拖出连线"><MockConnection /></FigureFrame>
                        <ul className="cg-bullets">
                            <li>每个节点左右两侧都有小圆点：<strong>左边是输入，右边是输出</strong>。</li>
                            <li>按住右侧圆点拖到另一个节点上松开，就连好了。选中连线后按 Delete 可以删除。</li>
                            <li>如果拖到空白处松开，或者单击圆点，会弹出「创建下一步」菜单，选一项就自动创建并连好新节点。</li>
                            <li>选中两个以上节点后按 <Kbd>Alt</Kbd> + <Kbd>L</Kbd> 可以批量连接。</li>
                        </ul>
                        <FigureFrame caption="「创建下一步」菜单：不用先建节点再连线"><MockNextStepMenu /></FigureFrame>
                        <h3 className="cg-h3">用 @ 在提示词里引用</h3>
                        <p className="cg-p">在任何提示词输入框里输入 <Kbd>@</Kbd>，会弹出画布节点、技能库、素材库的候选列表。选中后这段内容会被准确地带进本次生成，比文字描述「上面那张图」可靠得多。</p>
                        <FigureFrame><MockMention /></FigureFrame>
                    </Section>

                    <Section id="generate" eyebrow="创作" title="生成内容" lead="选中图片、视频、音频或文本节点后，下方会出现生成面板。">
                        <FigureFrame><MockPromptPanel /></FigureFrame>
                        <Legend
                            items={[
                                ["提示词", "描述你想要的内容。节点里已经有图时，输入新提示词会基于当前图片重新生成。点「润色」可以让 AI 帮你把提示词写得更完整。"],
                                ["模型", "不同模型风格、速度和价格不同。不选时会使用默认模型和参数。"],
                                ["参考素材与参数", "这里显示「已连接 N 个素材」，就是通过连线带进来的参考内容。「参数」展开后可以调整比例、时长、数量等。"],
                                ["生成按钮", "按钮上写着本次预计消耗的积分。点击后节点显示「生成中」，可以继续做别的事，完成后结果自动出现。"],
                            ]}
                        />
                        <Tip title="生成之后">鼠标移到节点上，上方会出现工具栏：重新生成、下载、查看版本历史、锁定位置。图片节点还有裁剪、去除背景、多角度、全景图、宫格切分、反推提示词、角色三视图等工具。</Tip>
                    </Section>

                    <Section id="script" eyebrow="创作" title="分镜脚本" lead="做短视频、广告、短剧时最常用的节点。输入一段剧情，它会自动拆成一张镜头表，再一步步变成成片。">
                        <FigureFrame tall><MockScriptNode /></FigureFrame>
                        <ol className="cg-steps-text">
                            <li><strong>写剧情。</strong>在底部输入框写下剧本或剧情，以及总时长等要求，例如「15 秒电商广告，展示毛绒小象的互动玩法」。可以先选镜头数（自动或 1 到 10 镜）和单镜时长，然后点发送。</li>
                            <li><strong>检查镜头表。</strong>每一行是一个镜头，包含时长、视频提示词、台词/旁白。直接点单元格就能修改，「添加行」可以补镜头。</li>
                            <li><strong>出图（可选）。</strong>想先确认画面，可以在「更多操作」里生成分镜图，确认满意再做视频。</li>
                            <li><strong>出视频、合并成片。</strong>在「更多操作」里生成未完成的视频，全部完成后选择合并，得到一条完整的成片。</li>
                        </ol>
                        <Tip>把「故事梗概」文本节点或「项目画风」节点连到分镜脚本的输入口，生成的镜头会自动遵循你的设定和画风。表格太挤时点「全屏编辑」，可以显示景别、运镜、画面描述等更多列。</Tip>
                    </Section>

                    <Section id="toolbox" eyebrow="创作" title="工具箱" lead="底部工具栏的公文包图标。选一个工具，画布上会出现一组已经连好的节点：输入、处理功能和使用说明。">
                        <FigureFrame><MockToolbox /></FigureFrame>
                        <p className="cg-p">用法：把自己的图片或视频放进输入节点，再点功能节点提交处理任务即可。预设工具包括图片移除背景、图片分辨率提高、PSD 分层、视频替换背景、视频分辨率提升、图像扩张。「个人」标签里是你自己保存的工具。</p>
                    </Section>

                    <Section id="assets" eyebrow="管理与协作" title="资产与素材" lead="两者的区别：资产是这个画布里产生的内容，素材库是你跨画布通用的收藏。">
                        <FigureFrame caption="顶部切换到「资产」视图"><MockAssetView /></FigureFrame>
                        <Table
                            head={["", "资产", "素材库"]}
                            rows={[
                                ["范围", "当前画布生成和上传的内容", "你所有的素材，任何画布都能用"],
                                ["入口", "顶部「资产」切换", "左侧导航「素材库」或底部工具栏"],
                                ["常用操作", "单击看详情（提示词、模型、尺寸），双击跳回画布定位，设置主版本", "按类型筛选、搜索，插入画布"],
                            ]}
                        />
                    </Section>

                    <Section id="agent" eyebrow="管理与协作" title="Agent 助手" lead="右下角的小助手。不知道从哪里开始时，直接告诉它你想做什么。">
                        <FigureFrame><MockAgent /></FigureFrame>
                        <ul className="cg-bullets">
                            <li>点击小助手打开「Agent 工作台」，用自然语言描述任务，比如「用这张商品图做一条 15 秒广告」。</li>
                            <li>输入 <Kbd>@</Kbd> 引用画布里的节点，输入 <Kbd>/</Kbd> 调用技能库里的技能。</li>
                            <li>需要动画布或花积分的操作，它会先请你确认，徽标显示「待审批」时记得去看一下。</li>
                            <li>小助手可以拖动换位置；面板也可以停靠在画布右侧。</li>
                        </ul>
                    </Section>

                    <Section id="share" eyebrow="管理与协作" title="保存与分享">
                        <FigureFrame><MockShare /></FigureFrame>
                        <ul className="cg-bullets">
                            <li><strong>自动保存</strong>：编辑会自动同步到云端，左上角云朵图标显示同步状态。</li>
                            <li><strong>分享</strong>：点顶部最右侧的分享按钮，选有效期（长期、7 天或 30 天），点「创建并复制链接」发给别人即可查看。不想再分享时点「停止分享」，链接立即失效。</li>
                        </ul>
                    </Section>

                    <ShortcutsSection />

                    <Section id="faq" eyebrow="参考" title="常见问题">
                        <div className="cg-faq">
                            {FAQ.map(([q, a]) => (
                                <details key={q}>
                                    <summary>{q}</summary>
                                    <p>{a}</p>
                                </details>
                            ))}
                        </div>
                    </Section>

                    <footer className="cg-footer">
                        <span>准备好了？</span>
                        <Link to="/canvas" className="cg-header-cta">打开我的画布</Link>
                        <a href="#overview" className="cg-top"><ArrowUp />回到顶部</a>
                    </footer>
                </main>
            </div>
        </div>
    );
}
