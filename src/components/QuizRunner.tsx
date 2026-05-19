import { useEffect, useMemo, useState } from 'preact/hooks';
import { hashSeed, seededShuffle } from '@/lib/seededShuffle';

interface IndexQuestion {
  slug: string;
  title: string;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
  questionHtml: string;
  answerHtml: string;
}

interface Props {
  seed: string;
  tags: string[];
  count: number;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; questions: IndexQuestion[] }
  | { kind: 'done'; questions: IndexQuestion[] };

export default function QuizRunner({ seed, tags, count }: Props) {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<'question' | 'answer'>('question');

  useEffect(() => {
    let cancelled = false;
    fetch('/quiz-index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { questions: IndexQuestion[] }) => {
        if (cancelled) return;
        const filtered = tags.length
          ? data.questions.filter((q) => q.tags.some((t) => tags.includes(t)))
          : data.questions;
        if (filtered.length === 0) {
          setStatus({ kind: 'error', message: 'No questions match the selected tags.' });
          return;
        }
        const seedKey = `${seed}|${tags.slice().sort().join(',')}`;
        const shuffled = seededShuffle(filtered, hashSeed(seedKey));
        const chosen = shuffled.slice(0, Math.min(count, shuffled.length));
        setStatus({ kind: 'ready', questions: chosen });
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({ kind: 'error', message: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [seed, tags.join(','), count]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (status.kind === 'ready') setSide((s) => (s === 'question' ? 'answer' : 'question'));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        advance();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        retreat();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [status, index]);

  function advance() {
    if (status.kind !== 'ready') return;
    if (index + 1 >= status.questions.length) {
      setStatus({ kind: 'done', questions: status.questions });
    } else {
      setIndex(index + 1);
      setSide('question');
    }
  }

  function retreat() {
    if (status.kind !== 'ready' || index === 0) return;
    setIndex(index - 1);
    setSide('question');
  }

  function restart() {
    if (status.kind !== 'done') return;
    setIndex(0);
    setSide('question');
    setStatus({ kind: 'ready', questions: status.questions });
  }

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, [seed, tags, count]);

  if (status.kind === 'loading') return <div class="quiz-card">Loading questions…</div>;

  if (status.kind === 'error') {
    return (
      <div class="quiz-card">
        <p>{status.message}</p>
        <a class="btn" href="/quiz">
          ← Back to quiz setup
        </a>
      </div>
    );
  }

  if (status.kind === 'done') {
    return (
      <div class="quiz-card">
        <h2 style="margin-top:0">Done — {status.questions.length} questions reviewed</h2>
        <p style="color: var(--fg-muted)">Share this quiz to challenge someone with the same set:</p>
        <ShareBox url={shareUrl} />
        <div class="quiz-actions" style="margin-top: 1rem">
          <button class="btn" type="button" onClick={restart}>
            Restart this set
          </button>
          <a class="btn primary" href="/quiz">
            New quiz
          </a>
        </div>
      </div>
    );
  }

  const current = status.questions[index]!;
  const total = status.questions.length;

  return (
    <div class="quiz-card">
      <div class="quiz-progress">
        <span>
          {index + 1} / {total}
        </span>
        <div style="display: flex; gap: 0.4rem; align-items: center">
          <span class={`difficulty ${current.difficulty}`}>{current.difficulty}</span>
          {current.tags.map((t) => (
            <span key={t} class="tag-chip">
              {t}
            </span>
          ))}
        </div>
      </div>
      <h2 style="margin: 0.25rem 0 0; font-size: 1.25rem">{current.title}</h2>
      <div
        key={`${index}-${side}`}
        class="quiz-side"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{
          __html: side === 'question' ? current.questionHtml : current.answerHtml,
        }}
      />
      <div class="quiz-actions">
        <div style="display: flex; gap: 0.5rem">
          <button class="btn" type="button" onClick={retreat} disabled={index === 0}>
            ← Prev
          </button>
          <button
            class="btn primary"
            type="button"
            onClick={() => setSide(side === 'question' ? 'answer' : 'question')}
          >
            {side === 'question' ? 'Show answer' : 'Show question'}
          </button>
        </div>
        <button class="btn" type="button" onClick={advance}>
          {index + 1 === total ? 'Finish' : 'Next →'}
        </button>
      </div>
      <p style="margin: 1rem 0 0; font-size: 0.78rem; color: var(--fg-subtle); text-align: center">
        Tip: Space toggles question/answer · ← → moves between cards
      </p>
    </div>
  );
}

function ShareBox({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    if (!url) return;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <div class="share-box">
      <input type="text" readonly value={url} onFocus={(e) => (e.target as HTMLInputElement).select()} />
      <button class="btn" type="button" onClick={copy}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
