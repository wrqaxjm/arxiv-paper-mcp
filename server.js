// arXiv Paper Management MCP Server v2 — zero dependencies
// Tools: paper_search, paper_download, paper_classify, paper_list
// Storage: F:/arxiv-lunwen/<category>/<subcategory>/<title>__<arxiv_id>.{pdf,md,meta.json}

const ARXIV_API = "http://export.arxiv.org/api/query"
const ARXIV_PDF = "https://arxiv.org/pdf"
const STORAGE = process.env.ARXIV_PAPER_STORAGE || "./papers"

const TOOLS = [
  {
    name: "paper_search",
    description: "Search arXiv for papers. Returns title, authors, year, abstract, arxiv_id, categories, and PDF URL. Set check_local=true to mark which papers are already in your library.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query. Use ti: for title, au: for author, cat: for category (cs.AI, cs.LG, cs.CV, cs.RO, etc). Supports AND/OR/ANDNOT." },
        max_results: { type: "number", description: "Max results (default 10, max 50)" },
        sort: { type: "string", enum: ["relevance", "submittedDate", "lastUpdatedDate"], description: "Sort order (default: relevance)" },
        order: { type: "string", enum: ["ascending", "descending"], description: "Sort direction (default: descending)" },
        check_local: { type: "boolean", description: "If true, scan local library and mark in_library for each result (default: false)" }
      },
      required: ["query"]
    }
  },
  {
    name: "paper_download",
    description: `Download an arXiv paper PDF with auto-classification. Creates three files: .pdf (titled filename), .md (human-readable summary with notes section), .meta.json (machine-readable metadata). Saves to ${STORAGE}/<primary_category>/. Filename format: <sanitized_title>__<arxiv_id>.pdf. If metadata fetch fails, falls back to arxiv_id as filename.`,
    inputSchema: {
      type: "object",
      properties: {
        arxiv_id: { type: "string", description: "arXiv paper ID, e.g. '1706.03762'" }
      },
      required: ["arxiv_id"]
    }
  },
  {
    name: "paper_classify",
    description: "Classify a downloaded paper into a subcategory. TWO MODES: (1) Without subcategory — returns paper metadata (title, abstract, current path) for the AI to read and decide a subcategory. (2) With subcategory — moves the paper's .pdf/.md/.meta.json into F:/arxiv-lunwen/<category>/<subcategory>/ and updates metadata. The AI decides the subcategory after reading the abstract; this tool only executes the move.",
    inputSchema: {
      type: "object",
      properties: {
        arxiv_id: { type: "string", description: "arXiv paper ID to classify" },
        subcategory: { type: "string", description: "Subcategory name (e.g. 'transformer', 'SLAM', 'grasping'). Omit to view metadata first; provide to execute the move. Auto-normalized to lowercase-hyphenated." },
        category: { type: "string", description: "Override main category (optional, defaults to existing)" }
      },
      required: ["arxiv_id"]
    }
  },
  {
    name: "paper_list",
    description: "List all papers in the local library. Scans .meta.json files under F:/arxiv-lunwen/. Supports filtering by category, subcategory, or classification status.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string", description: "Filter by main category (e.g. 'cs.CV')" },
        subcategory: { type: "string", description: "Filter by subcategory (e.g. 'transformer')" },
        status: { type: "string", enum: ["待分类", "已分类"], description: "Filter by classification status" }
      }
    }
  },
  {
    name: "paper_translate",
    description: "Save a Chinese translation of the paper's abstract. The AI reads the English abstract (from paper_download or paper_classify view mode), translates it to Chinese, then calls this tool to save the translation into the .md and .meta.json files. The .md is rebuilt with bilingual sections: '## 摘要（English）' and '## 摘要（中文）'. User notes in the '## 我的笔记' section are preserved.",
    inputSchema: {
      type: "object",
      properties: {
        arxiv_id: { type: "string", description: "arXiv paper ID" },
        chinese_abstract: { type: "string", description: "Chinese translation of the abstract, written by the AI after reading the English version" }
      },
      required: ["arxiv_id", "chinese_abstract"]
    }
  }
]

