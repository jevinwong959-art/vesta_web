---
name: Vesta Trade Workspace
description: 清楚、克制、可靠的业务工作台
colors:
  accent: "#2855d9"
  accent-hover: "#2046b8"
  accent-soft: "#edf2ff"
  ink: "#202631"
  muted: "#596575"
  canvas: "#f5f6f8"
  surface: "#fff"
  surface-soft: "#f8f9fb"
  line: "#e2e6ed"
  control-border: "#7c8797"
  status-success-ink: "#237553"
  status-success-surface: "#edf7f0"
  status-warning-ink: "#99631d"
  status-warning-surface: "#fff5df"
  status-error-ink: "#aa5f4c"
  status-error-surface: "#fff0eb"
typography:
  headline:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "30px"
    fontWeight: 650
    lineHeight: 1.35
    letterSpacing: "-1px"
  title:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.6
  priority-title:
    fontSize: "18px"
    fontWeight: 650
    lineHeight: 1.45
  mobile-headline:
    fontSize: "26px"
  mobile-input:
    fontSize: "16px"
  body:
    fontFamily: '"Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.6
  ui:
    fontSize: "13px"
    lineHeight: 1.6
  label:
    fontSize: "12px"
    lineHeight: 1.6
  metric:
    fontSize: "clamp(24px, 2.1vw, 34px)"
    fontWeight: 650
    lineHeight: 1.2
    letterSpacing: "-0.03em"
rounded:
  chip: "5px"
  control: "7px"
  card: "12px"
  dialog: "16px"
spacing:
  control-gap: "8px"
  group-gap: "12px"
  mobile-gutter: "16px"
  section: "24px"
  desktop-gutter: "40px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "#3f4959"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  button-soft:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.control}"
    padding: "9px 16px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
  status-success:
    backgroundColor: "{colors.status-success-surface}"
    textColor: "{colors.status-success-ink}"
    rounded: "{rounded.chip}"
    padding: "4px 9px"
---

# Design System: Vesta

## Overview

**Creative North Star: "业务工作台"**

清楚、克制、可靠，以完成任务为先。设计感来自任务顺序、对象身份、数字对齐与操作反馈：先认出正在处理的客户或订单，再理解状态和下一步。

保留钴蓝、石墨、冷白的现有体系。浅色页面承载信息，细边框区分相邻区域，弹窗用集中层次承载一项任务。主操作醒目，次操作安静，输入边界清楚；统计卡保持统一浅色。

**Key Characteristics:**

- 对象名称与当前任务优先，辅助说明后置。
- 克制而明确的控件，持续可见的键盘焦点。
- 桌面按列比较，手机按记录阅读。
- 反馈可理解、可恢复，动态效果不承载唯一信息。

本文件基于 VESTA-370 当前实现提取。屏幕主题以 `web/tokens.css` 为实现源，布局和组件以 `web/screen.css` 为实现源；未来调整时同步本文与 `.impeccable/design.json`。打印使用独立文档样式。

## Colors

### Primary

钴蓝（accent）标识主要操作、当前导航和焦点；较深的 hover 色用于悬停，浅蓝表面用于低强度操作及选中状态。它不是给所有标题上色的装饰色。

### Neutral

石墨（ink）承载标题和正文；muted 用于说明和元信息。冷白由 canvas、surface、surface-soft 构成页面、内容和次级区域。line 是容器分隔线，control-border 是可交互输入边界，两者不能混用。

成功、待处理和错误使用配对的语义文字色与表面色，仍显示状态文字。提示颜色不代替履约和资金状态的独立说明。

**The 明确边界 Rule.** 输入控件使用 control-border，不能退化为容器的浅色分隔线。

## Typography

使用系统字体栈，中文依次回退至苹方和微软雅黑；不额外加载展示字体。层级依靠字号、字重和位置，不靠重复全大写小标题。

页面标题使用 headline，手机使用 mobile-headline；普通卡片标题使用 title，优先任务标题使用 priority-title，保持比任务对象更清楚的字级。正文使用 body，紧凑表格与控件使用 ui，辅助说明使用 label。金额使用等宽数字及 metric 字距；761–1200px 统计数字为 26px，480px 以下为 20px。商品名为 18px、价格为 26px；这些角色不替代页面标题。

表单输入在手机工作区保持 16px。长公司名称、邮件和订单编号允许换行，不裁掉识别对象所需的信息。

**The 数字可比 Rule.** 金额保留币种和精度，用等宽数字对齐，不用动画数字替代实际金额。

## Layout

桌面内部工作区使用 240px 侧栏，内容最大宽度 1640px，基础内边距 36px/40px；761–1200px 收为 28px。760px 以下主区取消侧栏占位，内容内边距为 24px/16px，导航作为可关闭的覆盖层。

