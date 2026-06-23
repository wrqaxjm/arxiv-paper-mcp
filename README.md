# ArXiv Paper MCP

A zero-dependency Node.js MCP server for managing your arXiv paper library. Search, download, classify, and translate academic papers — all through natural language via your AI coding agent (OpenCode, Claude Code, etc.).

## Features

| Tool | Description |
|------|-------------|
| `paper_search` | Search arXiv with filters (category, date, author, title). Supports `check_local` to mark already-downloaded papers. |
| `paper_download` | Download PDF + auto-classify by arXiv primary category. Creates three files: `.pdf` (titled by paper name), `.md` (bilingual summary), `.meta.json` (machine-readable metadata). |
| `paper_classify` | AI-driven subcategory assignment. Agent reads the abstract → decides a subcategory → tool moves files into `category/subcategory/` folders. |
| `paper_list` | Browse your local library. Filter by category, subcategory, or classification status. |
| `paper_translate` | AI translates English abstracts to Chinese. Saves bilingual summaries in `.md` and `.meta.json`. |

## Quick Start

### Prerequisites
- Node.js 18+ (built-in `fetch` required)
- An MCP-compatible agent (OpenCode, Claude Code, etc.)

### Installation

```bash
# Clone
git clone https://github.com/YOUR_USERNAME/arxiv-paper-mcp.git
cd arxiv-paper-mcp
```

### Configuration

Set the paper storage directory via environment variable (defaults to `./papers`):

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

## Usage

Load the `arxiv-research` skill in your agent, or describe your task naturally:

> "Search for the latest papers on visual SLAM from arXiv, download the top 5, and classify them by topic."

### Workflow

```
search → read abstracts → download → AI-driven classify → list → translate → read
```

### Directory Structure

After downloading and classifying:

```
your-library/
├── cs.AI/
│   └── marl/
│       ├── Paper_Title__2301.xxxxx.pdf
│       ├── Paper_Title__2301.xxxxx.md      # bilingual summary + notes
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

## Bilingual Abstracts

Each downloaded paper gets a `.md` file with both English and Chinese abstracts:

```markdown
# Paper Title
- **作者**: Author Names
- **arXiv ID**: 2301.xxxxx

## 摘要（English）
The paper's abstract in English...

## 摘要（中文）
论文摘要的中文翻译...

## 我的笔记
<!-- Your reading notes here -->
```

Chinese translation is done by the AI agent (not an external API), preserving academic terminology in English.

## Parallel Processing

For batch operations (downloading or translating multiple papers), dispatch parallel task subagents. Each subagent handles one paper independently — no file conflicts because each paper has a unique filename.

## Zero Dependencies

No npm install required. Uses only Node.js built-in modules (`fs`, `path`, `fetch`). The arXiv API returns Atom XML, which is parsed with a lightweight regex-based parser.

## License

MIT
