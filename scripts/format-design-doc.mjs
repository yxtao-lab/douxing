/**
 * 将 Word 详细设计文档整理为 Markdown
 * 用法：node scripts/format-design-doc.mjs [docx路径]
 * 默认读取：e:/Desktop/详细设计文档.docx
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const rawPath = resolve(root, 'docs/.docx-raw.txt');
const outPath = resolve(root, 'docs/详细设计文档.md');

const docxPath = process.argv[2] || 'e:/Desktop/详细设计文档.docx';

if (existsSync(docxPath)) {
  const py = `
import zipfile, xml.etree.ElementTree as ET
path = r'${docxPath.replace(/\\/g, '/')}'
with zipfile.ZipFile(path) as z:
    xml = z.read('word/document.xml')
root = ET.fromstring(xml)
ns = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
paragraphs = []
for p in root.iter(ns + 'p'):
    texts = []
    for t in p.iter(ns + 't'):
        if t.text: texts.append(t.text)
        if t.tail: texts.append(t.tail)
    line = ''.join(texts).strip()
    if line: paragraphs.append(line)
open(r'${rawPath.replace(/\\/g, '/')}', 'w', encoding='utf-8').write(chr(10).join(paragraphs))
print('extracted', len(paragraphs), 'paragraphs')
`;
  execSync(`python -c ${JSON.stringify(py)}`, { stdio: 'inherit', cwd: root });
} else if (!existsSync(rawPath)) {
  console.error('未找到 docx 或 .docx-raw.txt，请指定 Word 路径');
  process.exit(1);
}

const raw = readFileSync(rawPath, 'utf8');
const lines = raw.split('\n');

function slugify(text) {
  return text
    .replace(/^#+\s*/, '')
    .replace(/\*\*/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    .toLowerCase();
}

function isDiagramLine(line) {
  return /^[│┌┐└┘├┤┬┴┼─═▼▲←→\s]+$/.test(line) && /[│┌└├─]/.test(line);
}

function isTableRow(line) {
  return line.trim().startsWith('|');
}

function isTableSeparator(line) {
  return /^\|[\s\-:|]+\|$/.test(line.trim());
}

