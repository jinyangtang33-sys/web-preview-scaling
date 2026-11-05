# 课程目录验收报告

已修复 1 个可复现问题：390×844 触屏初始状态下，目录两张课程卡片的名称、级别和时长完全透明。修复后正常滚动即可阅读，桌面原有悬停/聚焦交互及布局保留。

## 范围与来源

- 仅处理本目录 project/page.html，依据 request.txt 与 skill/SKILL.md。
- 独立无头 Google Chrome 156.0.8078.80；指定 Playwright，channel=chrome，直接 file URL。
- 实测 window.innerWidth/innerHeight：桌面 1440×900、手机 390×844。全新上下文默认缩放，DPR=1，无 CSS zoom/scale。
- 手机为独立浏览器触屏模拟，并非真实手机：hover:none=true、pointer:coarse=true、maxTouchPoints=1。实际预览/IAB 不可访问，未重复尝试，无法比较宿主。

## 发现与修复

默认 .course-meta 的 opacity 为 0，通过悬停/聚焦显示。既有触屏例外只针对 .featured .course-meta，因此推荐可读而目录透明。正常滚动时目录仅剩封面与“查看课程”，无法辨认课程。

project/page.html 第 25 行只改一处选择器：

    原：@media (hover:none) { .featured .course-meta { opacity: 1; } }
    新：@media (hover:none) { .course-meta { opacity: 1; } }

手机三组元信息的合成 opacity 从 [1,0,0] 变为 [1,1,1]。有效截图确认名称与说明清晰、未遮挡或裁切。主容器及元信息边界、字号和列宽未变。桌面初始值仍 [0,0,0]，悬停/聚焦对应卡片变为 1。

## 已完成检查

| 状态 | 实测结果 |
| --- | --- |
| 桌面 1440×900 | 主容器 1000px；目录 490px + 490px；根 scrollWidth/clientWidth 均 1440 |
| 手机触屏 390×844 | 主容器/单列 358px；根 scrollWidth/clientWidth 均 390；信息初始可读 |
| 600×844 触屏 | 单列 568px，紧凑菜单，信息均 opacity=1，无整页横向溢出 |
| 601×844 触屏 | 两列各 274.5px，桌面导航，信息均 opacity=1，无整页横向溢出 |
| 390×844 鼠标 | 单列；保留 hover/focus 显示；只缩窄窗口不能代表触屏 |

- 桌面、手机各测 8 个入口：推荐入口、两张课程、导航两项、主题三项。均到达预期 #catalog、#topics 或 #lesson。
- 手机导航菜单关闭→打开→关闭正常；隐藏桌面导航有可用替代。
- CDP 合成触摸纵向滑动：scrollY 从 0 到 557，信息仍可见；主题轨道横向触摸从 0 到 386，末项“光线”可点回目录。
- 主题轨道 scrollWidth 744 / clientWidth 358 是组件内部滚动，保留现有行为。
- 桌面三张卡片逐一检查 hover=1、移开=0、focus-within=1。
- 隐藏草稿 #future-note 保持 display:none；课程说明仍明确“完整内容在下一阶段开放”。
- 已测页面无 pageerror。600/601 和窄鼠标的附加检查只覆盖 DOM、媒体查询与几何。

## 证据

- 修复前：verified-before-mobile-390-catalog-unhovered.png。
- 修复后：verified-after-mobile-390-catalog-unhovered.png。
- 正常触摸滚动：verified-after-mobile-390-touch-scroll.png、verified-after-mobile-390-touch-rail.png。
- 导航：verified-after-mobile-390-menu-open.png。
- 桌面：verified-after-desktop-1440-initial.png、verified-after-desktop-1440-catalog-hovered.png。
- evidence.json 汇总读数、修复、操作、截图尺寸与 SHA-256。完整读数在 verified-before-measurements.json、verified-after-measurements.json；入口与手势在 functional-checks.json。

## 工具偏差与未验证范围

首次使用 Playwright fullPage:true 截图后，本机 Chrome 的触屏媒体查询变成 hover/fine，而 maxTouchPoints 仍为 1。独立诊断已复现。最初 before-*.png / after-*.png 及无 verified- 前缀的测量文件仅保留排查记录，不用于触屏验收。最终改用视口截图并逐张核对截图前后媒体查询一致。详见 screenshot-diagnostic.json。

修复前重跑读取原始快照 page.before.html；最终读取 project/page.html。生成证据时确认两者仅有上述 CSS 选择器差异。有效截图均以 verified- 开头。

未验证实际 Codex 预览、真实手机、Safari/Firefox、混合输入设备或完整课程播放。静态项目仅有课程说明占位，未扩展功能。没有提交或发布。
