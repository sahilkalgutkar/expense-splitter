let accessToken: string | null = null;
let onAuthExpired: (() => void) | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function registerAuthExpiredHandler(handler: () => void): void {
  onAuthExpired = handler;
}

export function notifyAuthExpired(): void {
  accessToken = null;
  onAuthExpired?.();
}
