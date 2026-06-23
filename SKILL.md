---
name: arxiv-research
description: |
  Complete arXiv paper research workflow. Use this skill when the user wants to search for, download, classify, or manage academic papers. Covers CS/AI/robotics/ML papers from arXiv. Includes search with local library check, titled PDF download with auto-classification, AI-driven subcategory assignment, bilingual translation via parallel subagents, and library browsing.
---

# arXiv Paper Research

Manage your arXiv paper library through the arxiv MCP server.

## Setup

Add to your agent's config (OpenCode: `opencode.jsonc`, Claude: `claude_desktop_config.json`):

```jsonc
"arxiv": {
  "type": "local",
  "command": ["node", "/path/to/arxiv-paper-mcp/server.js"],
  "enabled": true,
  "environment": { "ARXIV_PAPER_STORAGE": "/your/path" },
  "timeout": 300000
}
```

## Tools

| Tool | Usage |
|------|-------|
| `paper_search` | Search arXiv with filters (category, date, author, title). `check_local=true` marks already-downloaded papers. |
| `paper_download` | Download PDF + auto-classify by primary category. Creates `.pdf`, bilingual `.md`, `.meta.json`. |
| `paper_classify` | AI-driven subcategory assignment. Openai view mode first → AI reads abstract and decides → execute mode moves files. |
| `paper_list` | Browse library. Filter by category, subcategory, or status. |
| `paper_translate` | AI translates English abstract to Chinese, saves to `.md` and `.meta.json`. |

## Workflow

```
1. Search  → paper_search(query, check_local=true)
2. Select  → AI reads abstracts, picks papers, skips in_library
3. Download → paper_download (or parallel task subagents for batch)
4. Classify → paper_classify(id) view → AI decides → paper_classify(id, subcategory)
5. Verify  → paper_list(status="待分类")
6. Translate → paper_translate(id, chinese_abstract) (parallel task subagents for batch)
7. Read    → read .md for bilingual summary / read .pdf for full paper
```

## Parallel with Task Subagents (OpenCode)

For batch download or translation, dispatch multiple `task` subagents in one message:

```
task(子agent, "download arxiv_id=xxx")
task(子agent, "download arxiv_id=yyy")
task(子agent, "download arxiv_id=zzz")
```

Each subagent operates independently. No conflicts — each paper has a unique filename.

## Subcategory Naming

AI decides after reading the abstract. Tool auto-normalizes to lowercase-hyphenated. Common labels:

`transformer` `slam` `3d-reconstruction` `grasping` `rl` `llm` `marl`
`imitation-learning` `robot-manipulation` `vision-transformer` `peft`
`image-segmentation` `object-detection` `neural-rendering` `nlp`

## Library Structure

```
your-library/
├── cs.AI\marl\
│   ├── Paper_Title__2301.xxxxx.pdf
│   ├── Paper_Title__2301.xxxxx.md     # bilingual: English + Chinese
│   └── Paper_Title__2301.xxxxx.meta.json
├── cs.CV\vision-transformer\...
├── cs.RO\slam\...
└── cs.CL\transformer-architecture\...
```