桌面表格支持横向比较。客户、订单及重点订单在760px以下使用同一表格的记录布局，身份、字段标签和操作保持在同一条记录中；768/1024px仍允许表格容器局部滚动。门户导航在手机变为两列，搜索独占一行。

常用间距来自 frontmatter 中已使用的数值；不要把每一处历史间距强制改成统一网格。详情连续处理条位于标题与正文之间，保持来源列表顺序；切换只重置正文滚动，不跳动整个页面。

## Elevation & Depth

以浅色分层与细边框为主。设计感通过明确的对齐、疏密与对象层次体现；轻阴影分离内容卡片，较强阴影和遮罩仅用于集中任务的弹窗。

- 内容卡片：`0 2px 4px #20263103`，弱环境阴影。
- 主要按钮：`0 2px 3px #2855d918`，轻微操作强调。
- 弹窗：`0 32px 100px #1b263d30`，配合现有遮罩和5px背景模糊。

**The 统一统计 Rule.** 统计卡保持统一浅色，不用第一张深色卡制造任意重要性。

## Shapes

输入与按钮采用小圆角，状态标签更紧凑，卡片和弹窗逐级放宽圆角，具体值见 rounded。细边框承担分组和边界；图标主要说明操作，不作为每段标题的装饰。

## Components

### Buttons

克制而明确。主要按钮用钴蓝底与白字，悬停加深；次要按钮白底、浅边框；soft 用于低强度蓝色操作。桌面常规最小高度40px、compact为34px，手机工作区均至少44px。焦点为3px钴蓝轮廓、向外偏移3px；禁用有原生disabled状态，不只降低透明度。

### Inputs

边界清楚的白色输入框。焦点边框变钴蓝，外侧有轻色环；只读保留文字选择，禁用有说明性的原生状态，错误只在真实校验失败时呈现。输入标签不能仅靠placeholder表达。

### Navigation

当前项使用浅蓝底、蓝色文字和aria-current。手机导航包含关闭入口、焦点循环、Escape关闭和触发点恢复。详情的上一条/下一条仅浏览打开时的记录集合，显示位置、边界禁用，快捷键为Alt+PageUp/PageDown；输入和上层弹窗不触发底层记录切换。

### Chips

紧凑的语义色状态标签；成功、待处理与错误均保留文字。可操作筛选仍使用按钮或选择器，不把纯状态标签伪装成控件。

### Cards / Containers

统一白色表面、细边框和轻阴影。标题、统计与内容保持不同字级。共享RecordsTable负责表头、移动字段标签和空状态；搜索无结果提供清除筛选，首次空数据引向实际可执行的下一步。

经营总览顶部采用紧凑任务节奏：标题说明间6px，标题组至币种栏12px，币种栏至统计卡12px；手机币种控件至少44px高。该局部密度不覆盖其他页面的标题与操作区。

### Feedback / Dialogs

采购加入反馈包含商品和数量，提供撤销上次添加；清单变动使旧撤销失效。数量短促强调为180ms，仅在未请求减少动态时运行。弹窗关闭和重新打开保留本次会话采购草稿，明确清空须确认；刷新及退出清理。表单按需加载展示等待，失败可重试，关闭后不突然重新打开。

### Login

登录采用统一入口，不展示团队/客户选择、演示身份组或宣传文案；认证返回的账号角色决定进入工作台还是客户门户。深石墨表面承载钴蓝立体折光 V 与矢量字标，配必要的账号、密码、登录及恢复控件，该局部表达不扩展到业务统计卡。SVG厚度侧面、倒角与折面反射配合CSS透视；鼠标仅在品牌区带动小幅转向及反光，表单固定。900ms入场、1100ms轮廓描绘、200ms延迟后的800ms字标，以及100ms延迟后的1600ms边缘光均有限单次播放，图标按钮支持重播。指针归位后不持续计算，隐藏/离屏时停止，减少动态显示完整静态标志。触摸设备只播放短暂入场，不跟随触摸；600px及以下标志在上、表单在下。无3D支持时仍显示完整SVG和可操作表单。

## Do's and Don'ts

- Do 先展示客户/订单身份，再展示任务、时间和操作。
- Do 保留键盘焦点、状态文字、错误恢复和减少动态回退。
- Do 同时检查桌面比较和手机逐条处理的布局。
- Don't 用深色首项统计卡破坏统一浅色统计体系。
- Don't 用颜色、动效或装饰性小标题替代必要的业务说明。
- Don't 将屏幕主题自动套用到正式报价打印文档。