function fixHeading(line) {
  if (line.startsWith('# 兜行')) return '# 兜行（Douxing）平台详细设计文档';
  if (line === '## 文档信息') return null; // handled in header
  if (line === '## 目录') return null;
  if (line.match(/^## \d+\./)) {
    return line.replace(/^## (\d+)\.\s*/, '## $1. ');
  }
  return line;
}

const out = [];
const toc = [];

// --- 文档头 ---
out.push('# 兜行（Douxing）平台详细设计文档');
out.push('');
out.push('<div align="center">');
out.push('');
out.push('**AI 驱动 · 个性化旅游决策与社交平台**');
out.push('');
out.push('| 项目 | 兜行（Douxing） |');
out.push('|------|----------------|');
out.push('| 文档版本 | **V2.0 最终版** |');
out.push('| 编制日期 | 2024 年 12 月 |');
out.push('| 编制团队 | 产品技术部 |');
out.push('| 文档状态 | 已定稿 |');
out.push('');
out.push('</motion.div>');
out.push('');
out.push('> 本文档由《详细设计文档》Word 原版整理为 Markdown，便于版本管理与在线阅读。');
out.push('> 实施进度请参阅 [ROADMAP.md](./ROADMAP.md)。');
out.push('');
out.push('---');
out.push('');

let i = 0;
// skip until first real chapter
while (i < lines.length && !lines[i].match(/^## 1\./)) i++;

let inCode = false;
let codeLang = 'text';
let codeBuf = [];
let inTable = false;

function flushCode() {
  if (codeBuf.length === 0) return;
  out.push('```' + codeLang);
  out.push(...codeBuf);
  out.push('```');
  out.push('');
  codeBuf = [];
  inCode = false;
  codeLang = 'text';
}

function flushTableBuffer(buf) {
  if (buf.length === 0) return;
  out.push(...buf);
  out.push('');
}

while (i < lines.length) {
  let line = lines[i];
  const trimmed = line.trim();

  if (trimmed === '---') {
    flushCode();
    inTable = false;
    out.push('---');
    out.push('');
    i++;
    continue;
  }

  // mermaid / explicit code fence
  if (trimmed.startsWith('```')) {
    if (inCode) {
      flushCode();
    } else {
      inCode = true;
      codeLang = trimmed.slice(3).trim() || 'text';
    }
    i++;
    continue;
  }

  if (inCode) {
    codeBuf.push(line);
    i++;
    continue;
  }

  // diagram block
  if (isDiagramLine(trimmed) || (trimmed === '▼' || trimmed === '│')) {
    if (!inCode) {
      inCode = true;
      codeLang = 'text';
    }
    codeBuf.push(line);
    i++;
    continue;
  }

  // yaml-like k8s fragments after #### 2.3.1
  if (
    /^(apiVersion|kind|metadata|spec|selector|ports|targetPort|name):/.test(trimmed) &&
    !trimmed.startsWith('|')
  ) {
    if (!inCode) {
      inCode = true;
      codeLang = 'yaml';
    }
    codeBuf.push(line);
    i++;
    continue;
  }

  // heading
  const hFix = fixHeading(line);
  if (hFix === null) {
    i++;
    continue;
  }
  if (hFix !== line && line.startsWith('#')) {
    flushCode();
    inTable = false;
    line = hFix;
  }

  if (line.startsWith('## ') && line.match(/^## \d+\./)) {
    flushCode();
    inTable = false;
    const title = line.replace(/^##\s*/, '');
    const slug = slugify(title);
    toc.push({ level: 2, title, slug });
    out.push(line);
    out.push('');
    i++;
    continue;
  }

  if (line.startsWith('### ')) {
    flushCode();
    inTable = false;
    const title = line.replace(/^###\s*/, '');
    toc.push({ level: 3, title, slug: slugify(title) });
    out.push(line);
    out.push('');
    i++;
    continue;
  }

  if (line.startsWith('#### ')) {
    flushCode();
    inTable = false;
    out.push(line);
    out.push('');
    i++;
    continue;
  }

  // table
  if (isTableRow(trimmed)) {
    flushCode();
    if (!inTable) inTable = true;
    out.push(trimmed);
    i++;
    continue;
  } else if (inTable) {
    inTable = false;
    out.push('');
  }

  // blockquote-style value props
  if (trimmed === '**核心价值主张：**') {
    flushCode();
    out.push('### 核心价值主张');
    out.push('');
    i++;
    continue;
  }

  // empty
  if (!trimmed) {
    if (!inTable) out.push('');
    i++;
    continue;
  }

  // list continuation fix for summary section
  if (trimmed.startsWith('- ') && out[out.length - 1]?.match(/^\d+\.\s\*\*/)) {
    out.push('   ' + trimmed);
    i++;
    continue;
  }

  flushCode();
  out.push(line);
  i++;
}
flushCode();

// Insert TOC after header
const tocBlock = ['## 目录', ''];
for (const item of toc) {
  if (item.level === 2) {
    tocBlock.push(`- [${item.title}](#${item.slug})`);
  }
}
tocBlock.push('');
tocBlock.push('---');
tocBlock.push('');

const finalText = out.join('\n');
const insertAt = finalText.indexOf('---\n\n## 1.');
const withToc =
  finalText.slice(0, insertAt) +
  tocBlock.join('\n') +
  '\n' +
  finalText.slice(insertAt + 4);

// cleanup
const cleaned = withToc
  .replace(/<\/motion\.div>/g, '</div>')
  .replace(/<motion\.motion\.div/g, '<motion.div')
  .replace(/\n{4,}/g, '\n\n\n')
  .replace(/^\|[-\s|]+\|$/gm, (m) => m.replace(/\|/g, '|').replace(/([^|])\s+\|/g, '$1|'));

writeFileSync(outPath, cleaned, 'utf8');
console.log('Written:', outPath, 'chars:', cleaned.length);
try {
  execSync('python scripts/postprocess-design-doc.py', { stdio: 'inherit', cwd: root });
} catch {
  console.warn('请手动运行: python scripts/postprocess-design-doc.py');
}