// ── Helpers ──

function response(id, result) {
  return JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n"
}

function err(id, code, message) {
  return JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
}

// Sanitize paper title for use as filename
function sanitizeTitle(title) {
  if (!title) return ""
  let s = title.trim()
  // Remove LaTeX inline math: $...$ → keep inner content
  s = s.replace(/\$([^$]+)\$/g, (_, inner) => inner)
  // Remove LaTeX commands: \textbf{...} → ..., \emph{...} → ..., etc.
  s = s.replace(/\\(?:textbf|emph|textit|texttt|text|mathrm|mathbf|mathit)\{([^}]*)\}/g, (_, inner) => inner)
  // Remove other backslash commands (e.g. \alpha, \beta)
  s = s.replace(/\\[a-zA-Z]+/g, "")
  // Remove file-system illegal characters
  s = s.replace(/[\/\\:*?"<>|]/g, "")
  // Replace whitespace with underscore
  s = s.replace(/\s+/g, "_")
  // Collapse consecutive underscores
  s = s.replace(/_+/g, "_")
  // Remove leading/trailing underscores
  s = s.replace(/^_+|_+$/g, "")
  // Truncate to 100 chars
  if (s.length > 100) s = s.substring(0, 100)
  return s
}

// Normalize subcategory name: "Transformer Architecture" → "transformer-architecture"
function normalizeSubcategory(sub) {
  if (!sub) return ""
  let s = sub.trim().toLowerCase()
  s = s.replace(/\s+/g, "-")
  s = s.replace(/[^a-z0-9-]/g, "")
  s = s.replace(/-+/g, "-")
  s = s.replace(/^-+|-+$/g, "")
  return s
}

// Parse arXiv Atom XML feed → array of paper objects
function parseArxivAtom(xml) {
  const entries = []
  const re = /<entry>([\s\S]*?)<\/entry>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    const e = m[1]
    const tag = (t) => {
      const r = new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`, "i")
      const match = r.exec(e)
      return match ? match[1].replace(/<[^>]+>/g, "").trim() : ""
    }
    const idUrl = tag("id")
    const arxivId = idUrl.replace(/^.*\/abs\//, "")

    const categories = []
    const catRe = /<category[^>]*term="([^"]+)"/gi
    let cm
    while ((cm = catRe.exec(e)) !== null) categories.push(cm[1])

    const authors = []
    const authorRe = /<author>([\s\S]*?)<\/author>/gi
    let am
    while ((am = authorRe.exec(e)) !== null) {
      const n = /<name>([^<]+)<\/name>/i.exec(am[1])
      if (n) authors.push(n[1].trim())
    }

    const pdfMatch = e.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i)
    const pdfUrl = pdfMatch ? pdfMatch[1] : `${ARXIV_PDF}/${arxivId}`

    entries.push({
      arxiv_id: arxivId,
      title: tag("title"),
      authors,
      abstract: tag("summary").replace(/\s+/g, " "),
      year: (tag("published").match(/^(\d{4})/) || [])[1] || null,
      published: tag("published"),
      updated: tag("updated"),
      categories,
      pdf_url: pdfUrl,
      primary_category: (e.match(/<arxiv:primary_category[^>]*term="([^"]+)"/i) || [])[1] || (categories[0] || "")
    })
  }
  return entries
}

// Fetch single paper metadata by arxiv_id
async function fetchMetadata(arxivId) {
  const url = `${ARXIV_API}?id_list=${encodeURIComponent(arxivId)}&max_results=1`
  const res = await fetch(url, { headers: { "User-Agent": "opencode-paper-mcp/2.0" } })
  if (!res.ok) throw new Error(`arXiv API HTTP ${res.status}`)
  const xml = await res.text()
  const papers = parseArxivAtom(xml)
  if (papers.length === 0) throw new Error("Paper not found on arXiv")
  return papers[0]
}

// Recursively scan storage for .meta.json files
async function scanMetaFiles() {
  const fs = await import("fs")
  const path = await import("path")
  const results = []

  function scan(dir) {
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch (e) { return }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scan(fullPath)
      } else if (entry.name.endsWith(".meta.json")) {
        try {
          const content = fs.readFileSync(fullPath, "utf8")
          const meta = JSON.parse(content)
          meta._meta_path = fullPath
          results.push(meta)
        } catch (e) { /* skip corrupt */ }
      }
    }
  }

  try { scan(STORAGE) } catch (e) {}
  return results
}

// Build .md content from metadata (bilingual: English + Chinese)
function buildMdContent(meta, category, subcategory, existingNotes) {
  const title = meta.title || "(title unavailable)"
  const authors = (meta.authors || []).join(", ") || "(unknown)"
  const year = meta.year || "unknown"
  const abstract = meta.abstract || "(abstract unavailable)"
  const chineseAbstract = meta.chinese_abstract || "（待翻译）"
  const subDisplay = subcategory || "待分类"
  const notes = existingNotes || "<!-- 在此记录阅读笔记，工具不会修改此区域 -->"

  return `# ${title}

- **作者**: ${authors}
- **年份**: ${year}
- **arXiv ID**: ${meta.arxiv_id}
- **主分类**: ${category}
- **子分类**: ${subDisplay}

## 摘要（English）
${abstract}

## 摘要（中文）
${chineseAbstract}

## 我的笔记
${notes}
`
}

// ── Tool Handlers ──

async function toolSearch(args) {
  const max = Math.min(args.max_results || 10, 50)
  const q = encodeURIComponent(args.query)
  const sb = args.sort || "relevance"
  const so = args.order || "descending"

  const url = `${ARXIV_API}?search_query=${q}&start=0&max_results=${max}&sortBy=${sb}&sortOrder=${so}`
  const res = await fetch(url, { headers: { "User-Agent": "opencode-paper-mcp/2.0" } })
  if (!res.ok) throw new Error(`arXiv API HTTP ${res.status}: ${res.statusText}`)

  const xml = await res.text()
  const papers = parseArxivAtom(xml)

  // Check local library if requested
  let localIds = new Set()
  if (args.check_local) {
    const localMeta = await scanMetaFiles()
    for (const m of localMeta) {
      localIds.add(m.arxiv_id)
      localIds.add(m.arxiv_id.replace(/v\d+$/, ""))
    }
  }

  const results = papers.map(p => {
    const idNoVersion = p.arxiv_id.replace(/v\d+$/, "")
    const r = {
      arxiv_id: p.arxiv_id,
      title: p.title,
      authors: p.authors,
      year: p.year,
      abstract: p.abstract,
      categories: p.categories,
      primary_category: p.primary_category,
      pdf_url: p.pdf_url
    }
    if (args.check_local) {
      r.in_library = localIds.has(p.arxiv_id) || localIds.has(idNoVersion)
    }
    return r
  })

  return {
    query: args.query,
    total: results.length,
    check_local: args.check_local || false,
    papers: results
  }
}

async function toolDownload(args) {
  const fs = await import("fs")
  const path = await import("path")

  const id = args.arxiv_id.replace(/^arxiv:/i, "").trim()
  const idNoVersion = id.replace(/v\d+$/, "")

  // Check if paper already exists in library
  const allMeta = await scanMetaFiles()
  const existing = allMeta.find(m =>
    m.arxiv_id === id ||
    m.arxiv_id === idNoVersion ||
    m.arxiv_id.replace(/v\d+$/, "") === idNoVersion
  )
  if (existing) {
    return {
      arxiv_id: existing.arxiv_id,
      title: existing.title,
      category: existing.category,
      subcategory: existing.subcategory || "",
      path: path.dirname(existing._meta_path),
      already_exists: true,
      hint: "Paper already in library. Use paper_classify to reclassify or paper_translate to add Chinese abstract."
    }
  }

  const pdfUrl = `${ARXIV_PDF}/${id}`

  // 1. Fetch metadata (with fallback on failure)
  let meta = null
  let metaFetchFailed = false
  try {
    meta = await fetchMetadata(id)
  } catch (e) {
    metaFetchFailed = true
    meta = {
      arxiv_id: id,
      title: "",
      authors: [],
      year: null,
      abstract: "",
      primary_category: "uncategorized"
    }
  }

  // 2. Sanitize title for filename
  let titlePart = sanitizeTitle(meta.title)
  if (!titlePart) titlePart = id  // fallback to arxiv_id if title empty
  const basename = `${titlePart}__${id}`

  // 3. Determine directory (main category only, no subcategory yet)
  const category = meta.primary_category || "uncategorized"
  const dir = path.join(STORAGE, category)
  try { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }) } catch (e) {}

  // 4. Download PDF to temp file first (atomic write)
  const pdfPath = path.join(dir, `${basename}.pdf`)
  const tmpPath = path.join(dir, `${basename}.pdf.tmp`)

  const fRes = await fetch(pdfUrl, {
    headers: { "User-Agent": "opencode-paper-mcp/2.0" }
  })
  if (!fRes.ok) throw new Error(`PDF download HTTP ${fRes.status}: ${fRes.statusText}`)

  const buf = Buffer.from(await fRes.arrayBuffer())
  fs.writeFileSync(tmpPath, buf)

  // Rename temp → final (handle Windows file-exists edge case)
  try {
    fs.renameSync(tmpPath, pdfPath)
  } catch (e) {
    try { fs.unlinkSync(pdfPath) } catch (e2) {}
    fs.renameSync(tmpPath, pdfPath)
  }

  // 5. Create .md summary
  const mdPath = path.join(dir, `${basename}.md`)
  fs.writeFileSync(mdPath, buildMdContent(meta, category, ""))

  // 6. Create .meta.json
  const metaPath = path.join(dir, `${basename}.meta.json`)
  const metaContent = {
    arxiv_id: id,
    title: meta.title || "",
    authors: meta.authors || [],
    year: meta.year,
    abstract: meta.abstract || "",
    category: category,
    subcategory: "",
    downloaded_at: new Date().toISOString(),
    file_basename: basename,
    metadata_available: !metaFetchFailed
  }
  fs.writeFileSync(metaPath, JSON.stringify(metaContent, null, 2))

  return {
    arxiv_id: id,
    title: meta.title || "(metadata unavailable)",
    authors: meta.authors || [],
    year: meta.year,
    category: category,
    subcategory: "",
    pdf_path: pdfPath,
    md_path: mdPath,
    meta_path: metaPath,
    size_bytes: buf.length,
    metadata_available: !metaFetchFailed
  }
}

async function toolClassify(args) {
  const fs = await import("fs")
  const path = await import("path")

  const arxivId = args.arxiv_id.replace(/^arxiv:/i, "").trim()
  const arxivIdNoVersion = arxivId.replace(/v\d+$/, "")

  // Find the paper's .meta.json by scanning
  const allMeta = await scanMetaFiles()
  const meta = allMeta.find(m =>
    m.arxiv_id === arxivId ||
    m.arxiv_id === arxivIdNoVersion ||
    m.arxiv_id.replace(/v\d+$/, "") === arxivIdNoVersion
  )

  if (!meta) {
    return { error: `Paper ${arxivId} not found in library. Download it first with paper_download.` }
  }

  // ── View mode: return metadata for AI to read and decide ──
  if (!args.subcategory) {
    return {
      arxiv_id: meta.arxiv_id,
      title: meta.title || "(unknown)",
      authors: meta.authors || [],
      year: meta.year,
      abstract: meta.abstract || "",
      category: meta.category,
      current_subcategory: meta.subcategory || "(none)",
      current_path: path.dirname(meta._meta_path),
      hint: "Read the abstract above, then call paper_classify again with a subcategory to move this paper."
    }
  }

  // ── Execute mode: move files to subcategory ──
  const subcategory = normalizeSubcategory(args.subcategory)
  const category = args.category || meta.category
  const oldDir = path.dirname(meta._meta_path)
  const newDir = path.join(STORAGE, category, subcategory)

  // Create new directory
  try { if (!fs.existsSync(newDir)) fs.mkdirSync(newDir, { recursive: true }) } catch (e) {}

  // Move three files: .pdf, .md, .meta.json
  // Use copy+delete instead of rename: more reliable on Windows for large files
  const basename = meta.file_basename
  const extensions = [".pdf", ".md", ".meta.json"]
  for (const ext of extensions) {
    const oldPath = path.join(oldDir, `${basename}${ext}`)
    const newPath = path.join(newDir, `${basename}${ext}`)
    if (!fs.existsSync(oldPath)) continue

    // Step 1: copy to new location
    try { fs.copyFileSync(oldPath, newPath) } catch (e) { /* try rename as fallback */ }
    if (!fs.existsSync(newPath)) {
      try { fs.renameSync(oldPath, newPath) } catch (e2) {}
    }

    // Step 2: delete old location (only if new location exists to avoid data loss)
    if (fs.existsSync(newPath)) {
      try { fs.unlinkSync(oldPath) } catch (e3) {}
    }
  }

  // Verify: clean up any remaining old files
  for (const ext of extensions) {
    const oldPath = path.join(oldDir, `${basename}${ext}`)
    if (fs.existsSync(oldPath)) {
      try { fs.unlinkSync(oldPath) } catch (e) {}
    }
  }

  // Update .meta.json with new classification
  meta.category = category
  meta.subcategory = subcategory
  delete meta._meta_path
  const newMetaPath = path.join(newDir, `${basename}.meta.json`)
  fs.writeFileSync(newMetaPath, JSON.stringify(meta, null, 2))

  // Also update the .md file's subcategory field
  const newMdPath = path.join(newDir, `${basename}.md`)
  try {
    let mdContent = fs.readFileSync(newMdPath, "utf8")
    mdContent = mdContent.replace(/\*\*子分类\*\*:.*$/m, `**子分类**: ${subcategory}`)
    mdContent = mdContent.replace(/\*\*主分类\*\*:.*$/m, `**主分类**: ${category}`)
    fs.writeFileSync(newMdPath, mdContent)
  } catch (e) { /* non-critical */ }

  // Clean up empty old directory (only if it's a subcategory folder, not the main category)
  if (oldDir !== newDir) {
    try {
      const remaining = fs.readdirSync(oldDir)
      if (remaining.length === 0) fs.rmdirSync(oldDir)
    } catch (e) {}
  }

  return {
    arxiv_id: meta.arxiv_id,
    title: meta.title,
    old_path: oldDir,
    new_path: newDir,
    category: category,
    subcategory: subcategory,
    moved_files: [`${basename}.pdf`, `${basename}.md`, `${basename}.meta.json`]
  }
}

async function toolList(args) {
  const path = await import("path")

  const allMeta = await scanMetaFiles()

  let filtered = allMeta
  if (args.category) {
    filtered = filtered.filter(m => m.category === args.category)
  }
  if (args.subcategory) {
    const norm = normalizeSubcategory(args.subcategory)
    filtered = filtered.filter(m => normalizeSubcategory(m.subcategory || "") === norm)
  }
  if (args.status === "待分类") {
    filtered = filtered.filter(m => !m.subcategory)
  } else if (args.status === "已分类") {
    filtered = filtered.filter(m => m.subcategory)
  }

  // Build tree structure
  const tree = {}
  for (const meta of filtered) {
    const cat = meta.category || "uncategorized"
    const sub = meta.subcategory || "(待分类)"
    if (!tree[cat]) tree[cat] = {}
    if (!tree[cat][sub]) tree[cat][sub] = []
    tree[cat][sub].push({
      arxiv_id: meta.arxiv_id,
      title: meta.title || "(unknown)",
      year: meta.year
    })
  }

  return {
    total: filtered.length,
    filters: {
      category: args.category || null,
      subcategory: args.subcategory || null,
      status: args.status || null
    },
    library: tree
  }
}

async function toolTranslate(args) {
  const fs = await import("fs")
  const path = await import("path")

  const arxivId = args.arxiv_id.replace(/^arxiv:/i, "").trim()
  const arxivIdNoVersion = arxivId.replace(/v\d+$/, "")

  // Find the paper's .meta.json
  const allMeta = await scanMetaFiles()
  const meta = allMeta.find(m =>
    m.arxiv_id === arxivId ||
    m.arxiv_id === arxivIdNoVersion ||
    m.arxiv_id.replace(/v\d+$/, "") === arxivIdNoVersion
  )

  if (!meta) {
    return { error: `Paper ${arxivId} not found in library. Download it first with paper_download.` }
  }

  const basename = meta.file_basename
  const dir = path.dirname(meta._meta_path)
  const mdPath = path.join(dir, `${basename}.md`)
  const metaPath = path.join(dir, `${basename}.meta.json`)

  // Extract existing notes from .md (preserve user notes)
  let existingNotes = ""
  try {
    const mdContent = fs.readFileSync(mdPath, "utf8")
    const notesMatch = mdContent.match(/## 我的笔记\n([\s\S]*?)$/)
    if (notesMatch) existingNotes = notesMatch[1].trim()
  } catch (e) {}

  // Update .meta.json with Chinese abstract
  meta.chinese_abstract = args.chinese_abstract
  delete meta._meta_path
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2))

  // Rebuild .md with bilingual content (preserves notes)
  const newMd = buildMdContent(meta, meta.category, meta.subcategory, existingNotes)
  fs.writeFileSync(mdPath, newMd)

  return {
    arxiv_id: meta.arxiv_id,
    title: meta.title,
    chinese_abstract_saved: true,
    md_path: mdPath,
    meta_path: metaPath
  }
}

// ── MCP Protocol ──

async function handle(msg) {
  const { id, method, params } = msg

  try {
    if (method === "initialize") {
      return response(id, {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "arxiv-mcp", version: "2.0.0" }
      })
    }

    if (method === "tools/list") {
      return response(id, { tools: TOOLS })
    }

    if (method === "tools/call") {
      const { name, arguments: callArgs } = params
      const args = callArgs || {}

      let result
      switch (name) {
        case "paper_search":    result = await toolSearch(args); break
        case "paper_download":  result = await toolDownload(args); break
        case "paper_classify":  result = await toolClassify(args); break
        case "paper_list":      result = await toolList(args); break
        case "paper_translate": result = await toolTranslate(args); break
        default: return err(id, -32601, `Unknown tool: ${name}`)
      }

      return response(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
      })
    }

    if (method === "notifications/initialized") return null

    return err(id, -32601, `Unknown method: ${method}`)
  } catch (e) {
    return err(id, -32603, String(e.message || e))
  }
}

// ── Main Loop ──

let buf = ""
let pending = 0
let stdinEnded = false

process.stdin.setEncoding("utf8")
process.stdin.on("data", (chunk) => {
  buf += chunk
  while (buf.includes("\n")) {
    const idx = buf.indexOf("\n")
    const line = buf.slice(0, idx).trim()
    buf = buf.slice(idx + 1)
    if (!line) continue
    let msg
    try { msg = JSON.parse(line) } catch { continue }
    pending++
    handle(msg).then((r) => {
      if (r) process.stdout.write(r)
      pending--
      if (stdinEnded && pending === 0) process.exit(0)
    })
  }
})

process.stdin.on("end", () => {
  stdinEnded = true
  if (pending === 0) process.exit(0)
})

process.stderr.write("[arxiv-mcp v2.0] Server started\n")
