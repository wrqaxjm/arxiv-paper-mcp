# ArXiv Paper MCP

> A zero-dependency Node.js MCP server for managing your arXiv paper library. Search, download, classify, and translate academic papers — all through natural language.

[中文](README.md)

---

## Features

| Tool | Description |
|------|-------------|
| `paper_search` | Search arXiv with filters (category, date, author, title). `check_local=true` marks already-downloaded papers. |
| `paper_download` | Download PDF + auto-classify by primary category. Creates `.pdf` (titled), `.md` (bilingual summary), `.meta.json`. |
| `paper_classify` | AI-driven subcategory assignment. View mode returns abstract + existing subcategories in the library, so the AI maintains naming consistency. Then AI executes the move into `category/subcategory/`. |
| `paper_list` | Browse library. Filter by category, subcategory, or classification status. |
| `paper_translate` | AI translates English abstracts to Chinese. Saves bilingual `.md` and `.meta.json`. |

## Quick Start

### Prerequisites

- Node.js 18+ (built-in `fetch` required)
- An MCP-compatible agent (OpenCode, Claude Code, etc.)

### Installation

```bash
git clone https://github.com/wrqaxjm/arxiv-paper-mcp.git
cd arxiv-paper-mcp
```

**Zero dependencies. No `npm install` needed.**

### Configuration

Set storage path via environment variable (defaults to `./papers`):

```bash
export ARXIV_PAPER_STORAGE=/path/to/your/library
```

#### OpenCode

Add to `opencode.jsonc`:

```jsonc
{
  "mcp": {
    "arxiv": {
      "type": "local",
      "command": ["node", "/path/to/arxiv-paper-mcp/server.js"],
      "enabled": true,
      "environment": {
        "ARXIV_PAPER_STORAGE": "/path/to/papers"
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

## Usage

Load the skill or describe tasks naturally:

> "Search arXiv for the latest papers on visual SLAM, download the top 5, and classify them by topic."

### Workflow

```
search → select → download → AI classify → verify → translate → read
```

### Parallel Processing

For batch operations, dispatch parallel task subagents. Each paper has a unique filename — no conflicts.

```
task(subagent, "download arxiv_id=xxx")
task(subagent, "download arxiv_id=yyy")
task(subagent, "download arxiv_id=zzz")
```

### Library Structure

```
your-library/
├── cs.AI/marl/
│   ├── Paper_Title__2301.xxxxx.pdf
│   ├── Paper_Title__2301.xxxxx.md      # bilingual summary + notes
│   └── Paper_Title__2301.xxxxx.meta.json
├── cs.CV/vision-transformer/...
├── cs.RO/slam/...
└── cs.CL/transformer-architecture/...
```

## Bilingual Abstracts

Each `.md` file has both English and Chinese abstracts:

```markdown
# Paper Title
- **Authors**: Author Names
- **arXiv ID**: 2301.xxxxx

## 摘要（English）
The paper's abstract...

## 摘要（中文）
Chinese translation...

## 我的笔记
<!-- Your reading notes here -->
```

Translation is done by the AI agent (no external translation API), with academic terms kept in English.

## Zero Dependencies

No `npm install`. Uses only Node.js built-in modules (`fs`, `path`, `fetch`). arXiv Atom XML is parsed with a lightweight regex parser.

## License

MIT
