/**
 * End-to-end smoke check against a running dev server (npm run dev).
 * Verifies: auth, board/column/card CRUD, realtime delivery to a second client,
 * 403 for a viewer, and invite links. Creates and deletes its own board.
 *
 *   node scripts/smoke.mjs
 */
import { io } from "socket.io-client";

const BASE = process.env.SMOKE_BASE ?? "http://localhost:8787";

function assert(condition, message) {
  if (!condition) throw new Error(`FAIL: ${message}`);
  console.log(`ok - ${message}`);
}

async function request(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  return { status: response.status, data };
}

async function login(email, password) {
  const { status, data } = await request("/api/auth/login", { method: "POST", body: { email, password } });
  if (status !== 200) throw new Error(`login failed for ${email}: ${status}`);
  return data.accessToken;
}

function waitFor(socket, event, predicate = () => true, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), timeoutMs);
    const handler = (payload) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });
}

const owner = await login("demo@kanban.dev", "demo1234");
const editor = await login("team@kanban.dev", "demo1234");

// Remove boards left behind by an interrupted earlier run.
const existing = await request("/api/boards", { token: owner });
for (const board of existing.data.boards.filter((candidate) => candidate.title.startsWith("SMOKE") && candidate.role === "owner")) {
  await request(`/api/boards/${board.id}`, { method: "DELETE", token: owner });
}

const created = await request("/api/boards", { method: "POST", token: owner, body: { title: "SMOKE board" } });
assert(created.status === 201, "board created");
const boardId = created.data.board.id;
assert(created.data.board.columns.length === 3, "default columns To Do / In Progress / Done");

const invited = await request(`/api/boards/${boardId}/members`, {
  method: "POST",
  token: owner,
  body: { email: "team@kanban.dev", role: "editor" },
});
assert(invited.status === 201, "editor added to the smoke board");

async function connect(token) {
  const candidate = io(BASE, { auth: { token }, transports: ["websocket"] });
  await new Promise((resolve, reject) => {
    candidate.on("connect", resolve);
    candidate.on("connect_error", reject);
  });
  return candidate;
}

const ownerSocket = await connect(owner);
const socket = await connect(editor);
const presencePromise = waitFor(socket, "presence:update", (payload) => payload.users.length >= 2);
const joinedOwner = await new Promise((resolve) => ownerSocket.emit("board:join", { boardId }, resolve));
const joinedEditor = await new Promise((resolve) => socket.emit("board:join", { boardId }, resolve));
assert(joinedOwner?.ok === true && joinedEditor?.ok === true, "both users joined the realtime room");

const presence = await presencePromise;
assert(presence.users.length >= 2, "presence lists both users");

const firstColumn = created.data.board.columns[0];
const secondColumn = created.data.board.columns[1];

const createdEvent = waitFor(socket, "card:created", (payload) => payload.card.title === "SMOKE card");
const cardResponse = await request(`/api/columns/${firstColumn.id}/cards`, {
  method: "POST",
  token: owner,
  body: { title: "SMOKE card", description: "created by smoke test" },
});
assert(cardResponse.status === 201, "card created");
const card = cardResponse.data.card;
await createdEvent;
assert(true, "card:created delivered to the other client");

const movedEvent = waitFor(socket, "card:moved", (payload) => payload.card.id === card.id);
const moved = await request(`/api/cards/${card.id}`, {
  method: "PATCH",
  token: owner,
  body: { columnId: secondColumn.id, position: "m" },
});
assert(moved.status === 200 && moved.data.card.columnId === secondColumn.id, "card moved to another column");
await movedEvent;
assert(true, "card:moved delivered to the other client");

const updatedEvent = waitFor(socket, "card:updated", (payload) => payload.card.title === "SMOKE renamed");
const renamed = await request(`/api/cards/${card.id}`, {
  method: "PATCH",
  token: editor,
  body: { title: "SMOKE renamed" },
});
assert(renamed.status === 200, "editor can rename a card");
await updatedEvent;
assert(true, "card:updated delivered to the other client");

// Viewer role must be rejected by the API, not just hidden in the UI.
const invitee = await request("/api/boards", { method: "POST", token: owner, body: { title: "SMOKE viewer board" } });
const viewerBoardId = invitee.data.board.id;
const added = await request(`/api/boards/${viewerBoardId}/members`, {
  method: "POST",
  token: owner,
  body: { email: "team@kanban.dev", role: "viewer" },
});
assert(added.status === 201, "viewer added to a second board");
const columnId = invitee.data.board.columns[0].id;
const forbidden = await request(`/api/columns/${columnId}/cards`, {
  method: "POST",
  token: editor,
  body: { title: "should fail" },
});
assert(forbidden.status === 403, "viewer gets 403 when creating a card");

const invite = await request(`/api/boards/${viewerBoardId}/invite`, { method: "POST", token: owner });
assert(invite.status === 200 && invite.data.url.includes("/invite/"), "invite link generated");
const accepted = await request(`/api/invites/${invite.data.token}`, { method: "POST", token: editor });
assert(accepted.status === 200 && accepted.data.boardId === viewerBoardId, "invite link accepted");

await request(`/api/cards/${card.id}`, { method: "DELETE", token: owner });
await request(`/api/boards/${viewerBoardId}`, { method: "DELETE", token: owner });
await request(`/api/boards/${boardId}`, { method: "DELETE", token: owner });
assert(true, "cleanup done");

ownerSocket.disconnect();
socket.disconnect();
console.log("\nSMOKE PASSED");
