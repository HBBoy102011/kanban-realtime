import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hoisted = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => void;
  const socket = {
    auth: {} as Record<string, unknown>,
    active: false,
    connected: false,
    handlers: new Map<string, Handler[]>(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    on(event: string, handler: Handler) {
      const list = socket.handlers.get(event) ?? [];
      list.push(handler);
      socket.handlers.set(event, list);
      return socket;
    },
    emit(event: string, ...args: unknown[]) {
      for (const handler of socket.handlers.get(event) ?? []) handler(...args);
    },
    reset() {
      socket.handlers.clear();
      socket.auth = {};
      socket.active = false;
      socket.connect.mockClear();
      socket.disconnect.mockClear();
    },
  };
  const io = vi.fn((options?: { auth?: Record<string, unknown> }) => {
    socket.auth = options?.auth ?? {};
    return socket;
  });
  return { socket, io };
});

vi.mock("socket.io-client", () => ({ io: hoisted.io }));

const USER = { id: "u1", email: "user@example.com", name: "Test" };
const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  hoisted.socket.reset();
  hoisted.io.mockClear();
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createBoardSocket", () => {
  it("shares one refresh between a REST 401 and a rejected socket handshake", async () => {
    const api = await import("./api");
    const { createBoardSocket } = await import("./boardSocket");
    api.setAccessToken("stale");

    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        if (String(input).includes("/api/auth/refresh")) {
          refreshCalls += 1;
          await new Promise((resolve) => setTimeout(resolve, 20));
          return json({ accessToken: "fresh", user: USER });
        }
        const headers = (init?.headers ?? {}) as Record<string, string>;
        return headers.Authorization === "Bearer fresh" ? json({ boards: [] }) : json({ error: "no" }, 401);
      }),
    );

    const onAuthLost = vi.fn();
    const socket = createBoardSocket({ onAuthLost });
    const rest = api.api<{ boards: unknown[] }>("/api/boards");
    hoisted.socket.emit("connect_error", new Error("unauthorized"));

    await expect(rest).resolves.toEqual({ boards: [] });
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(refreshCalls).toBe(1);
    expect(socket.auth).toEqual({ token: "fresh" });
    expect(hoisted.socket.connect).toHaveBeenCalledTimes(1);
    expect(onAuthLost).not.toHaveBeenCalled();
  });

  it("reports auth loss once and stops retrying when the refresh cookie is gone", async () => {
    const api = await import("./api");
    const { createBoardSocket } = await import("./boardSocket");
    api.setAccessToken("stale");

    let refreshCalls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        refreshCalls += 1;
        return json({ error: "expired" }, 401);
      }),
    );

    const onAuthLost = vi.fn();
    const socket = createBoardSocket({ onAuthLost });
    hoisted.socket.emit("connect_error", new Error("unauthorized"));
    await new Promise((resolve) => setTimeout(resolve, 20));
    hoisted.socket.emit("connect_error", new Error("unauthorized"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(refreshCalls).toBe(1);
    expect(onAuthLost).toHaveBeenCalledTimes(1);
    expect(hoisted.socket.disconnect).toHaveBeenCalledTimes(1);
    expect(socket.auth).toEqual({ token: "stale" });
    expect(api.getAccessToken()).toBeNull();
  });
});
