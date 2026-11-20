import { Router } from "express";
import { updateColumnSchema } from "../../../../packages/shared/src/schemas";
import { prisma } from "../db";
import { logActivity, requireColumnRole } from "../access";
import { currentUser, requireAuth } from "../auth";
import { asyncHandler } from "../errors";
import { emitToBoard } from "../realtime";

export const columnsRouter = Router();
columnsRouter.use(requireAuth);

columnsRouter.patch(
  "/columns/:columnId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { columnId } = req.params;
    const { column } = await requireColumnRole(columnId, user.id, "editor");
    const input = updateColumnSchema.parse(req.body);
    const updated = await prisma.column.update({
      where: { id: columnId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.position !== undefined ? { position: input.position } : {}),
      },
      include: { cards: true },
    });
    if (input.title !== undefined) {
      await logActivity(column.boardId, user.id, "column.renamed", updated.title);
    }
    emitToBoard(column.boardId, "column:updated", {
      column: {
        id: updated.id,
        title: updated.title,
        position: updated.position,
        cards: updated.cards.map((card) => ({
          id: card.id,
          columnId: card.columnId,
          title: card.title,
          description: card.description,
          dueDate: card.dueDate ? card.dueDate.toISOString() : null,
          position: card.position,
          createdAt: card.createdAt.toISOString(),
          updatedAt: card.updatedAt.toISOString(),
        })),
      },
    });
    res.json({ column: { id: updated.id, title: updated.title, position: updated.position } });
  }),
);

columnsRouter.delete(
  "/columns/:columnId",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { columnId } = req.params;
    const { column } = await requireColumnRole(columnId, user.id, "editor");
    await prisma.column.delete({ where: { id: columnId } });
    await logActivity(column.boardId, user.id, "column.deleted", column.title);
    emitToBoard(column.boardId, "column:deleted", { columnId });
    res.status(204).end();
  }),
);
