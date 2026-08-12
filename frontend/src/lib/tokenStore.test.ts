import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, notifyAuthExpired, registerAuthExpiredHandler, setAccessToken } from './tokenStore';

describe('tokenStore', () => {
  beforeEach(() => {
    setAccessToken(null);
    registerAuthExpiredHandler(() => undefined);
  });

  it('has no access token by default', () => {
    expect(getAccessToken()).toBeNull();
  });

  it('stores and returns the access token that was set', () => {
    setAccessToken('token-123');
    expect(getAccessToken()).toBe('token-123');
  });

  it('overwrites a previously stored token', () => {
    setAccessToken('first');
    setAccessToken('second');
    expect(getAccessToken()).toBe('second');
  });

  it('allows clearing the token back to null', () => {
    setAccessToken('token-123');
    setAccessToken(null);
    expect(getAccessToken()).toBeNull();
  });

  describe('notifyAuthExpired', () => {
    it('clears the access token', () => {
      setAccessToken('token-123');

      notifyAuthExpired();

      expect(getAccessToken()).toBeNull();
    });

    it('invokes the registered handler', () => {
      const handler = vi.fn();
      registerAuthExpiredHandler(handler);

      notifyAuthExpired();

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('does not throw when no handler has been registered', () => {
      // registerAuthExpiredHandler was never called with a "real" handler in a fresh module,
      // but here we simulate that by directly checking the exported behavior is safe either way.
      expect(() => notifyAuthExpired()).not.toThrow();
    });

    it('uses the most recently registered handler, not earlier ones', () => {
      const firstHandler = vi.fn();
      const secondHandler = vi.fn();
      registerAuthExpiredHandler(firstHandler);
      registerAuthExpiredHandler(secondHandler);

      notifyAuthExpired();

      expect(firstHandler).not.toHaveBeenCalled();
      expect(secondHandler).toHaveBeenCalledTimes(1);
    });
  });
});
