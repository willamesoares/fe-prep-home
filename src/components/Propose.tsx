import { useEffect, useRef, useState } from 'preact/hooks';
import { EditorView, basicSetup } from 'codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorState } from '@codemirror/state';
import {
  clearToken,
  getStoredToken,
  hasClientId,
  pollForToken,
  requestDeviceCode,
  storeToken,
  type DeviceCodeResponse,
} from '@/lib/githubOAuth';
import { fetchQuestionForEdit, submitQuestion, updateQuestion } from '@/lib/octokit';
import { slugify } from '@/lib/slug';
import { TAGS, DIFFICULTIES, TAG_PATTERN, normalizeTag } from '@/lib/constants';
import { parseFrontmatter } from '@/lib/frontmatter';

interface Props {
  suggestedTags?: readonly string[];
}

const TEMPLATE = `# Question

Write the question here. Code samples are welcome:

\`\`\`js
// example
\`\`\`

# Answer

Write a thorough, opinionated answer here. Include code, gotchas, and rules of thumb.
`;

type AuthState =
  | { kind: 'signed-out' }
  | { kind: 'requesting' }
  | { kind: 'verifying'; device: DeviceCodeResponse }
  | { kind: 'signed-in'; token: string }
  | { kind: 'error'; message: string };

export default function Propose({ suggestedTags = TAGS }: Props) {
  const [auth, setAuth] = useState<AuthState>(() => {
    const t = getStoredToken();
    return t ? { kind: 'signed-in', token: t } : { kind: 'signed-out' };
  });

  const [title, setTitle] = useState('');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [customTagInput, setCustomTagInput] = useState('');
  const [tagError, setTagError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTIES)[number]>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ prUrl: string } | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editPath, setEditPath] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [primaryTagLocked, setPrimaryTagLocked] = useState<string | null>(null);

  const editorParent = useRef<HTMLDivElement>(null);
  const editorView = useRef<EditorView | null>(null);
  const [body, setBody] = useState('');
  const [initialBody, setInitialBody] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const slug = new URLSearchParams(window.location.search).get('edit');
    if (slug) {
      setEditSlug(slug);
    } else {
      setInitialBody(TEMPLATE);
    }
  }, []);

  useEffect(() => {
    if (!editSlug) return;
    let cancelled = false;
    setEditLoading(true);
    fetchQuestionForEdit(editSlug)
      .then(({ raw, path }) => {
        if (cancelled) return;
        const { data, body: fmBody } = parseFrontmatter(raw);
        if (data.title) setTitle(data.title);
        if (data.tags && data.tags.length > 0) {
          setSelectedTags(new Set(data.tags));
          setPrimaryTagLocked(data.tags[0]);
        }
        if (data.difficulty) setDifficulty(data.difficulty);
        setEditPath(path);
        setInitialBody(fmBody.replace(/^\s+/, '').replace(/\s+$/, '') + '\n');
      })
      .catch((e) => {
        if (cancelled) return;
        setEditError(`Couldn't load that question for editing: ${String(e)}`);
        setInitialBody(TEMPLATE);
      })
      .finally(() => {
        if (!cancelled) setEditLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [editSlug]);

  useEffect(() => {
    if (!editorParent.current || editorView.current || initialBody === null) return;
    editorView.current = new EditorView({
      state: EditorState.create({
        doc: initialBody,
        extensions: [
          basicSetup,
          markdown(),
          EditorView.lineWrapping,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) setBody(u.state.doc.toString());
          }),
        ],
      }),
      parent: editorParent.current,
    });
    setBody(initialBody);
    return () => {
      editorView.current?.destroy();
      editorView.current = null;
    };
  }, [initialBody]);

  async function startSignIn() {
    if (!hasClientId()) {
      setAuth({
        kind: 'error',
        message:
          'GitHub sign-in is not configured for this deployment. Set PUBLIC_GITHUB_CLIENT_ID and PUBLIC_OAUTH_PROXY_URL.',
      });
      return;
    }
    setAuth({ kind: 'requesting' });
    try {
      const device = await requestDeviceCode();
      setAuth({ kind: 'verifying', device });
      const token = await pollForToken(device.device_code, device.interval);
      storeToken(token);
      setAuth({ kind: 'signed-in', token });
    } catch (e) {
      setAuth({ kind: 'error', message: String(e) });
    }
  }

  function signOut() {
    clearToken();
    setAuth({ kind: 'signed-out' });
  }

  function toggleTag(tag: string) {
    if (primaryTagLocked && tag === primaryTagLocked) return;
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag);
    else next.add(tag);
    setSelectedTags(next);
  }

  function addCustomTag() {
    const normalized = normalizeTag(customTagInput);
    if (!normalized) {
      setTagError('Enter a tag name.');
      return;
    }
    if (normalized.length > 30) {
      setTagError('Tag must be 30 characters or fewer.');
      return;
    }
    if (!TAG_PATTERN.test(normalized)) {
      setTagError('Tags can only contain lowercase letters, numbers, and dashes.');
      return;
    }
    if (selectedTags.has(normalized)) {
      setTagError('That tag is already selected.');
      return;
    }
    const next = new Set(selectedTags);
    next.add(normalized);
    setSelectedTags(next);
    setCustomTagInput('');
    setTagError(null);
  }

  function validate(): string | null {
    if (auth.kind !== 'signed-in') return 'Sign in to submit.';
    if (title.trim().length < 5) return 'Title must be at least 5 characters.';
    if (selectedTags.size === 0) return 'Pick at least one tag.';
    if (!/^#\s+Question/m.test(body)) return 'Body must contain a `# Question` heading.';
    if (!/^#\s+Answer/m.test(body)) return 'Body must contain a `# Answer` heading.';
    return null;
  }

  async function submit(e: Event) {
    e.preventDefault();
    if (auth.kind !== 'signed-in') return;
    const err = validate();
    if (err) {
      setSubmitError(err);
      return;
    }
    setSubmitError(null);
    setSubmitting(true);
    try {
      const primaryTag = Array.from(selectedTags)[0]!;
      const filePath = editPath ?? `content/${primaryTag}/${slugify(title)}.md`;
      const frontmatter = [
        '---',
        `title: ${JSON.stringify(title.trim())}`,
        `tags: [${Array.from(selectedTags).join(', ')}]`,
        `difficulty: ${difficulty}`,
        '---',
        '',
      ].join('\n');
      const fileContent = frontmatter + body.trim() + '\n';
      const prBody = [
        editSlug
          ? `Edit to \`${filePath}\` proposed via fe-prep.`
          : `Proposed via fe-prep.`,
        '',
        `**Title:** ${title}`,
        `**Tags:** ${Array.from(selectedTags).join(', ')}`,
        `**Difficulty:** ${difficulty}`,
      ].join('\n');
      const out = editSlug
        ? await updateQuestion({
            token: auth.token,
            filePath,
            fileContent,
            title,
            body: prBody,
          })
        : await submitQuestion({
            token: auth.token,
            filePath,
            fileContent,
            title,
            body: prBody,
          });
      setResult(out);
    } catch (e) {
      setSubmitError(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div class="quiz-card">
        <h2 style="margin-top: 0">
          Thanks — your {editSlug ? 'edit' : 'question'} is submitted
        </h2>
        <p>
          Your pull request is now open. A maintainer will review it and the change will appear
          on the site once merged.
        </p>
        <a class="btn primary" href={result.prUrl} target="_blank" rel="noopener noreferrer">
          View PR on GitHub →
        </a>
      </div>
    );
  }

  return (
    <div>
      {editSlug && (
        <div
          class="quiz-card"
          style="margin-bottom: 1rem; padding: 0.75rem 1rem; font-size: 0.9rem"
        >
          {editLoading ? (
            <>Loading <code>content/{editSlug}.md</code>…</>
          ) : editError ? (
            <span style="color: var(--hard)">{editError}</span>
          ) : (
            <>
              Editing <code>content/{editSlug}.md</code>. The primary tag is fixed (changing it
              would move the file to another folder).
            </>
          )}
        </div>
      )}
      <AuthPanel auth={auth} onSignIn={startSignIn} onSignOut={signOut} />
      <form onSubmit={submit} style="margin-top: 1.5rem">
        <label style="display:block; margin-bottom: 0.75rem">
          <div style="font-weight: 600; margin-bottom: 0.25rem">Title</div>
          <input
            type="text"
            class="search-input"
            style="margin-bottom: 0"
            placeholder="How does …"
            value={title}
            onInput={(e) => setTitle((e.target as HTMLInputElement).value)}
            required
          />
        </label>
        <div style="margin-bottom: 0.75rem">
          <div style="font-weight: 600; margin-bottom: 0.4rem">Tags</div>
          <div style="font-size: 0.78rem; color: var(--fg-subtle); margin: 0 0 0.4rem">
            Suggested tags
          </div>
          <div class="filters" style="margin: 0">
            {suggestedTags.map((tag) => {
              const locked = primaryTagLocked === tag;
              return (
                <button
                  key={tag}
                  type="button"
                  class={`tag-chip ${selectedTags.has(tag) ? 'active' : ''}`}
                  data-clickable
                  onClick={() => toggleTag(tag)}
                  aria-pressed={selectedTags.has(tag)}
                  disabled={locked}
                  title={locked ? 'Primary tag — fixed in edit mode' : undefined}
                  style={locked ? 'cursor: not-allowed; opacity: 0.85' : undefined}
                >
                  {tag}
                </button>
              );
            })}
          </div>
          {Array.from(selectedTags).some((t) => !suggestedTags.includes(t)) && (
            <>
              <div style="font-size: 0.78rem; color: var(--fg-subtle); margin: 0.6rem 0 0.4rem">
                Custom tags
              </div>
              <div class="filters" style="margin: 0">
                {Array.from(selectedTags)
                  .filter((t) => !suggestedTags.includes(t))
                  .map((tag) => {
                    const locked = primaryTagLocked === tag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        class="tag-chip active"
                        data-clickable
                        onClick={() => toggleTag(tag)}
                        aria-pressed={true}
                        disabled={locked}
                        title={locked ? 'Primary tag — fixed in edit mode' : 'Click to remove'}
                        style={locked ? 'cursor: not-allowed; opacity: 0.85' : undefined}
                      >
                        {tag}{locked ? '' : ' ×'}
                      </button>
                    );
                  })}
              </div>
            </>
          )}
          <div style="display: flex; gap: 0.5rem; margin-top: 0.6rem">
            <input
              type="text"
              class="search-input"
              style="margin: 0; flex: 1"
              placeholder="Add a custom tag (e.g. typescript)"
              value={customTagInput}
              onInput={(e) => {
                setCustomTagInput((e.target as HTMLInputElement).value);
                if (tagError) setTagError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomTag();
                }
              }}
            />
            <button type="button" class="btn" onClick={addCustomTag}>
              Add
            </button>
          </div>
          {tagError && (
            <p style="font-size: 0.78rem; color: var(--hard); margin: 0.4rem 0 0">{tagError}</p>
          )}
          <p style="font-size: 0.78rem; color: var(--fg-subtle); margin: 0.4rem 0 0">
            First tag = folder the file lives in. Custom tags must be lowercase letters, numbers, and dashes.
          </p>
        </div>
        <label style="display:block; margin-bottom: 1rem">
          <div style="font-weight: 600; margin-bottom: 0.25rem">Difficulty</div>
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty((e.target as HTMLSelectElement).value as typeof difficulty)
            }
            style="padding: 0.5rem; border-radius: var(--radius); border: 1px solid var(--border); background: var(--bg-elev); color: var(--fg)"
          >
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>
        <div style="font-weight: 600; margin-bottom: 0.25rem">Body</div>
        <div
          ref={editorParent}
          style="border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; min-height: 360px; background: var(--bg-elev)"
        />
        <p style="font-size: 0.78rem; color: var(--fg-subtle); margin: 0.4rem 0 1rem">
          Must include `# Question` and `# Answer` H1 headings. Triple-backtick code fences are
          highlighted on the site.
        </p>
        {submitError && (
          <div class="propose-warning" style="margin-bottom: 1rem">
            {submitError}
          </div>
        )}
        <button
          type="submit"
          class="btn primary"
          disabled={auth.kind !== 'signed-in' || submitting || editLoading}
        >
          {submitting
            ? 'Submitting…'
            : editSlug
              ? 'Submit edit as pull request'
              : 'Submit as pull request'}
        </button>
      </form>
    </div>
  );
}

