# ArXiv Paper MCP

> 一个零依赖、纯 Node.js 的 MCP 服务器，用于管理你的 arXiv 论文库。通过自然语言搜索、下载、分类和翻译学术论文。

> A zero-dependency Node.js MCP server for managing your arXiv paper library. Search, download, classify, and translate academic papers — all through natural language.

---

## 功能 / Features

| 工具 Tool | 说明 Description |
|-----------|-----------------|
| `paper_search` | 搜索 arXiv 论文，支持分类、日期、作者、标题过滤。`check_local=true` 标记已下载的论文。 / Search arXiv with filters. `check_local=true` marks already-downloaded papers. |
| `paper_download` | 下载 PDF + 自动按主分类归档。创建三个文件：`.pdf`（题名命名）、`.md`（双语摘要 + 笔记区）、`.meta.json`（机器可读元数据）。/ Download PDF + auto-classify. Creates `.pdf` (titled), `.md` (bilingual summary), `.meta.json`. |
| `paper_classify` | AI 驱动的细分类。Agent 先读摘要 → 决定子分类 → 工具将文件移动到 `主分类/子分类/` 目录。 / AI-driven subcategory assignment: agent reads abstract → decides subcategory → tool moves files. |
| `paper_list` | 浏览本地论文库，支持按分类、子分类或状态过滤。 / Browse library with category/subcategory/status filters. |
| `paper_translate` | AI 将英文摘要翻译为中文，保存双语 `.md` 和 `.meta.json`。 / AI translates English abstracts to Chinese. |

## 快速开始 / Quick Start

### 前置要求 / Prerequisites

- Node.js 18+（需要内置 `fetch`）/ Node.js 18+ (built-in `fetch` required)
- 支持 MCP 的 AI Agent（OpenCode、Claude Code 等）/ An MCP-compatible agent

### 安装 / Installation

```bash
git clone https://github.com/wrqaxjm/arxiv-paper-mcp.git
cd arxiv-paper-mcp
```

**零依赖，不需要 `npm install`。** / **Zero dependencies. No `npm install` needed.**

### 配置 / Configuration

通过环境变量设置论文存储目录（默认为 `./papers`）：/ Set storage path via env var (defaults to `./papers`):

```bash
export ARXIV_PAPER_STORAGE=/path/to/your/library
```

#### OpenCode

在 `opencode.jsonc` 中添加：/ Add to `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "arxiv": {
      "type": "local",
      "command": ["node", "/path/to/arxiv-paper-mcp/server.js"],
      "enabled": true,
      "environment": {
        "ARXIV_PAPER_STORAGE": "F:/arxiv-lunwen"
      },
      "timeout": 300000
    }
  }
}
```

#### Claude Code

```json
{
  "mcpServers": {
    "arxiv": {
      "command": "node",
      "args": ["/path/to/arxiv-paper-mcp/server.js"],
      "env": {
        "ARXIV_PAPER_STORAGE": "/path/to/papers"
      }
    }
  }
}
```

## 使用方法 / Usage

在你的 Agent 中加载 `SKILL.md`，或直接用自然语言描述任务：/ Load the skill or describe tasks naturally:

> "帮我搜索 arXiv 上关于 visual SLAM 的最新论文，下载前 5 篇，按主题分类。"
> "Search arXiv for the latest papers on visual SLAM, download the top 5, and classify them by topic."

### 工作流 / Workflow

```
搜索 search → 读摘要筛选 select → 下载 download → AI 分类 classify → 验证 verify → 翻译 translate → 阅读 read
```

### 并行处理 / Parallel Processing

批量下载或翻译时，使用 OpenCode 的 `task` 子 agent 并行执行。每篇论文有唯一文件名，不会冲突。/ For batch operations, dispatch parallel task subagents. Each paper has a unique filename — no conflicts.

```
task(子agent, "下载 arxiv_id=xxx")
task(子agent, "下载 arxiv_id=yyy")
task(子agent, "下载 arxiv_id=zzz")
```

### 目录结构 / Library Structure

```
your-library/
├── cs.AI/
│   └── marl/
│       ├── Paper_Title__2301.xxxxx.pdf
│       ├── Paper_Title__2301.xxxxx.md      # 双语摘要 + 笔记
│       └── Paper_Title__2301.xxxxx.meta.json
├── cs.CV/
│   └── vision-transformer/
│       └── ...
├── cs.RO/
│   ├── slam/
│   └── grasping/
└── cs.CL/
    └── transformer/
```

## 双语摘要 / Bilingual Abstracts

每篇论文的 `.md` 文件包含中英文双语摘要：/ Each `.md` file has both English and Chinese abstracts:

```markdown
# Paper Title
- **作者**: Author Names
- **arXiv ID**: 2301.xxxxx

## 摘要（English）
The paper's abstract...

## 摘要（中文）
论文摘要的中文翻译...

## 我的笔记
<!-- 在此记录阅读笔记 -->
```

中文翻译由 AI Agent 完成（不调用外部翻译 API），学术术语保留英文原文。 / Chinese translation is done by the AI agent, with academic terms kept in English.

## 零依赖 / Zero Dependencies

不需要 `npm install`。仅使用 Node.js 内置模块（`fs`、`path`、`fetch`）。arXiv API 返回的 Atom XML 通过轻量级正则解析。 / No npm install. Uses only Node.js built-in modules. arXiv Atom XML is parsed with a lightweight regex parser.

## 许可证 / License

MIT
