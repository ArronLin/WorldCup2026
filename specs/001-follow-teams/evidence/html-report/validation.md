# 新增行HTML报告补充验收（2026-10-21）

入口：[本功能报告](../coverage-added.html)。报告来自已归档JSON，原始JSON和实现前基线未改写；生成器核对全部32文件源码摘要。默认11个有新增可执行行的文件，其余可勾选查看，不适用项不会计作0%或100%。

## 实际执行

- 先编写4个目标单测，契约骨架运行产生真实断言失败：[Red](red.txt)；实现后通过：[Green](green.txt)。补充CLI与行链接回归后5项通过：[Refactor](refactor.txt)。
- 全量Vitest：19文件95项通过，0跳过：[unit.txt](unit.txt)。
- 先当前工作区build，再CI=1完整Playwright：24项通过，0跳过：[build.txt](build.txt)、[e2e.txt](e2e.txt)。
- 文件选择直接定位源码的改进先取得目标失败：[navigation-red.txt](navigation-red.txt)，再实现并复跑5个报告单测：[navigation-green.txt](navigation-green.txt)，重新build后3个报告浏览器场景通过：[e2e-final.txt](e2e-final.txt)。其他应用源码未改变。
- 可恢复变异：临时反转行命中判断，目标断言识别；finally恢复哈希一致后5项正常通过：[mutation.json](mutation.json)。
- 固定基线重建→95项单测覆盖采集→新增行审计→CI路径HTML生成均退出0，仍为200/200：[coverage-chain.json](coverage-chain.json)。工具脚本不属于既定src/netlify生产覆盖范围，本轮未新增应用可执行行，不重设基线。
- 实际报告Chromium离线检查通过：100%、11/32文件、state.js的33行、chat.mjs不适用、无页面异常或375px页宽溢出：[browser-check.json](browser-check.json)。源码高亮、缺失行筛选、路径搜索、键盘操作、深链接和红色未覆盖行使用有独立预期的真实夹具验证，非修改实际报告伪造未覆盖结果。桌面/源码/窄屏截图在本目录。

## 范围与复现

运行`npm run coverage:html`生成本功能已归档报告的HTML；输入输出可通过`--input`、`--output`指定。新增脚本不依赖外部服务或新包。源码/计数不匹配时拒绝生成，不把过期结果贴到新源码。JSON与HTML用于数据展示，页面生成本身不执行测试。

CI增加HTML生成并将其随coverage目录上传；本地执行了相同报告命令，远程CI未运行。没有修改Spec Kit预设、工程规则、功能规格、应用生产源码或历史T054/T055证据；没有提交或部署。Wiki用于背景，快照与当前提交对应关系仍未知；CodeGraph未索引scripts目录，关键逻辑已直接读取当前源码核实。

