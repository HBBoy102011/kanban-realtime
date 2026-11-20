import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email").max(160),
  password: z.string().min(8, "Пароль должен быть не короче 8 символов").max(128),
  name: z.string().trim().min(1, "Укажите имя").max(60),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  password: z.string().min(1, "Укажите пароль"),
});

export const createBoardSchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(80),
});

export const updateBoardSchema = z.object({
  title: z.string().trim().min(1).max(80),
});

export const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Некорректный email"),
  role: z.enum(["editor", "viewer"]),
});

export const createColumnSchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(80),
});

export const updateColumnSchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    position: z.string().min(1).max(64).optional(),
  })
  .refine((value) => value.title !== undefined || value.position !== undefined, {
    message: "Нечего обновлять",
  });

export const createCardSchema = z.object({
  title: z.string().trim().min(1, "Укажите название").max(160),
  description: z.string().max(4000).optional(),
});

const dateString = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Некорректная дата");

export const updateCardSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().max(4000).optional(),
  dueDate: dateString.nullable().optional(),
  columnId: z.string().min(1).optional(),
  position: z.string().min(1).max(64).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateCardInput = z.infer<typeof createCardSchema>;
export type UpdateCardInput = z.infer<typeof updateCardSchema>;
