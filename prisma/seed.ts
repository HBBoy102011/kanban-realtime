import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { generateKeyBetween } from "../packages/shared/src/fractional";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash("demo1234", 10);
  const demo = await prisma.user.upsert({
    where: { email: "demo@kanban.dev" },
    update: {},
    create: { email: "demo@kanban.dev", name: "Демо-пользователь", passwordHash },
  });
  const teammate = await prisma.user.upsert({
    where: { email: "team@kanban.dev" },
    update: {},
    create: { email: "team@kanban.dev", name: "Тимур (редактор)", passwordHash },
  });

  const existing = await prisma.board.findFirst({ where: { ownerId: demo.id, title: "Запуск продукта" } });
  if (existing) {
    console.log("[seed] demo board already exists");
    return;
  }

  const p1 = generateKeyBetween(null, null);
  const p2 = generateKeyBetween(p1, null);
  const p3 = generateKeyBetween(p2, null);

  const board = await prisma.board.create({
    data: {
      title: "Запуск продукта",
      ownerId: demo.id,
      members: {
        create: [
          { userId: demo.id, role: "owner" },
          { userId: teammate.id, role: "editor" },
        ],
      },
      columns: {
        create: [
          {
            title: "To Do",
            position: p1,
            cards: {
              create: [
                {
                  title: "Собрать требования к MVP",
                  description: "Интервью с тремя пользователями и список болей.",
                  position: generateKeyBetween(null, null),
                  createdById: demo.id,
                },
                {
                  title: "Дизайн онбординга",
                  description: "Три экрана: приветствие, доска, приглашение команды.",
                  position: generateKeyBetween(generateKeyBetween(null, null), null),
                  createdById: demo.id,
                },
              ],
            },
          },
          {
            title: "In Progress",
            position: p2,
            cards: {
              create: [
                {
                  title: "Реальное время на Socket.IO",
                  description: "События карточек, присутствие и переподключение.",
                  position: generateKeyBetween(null, null),
                  createdById: teammate.id,
                },
              ],
            },
          },
          {
            title: "Done",
            position: p3,
            cards: {
              create: [
                {
                  title: "Схема данных и fractional indexing",
                  description: "Позиции карточек хранятся строками base62.",
                  position: generateKeyBetween(null, null),
                  createdById: demo.id,
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.activity.create({
    data: { boardId: board.id, userId: demo.id, action: "board.created", detail: board.title },
  });

  console.log("[seed] demo account: demo@kanban.dev / demo1234");
  console.log("[seed] board:", board.title);
}

main()
  .catch((error) => {
    console.error("[seed] failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
