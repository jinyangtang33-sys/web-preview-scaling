# web-preview-scaling

[![布局回归测试 / Layout regression tests](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml/badge.svg?branch=main)](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml)

网页在 Codex 侧边预览里看着刚好，换到浏览器却觉得标题太大、正文太宽？这个 skill 让 Codex 在相同的 CSS 视口下测量同一个元素，再拉宽窗口，找出差异来自滚动条、字号规则还是响应式断点。

Does your page look right in Codex's side preview, but feel oversized or too wide in a standalone browser? This skill guides Codex to measure the same elements at matching CSS viewport sizes, then widen the viewport to identify differences caused by scrollbars, font-size rules, or responsive breakpoints.

![实测对照 / Measured comparison. At 1280 × 720 CSS px, the side preview has a 15 px scrollbar and a 1225 px content area. Standalone headless Chrome has no scrollbar width and a 1240 px content area. Both titles are 89.6 px.](docs/viewport-comparison.svg)

图中是示例页「修复前」的一次实测。正文两侧各留 20 px，预览滚动条又占了 15 px，因此正文恰好窄了 15 px。标题在两处都是 `7vw`，同一视口下算出来都是 89.6 px。**仅凭这次宽度差，无需调整字号。** 你可以在自己的环境里比较 `window.innerWidth` 和 `document.documentElement.clientWidth`，查看滚动条实际占了多少空间。

The diagram shows one measurement of the example page before the fix, at **1280 × 720 CSS px**. The top bar is Codex's side preview, with a **1225 px** content area and a **15 px** scrollbar. The bottom bar is standalone headless Chrome, with a **1240 px** content area and no width reserved for a scrollbar. Both leave 20 px on each side of the content. Both titles use `7vw`, which resolves to **89.6 px** at this viewport size. **This width difference alone calls for no font-size change.** Compare `window.innerWidth` with `document.documentElement.clientWidth` to measure the scrollbar space in your own environment.

## 在 Codex 里开始用 / Get started in Codex

把下面任意一种语言的安装请求发给 Codex。

Send either version of the installation request to Codex.

```text
$skill-installer 请从 https://github.com/jinyangtang33-sys/web-preview-scaling 的 main 分支安装 skill。SKILL.md 在仓库根目录（--path .），安装名为 web-preview-scaling（--name web-preview-scaling）。
```

```text
$skill-installer Install the skill from the main branch of https://github.com/jinyangtang33-sys/web-preview-scaling. SKILL.md is at the repository root (--path .). Use web-preview-scaling as the installation name (--name web-preview-scaling).
```

安装后，在你的网页项目中启动开发服务器，打开要检查的页面。把下面的网址换成自己的，再把任意一种语言的请求发给 Codex。

After installation, start your project's development server and open the page you want to check. Replace the URL below with your own, then send either version of the request to Codex.

```text
$web-preview-scaling 请检查 http://localhost:3000/ 。侧边预览里标题大小合适，浏览器打开后显得太大。先按预览的实际视口对照，再看 1440 × 900。告诉我标题字号、正文宽度和造成差异的 CSS 规则。
```

```text
$web-preview-scaling Check http://localhost:3000/ . The title looks right in the side preview but too large in a standalone browser. First compare at the preview's actual viewport size, then check 1440 × 900. Report the title's font size, the content width, and the CSS rules responsible for any differences.
```

Codex 可以用已有浏览器工具读取页面。若要批量采样或保存截图，可在装有 Playwright 的项目中使用仓库附带的脚本。

Codex can inspect the page with its existing browser tools. For measurements across multiple viewports or saved screenshots, run the bundled script from a project that has Playwright installed. [测量脚本用法（中文） / Script instructions (Chinese)](SKILL.md#采集可复查的读数) · [OpenAI 的 skill 使用说明 / OpenAI skill guide](https://learn.chatgpt.com/docs/build-skills)

## 用示例验证 / Try the example

示例是一张河岸步行路线页。下载仓库 ZIP，解压后用浏览器打开 `example/index.html`。页面顶部会实时显示 CSS 视口、标题字号、正文宽度和列数。

The example is a riverside walking-route page. Download and extract the repository ZIP, then open `example/index.html` in your browser. The strip at the top shows the CSS viewport size, title font size, content width, and column count in real time. [下载仓库 ZIP / Download ZIP](https://github.com/jinyangtang33-sys/web-preview-scaling/archive/refs/heads/main.zip)

1. 将浏览器的响应式视口设为 **1440 × 900**，切换「修复前 / 修复后」。标题会从 **100.8 px** 降到 **52 px**，正文宽度会收至 **960 px**。这次字号差来自标题新增的上限 `clamp(30px, 7vw, 52px)`。

   Set the browser's responsive viewport to **1440 × 900** and switch from **修复前 (Before)** to **修复后 (After)**. The title shrinks from **100.8 px** to **52 px**, and the content width is capped at **960 px**. The font-size change comes from the new limit in `clamp(30px, 7vw, 52px)`.

2. 将视口宽度从 **759 px** 调到 **760 px**。「沿途停留」会从一列变为三列。切换修复前后，两种样式都应在同一个宽度换列。

   Change the viewport width from **759 px** to **760 px**. The section labeled **沿途停留 (Stops along the way)** changes from one column to three. Both the Before and After versions should switch at the same width.

推送到 `main` 或向 `main` 提交 PR 时，GitHub Actions 会用 Chrome 核对两个版本的标题字号和断点列数。

On pushes to `main` and pull requests targeting `main`, GitHub Actions uses Chrome to check the title font sizes and column counts around the breakpoint in both versions. [示例源码 / Example source](example/index.html) · [回归测试 / Regression tests](tests/layout.test.cjs) · [CI 运行记录 / CI runs](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml)
