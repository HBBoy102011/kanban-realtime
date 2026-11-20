import bcrypt from "bcryptjs";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "./env";
import { HttpError } from "./errors";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
}

export const REFRESH_COOKIE = "kanban_refresh";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const hashPassword = (password: string): Promise<string> => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string): Promise<boolean> => bcrypt.compare(password, hash);

export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ sub: user.id, email: user.email, name: user.name, typ: "access" }, env.accessSecret, {
    expiresIn: env.accessTokenTtl,
  });
}

export function signRefreshToken(userId: string): string {
  return jwt.sign({ sub: userId, typ: "refresh" }, env.refreshSecret, { expiresIn: 7 * 24 * 60 * 60 });
}

export function verifyAccessToken(token: string | null | undefined): AuthUser | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.accessSecret) as jwt.JwtPayload;
    if (payload.typ !== "access" || typeof payload.sub !== "string") return null;
    return {
      id: payload.sub,
      email: typeof payload.email === "string" ? payload.email : "",
      name: typeof payload.name === "string" ? payload.name : "",
    };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string | null | undefined): string | null {
  if (!token) return null;
  try {
    const payload = jwt.verify(token, env.refreshSecret) as jwt.JwtPayload;
    if (payload.typ !== "refresh" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

export function setRefreshCookie(res: Response, userId: string): void {
  res.cookie(REFRESH_COOKIE, signRefreshToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: env.isProd,
    path: "/api/auth",
    maxAge: REFRESH_TTL_MS,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
}

/** Validates the Bearer token and attaches the user to the request. */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const user = verifyAccessToken(token);
  if (!user) {
    next(new HttpError(401, "Требуется авторизация"));
    return;
  }
  (req as Request & { user?: AuthUser }).user = user;
  next();
}

export function currentUser(req: Request): AuthUser {
  const user = (req as Request & { user?: AuthUser }).user;
  if (!user) throw new HttpError(401, "Требуется авторизация");
  return user;
}
