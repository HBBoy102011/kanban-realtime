import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { verifyAccessToken, type AuthUser } from "./auth";
import { prisma } from "./db";
import { env } from "./env";
import type { PresenceUser } from "../../../packages/shared/src/types";

const room = (boardId: string): string => `board:${boardId}`;

let io: Server | null = null;
/** boardId -> socketId -> user (unique users are derived when broadcasting). */
const presence = new Map<string, Map<string, AuthUser>>();

export function emitToBoard(boardId: string, event: string, payload: unknown): void {
  io?.to(room(boardId)).emit(event, payload);
}

function broadcastPresence(boardId: string): void {
  const users = [...new Set([...(presence.get(boardId)?.values() ?? [])].map((user) => user.id))]
    .map((id) => {
      const user = [...(presence.get(boardId)?.values() ?? [])].find((candidate) => candidate.id === id);
      return { id, name: user?.name ?? "?" } satisfies PresenceUser;
    });
  io?.to(room(boardId)).emit("presence:update", { boardId, users });
}

function removeFromPresence(boardId: string, socketId: string): void {
  const boardPresence = presence.get(boardId);
  if (!boardPresence) return;
  boardPresence.delete(socketId);
  if (boardPresence.size === 0) presence.delete(boardId);
  broadcastPresence(boardId);
}

export function setupRealtime(server: HttpServer): Server {
  io = new Server(server, {
    cors: { origin: env.clientOrigin, credentials: true },
    serveClient: false,
  });

  io.use((socket, next) => {
    const token = typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : null;
    const user = verifyAccessToken(token);
    if (!user) {
      next(new Error("unauthorized"));
      return;
    }
    socket.data.user = user;
    socket.data.boards = new Set<string>();
    next();
  });

  io.on("connection", (socket) => {
    const user = socket.data.user as AuthUser;
    const joined = socket.data.boards as Set<string>;

    socket.on(
      "board:join",
      async (payload: { boardId?: string }, ack?: (result: { ok: boolean; error?: string }) => void) => {
        try {
          const boardId = String(payload?.boardId ?? "");
          if (!boardId) {
            ack?.({ ok: false, error: "boardId is required" });
            return;
          }
          const member = await prisma.boardMember.findUnique({
            where: { boardId_userId: { boardId, userId: user.id } },
          });
          if (!member) {
            ack?.({ ok: false, error: "forbidden" });
            return;
          }
          await socket.join(room(boardId));
          joined.add(boardId);
          const boardPresence = presence.get(boardId) ?? new Map<string, AuthUser>();
          boardPresence.set(socket.id, user);
          presence.set(boardId, boardPresence);
          broadcastPresence(boardId);
          ack?.({ ok: true });
        } catch (error) {
          console.error("[socket] join failed:", error);
          ack?.({ ok: false, error: "failed" });
        }
      },
    );

    socket.on("board:leave", (payload: { boardId?: string }) => {
      const boardId = String(payload?.boardId ?? "");
      if (!boardId) return;
      socket.leave(room(boardId));
      joined.delete(boardId);
      removeFromPresence(boardId, socket.id);
    });

    socket.on("disconnect", () => {
      for (const boardId of joined) removeFromPresence(boardId, socket.id);
    });
  });

  return io;
}
