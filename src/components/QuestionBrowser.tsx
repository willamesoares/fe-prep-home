import { useMemo, useState } from 'preact/hooks';

export interface QuestionMeta {
  slug: string;
  title: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface Props {
  questions: QuestionMeta[];
  allTags: string[];
}

export default function QuestionBrowser({ questions, allTags }: Props) {
  const [active, setActive] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return questions.filter((it) => {
      if (active.size > 0 && !it.tags.some((t) => active.has(t))) return false;
      if (q && !it.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [questions, active, query]);

  function toggleTag(tag: string) {
    const next = new Set(active);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setActive(next);
  }

  return (
    <div>
      <input
        class="search-input"
        type="search"
        placeholder="Search questions…"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        aria-label="Search questions"
      />
      <div class="filters" role="group" aria-label="Filter by tag">
        <span class="filters-label">Tags:</span>
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            class={`tag-chip ${active.has(tag) ? 'active' : ''}`}
            data-clickable
            onClick={() => toggleTag(tag)}
            aria-pressed={active.has(tag)}
          >
            {tag}
          </button>
        ))}
        {active.size > 0 && (
          <button type="button" class="tag-chip" data-clickable onClick={() => setActive(new Set())}>
            clear
          </button>
        )}
      </div>
      {filtered.length === 0 ? (
        <div class="empty">No questions match these filters.</div>
      ) : (
        <div>
          {filtered.map((it) => (
            <a key={it.slug} class="q-card" href={`/q/${it.slug}/`}>
              <div class="q-card-title">{it.title}</div>
              <div class="q-card-meta">
                <span class={`difficulty ${it.difficulty}`}>{it.difficulty}</span>
                {it.tags.map((t) => (
                  <span key={t} class="tag-chip">
                    {t}
                  </span>
                ))}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