function AuthPanel({
  auth,
  onSignIn,
  onSignOut,
}: {
  auth: AuthState;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  if (auth.kind === 'signed-in') {
    return (
      <div style="display:flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.85rem; background: var(--bg-elev); border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.9rem">
        <span>✓ Signed in to GitHub</span>
        <button type="button" class="btn" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    );
  }
  if (auth.kind === 'requesting') {
    return <div class="quiz-card">Requesting device code…</div>;
  }
  if (auth.kind === 'verifying') {
    return (
      <div class="quiz-card">
        <h3 style="margin-top: 0">Finish signing in</h3>
        <p>
          Open <a href={auth.device.verification_uri} target="_blank" rel="noopener noreferrer">
            {auth.device.verification_uri}
          </a>{' '}
          and enter this code:
        </p>
        <code
          style="display:block; font-size: 1.5rem; padding: 0.5rem 1rem; background: var(--code-bg); border-radius: var(--radius); letter-spacing: 0.15em; text-align: center; user-select: all"
        >
          {auth.device.user_code}
        </code>
        <p style="font-size: 0.85rem; color: var(--fg-muted); margin-top: 0.75rem">
          Waiting for confirmation…
        </p>
      </div>
    );
  }
  if (auth.kind === 'error') {
    return (
      <div class="propose-warning">
        {auth.message}
        <button type="button" class="btn" style="margin-left: 0.5rem" onClick={onSignIn}>
          Retry
        </button>
      </div>
    );
  }
  return (
    <div class="quiz-card">
      <h3 style="margin-top: 0">Sign in to submit</h3>
      <p style="color: var(--fg-muted); margin: 0 0 1rem">
        Your submission opens a pull request from your fork. Maintainers review it and merge it
        when ready. We never store your data.
      </p>
      <button type="button" class="btn primary" onClick={onSignIn}>
        Sign in with GitHub
      </button>
    </div>
  );
}
