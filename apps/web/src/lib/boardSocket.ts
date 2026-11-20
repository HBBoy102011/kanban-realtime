import { io, type Socket } from "socket.io-client";
import { getAccessToken, refreshSession } from "./api";

interface BoardSocketOptions {
  /** Called when the refresh cookie is gone too, so the user has to sign in again. */
  onAuthLost: () => void;
}

/**
 * Creates the realtime socket and keeps its handshake token fresh.
 *
 * Socket.IO caches `auth` for the first handshake and reuses it on every
 * reconnection. Once the 15-minute access token expires, the server rejects the
 * handshake with `unauthorized`; instead of asking the user to reload, this
 * helper refreshes the session, swaps in the new access token and lets the
 * manager retry. The retry itself is automatic (the client is already in its
 * reconnection loop), but `socket.connect()` covers the case where it stopped.
 */
export function createBoardSocket({ onAuthLost }: BoardSocketOptions): Socket {
  const socket = io({ auth: { token: getAccessToken() } });
  let refreshing = false;

  socket.on("connect_error", async (error: Error) => {
    if (error.message !== "unauthorized" || refreshing) return;
    refreshing = true;
    try {
      const session = await refreshSession();
      if (!session) {
        onAuthLost();
        return;
      }
      socket.auth = { token: session.accessToken };
      if (!socket.active) socket.connect();
    } finally {
      refreshing = false;
    }
  });

  return socket;
}
