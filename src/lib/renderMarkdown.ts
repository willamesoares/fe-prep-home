import { Marked } from 'marked';
import { createHighlighter, type Highlighter } from 'shiki';

const LANG_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  sh: 'bash',
  shell: 'bash',
};

const LANGUAGES = [
  'javascript',
  'typescript',
  'css',
  'html',
  'json',
  'bash',
  'markdown',
];

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-light', 'github-dark'],
      langs: LANGUAGES,
    });
  }
  return highlighterPromise;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function renderMarkdown(markdown: string): Promise<string> {
  const highlighter = await getHighlighter();
  const marked = new Marked({
    gfm: true,
    breaks: false,
  });

  marked.use({
    renderer: {
      code(this: any, token: any) {
        const raw = token.text ?? '';
        const langRaw = (token.lang ?? '').trim().toLowerCase();
        const lang = LANG_ALIASES[langRaw] ?? langRaw;
        if (!lang || !LANGUAGES.includes(lang)) {
          return `<pre><code>${escapeHtml(raw)}</code></pre>`;
        }
        return highlighter.codeToHtml(raw, {
          lang,
          themes: { light: 'github-light', dark: 'github-dark' },
        });
      },
    },
  });

  return marked.parse(markdown, { async: false }) as string;
}
