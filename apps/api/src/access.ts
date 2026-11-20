import type { Card, Column } from "@prisma/client";
import { prisma } from "./db";
import { HttpError } from "./errors";
import { hasRoleAtLeast, type Role } from "../../../packages/shared/src/permissions";
import type { BoardDto, CardDto, ColumnDto } from "../../../packages/shared/src/types";

export async function getRole(boardId: string, userId: string): Promise<Role | null> {
  const member = await prisma.boardMember.findUnique({
    where: { boardId_userId: { boardId, userId } },
  });
  return (member?.role as Role | undefined) ?? null;
}

/** Throws 404 when the board is invisible to the user and 403 when the role is too low. */
export async function requireBoardRole(boardId: string, userId: string, min: Role): Promise<Role> {
  const role = await getRole(boardId, userId);
  if (!role) throw new HttpError(404, "Доска не найдена");
  if (!hasRoleAtLeast(role, min)) throw new HttpError(403, "Недостаточно прав");
  return role;
}

export async function requireColumnRole(
  columnId: string,
  userId: string,
  min: Role,
): Promise<{ column: Column; role: Role }> {
  const column = await prisma.column.findUnique({ where: { id: columnId } });
  if (!column) throw new HttpError(404, "Колонка не найдена");
  const role = await requireBoardRole(column.boardId, userId, min);
  return { column, role };
}

export async function requireCardRole(
  cardId: string,
  userId: string,
  min: Role,
): Promise<{ card: Card & { column: Column }; role: Role }> {
  const card = await prisma.card.findUnique({ where: { id: cardId }, include: { column: true } });
  if (!card) throw new HttpError(404, "Карточка не найдена");
  const role = await requireBoardRole(card.column.boardId, userId, min);
  return { card, role };
}

export function cardDto(card: Card): CardDto {
  return {
    id: card.id,
    columnId: card.columnId,
    title: card.title,
    description: card.description,
    dueDate: card.dueDate ? card.dueDate.toISOString() : null,
    position: card.position,
    createdAt: card.createdAt.toISOString(),
    updatedAt: card.updatedAt.toISOString(),
  };
}

export function columnDto(column: Column & { cards: Card[] }): ColumnDto {
  return {
    id: column.id,
    title: column.title,
    position: column.position,
    cards: [...column.cards].sort((a, b) => a.position.localeCompare(b.position)).map(cardDto),
  };
}

export async function buildBoardDto(boardId: string, role: Role): Promise<BoardDto> {
  const board = await prisma.board.findUnique({
    where: { id: boardId },
    include: {
      owner: true,
      members: { include: { user: true }, orderBy: { joinedAt: "asc" } },
      columns: { include: { cards: true }, orderBy: { position: "asc" } },
    },
  });
  if (!board) throw new HttpError(404, "Доска не найдена");

  return {
    id: board.id,
    title: board.title,
    role,
    ownerId: board.ownerId,
    owner: { id: board.owner.id, email: board.owner.email, name: board.owner.name },
    members: board.members.map((member) => ({
      userId: member.userId,
      name: member.user.name,
      email: member.user.email,
      role: member.role as Role,
    })),
    columns: board.columns.map((column) => columnDto(column)),
    createdAt: board.createdAt.toISOString(),
  };
}

export async function logActivity(boardId: string, userId: string, action: string, detail: string): Promise<void> {
  await prisma.activity.create({ data: { boardId, userId, action, detail } });
}

export async function nextColumnPosition(boardId: string): Promise<string> {
  const { generateKeyBetween } = await import("../../../packages/shared/src/fractional");
  const last = await prisma.column.findFirst({
    where: { boardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return generateKeyBetween(last?.position ?? null, null);
}

export async function nextCardPosition(columnId: string): Promise<string> {
  const { generateKeyBetween } = await import("../../../packages/shared/src/fractional");
  const last = await prisma.card.findFirst({
    where: { columnId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return generateKeyBetween(last?.position ?? null, null);
}
