# 快速验证

实现阶段先运行 npm test -- tests/teams-dropdown.test.js，记录预期失败和实现后的通过结果，再运行 npm run test:coverage 核对变更范围。

运行 npm run build 后确认 4173 端口对应当前 dist，设置 CI=1 后执行 npm run test:e2e -- e2e/teams-dropdown.spec.js。端口冲突时确认预览进程归属，避免复用旧构建。核对中英文、两种键盘激活方式、焦点、深浅主题与窄屏。

QA 用实体手机打开同一待发布版本，选两个小组并收起面板，正常缩放下一次点中清除。核对列表恢复，重开面板核对具体小组均未勾选、全部小组已选。在 tasks.md 的人工项记录设备、浏览器版本、候选版本、执行人、日期、结果及实际观察。SC-003 通过才能发布。
