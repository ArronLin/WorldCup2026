# 002 需求与真实测试映射

以下名称均来自实际执行的测试源码；最终通过记录见 [单测 JSON](T015/unit-results.json) 与 [浏览器 JSON](T013/full.json)。

## 真实 TDD 证据

- 状态：[T002 red](T002/1792569346089-red.json) → [T003 green](T003/1792569360099-green.json) → [T004 refactor](T004/1792569362324-refactor.json)。Red 6 个行为断言失败，Green/Refactor 6 个通过。
- 界面：[T005 red](T005/1792569460091-red.json) → [T006 green](T006/1792569509117-green.json) → [T007 refactor](T007/1792569541250-refactor.json)。有效 Red 8 个断言失败，Green/Refactor 14 个通过；此前错误字典路径的运行只作准备失败记录，详见 [说明](T005/review.md)。
- 双语：[T008 red](T008/1792569546515-red.json) → [T009 green](T009/1792569566043-green.json) → [T010 refactor](T010/1792569572980-refactor.json)。Red 新增 4 个英文行为失败，Green 新功能 18 个通过，Refactor 全量 120 个通过。
- 重构审视没有强行改写已清晰的实现，保留审视结论与真实复跑。
- [变异失败](T011/1792569613752-mutation.json) 与 [恢复哈希](T011/recovery.json) 是独立有效性验证，不冒充历史 Red。

## 覆盖矩阵

| 需求/场景 | 单元测试（tests/） | 浏览器测试（e2e/team-group-filter.spec.js） | TDD 链 |
| --- | --- | --- | --- |
| FR-001；US1-AS1 | [team-group-filter-view.test.js](../../../tests/team-group-filter-view.test.js)：renders all group options, clear action, names and original team order | single and multiple groups, last cancellation and visible response within one second | 状态/界面 |
| FR-002；US1-AS2/3；SC-001 | [team-group-filter-state.test.js](../../../tests/team-group-filter-state.test.js)：empty selection shows all; selection is a union and excludes unknown groups | single and multiple groups, last cancellation and visible response within one second | 状态/界面 |
| FR-003；US1-AS4 | [team-group-filter-controller.test.js](../../../tests/team-group-filter-controller.test.js)：updates union synchronously without replacing controls or losing focus; clears the last group | all groups, rapid changes and repeated show-all keep exact order without duplicates | 状态/界面 |
| FR-004；US1-AS5 | [team-group-filter-view.test.js](../../../tests/team-group-filter-view.test.js)：renders all group options, clear action, names and original team order | correct detail, return retains groups, refresh and a new page reset them | 状态/界面 |
| FR-005；US2-AS1/2 | [team-group-filter-view.test.js](../../../tests/team-group-filter-view.test.js)：switches real dictionaries zh → en → zh while retaining selected groups and team identities | real Chinese-English-Chinese changes preserve selected identities and all mode | 双语 |
| FR-006；US1-AS5 | [team-group-filter-view.test.js](../../../tests/team-group-filter-view.test.js)：reads the latest selection when re-rendering, retains all options and resets with a new document instance | correct detail, return retains groups, refresh and a new page reset them | 状态/界面 |
| FR-007；US1-AS6 | [team-group-filter-controller.test.js](../../../tests/team-group-filter-controller.test.js)：updates union synchronously without replacing controls or losing focus; clears the last group | keyboard selection retains focus and hidden team cards leave the tab sequence | 界面 |
| FR-008；EC-03 | [team-group-filter-view.test.js](../../../tests/team-group-filter-view.test.js)：uses a neutral unavailable message for empty or failed data | empty data has a neutral bilingual message and no fabricated groups | 界面/双语 |
| FR-009；EC-04 | [team-group-filter-view.test.js](../../../tests/team-group-filter-view.test.js)：keeps unknown-group teams only in all mode and excludes them from options | unknown groups remain in all mode but never become options or selected results | 状态/界面/双语 |
| EC-01/02 | [team-group-filter-state.test.js](../../../tests/team-group-filter-state.test.js)：handles all selections and rapid changes according to the last checked value | all groups, rapid changes and repeated show-all keep exact order without duplicates | 状态/界面 |
| SC-002 | [team-group-filter-controller.test.js](../../../tests/team-group-filter-controller.test.js)：updates union synchronously without replacing controls or losing focus; clears the last group | single and multiple groups, last cancellation and visible response within one second | 界面 |
| SC-003 | [team-group-filter-controller.test.js](../../../tests/team-group-filter-controller.test.js)：uses the active English dictionary for updates after language re-render | real Chinese-English-Chinese changes preserve selected identities and all mode | 双语；并见 FR-006/007 |

补充：FR-008 的网络失败场景由 unavailable data is not described as an empty filter result 验证；US2-AS2 的未知分组与无数据英文文案由 view 测试中的 translates all-mode and unknown-group labels using the English dictionary、translates unavailable-data guidance using the English dictionary 验证。FR-006 的事件范围和销毁由 delegates once, ignores unrelated actions and supports disposal and reinitialization 验证。FR-007 的尺寸/主题由 narrow and desktop controls wrap without overflow and have visible focus in both themes 验证，另见 [交互及视觉复核](T014/review.md)。

本轮不使用绑定 001 的 requirements-TDD HTML 生成器。上述映射是需求覆盖，新增行 HTML 是代码覆盖，两者分母不同。
