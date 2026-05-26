import type { Difficulty } from './constants';

export interface ParsedFrontmatter {
  title?: string;
  tags?: string[];
  difficulty?: Difficulty;
  author?: string;
}

export function parseFrontmatter(raw: string): { data: ParsedFrontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) return { data: {}, body: raw };
  const fm = match[1] ?? '';
  const body = match[2] ?? '';
  const data: ParsedFrontmatter = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^(\w+):\s*(.*)$/);
    if (!m) continue;
    const [, key, value] = m;
    if (key === 'tags') {
      const arr = value.match(/^\[(.*)\]$/);
      if (arr) {
        data.tags = arr[1]
          .split(',')
          .map((t) => unquote(t))
          .filter(Boolean);
      }
    } else if (key === 'title') {
      data.title = unquote(value);
    } else if (key === 'difficulty') {
      const v = unquote(value);
      if (v === 'easy' || v === 'medium' || v === 'hard') data.difficulty = v;
    } else if (key === 'author') {
      data.author = unquote(value);
    }
  }
  return { data, body };
}

function unquote(s: string): string {
  const t = s.trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    return t.slice(1, -1);
  }
  return t;
}
