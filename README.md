# web-preview-scaling

**简体中文** | [English](README.en.md)

[![诊断与回归检查](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml/badge.svg?branch=main)](https://github.com/jinyangtang33-sys/web-preview-scaling/actions/workflows/layout-regression.yml)

网页呈现问题的诊断工具：记录 CSS 视口、元素尺寸、字号、断点、溢出与触屏可见性线索，帮助复现问题并定位相关规则。

**定位已收缩为诊断。** 本仓库不再提供通用网页美化流程，也不承诺使用后网页效果更好。此前两次新项目等预算实验均未达到预设的明确优势门槛；[全部实验记录](evals/README.md#历史实验记录)保留。

## 能做什么

| 工具 | 输出 | 边界 |
| --- | --- | --- |
| [measure.cjs](scripts/measure.cjs) | 实际 CSS 视口、横向溢出、指定元素边界、计算字号、网格轨道及输入特征 | 需要正确的页面状态和选择器；不判断布局好坏 |
| [render-inspect.cjs](scripts/render-inspect.cjs) | 隐藏/截断候选、操作位置、图片元素框与拟合尺寸 | 候选可能是正常隐藏或内部滚动；不是缺陷或可访问性认证 |
| [跨尺寸返回检查](evals/check-responsive-return.cjs) | 在项目测试中切换尺寸、返回并实际使用控件 | 需要项目自己的导航与断言，不自动适配任意网站 |
| [Codex 入口](SKILL.md) | 按同状态、同视口取证，解释候选原因和未验证范围 | 仅用于诊断与已明确授权的局部故障修复，不启动整页设计 |

适合排查“小窗和独立浏览器显示不同”、宽屏字号异常、断点未按预期切换、图片尺寸异常、整页横向溢出，以及必要内容仅悬停可见等问题。设计目标需要由用户或项目给出，读数不替用户选择视觉风格。

## 直接使用脚本

从已有 Playwright 或 playwright-core 的项目目录执行，安装了 Chrome 时传 `--channel chrome`。把路径、URL、视口和选择器换成当前项目的值。

```sh
node "<repo>/scripts/measure.cjs" http://localhost:3000/ --viewport 1440x900 --viewport 390x844 --selector main --selector h1 --channel chrome
node "<repo>/scripts/render-inspect.cjs" http://localhost:3000/ --viewport 390x844 --touch --channel chrome --screenshots ./diagnostic-captures
```

脚本输出 JSON；`--ready CSS` 可等待目标出现。CLI 的来源是独立无头浏览器。要比较 Codex 预览，先在真实预览页面读取实际 CSS 视口，再将独立浏览器设为相同尺寸与状态；不能把 CLI 的读数当成已测过宿主。触屏模拟也不等于真机。

登录态、弹层和动态数据可用项目已有的授权浏览器会话复现，再读取相同属性。完整用法与限制见[诊断说明](references/preview-diagnostics.md)。

## 在 Codex 中诊断

诊断工具在 `main` 分支维护。可向 Codex 提交安装请求：

```text
$skill-installer 请从 https://github.com/jinyangtang33-sys/web-preview-scaling 的 main 分支安装仓库根目录的 skill（--path .），安装名 web-preview-scaling。
```

```text
$web-preview-scaling 请诊断 http://localhost:3000/ 的标题为何在侧边预览和独立浏览器里大小不同。保持代码不变，记录同状态、同 CSS 视口的字号和容器宽度，指出候选原因及未验证项。
```

如果另行要求修复已确认故障，按故障范围修改并用同一读数和操作复测。这里没有“优化整页”或自动视觉评分入口。

## 示例与回归

[示例页](example/index.html)用于核对测量：1440×900 下，两组预设 CSS 的标题分别为100.8px和52px，内容宽度1400px和960px；759/760px处网格从一列切到三列。这些是示例约定，不是推荐给所有项目的设计值。

[滚动条案例](docs/viewport-comparison.svg)记录同为1280×720时可用宽度因15px滚动条而不同，标题字号相同。它演示如何解释读数，不是网页效果增益证明。

推送 main 或向 main 提 PR 时，[CI](.github/workflows/layout-regression.yml)运行14项浏览器基础检查，并重放公开实验的补丁与指纹。**CI不评判美观、不调用模型复做实验，也不证明任意页面已通过验收。** [诊断验证范围](evals/README.md)。

## 为什么保留实验记录

仓库曾尝试用通用设计指导改善网页效果。TodoMVC 和随后冻结精简候选的 Markdown Editor 测试中，两边各三次代码回复、十五分钟上限，平均盲评分差均为+1.5/24，低于事前+2门槛。不同候选和项目不能合并为同一版本的重复实验。

这些记录用于说明为何收缩定位，保留原有收益、失败与局限，不作为现行诊断工具的效果宣传。原设计指南见[归档](evals/archive/design-guides-78c5386/README.md)，源码、截图、预算及全部历史结果见[实验索引](evals/README.md#历史实验记录)。
