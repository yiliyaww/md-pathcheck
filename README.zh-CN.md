# md-pathcheck

在提交文档前，找出 Markdown 中失效的本地链接。

[English](README.md) · [参与贡献](CONTRIBUTING.md) · [安全问题](SECURITY.md) · [更新记录](CHANGELOG.md)

`md-pathcheck` 是一个离线命令行工具，用来检查文档仓库中的本地文件链接、图片路径和标题锚点。它不发起网络请求，也不需要安装第三方依赖。

当前版本为 **0.1.1**，支持常用 Markdown 语法子集，并非完整的 CommonMark 解析器。

## 快速开始

需要 Node.js 20 或更新版本。下载或克隆仓库，在仓库目录执行：

```sh
node bin/md-pathcheck.mjs --root .
```

无需执行 `npm install`。也可以只扫描指定文件或目录：

```sh
node bin/md-pathcheck.mjs --root . README.md examples
```

扫描路径相对于 `--root`，根目录默认为当前目录。为了验证标题锚点，工具仍可能读取未列入扫描范围的目标 Markdown 文件，但它必须位于根目录内。

## 检查示例

假设 `docs/setup.md` 包含：

```md
[安装说明](install.md#requirements)
![截图](images/setup.png)
```

工具会确认两个本地目标都存在。如果目标是 `.md` 或 `.markdown` 文件，还会检查非空片段是否对应其标题锚点。诊断信息包含源文件和行号，例如：

```text
docs/setup.md:1 [missing-target] install.md#requirements — Target does not exist.
```

## 命令行参数

```text
node bin/md-pathcheck.mjs [options] [files or directories...]

--root PATH  项目根目录，默认为当前目录
--json       输出 JSON 报告
--help, -h   显示帮助
--version    显示版本
--           将剩余参数作为路径处理
```

不指定扫描路径时，递归检查根目录下所有 `.md` 和 `.markdown` 文件。遍历时跳过 `.git`、`node_modules`、`vendor`、`dist` 目录以及符号链接。

| 退出码 | 含义 |
| --- | --- |
| `0` | 未发现链接问题 |
| `1` | 发现至少一个链接问题 |
| `2` | 参数无效，或读取扫描输入失败 |

## JSON 与 JavaScript API

```sh
node bin/md-pathcheck.mjs --root . --json
```

报告包含数值字段 `files`、`links` 和问题数组 `issues`。`links` 统计识别到的本地目标，不包含外部 URL。每个问题包含 `file`、`line`、`href`、`code`、`message`。文件名相对于根目录，使用 `/` 分隔；行号从 1 开始。

```js
import { check } from './lib/check.mjs';

const report = await check({ root: process.cwd(), targets: ['README.md'] });
console.log(report.issues);
```

省略 `targets` 或传入空数组即可扫描整个根目录。无效输入或源文件读取失败会使 Promise 拒绝；失效链接会记录在 `issues` 中。

## 支持的语法与路径规则

- 行内链接、图片链接、尖括号包裹的目标和可选标题。
- 链接标签中的图片，例如可点击徽章：`[![徽章](badge.png)](guide.md)` 会检查两个本地目标。外层是网络链接时，也会检查内层图片路径。
- 完整式、折叠式引用链接，以及已定义的快捷引用链接。完整式或折叠式引用缺少定义时会报错。
- ATX 标题（`# 标题`）、setext 标题、Unicode 标题和重复标题后缀，例如 `#setup-1`。
- 百分号编码的文件名及片段；检查本地文件时忽略路径查询参数。
- 相对于源文档的路径；以 `/` 开头的路径相对于项目根目录。
- 同一文档的标题片段；空目标表示当前文档。
- 忽略围栏代码块、行内代码和 HTML 注释中的链接。
- 跳过带协议的 URL（如 `https:`、`mailto:`、`data:`），以及 `//` 开头的 URL。

超出根目录的链接和经过符号链接的目标会记为问题。如果文档跨子目录互相引用，请将仓库根目录设为 `--root`。

## 已知限制

这是一个小型解析器，不验证远程 URL、原生 HTML 链接或 ID、MDX、渲染器扩展、脚注、缩进代码块或所有嵌套 Markdown 结构。标题锚点采用近似 GitHub 的规则，可能与具体文档渲染器不同。未定义的快捷引用难以和普通方括号文本区分，因此会被忽略。

目录链接只检查目录是否存在，不推断 `index.md` 或 `README.md`。非 Markdown 文件和目录上的片段不做验证。检查通过只表示支持范围内的本地链接通过检查，不能保证整个站点正确渲染。

## 开发

```sh
npm test
npm run check
npm pack
```

测试使用 Node 内置测试运行器和临时测试目录。`npm pack` 先运行测试并检查本仓库文档，再生成本地包文件。使用命令行工具不依赖发布到 npm 注册表。

贡献和问题反馈见 [CONTRIBUTING.md](CONTRIBUTING.md)。本项目采用 [MIT 许可证](LICENSE)。
