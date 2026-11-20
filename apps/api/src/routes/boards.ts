import { randomUUID } from "node:crypto";
import { Router } from "express";
import { addMemberSchema, createBoardSchema, updateBoardSchema } from "../../../../packages/shared/src/schemas";
import { generateKeyBetween } from "../../../../packages/shared/src/fractional";
import { prisma } from "../db";
import {
  buildBoardDto,
  cardDto,
  getRole,
  logActivity,
  nextColumnPosition,
  requireBoardRole,
} from "../access";
import { currentUser, requireAuth } from "../auth";
import { env } from "../env";
import { HttpError, asyncHandler } from "../errors";
import { emitToBoard } from "../realtime";

export const boardsRouter = Router();
boardsRouter.use(requireAuth);

boardsRouter.get(
  "/boards",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const memberships = await prisma.boardMember.findMany({
      where: { userId: user.id },
      include: { board: true },
      orderBy: { board: { updatedAt: "desc" } },
    });
    res.json({
      boards: memberships.map(({ board, role }) => ({
        id: board.id,
        title: board.title,
        role,
        updatedAt: board.updatedAt.toISOString(),
      })),
    });
  }),
);

boardsRouter.post(
  "/boards",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const input = createBoardSchema.parse(req.body);
    const first = generateKeyBetween(null, null);
    const second = generateKeyBetween(first, null);
    const third = generateKeyBetween(second, null);

    const board = await prisma.board.create({
      data: {
        title: input.title,
        ownerId: user.id,
        members: { create: { userId: user.id, role: "owner" } },
        columns: {
          create: [
            { title: "To Do", position: first },
            { title: "In Progress", position: second },
            { title: "Done", position: third },
          ],
        },
      },
    });
    res.status(201).json({ board: await buildBoardDto(board.id, "owner") });
  }),
);

boardsRouter.get(
  "/boards/:boardId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    const role = await getRole(boardId, user.id);
    if (!role) throw new HttpError(404, "Доска не найдена");
    res.json({ board: await buildBoardDto(boardId, role) });
  }),
);

boardsRouter.patch(
  "/boards/:boardId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    await requireBoardRole(boardId, user.id, "editor");
    const input = updateBoardSchema.parse(req.body);
    const board = await prisma.board.update({ where: { id: boardId }, data: { title: input.title } });
    await logActivity(boardId, user.id, "board.renamed", board.title);
    emitToBoard(boardId, "board:updated", { board: { id: board.id, title: board.title } });
    res.json({ board: { id: board.id, title: board.title } });
  }),
);

boardsRouter.delete(
  "/boards/:boardId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    await requireBoardRole(boardId, user.id, "owner");
    await prisma.board.delete({ where: { id: boardId } });
    res.status(204).end();
  }),
);

boardsRouter.get(
  "/boards/:boardId/members",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    await requireBoardRole(boardId, user.id, "viewer");
    const members = await prisma.boardMember.findMany({
      where: { boardId },
      include: { user: true },
      orderBy: { joinedAt: "asc" },
    });
    res.json({
      members: members.map((member) => ({
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      })),
    });
  }),
);

boardsRouter.post(
  "/boards/:boardId/members",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    await requireBoardRole(boardId, user.id, "owner");
    const input = addMemberSchema.parse(req.body);
    const invitee = await prisma.user.findUnique({ where: { email: input.email } });
    if (!invitee) throw new HttpError(404, "Пользователь с таким email не зарегистрирован");
    if (invitee.id === user.id) throw new HttpError(400, "Вы уже владелец этой доски");

    const member = await prisma.boardMember.upsert({
      where: { boardId_userId: { boardId, userId: invitee.id } },
      create: { boardId, userId: invitee.id, role: input.role },
      update: { role: input.role },
      include: { user: true },
    });
    await logActivity(boardId, user.id, "member.added", `${member.user.name} (${input.role})`);
    res.status(201).json({
      member: {
        userId: member.userId,
        name: member.user.name,
        email: member.user.email,
        role: member.role,
      },
    });
  }),
);

boardsRouter.delete(
  "/boards/:boardId/members/:userId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId, userId } = req.params;
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw new HttpError(404, "Доска не найдена");
    if (board.ownerId !== user.id) throw new HttpError(403, "Удалять участников может только владелец");
    if (userId === board.ownerId) throw new HttpError(400, "Нельзя удалить владельца доски");
    await prisma.boardMember.deleteMany({ where: { boardId, userId } });
    res.status(204).end();
  }),
);

boardsRouter.post(
  "/boards/:boardId/invite",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    await requireBoardRole(boardId, user.id, "owner");
    const board = await prisma.board.findUnique({ where: { id: boardId } });
    if (!board) throw new HttpError(404, "Доска не найдена");
    const token = board.inviteToken ?? randomUUID();
    if (!board.inviteToken) {
      await prisma.board.update({ where: { id: boardId }, data: { inviteToken: token } });
    }
    res.json({ token, url: `${env.clientOrigin}/invite/${token}` });
  }),
);

boardsRouter.get(
  "/boards/:boardId/activity",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    await requireBoardRole(boardId, user.id, "viewer");
    const rows = await prisma.activity.findMany({
      where: { boardId },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json({
      activity: rows.map((row) => ({
        id: row.id,
        action: row.action,
        detail: row.detail,
        createdAt: row.createdAt.toISOString(),
        user: { id: row.user.id, name: row.user.name },
      })),
    });
  }),
);

boardsRouter.post(
  "/boards/:boardId/columns",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { boardId } = req.params;
    await requireBoardRole(boardId, user.id, "editor");
    const { title } = req.body?.title ? req.body : { title: "" };
    const parsedTitle = String(title).trim();
    if (!parsedTitle) throw new HttpError(400, "Укажите название колонки");

    const column = await prisma.column.create({
      data: { boardId, title: parsedTitle.slice(0, 80), position: await nextColumnPosition(boardId) },
      include: { cards: true },
    });
    await logActivity(boardId, user.id, "column.created", column.title);
    emitToBoard(boardId, "column:created", {
      column: { id: column.id, title: column.title, position: column.position, cards: [] },
    });
    res.status(201).json({ column: { id: column.id, title: column.title, position: column.position, cards: [] } });
  }),
);
