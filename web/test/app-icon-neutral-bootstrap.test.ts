import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readProjectFile = (relative: string) => readFileSync(new URL(`../${relative}`, import.meta.url), "utf8");

// 首屏显示默认品牌图标，解析外观后仍允许自定义品牌覆盖 favicon。
describe("app icon bootstrap", () => {
    const indexHtml = readProjectFile("index.html");
    const appearanceStore = readProjectFile("src/stores/use-appearance-store.ts");

    test("index.html declares the supplied MeiyeAI favicon", () => {
        expect(indexHtml).toContain('href="/zaomu-favicon-16.png"');
    });

    test("the appearance store replaces the favicon after loading the public appearance", () => {
        expect(appearanceStore).toContain('link[rel~="icon"]');
        expect(appearanceStore).toContain('favicon.href = "/zaomu-favicon.png";');
    });
});
