import type { Role } from "./permissions";

export interface UserDto {
  id: string;
  email: string;
  name: string;
}

export interface CardDto {
  id: string;
  columnId: string;
  title: string;
  description: string;
  dueDate: string | null;
  position: string;
  createdAt: string;
  updatedAt: string;
}

export interface ColumnDto {
  id: string;
  title: string;
  position: string;
  cards: CardDto[];
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: Role;
}

export interface BoardSummaryDto {
  id: string;
  title: string;
  role: Role;
  updatedAt: string;
}

export interface BoardDto {
  id: string;
  title: string;
  role: Role;
  ownerId: string;
  owner: UserDto;
  members: MemberDto[];
  columns: ColumnDto[];
  createdAt: string;
}

export interface ActivityDto {
  id: string;
  action: string;
  detail: string;
  createdAt: string;
  user: { id: string; name: string };
}

export interface PresenceUser {
  id: string;
  name: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken: string;
}

export interface InviteLinkDto {
  token: string;
  url: string;
}

/** Realtime protocol (server -> clients), mirrored in README. */
export interface ServerToClientEvents {
  "card:created": (payload: { card: CardDto }) => void;
  "card:updated": (payload: { card: CardDto }) => void;
  "card:moved": (payload: { card: CardDto }) => void;
  "card:deleted": (payload: { cardId: string; columnId: string }) => void;
  "column:created": (payload: { column: ColumnDto }) => void;
  "column:updated": (payload: { column: ColumnDto }) => void;
  "column:deleted": (payload: { columnId: string }) => void;
  "board:updated": (payload: { board: { id: string; title: string } }) => void;
  "presence:update": (payload: { boardId: string; users: PresenceUser[] }) => void;
}

export interface ClientToServerEvents {
  "board": (payload: { boardId: string }, ack?: (result: { ok: boolean; error?: string }) => void) => void;
}
