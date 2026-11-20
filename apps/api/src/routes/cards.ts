import { Router } from "express";
import { createCardSchema, updateCardSchema } from "../../../../packages/shared/src/schemas";
import { prisma } from "../db";
import {
  cardDto,
  logActivity,
  nextCardPosition,
  requireCardRole,
  requireColumnRole,
} from "../access";
import { currentUser, requireAuth } from "../auth";
import { HttpError, asyncHandler } from "../errors";
import { emitToBoard } from "../realtime";

export const cardsRouter = Router();
cardsRouter.use(requireAuth);

cardsRouter.post(
  "/columns/:columnId/cards",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { columnId } = req.params;
    const { column } = await requireColumnRole(columnId, user.id, "editor");
    const input = createCardSchema.parse(req.body);

    const card = await prisma.card.create({
      data: {
        columnId,
        title: input.title,
        description: input.description ?? "",
        position: await nextCardPosition(columnId),
        createdById: user.id,
      },
    });
    await logActivity(column.boardId, user.id, "card.created", card.title);
    emitToBoard(column.boardId, "card:created", { card: cardDto(card) });
    res.status(201).json({ card: cardDto(card) });
  }),
);

cardsRouter.patch(
  "/cards/:cardId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { cardId } = req.params;
    const { card: existing } = await requireCardRole(cardId, user.id, "editor");
    const input = updateCardSchema.parse(req.body);

    let columnId = existing.columnId;
    if (input.columnId && input.columnId !== existing.columnId) {
      await requireColumnRole(input.columnId, user.id, "editor");
      const target = await prisma.column.findUnique({ where: { id: input.columnId } });
      if (!target || target.boardId !== existing.column.boardId) {
        throw new HttpError(400, "Колонка принадлежит другой доске");
      }
      columnId = input.columnId;
    }

    const moving = columnId !== existing.columnId;
    const position =
      input.position ?? (moving ? await nextCardPosition(columnId) : existing.position);

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.dueDate !== undefined ? { dueDate: input.dueDate ? new Date(input.dueDate) : null } : {}),
        columnId,
        position,
      },
    });

    const boardId = existing.column.boardId;
    const event = moving ? "card:moved" : "card:updated";
    if (input.title !== undefined && input.title !== existing.title) {
      await logActivity(boardId, user.id, "card.renamed", `${existing.title} → ${input.title}`);
    } else if (moving) {
      await logActivity(boardId, user.id, "card.moved", updated.title);
    }
    emitToBoard(boardId, event, { card: cardDto(updated) });
    res.json({ card: cardDto(updated) });
  }),
);

cardsRouter.delete(
  "/cards/:cardId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { cardId } = req.params;
    const { card } = await requireCardRole(cardId, user.id, "editor");
    const boardId = card.column.boardId;
    await prisma.card.delete({ where: { id: cardId } });
    await logActivity(boardId, user.id, "card.deleted", card.title);
    emitToBoard(boardId, "card:deleted", { cardId, columnId: card.columnId });
    res.status(204).end();
  }),
);
