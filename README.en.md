# web-preview-scaling

[简体中文](README.md) | **English**

[![Diagnostics and regression checks](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml/badge.svg?branch=main)](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml)

Browser diagnostics for CSS viewports, element geometry, computed font sizes, breakpoints, overflow and touch visibility candidates. Use the readings to reproduce a reported problem and inspect the rules behind it.

**The scope is now diagnostics.** This repository no longer provides a general webpage beautification workflow or promises better-looking pages. Neither matched-budget new-project experiment reached its predefined advantage threshold. [All experimental records remain available](evals/README.md#历史实验记录).

## Tools and limits

| Tool | Output | Limit |
| --- | --- | --- |
| [measure.cjs](scripts/measure.cjs) | Actual CSS viewport, horizontal overflow, selected element bounds, computed typography, grid tracks and input features | Requires the right state and selectors; does not rate layout quality |
| [render-inspect.cjs](scripts/render-inspect.cjs) | Hidden/clipped candidates, action positions, image frames and fitted dimensions | Intentional hiding and internal scrolling need context; not an accessibility certification |
| [Responsive return check](evals/check-responsive-return.cjs) | Resize, navigate back and exercise a control in project tests | Requires project-specific navigation and assertions |
| [Codex entry point](SKILL.md) | Matching-state evidence, candidate causes and unverified scope | Diagnostics and explicitly authorized local fault repairs; no whole-page design workflow |

Suitable questions include preview/browser differences, unexpected font sizes or breakpoint behavior, image sizing, root overflow, and essential content available only on hover. The user or project supplies design targets; measurements do not choose a visual style.

## Run the scripts

Run from a project with Playwright or playwright-core installed. Use `--channel chrome` for an installed Chrome browser. Replace the paths, URL, viewports and selectors.

```sh
node "<repo>/scripts/measure.cjs" http://localhost:3000/ --viewport 1440x900 --viewport 390x844 --selector main --selector h1 --channel chrome
node "<repo>/scripts/render-inspect.cjs" http://localhost:3000/ --viewport 390x844 --touch --channel chrome --screenshots ./diagnostic-captures
```

Output is JSON; `--ready CSS` waits for a target. CLI results come from a standalone headless browser. To compare a Codex preview, measure that actual preview's CSS viewport, then match the standalone browser's dimensions and state. CLI readings do not establish that the host was inspected. Touch emulation is not physical-device testing.

Use existing authorized browser sessions or project fixtures for authentication, dialogs and dynamic data. See the [diagnostic instructions (Chinese)](references/preview-diagnostics.md) for usage and limitations.

## Diagnose with Codex

The diagnostic tool is maintained on the `main` branch.

```text
$skill-installer Install the root skill from the main branch of https://github.com/jinyangtang33-sys/web-preview-scaling (--path .), named web-preview-scaling.
```

```text
$web-preview-scaling Diagnose why the title at http://localhost:3000/ differs between the side preview and a standalone browser. Keep the code unchanged. Record font sizes and container widths in matching states at the same CSS viewport; identify candidate causes and unverified scope.
```

When a separate request authorizes fixing a confirmed fault, keep the change within that fault and repeat the same measurements and operations. There is no whole-page optimization or automatic visual-rating entry point.

## Example and regression checks

The [example](example/index.html) checks measurements: at 1440×900, its two CSS presets produce 100.8px/52px headings and 1400px/960px content widths. The grid changes from one to three columns at 759/760px. These are fixture targets, not universal design recommendations.

The [scrollbar case](docs/viewport-comparison.svg) records different usable widths at the same 1280×720 viewport with a 15px scrollbar; title sizes are equal. It demonstrates interpretation of measurements.

On pushes to main and PRs targeting main, [CI](.github/workflows/layout-regression.yml) runs 14 browser checks and replays archived public proposals and fingerprints. **It does not judge aesthetics, call models to rerun experiments or certify arbitrary pages.** See [validation scope (Chinese)](evals/README.md).

## Why the experiments remain

Earlier versions attempted general design guidance. The TodoMVC and subsequent Markdown Editor experiments each allowed three code replies and a 15-minute limit per arm. Both mean blind-score differences were +1.5/24, below the predefined +2 threshold. They used different candidates and projects and cannot be pooled as repeated trials of one version.

These records explain the narrower scope. They retain observed gains, failures and limits, rather than advertise the current diagnostic tool's effect on page quality. See the [retired design guides](evals/archive/design-guides-78c5386/README.md) and [complete experimental index](evals/README.md#历史实验记录).
