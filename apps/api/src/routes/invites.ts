import { Router } from "express";
import { prisma } from "../db";
import { currentUser, requireAuth } from "../auth";
import { HttpError, asyncHandler } from "../errors";

export const invitesRouter = Router();
invitesRouter.use(requireAuth);

invitesRouter.post(
  "/invites/:token",
  asyncHandler(async (req, res) => {
    const user = currentUser(req);
    const { token } = req.params;
    const board = await prisma.board.findUnique({ where: { inviteToken: token } });
    if (!board) throw new HttpError(404, "Ссылка-приглашение недействительна");

    await prisma.boardMember.upsert({
      where: { boardId_userId: { boardId: board.id, userId: user.id } },
      create: { boardId: board.id, userId: user.id, role: "editor" },
      update: {},
    });
    res.json({ boardId: board.id, title: board.title });
  }),
);
