const CLIENT_ID = import.meta.env.PUBLIC_GITHUB_CLIENT_ID ?? '';
const PROXY_BASE =
  import.meta.env.PUBLIC_OAUTH_PROXY_URL ?? 'https://github.com';

const TOKEN_KEY = 'fe-prep:gh-token';
const SCOPE = 'public_repo';

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export function getStoredToken(): string | null {
  if (typeof localStorage === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function hasClientId() {
  return Boolean(CLIENT_ID);
}

export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  if (!CLIENT_ID) throw new Error('PUBLIC_GITHUB_CLIENT_ID is not configured.');
  const res = await fetch(`${PROXY_BASE}/login/device/code`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: CLIENT_ID, scope: SCOPE }),
  });
  if (!res.ok) throw new Error(`Device code request failed: HTTP ${res.status}`);
  return res.json();
}

interface TokenResponse {
  access_token?: string;
  error?: string;
  interval?: number;
}

export async function pollForToken(
  deviceCode: string,
  intervalSec: number,
  onTick?: () => void,
): Promise<string> {
  let interval = intervalSec;
  while (true) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    onTick?.();
    const res = await fetch(`${PROXY_BASE}/login/oauth/access_token`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
      }),
    });
    if (!res.ok) throw new Error(`Token poll failed: HTTP ${res.status}`);
    const data: TokenResponse = await res.json();
    if (data.access_token) return data.access_token;
    if (data.error === 'authorization_pending') continue;
    if (data.error === 'slow_down') {
      interval += 5;
      continue;
    }
    throw new Error(data.error ?? 'OAuth failed');
  }
}
