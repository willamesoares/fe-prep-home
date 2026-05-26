import { Octokit } from 'octokit';

const UPSTREAM_OWNER = import.meta.env.PUBLIC_REPO_OWNER ?? '';
const UPSTREAM_REPO = import.meta.env.PUBLIC_REPO_NAME ?? '';
const UPSTREAM_BRANCH = import.meta.env.PUBLIC_REPO_BRANCH ?? 'main';

export interface SubmitInput {
  token: string;
  filePath: string;
  fileContent: string;
  title: string;
  body: string;
}

export interface SubmitResult {
  prUrl: string;
}

export async function submitQuestion({
  token,
  filePath,
  fileContent,
  title,
  body,
}: SubmitInput): Promise<SubmitResult> {
  if (!UPSTREAM_OWNER || !UPSTREAM_REPO) {
    throw new Error('PUBLIC_REPO_OWNER / PUBLIC_REPO_NAME are not configured.');
  }
  const octokit = new Octokit({ auth: token });

  const user = (await octokit.rest.users.getAuthenticated()).data;

  await octokit.rest.repos.createFork({ owner: UPSTREAM_OWNER, repo: UPSTREAM_REPO });
  await waitForFork(octokit, user.login, UPSTREAM_REPO);

  const ref = await octokit.rest.git.getRef({
    owner: user.login,
    repo: UPSTREAM_REPO,
    ref: `heads/${UPSTREAM_BRANCH}`,
  });

  const branch = `proposal/${slugFromPath(filePath)}-${Date.now().toString(36)}`;
  await octokit.rest.git.createRef({
    owner: user.login,
    repo: UPSTREAM_REPO,
    ref: `refs/heads/${branch}`,
    sha: ref.data.object.sha,
  });

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: user.login,
    repo: UPSTREAM_REPO,
    path: filePath,
    message: `Add question: ${title}`,
    content: btoa(unescape(encodeURIComponent(fileContent))),
    branch,
  });

  const pr = await octokit.rest.pulls.create({
    owner: UPSTREAM_OWNER,
    repo: UPSTREAM_REPO,
    title: `New question: ${title}`,
    head: `${user.login}:${branch}`,
    base: UPSTREAM_BRANCH,
    body,
    maintainer_can_modify: true,
  });

  return { prUrl: pr.data.html_url };
}

async function waitForFork(octokit: Octokit, owner: string, repo: string) {
  for (let i = 0; i < 20; i++) {
    try {
      await octokit.rest.repos.get({ owner, repo });
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  throw new Error('Fork did not appear in time. Try again in a moment.');
}

function slugFromPath(p: string): string {
  return p.replace(/^content\//, '').replace(/\.md$/, '').replace(/\//g, '-');
}

export interface FetchedQuestion {
  raw: string;
  path: string;
}

export async function fetchQuestionForEdit(slug: string): Promise<FetchedQuestion> {
  if (!UPSTREAM_OWNER || !UPSTREAM_REPO) {
    throw new Error('PUBLIC_REPO_OWNER / PUBLIC_REPO_NAME are not configured.');
  }
  const path = `content/${slug}.md`;
  const octokit = new Octokit();
  const res = await octokit.rest.repos.getContent({
    owner: UPSTREAM_OWNER,
    repo: UPSTREAM_REPO,
    path,
    ref: UPSTREAM_BRANCH,
  });
  if (Array.isArray(res.data) || res.data.type !== 'file' || !('content' in res.data)) {
    throw new Error(`Expected a file at ${path}`);
  }
  const bytes = Uint8Array.from(atob(res.data.content.replace(/\n/g, '')), (c) => c.charCodeAt(0));
  const raw = new TextDecoder('utf-8').decode(bytes);
  return { raw, path };
}

export async function updateQuestion({
  token,
  filePath,
  fileContent,
  title,
  body,
}: SubmitInput): Promise<SubmitResult> {
  if (!UPSTREAM_OWNER || !UPSTREAM_REPO) {
    throw new Error('PUBLIC_REPO_OWNER / PUBLIC_REPO_NAME are not configured.');
  }
  const octokit = new Octokit({ auth: token });
  const user = (await octokit.rest.users.getAuthenticated()).data;

  await octokit.rest.repos.createFork({ owner: UPSTREAM_OWNER, repo: UPSTREAM_REPO });
  await waitForFork(octokit, user.login, UPSTREAM_REPO);

  try {
    await octokit.rest.repos.mergeUpstream({
      owner: user.login,
      repo: UPSTREAM_REPO,
      branch: UPSTREAM_BRANCH,
    });
  } catch {
    // Fork may already be up to date, or the merge isn't fast-forwardable.
    // Either way, fall through — we'll branch from whatever main currently points at.
  }

  const ref = await octokit.rest.git.getRef({
    owner: user.login,
    repo: UPSTREAM_REPO,
    ref: `heads/${UPSTREAM_BRANCH}`,
  });

  const branch = `edit/${slugFromPath(filePath)}-${Date.now().toString(36)}`;
  await octokit.rest.git.createRef({
    owner: user.login,
    repo: UPSTREAM_REPO,
    ref: `refs/heads/${branch}`,
    sha: ref.data.object.sha,
  });

  const current = await octokit.rest.repos.getContent({
    owner: user.login,
    repo: UPSTREAM_REPO,
    path: filePath,
    ref: branch,
  });
  if (Array.isArray(current.data) || current.data.type !== 'file') {
    throw new Error(`Expected an existing file at ${filePath}`);
  }

  await octokit.rest.repos.createOrUpdateFileContents({
    owner: user.login,
    repo: UPSTREAM_REPO,
    path: filePath,
    message: `Update question: ${title}`,
    content: btoa(unescape(encodeURIComponent(fileContent))),
    branch,
    sha: current.data.sha,
  });

  const pr = await octokit.rest.pulls.create({
    owner: UPSTREAM_OWNER,
    repo: UPSTREAM_REPO,
    title: `Edit: ${title}`,
    head: `${user.login}:${branch}`,
    base: UPSTREAM_BRANCH,
    body,
    maintainer_can_modify: true,
  });

  return { prUrl: pr.data.html_url };
}
