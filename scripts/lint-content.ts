import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import matter from 'gray-matter';

const ROOT = process.cwd();
const CONTENT_DIR = join(ROOT, 'content');

const TAGS = [
  'react',
  'js',
  'css',
  'html',
  'performance',
  'algorithm',
  'a11y',
  'tooling',
] as const;
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

interface Issue {
  file: string;
  message: string;
}

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const out: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

async function lintFile(file: string): Promise<Issue[]> {
  const rel = relative(ROOT, file);
  const issues: Issue[] = [];
  const raw = await readFile(file, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data;

  if (!isObject(data)) {
    issues.push({ file: rel, message: 'frontmatter is missing or invalid' });
    return issues;
  }
  if (typeof data.title !== 'string' || data.title.trim().length < 5) {
    issues.push({ file: rel, message: 'title must be a string of at least 5 characters' });
  }
  if (!Array.isArray(data.tags) || data.tags.length === 0) {
    issues.push({ file: rel, message: 'tags must be a non-empty array' });
  } else {
    for (const t of data.tags) {
      if (typeof t !== 'string' || !(TAGS as readonly string[]).includes(t)) {
        issues.push({ file: rel, message: `unknown tag: ${JSON.stringify(t)}` });
      }
    }
  }
  if (
    typeof data.difficulty !== 'string' ||
    !(DIFFICULTIES as readonly string[]).includes(data.difficulty)
  ) {
    issues.push({
      file: rel,
      message: `difficulty must be one of ${DIFFICULTIES.join(', ')}`,
    });
  }

  const body = parsed.content;
  if (!/^#\s+Question\s*$/m.test(body)) {
    issues.push({ file: rel, message: 'missing `# Question` H1 heading' });
  }
  if (!/^#\s+Answer\s*$/m.test(body)) {
    issues.push({ file: rel, message: 'missing `# Answer` H1 heading' });
  }

  const expectedFolder = Array.isArray(data.tags) && typeof data.tags[0] === 'string' ? data.tags[0] : null;
  if (expectedFolder) {
    const folder = rel.split('/')[1];
    if (folder && folder !== expectedFolder && (TAGS as readonly string[]).includes(folder)) {
      issues.push({
        file: rel,
        message: `file is in content/${folder}/ but primary tag is "${expectedFolder}"`,
      });
    }
  }

  return issues;
}

async function main() {
  const files = await walk(CONTENT_DIR);
  const all: Issue[] = [];
  for (const f of files) all.push(...(await lintFile(f)));
  if (all.length === 0) {
    console.log(`OK — ${files.length} files passed`);
    return;
  }
  for (const i of all) console.error(`  ${i.file}: ${i.message}`);
  console.error(`\n${all.length} issue(s) across ${files.length} files`);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
