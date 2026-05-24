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

type Result = 'right' | 'review';

interface QuizParams {
  seed: string;
  tags: string[];
  count: number;
}

type Status =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; questions: IndexQuestion[] }
  | { kind: 'done'; questions: IndexQuestion[] };

function parseParams(): QuizParams {
  const u = new URLSearchParams(window.location.search);
  return {
    seed: u.get('seed') || 'default',
    tags: (u.get('tags') || '').split(',').filter(Boolean),
    count: Math.max(1, Math.min(100, Number(u.get('count') || '10'))),
  };
}

export default function QuizRunner() {
  const [params, setParams] = useState<QuizParams | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'loading' });
  const [index, setIndex] = useState(0);
  const [side, setSide] = useState<'question' | 'answer'>('question');
  const [results, setResults] = useState<Record<number, Result>>({});

  useEffect(() => {
    setParams(parseParams());
  }, []);

  useEffect(() => {
    if (!params) return;
    let cancelled = false;
    fetch('/quiz-index.json')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: { questions: IndexQuestion[] }) => {
        if (cancelled) return;
        const filtered = params.tags.length
          ? data.questions.filter((q) => q.tags.some((t) => params.tags.includes(t)))
          : data.questions;
        if (filtered.length === 0) {
          setStatus({ kind: 'error', message: 'No questions match the selected tags.' });
          return;
        }
        const seedKey = `${params.seed}|${params.tags.slice().sort().join(',')}`;
        const shuffled = seededShuffle(filtered, hashSeed(seedKey));
        const chosen = shuffled.slice(0, Math.min(params.count, shuffled.length));
        setStatus({ kind: 'ready', questions: chosen });
        setIndex(0);
        setSide('question');
        setResults({});
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus({ kind: 'error', message: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [params]);

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

  function markAndAdvance(result: Result) {
    if (status.kind !== 'ready') return;
    setResults({ ...results, [index]: result });
    advance();
  }

  function restart() {
    if (status.kind !== 'done') return;
    setIndex(0);
    setSide('question');
    setResults({});
    setStatus({ kind: 'ready', questions: status.questions });
  }

  function retryMissed() {
    if (status.kind !== 'done') return;
    const missed = status.questions.filter((_, i) => results[i] === 'review');
    if (missed.length === 0) return;
    setIndex(0);
    setSide('question');
    setResults({});
    setStatus({ kind: 'ready', questions: missed });
  }

  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.href;
  }, [params]);

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
    const total = status.questions.length;
    const rightCount = Object.values(results).filter((r) => r === 'right').length;
    const reviewCount = Object.values(results).filter((r) => r === 'review').length;
    const skipped = total - rightCount - reviewCount;
    return (
      <div class="quiz-card">
        <h2 style="margin-top:0">Done — {total} questions reviewed</h2>
        <p style="color: var(--fg-muted); margin: 0 0 1rem">
          <strong style="color: var(--easy)">{rightCount} right</strong> ·{' '}
          <strong style="color: var(--medium)">{reviewCount} to review</strong> ·{' '}
          <span>{skipped} skipped</span>
        </p>
        <p style="color: var(--fg-muted)">Share this quiz to challenge someone with the same set:</p>
        <ShareBox url={shareUrl} />
        <div class="quiz-actions" style="margin-top: 1rem">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
            <button class="btn" type="button" onClick={restart}>
              Restart this set
            </button>
            {reviewCount > 0 && (
              <button class="btn primary" type="button" onClick={retryMissed}>
                Retry missed ({reviewCount})
              </button>
            )}
          </div>
          <a class="btn" href="/quiz">
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
      <div class="quiz-pips" aria-hidden="true">
        {status.questions.map((_, i) => {
          const r = results[i];
          const cls = i === index ? 'current' : r ? r : 'pending';
          return <span key={i} class={`quiz-pip ${cls}`} />;
        })}
      </div>
      <h2 style="margin: 0.25rem 0 0; font-size: 1.25rem">{current.title}</h2>
      <div
        key={`${index}-${side}`}
        class="quiz-side"
        dangerouslySetInnerHTML={{
          __html: side === 'question' ? current.questionHtml : current.answerHtml,
        }}
      />
      <div class="quiz-actions">
        <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
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
        {side === 'answer' ? (
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap">
            <button class="btn btn-review" type="button" onClick={() => markAndAdvance('review')}>
              Review
            </button>
            <button class="btn btn-right" type="button" onClick={() => markAndAdvance('right')}>
              Got it →
            </button>
          </div>
        ) : (
          <button class="btn" type="button" onClick={advance}>
            {index + 1 === total ? 'Finish' : 'Next →'}
          </button>
        )}
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
