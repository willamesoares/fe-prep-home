import { useState } from 'preact/hooks';
import { randomSeed } from '@/lib/seededShuffle';

interface Props {
  allTags: string[];
  tagCounts: Record<string, number>;
  totalCount: number;
}

export default function QuizSetup({ allTags, tagCounts, totalCount }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [count, setCount] = useState(10);

  function toggle(tag: string) {
    const next = new Set(selected);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setSelected(next);
  }

  const availableCount = selected.size === 0
    ? totalCount
    : allTags.reduce((sum, t) => (selected.has(t) ? sum + tagCounts[t]! : sum), 0);

  const effectiveCount = Math.min(count, availableCount);

  function start(e: Event) {
    e.preventDefault();
    const params = new URLSearchParams();
    params.set('seed', randomSeed());
    params.set('count', String(effectiveCount));
    if (selected.size) params.set('tags', Array.from(selected).join(','));
    window.location.href = `/quiz/run/?${params.toString()}`;
  }

  return (
    <form class="quiz-setup" onSubmit={start}>
      <fieldset>
        <legend>Categories</legend>
        <p style="font-size: 0.85rem; color: var(--fg-muted); margin: 0 0 0.75rem">
          Pick one or more, or leave empty for all.
        </p>
        <div class="filters" style="margin: 0">
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              class={`tag-chip ${selected.has(tag) ? 'active' : ''}`}
              data-clickable
              onClick={() => toggle(tag)}
              aria-pressed={selected.has(tag)}
            >
              {tag} ({tagCounts[tag]})
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>How many questions?</legend>
        <label>
          <input
            type="number"
            class="count-input"
            min="1"
            max={Math.max(1, availableCount)}
            value={count}
            onInput={(e) => setCount(Math.max(1, Number((e.target as HTMLInputElement).value)))}
          />
          <span style="margin-left: 0.5rem; color: var(--fg-muted); font-size: 0.85rem">
            of {availableCount} available
          </span>
        </label>
      </fieldset>
      <button type="submit" class="btn primary" disabled={availableCount === 0}>
        Start quiz →
      </button>
    </form>
  );
}
