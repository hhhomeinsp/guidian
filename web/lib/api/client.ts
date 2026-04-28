import type { TokenPair } from "./schema";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const ACCESS_KEY = "guidian.access_token";
const REFRESH_KEY = "guidian.refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(ACCESS_KEY) ??
    window.sessionStorage.getItem(ACCESS_KEY)
  );
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    window.localStorage.getItem(REFRESH_KEY) ??
    window.sessionStorage.getItem(REFRESH_KEY)
  );
}

// Legacy alias used by existing hooks
function getAccess(): string | null {
  return getAccessToken();
}

function getRefresh(): string | null {
  return getRefreshToken();
}

/**
 * Persist tokens to storage.
 * Always writes to sessionStorage (immune to iOS private-mode localStorage blocks).
 * If remember=true, also attempts localStorage for cross-session persistence.
 */
export function setTokens(access: string, refresh: string, remember: boolean): void {
  if (typeof window === "undefined") return;
  // sessionStorage always works, even in iOS private browsing
  window.sessionStorage.setItem(ACCESS_KEY, access);
  window.sessionStorage.setItem(REFRESH_KEY, refresh);
  if (remember) {
    try {
      window.localStorage.setItem(ACCESS_KEY, access);
      window.localStorage.setItem(REFRESH_KEY, refresh);
    } catch {
      // iOS private mode throws QuotaExceededError on localStorage writes — sessionStorage fallback is sufficient
    }
  }
}

export function storeTokens(pair: TokenPair) {
  setTokens(pair.access_token, pair.refresh_token, true);
}

export function clearTokens() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  window.sessionStorage.removeItem(ACCESS_KEY);
  window.sessionStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
  }
}

async function rawFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

async function refreshAccessToken(): Promise<string | null> {
  const refresh = getRefresh();
  if (!refresh) return null;
  const res = await rawFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    clearTokens();
    return null;
  }
  const pair = (await res.json()) as TokenPair;
  storeTokens(pair);
  return pair.access_token;
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const access = getAccess();
  const authHeaders = access ? { Authorization: `Bearer ${access}` } : {};
  let res = await rawFetch(path, {
    ...init,
    headers: { ...authHeaders, ...(init.headers ?? {}) },
  });

  if (res.status === 401 && access) {
    const next = await refreshAccessToken();
    if (next) {
      res = await rawFetch(path, {
        ...init,
        headers: { Authorization: `Bearer ${next}`, ...(init.headers ?? {}) },
      });
    }
  }

  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      /* noop */
    }
    throw new ApiError(res.status, body, `API ${res.status} on ${path}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
