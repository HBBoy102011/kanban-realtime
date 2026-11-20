import { Router } from "express";
import type { User } from "@prisma/client";
import { loginSchema, registerSchema } from "../../../../packages/shared/src/schemas";
import { prisma } from "../db";
import { HttpError, asyncHandler } from "../errors";
import {
  REFRESH_COOKIE,
  clearRefreshCookie,
  currentUser,
  hashPassword,
  requireAuth,
  setRefreshCookie,
  signAccessToken,
  verifyPassword,
  verifyRefreshToken,
} from "../auth";

export const authRouter = Router();

const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function rateLimitLogin(ip: string): void {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || entry.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }
  entry.count += 1;
  if (entry.count > MAX_ATTEMPTS) {
    throw new HttpError(429, "Слишком много попыток входа. Попробуйте через 15 минут.");
  }
}

function userDto(user: User) {
  return { id: user.id, email: user.email, name: user.name };
}

authRouter.post(
  "/register",
  asyncHandler(async (req, res) => {
    const input = registerSchema.parse(req.body);
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new HttpError(409, "Пользователь с таким email уже зарегистрирован");

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hashPassword(input.password),
      },
    });
    setRefreshCookie(res, user.id);
    res.status(201).json({ user: userDto(user), accessToken: signAccessToken(userDto(user)) });
  }),
);

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    rateLimitLogin(req.ip ?? "unknown");
    const input = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new HttpError(401, "Неверный email или пароль");
    }
    setRefreshCookie(res, user.id);
    res.json({ user: userDto(user), accessToken: signAccessToken(userDto(user)) });
  }),
);

authRouter.post(
  "/refresh",
  asyncHandler(async (req, res) => {
    const userId = verifyRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    if (!userId) throw new HttpError(401, "Сессия истекла, войдите заново");
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new HttpError(401, "Сессия истекла, войдите заново");
    setRefreshCookie(res, user.id);
    res.json({ user: userDto(user), accessToken: signAccessToken(userDto(user)) });
  }),
);

authRouter.post("/logout", (_req, res) => {
  clearRefreshCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, asyncHandler(async (req, res) => {
  const authUser = currentUser(req);
  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user) throw new HttpError(401, "Пользователь не найден");
  res.json({ user: userDto(user) });
}));
