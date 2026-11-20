import { io, type Socket } from "socket.io-client";
import { getAccessToken, refreshAccessToken } from "./api";

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
 * helper refreshes the session, swaps in the access token and reconnects.
 * The refresh itself is single-flight and shared with REST retries.
 */
export function createBoardSocket({ onAuthLost }: BoardSocketOptions): Socket {
  const socket = io({ auth: { token: getAccessToken() } });
  let handling = false;

  socket.on("connect_error", async (error: Error) => {
    if (error.message !== "unauthorized" || handling) return;
    handling = true;

    const token = await refreshAccessToken();
    if (!token) {
      socket.disconnect(); // stop retrying with the stale token
      onAuthLost();
      return;
    }

    socket.auth = { token };
    handling = false;
    if (!socket.active) socket.connect();
  });

  return socket;
}
