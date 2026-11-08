# 全技能优化 · VESTA-370

日期：2026-11-08（Asia/Shanghai）。基线43680db，分支codex/vesta-220-ui-polish。按用户截图的19项技能及[入门教程](https://impeccable.cn/tutorials/getting-started/)优化现有界面；全部新修改保持未提交，由用户自行提交最终版。

## 方向与范围

用户确认业务工作台方向：清楚、克制、可靠，以完成任务为先；钴蓝、石墨、冷白，统一浅色统计卡。控件克制而明确，主操作醒目、次操作安静、输入边界清楚。设计感落实到任务身份、字级、对齐与详情连续处理。

仅本机127.0.0.1、虚构数据。后台权限、隔离、财务、库存和单据快照规则未改；无新增依赖、外部字体、采购或公开部署。历史audit/critique不重新计分。craft/shape作为新建/规划入口，本轮不据此扩充业务。

## 技能覆盖

| 技能 | 本轮实际结果 | 验证 |
| --- | --- | --- |
| init | 复核PRODUCT.md，确认定位、角色、本机边界仍适用 | 对照计划与已确认需求，不重复初始化 |
| document | DESIGN.md与schemaVersion 2 sidecar；实际复用tokens、16组8阶色带、8组件片段 | JSON与独立组件渲染；live面板限制见下文 |
| extract | RecordsTable/EmptyState替代main/workspace/parity重复表格；共享语言上下文 | 35状态、空结果、手机标签与打印 |
| onboard | 首次空数据引向新建客户、报价、选品；保留角色帮助 | mock空客户→新建；门户订单→报价→产品 |
| clarify | 区分无结果与首次无数据；反馈说明商品、数量与申请含义 | empty/feedback/polish脚本 |
| harden | 版本和会话校验防旧响应覆盖；表单加载重试；嵌套焦点恢复 | 竞态复现修复前true、修复后false；400保留/防重发 |
| adapt | 手机标题对齐，操作列显式标记、交期保留标签；采购栏换行/安全区 | 320–1920宽度；触摸模拟、键盘 |
| distill | 删除重复小标题、无英文规格时重复商品名、未调用orbit规则 | 源码及截图；正式报价打印复验 |
| layout | 标题、记录身份与详情导航层级明确 | 独立设计18状态；layout最终0条 |
| typeset | 金额字距随字号缩放；对象15px/600，优先标题18px/650 | 独立设计/机械评估；六渲染状态无小字/跳级命中 |
| colorize | 待办复用warning语义色，主操作/焦点维持钴蓝 | 可计算文字对比检查；状态文字保留 |
| bolder | 优先任务先展示对象，详情位置/切换清楚，增强优先标题字级 | 待办一步直达；导航首尾、位置与快捷键 |
| quieter | 去除重复英文小标题，保留浅色表面与安静次操作 | 登录/客户/目录实看 |
| animate | 采购数量180ms短反馈，仅no-preference启用 | 动画名；减少动态时无动画且反馈可用 |
| delight | 撤销上次添加，清单编辑使旧撤销失效 | 200→100撤销；编辑250后追加350 |
| overdrive | 客户/订单连续处理，按钮或Alt+PageUp/PageDown，保留列表范围 | 非空筛选3客户顺序；5订单导航；输入/嵌套隔离 |
| optimize | FormModal与Decimal按需加载，首屏不下载表单块，失败可重试 | 降速前后LCP、构建体积、分包错误恢复 |
| live | 官方启动、Pick、3方案、切换/接受1、carbonize完成、退出清理 | 会话5d5a7107，3/3到达，completed，无注入残留 |
| polish | 草稿、详情、空状态、错误恢复、键盘与响应式收尾 | 构建、28/28测试、35状态和专项检查 |

typeset/layout按技能使用独立设计和机械评估；设计方完成前未读机械结论。代理阅读过进展里的历史范围，不声称对全部历史背景盲测。

## 实现与性能

新增records-table、record-navigation、form-loader、form-modal、form-types组件；原入口与workspace/parity复用。RecordsLanguage通过React上下文更新，不读取滞后的html.lang。ModalAccess仅恢复仍有效且属于下一活动弹窗的焦点，否则聚焦当前弹窗。

性能比较针对表单分包阶段：Edge、390px、关闭缓存、150ms延迟、200KiB/s下载、4倍CPU降速；3次LCP中位3188ms→3036ms，CLS均0。首屏390186→353168字节。后续连续导航和上下文加入后，最终首屏355.72kB/gzip113.99kB，延迟表单38.45kB/gzip15.54kB，CSS80.12kB/gzip16.97kB。不将阶段实验值当作最终版真实用户性能。

最终构建：index-ckCfdC4p.js、form-modal-Bjh5j4Rk.js、index-C8-_snTD.css。产物在忽略目录。

## 验证结果

- **通过**：pnpm build、pnpm test 28/28、修改代码Prettier、git diff --check。后台用隔离测试数据，浏览器采购/保存提交用拦截，不创建演示库业务单据。
- **通过**：35页面/状态无pageerror、可见无名控件或可计算低文字对比命中；总览/英文门户320/390/768/1024/1440/1920无整页溢出。客户/订单≤760无局部横滑；768/1024保留表格局部滚动。
- **通过**：采购草稿全部字段关闭恢复、追加、撤销、编辑使旧撤销失效、清空取消/确认、失败保留、防重发、模拟成功清空、退出清理和减少动态回退。
- **通过**：空状态下一步；连接失败恢复；长中英/阿拉伯文本和320px错误；保存400保留输入且单请求；分包失败重试、报价行、关闭恢复新增客户焦点。
- **通过**：客户/订单按钮和快捷键、首尾焦点、非空筛选顺序和关闭恢复；嵌套订单、跟进输入不切后台，关闭上层后继续切换。
- **通过**：正式报价52元素在打印媒体可见，生成A4 PDF并实看打印媒体图；触摸模拟导航及退出滚动清理。
- **保留提示**：DESIGN.md引入后，最终静态450条advisory（颜色254、字号141、圆角55），warning 0、退出0；type 141条advisory、退出0；layout 0条。包含独立打印配色、响应式/组件局部值及历史样式，未把所有局部值提升为共享tokens，也未添加忽略项，不能称静态零问题。
- **渲染检测**：六状态0/0/1/0/0/0，仅总览订单趋势图读数网格提示保留；未忽略，不称整站认证。

证据在.local/verification/all-skills-370/：empty、race、feedback、navigation、navigation-edges、form-load、performance、audit、polish、edges、print-touch、detector、design-components脚本及JSON、图片/PDF；design-assessment和mechanical存独立评估。全部证据、数据库、日志和产物均不加入Git。

## live与过程限制

身份约束：系统字体、石墨标题、白卡、钴蓝操作；标题原15px/650，位于卡片头部。比较字级、紧凑字形、蓝色强调，采用18px石墨标题。由代理在已授权优化范围内选择，不记录为用户亲自点击采纳。样式移入screen.css，live-complete确认completed，退出后8400 helper停止，index.html无差异。

本机0.1.18 live面板能显示DESIGN.md正文，VISUAL页却提示“No design system data available”。未修改插件或伪造面板成功；sidecar按技能schemaVersion 2保存，8组件另行独立渲染通过。该显示限制不影响业务页面或三方案流程。

脚本曾在懒加载结束前统计字段、及匹配两个关闭按钮而失败，改为等待实际输入/明确入口后通过。嵌套返回测试发现实际body焦点问题，修改ModalAccess后通过。初始3条字体warning来自未调用orbit和打印登录统计，清理后消除。失败过程不冒充通过。

## 运行与下一步

常规pnpm build后pnpm local，http://127.0.0.1:3100/；开发通常pnpm dev。本次live复用3100，仅单独启动Vite 5173；收尾停止临时Vite/helper，保留原3100服务。

未验证：物理iPhone/Android、原生200%缩放、完整屏幕阅读器、多浏览器、系统打印/多页报价、真实采购闭环及大数据。VESTA-190余项保留。后续可执行上述专门验收及逐步收敛非共享历史样式。

没有git add、commit或push，HEAD保持43680db。用户审阅工作区后自行提交最终版。
