import type { AuthResponse } from "@shared/types";

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data?.error) return data.error;
  } catch {
    // ignore non-JSON bodies
  }
  return `Ошибка ${response.status}`;
}

/** Tries the httpOnly refresh cookie. Returns null when the session is gone. */
export async function refreshSession(): Promise<AuthResponse | null> {
  const response = await fetch("/api/auth/refresh", { method: "POST", credentials: "include" });
  if (!response.ok) {
    accessToken = null;
    return null;
  }
  const data = (await response.json()) as AuthResponse;
  accessToken = data.accessToken;
  return data;
}

/**
 * Refreshes the access token through the httpOnly cookie.
 *
 * Single-flight: REST retries and the realtime socket share this promise, so a
 * simultaneous 401 in both places makes one request and gets one token. Network
 * failures resolve to null instead of rejecting, letting callers report their
 * own error.
 */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshSession()
      .then((session) => session?.accessToken ?? null)
      .catch(() => null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown } = {},
  retry = true,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(path, {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 401 && retry && !path.startsWith("/api/auth/")) {
    if (await refreshAccessToken()) return api<T>(path, options, false);
  }

  if (!response.ok) throw new ApiError(response.status, await readError(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
