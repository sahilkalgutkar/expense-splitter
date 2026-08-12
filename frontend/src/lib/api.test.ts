import axios, { type AxiosAdapter } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// axios.create() inherits `adapter` from axios.defaults at creation time, so this fake must be
// installed before `./api` (which calls axios.create()) is imported. Every test reassigns
// `currentHandler` rather than swapping the adapter itself, keeping one real interceptor pipeline
// under test throughout — only the transport layer is faked, not axios's own request/response chain.
type FakeResponse = { status: number; data?: unknown };
let currentHandler: (config: {
  url?: string;
  headers: Record<string, unknown>;
}) => FakeResponse | Promise<FakeResponse>;

const fakeAdapter: AxiosAdapter = async (config) => {
  const result = await currentHandler(config as { url?: string; headers: Record<string, unknown> });
  const response = {
    data: result.data ?? {},
    status: result.status,
    statusText: String(result.status),
    headers: {},
    config,
  };
  if (result.status >= 200 && result.status < 300) return response;

  const error = new Error(`Request failed with status ${result.status}`) as Error & {
    isAxiosError: true;
    response: typeof response;
    config: typeof config;
  };
  error.isAxiosError = true;
  error.response = response;
  error.config = config;
  throw error;
};
axios.defaults.adapter = fakeAdapter;

const { api, API_BASE_URL } = await import('./api');
const { getAccessToken, setAccessToken, registerAuthExpiredHandler } = await import('./tokenStore');

describe('api interceptors', () => {
  beforeEach(() => {
    setAccessToken(null);
    registerAuthExpiredHandler(() => undefined);
    currentHandler = () => ({ status: 200 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('attaches a Bearer authorization header when an access token is present', async () => {
    setAccessToken('my-token');
    let seenAuth: unknown;
    currentHandler = (config) => {
      seenAuth = config.headers.Authorization;
      return { status: 200 };
    };

    await api.get('/whatever');

    expect(seenAuth).toBe('Bearer my-token');
  });

  it('omits the authorization header when there is no access token', async () => {
    let seenAuth: unknown;
    currentHandler = (config) => {
      seenAuth = config.headers.Authorization;
      return { status: 200 };
    };

    await api.get('/whatever');

    expect(seenAuth).toBeUndefined();
  });

  it('passes through a successful response unchanged', async () => {
    currentHandler = () => ({ status: 200, data: { hello: 'world' } });

    const res = await api.get('/whatever');

    expect(res.data).toEqual({ hello: 'world' });
  });

  it('on a 401, refreshes the token and retries the original request once', async () => {
    let refreshCalls = 0;
    let protectedCalls = 0;

    currentHandler = (config) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls++;
        return { status: 200, data: { accessToken: 'refreshed-token' } };
      }
      protectedCalls++;
      const authed = config.headers.Authorization === 'Bearer refreshed-token';
      return authed ? { status: 200, data: { ok: true } } : { status: 401 };
    };

    const res = await api.get('/groups');

    expect(refreshCalls).toBe(1);
    expect(protectedCalls).toBe(2); // first 401, then the retry with the refreshed token
    expect(res.data).toEqual({ ok: true });
    expect(getAccessToken()).toBe('refreshed-token');
  });

  it('dedupes concurrent refreshes: two 401s in flight trigger only one refresh call', async () => {
    let refreshCalls = 0;

    currentHandler = (config) => {
      if (config.url?.includes('/auth/refresh')) {
        refreshCalls++;
        return { status: 200, data: { accessToken: 'refreshed-token' } };
      }
      const authed = config.headers.Authorization === 'Bearer refreshed-token';
      return authed ? { status: 200, data: { ok: true } } : { status: 401 };
    };

    const [a, b] = await Promise.all([api.get('/groups'), api.get('/expenses')]);

    expect(refreshCalls).toBe(1);
    expect(a.data).toEqual({ ok: true });
    expect(b.data).toEqual({ ok: true });
  });

  it('does not retry a second time if the retried request also comes back 401', async () => {
    let protectedCalls = 0;
    currentHandler = (config) => {
      if (config.url?.includes('/auth/refresh')) {
        return { status: 200, data: { accessToken: 'still-bad-token' } };
      }
      protectedCalls++;
      return { status: 401 };
    };
    const notifySpy = vi.fn();
    registerAuthExpiredHandler(notifySpy);

    await expect(api.get('/groups')).rejects.toMatchObject({ response: { status: 401 } });
    // one initial call + exactly one retry, never a third attempt
    expect(protectedCalls).toBe(2);
  });

  it('does not attempt a refresh for a 401 from an auth endpoint itself', async () => {
    let refreshCalls = 0;
    currentHandler = (config) => {
      if (config.url?.includes('/auth/')) {
        refreshCalls++;
        return { status: 401 };
      }
      return { status: 200 };
    };

    await expect(api.post('/auth/login', {})).rejects.toMatchObject({ response: { status: 401 } });
    // the only /auth/ call made is the login attempt itself - no refresh was triggered from it
    expect(refreshCalls).toBe(1);
  });

  it('calls the auth-expired handler and clears the token when the refresh itself fails', async () => {
    setAccessToken('stale-token');
    currentHandler = (config) => {
      if (config.url?.includes('/auth/refresh')) {
        return { status: 401 };
      }
      return { status: 401 };
    };
    const notifySpy = vi.fn();
    registerAuthExpiredHandler(notifySpy);

    await expect(api.get('/groups')).rejects.toMatchObject({ response: { status: 401 } });

    expect(notifySpy).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('propagates non-401 errors without attempting a refresh', async () => {
    let refreshCalls = 0;
    currentHandler = (config) => {
      if (config.url?.includes('/auth/refresh')) refreshCalls++;
      return { status: 500 };
    };

    await expect(api.get('/groups')).rejects.toMatchObject({ response: { status: 500 } });
    expect(refreshCalls).toBe(0);
  });

  it('has a sane default base URL', () => {
    expect(API_BASE_URL).toBeTruthy();
  });
});
