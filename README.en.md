# web-preview-scaling

[简体中文](README.md) | **English**

[![Base checks](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml/badge.svg?branch=main)](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml)

**Experimental; the slim candidate still missed the new-project advantage threshold.** The design guides were shortened by about 73%, then frozen before testing a previously unused Markdown Editor. Both arms received three code replies and a 15-minute limit. Blind scores were 19/17 and 18/17: +1.5/24 versus the +2 threshold. Both passed functional checks. [Revision rationale](evals/skill-revision-2026-11-05.md) · [Latest results and pages](evals/results/2026-11-05-heldout-markdown/README.md). Shorter instructions do not establish a substantial independent benefit.

**Historical development cases using the earlier candidate.** The mobile asset library showed four complete item names on the first screen (none without the skill); the booking list showed three complete records (one without it). In the final confirmation, two new blind reviewers preferred the skill on both projects, with a mean paired advantage of 4.25 points out of 24. All four pages passed independent functional checks. The workflow used extra implementation and review effort; these are development cases, not a cost-matched or held-out trial. [Results and limitations (Chinese)](evals/results/2026-11-04-visual-outcomes/README.md) · [Test scope and release criteria (Chinese)](evals/README.md) · [Touch omission retest (Chinese)](evals/results/2026-11-04-touch-rerun/README.md)

**Earlier TodoMVC matched-budget test.** Both TodoMVC arms received three code replies, a 15-minute limit and no model tool calls. Both blind reviewers mildly preferred the skill, but the mean difference was 1.5/24, below the frozen 2-point threshold. Both outputs passed functional checks; the skill was not retuned. [Source, screenshots, usage and results (Chinese)](evals/results/2026-11-05-heldout-todomvc/README.md). This does not establish a stable, substantial independent benefit on new projects.

This skill helps Codex improve hierarchy, content sizing, and responsive layout around the task a page serves: scanning lists, inspecting a subject, or completing and correcting a form. It calls for reviewing before-and-after renders in matching states and checking the original interactions. It also retains viewport-matched diagnosis of preview differences.

The image below is a basic example of font and content-width constraints. It demonstrates measurement; it is not evidence of an advantage over using no skill.

![Before and after screenshots at 1440 × 900 CSS px. Before the fix, the title is 100.8 px and the content is 1400 px wide. After the fix, the title is 52 px and the content is 960 px wide.](docs/example-before-after.en.png)

Both panels are actual first-viewport captures of the example in standalone headless Chrome, at **1440 × 900 CSS px**, displayed at the same scale. On the left, the `7vw` title grows to **100.8 px** and the content spans **1400 px**. On the right, upper limits bring the title to **52 px** and the content width to **960 px**. These limits are the example's design targets. Use your project's own design specifications when applying the skill.

The fix consists of two CSS rules. Switch between **修复前 (Before)** and **修复后 (After)** at the top of the example to reproduce it.

```css
main { max-width: 960px; }
h1 { font-size: clamp(30px, 7vw, 52px); }
```

## Get started in Codex

Send this installation request to Codex.

```text
$skill-installer Install the skill from the main branch of https://github.com/jinyangtang33-sys/web-preview-scaling. SKILL.md is at the repository root (--path .). Use web-preview-scaling as the installation name (--name web-preview-scaling).
```

To try the frozen slim candidate, replace `main` in the installation request with [candidate commit 78c5386](https://github.com/jinyangtang33-sys/web-preview-scaling/commit/78c53863050ac71050916c2cf637b2a117e1289d). The default branch may differ from the evaluated candidate.

After installation, start your project's development server and open the page you want to check. Replace the URL below with your own, then send this request to Codex.

```text
$web-preview-scaling Check http://localhost:3000/ . The title looks right in the side preview but too large in a standalone browser. First compare at the preview's actual viewport size, then check 1440 × 900. Report the title's font size, the content width, and the CSS rules responsible for any differences.
```

For a broader page improvement, use a request such as:

```text
$web-preview-scaling Improve the desktop and mobile experience at http://localhost:3000/ . Preserve the existing brand, content, and functionality. Make the main information easier to recognize and the actions clearer. Inspect the actual page before and after, verify the key workflows, and provide matching-state evidence and tradeoffs.
```

The [task-path guide (Chinese)](references/render-quality.md) focuses on one or two consequential obstacles. [Layout boundaries](references/layout-patterns.md) and [form boundaries](references/form-decisions.md) are conditional references. Multiple full implementations or agent reviews are no longer the default. The [revision rationale (Chinese)](evals/skill-revision-2026-11-05.md) distinguishes observations from hypotheses. [Preview diagnostics](references/preview-diagnostics.md) remain available when needed; measurements do not rank page quality.

Codex can inspect the page with its existing browser tools. For measurements across multiple viewports or saved screenshots, run the bundled script from a project that has Playwright installed. [Script instructions (Chinese)](references/preview-diagnostics.md) · [OpenAI skill guide](https://learn.chatgpt.com/docs/build-skills)

## Try the example

The example is a riverside walking-route page. Download and extract the repository ZIP, then open `example/index.html` in your browser. The strip at the top shows the CSS viewport size, title font size, content width, and column count in real time. [Download ZIP](https://github.com/jinyangtang33-sys/web-preview-scaling/archive/refs/heads/main.zip)

1. Set the browser's responsive viewport to **1440 × 900** and switch from **修复前 (Before)** to **修复后 (After)**. The title shrinks from **100.8 px** to **52 px**, and the content width is capped at **960 px**. The font-size change comes from the new limit in `clamp(30px, 7vw, 52px)`.

2. Change the viewport width from **759 px** to **760 px**. The section labeled **沿途停留 (Stops along the way)** changes from one column to three. Both the Before and After versions should switch at the same width.

On pushes to `main` and pull requests targeting `main`, GitHub Actions uses Chrome to check the title font sizes and column counts around the breakpoint in both versions. [Example source](example/index.html) · [Regression tests](tests/layout.test.cjs) · [CI runs](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml)

<details>
<summary>Another case · How can a scrollbar change content width at the same viewport size?</summary>

![At 1280 × 720 CSS px, the side preview reserves 15 px for a scrollbar and has a 1225 px content area. Standalone headless Chrome has a 1240 px content area. Both titles are 89.6 px.](docs/viewport-comparison.svg)

This is another measurement of the example before the fix. The top bar is Codex's side preview, with a **1225 px** content area and a **15 px** scrollbar. The bottom bar is standalone headless Chrome, with a **1240 px** content area and no width reserved for a scrollbar. Both leave 20 px on each side of the content. Both titles use `7vw`, which resolves to **89.6 px** at this viewport size. This width difference alone calls for no font-size change. Compare `window.innerWidth` with `document.documentElement.clientWidth` to measure the scrollbar space in your own environment.

</details>
