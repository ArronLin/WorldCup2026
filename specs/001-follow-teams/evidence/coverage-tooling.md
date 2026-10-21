# 覆盖工具能力

[T046](./T046/index.json)→[T047](./T047/index.json)→[T048](./T048/index.json)记录真实Red/Green/Refactor。10个工具测试覆盖新文件、旧行修改、多行表达式/模板、注释空白、重命名、D=0、4/5恰好通过与3/5拒绝、缺报告/映射/哈希/路径错误、两种基线重建。

独立真实Vitest夹具：导入代码1行命中，未导入代码1行零命中；C=1,D=2被拒绝，见[原始映射](unimported-coverage-proof.json)。provider实际保留未加载文件；不能用只导入文件的覆盖率冒充全量。

Istanbul语句起始行定义可执行行；修改多行续行时回映该语句，Babel词法排除注释/空白。V8的null结束列按行末处理，有真实补充Red→Green。所有生产源都需报告及采集哈希，缺失拒绝；CLI核对lcov。

干净副本正常链与坏哈希/缺提交见[clean-ci.json](clean-ci.json)、[负例](clean-ci-negative.json)。远程CI未执行。
