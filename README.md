# Kanban Realtime

Kanban-доска с совместной работой в реальном времени: колонки, карточки, drag-and-drop, роли доступа и присутствие участников. Изменения одного человека появляются у остальных без перезагрузки страницы.

![React](https://img.shields.io/badge/React-18-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-22-5fa04e?logo=nodedotjs&logoColor=white)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4-010101?logo=socketdotio&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748?logo=prisma&logoColor=white)
![CI](https://github.com/HBBoy102011/kanban-realtime/actions/workflows/ci.yml/badge.svg)

## Возможности

**Обязательные (MVP)**

- Регистрация по email и паролю, вход, выход, защищённые маршруты.
- Доски: создание, переименование, удаление, список досок пользователя.
- Колонки: добавление, переименование, удаление, перемещение влево/вправо. Новая доска получает To Do / In Progress / Done.
- Карточки: создание, редактирование названия, описания и дедлайна, удаление.
- Drag-and-drop внутри колонки и между колонками; порядок сохраняется на сервере.
- Команда: владелец приглашает по email или ссылкой; роли **владелец / редактор / наблюдатель**.
- Реальное время: создание, изменение, перемещение и удаление карточек и колонок, индикатор «кто онлайн».
- Адаптивная вёрстка (ноутбук и телефон).

**Дополнительно реализовано**

- Поиск по карточкам (название и описание).
- История действий на доске.
- Тёмная тема (сохраняется в localStorage).
- Оптимистичные обновления с откатом при ошибке сервера.
- Автоматическое переподключение WebSocket.

Не реализованы: метки, исполнители, комментарии, чек-листы, вложения, PWA и офлайн-очередь — модель данных и API к ним расширяются без переделки.

## Стек

| Часть | Технологии |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS 4, TanStack Query, dnd-kit |
| Backend | Node.js, TypeScript, Express, Zod |
| База данных | Prisma ORM; SQLite локально, PostgreSQL в docker-compose |
| Реальное время | Socket.IO (JWT в handshake, комнаты на доску) |
| Авторизация | JWT access (15 минут) + refresh в httpOnly-cookie (7 дней), bcrypt |
| Тесты | Vitest (fractional indexing, роли) |
| CI | GitHub Actions: typecheck, тесты, сборка |

## Быстрый старт

Требуется Node.js 20+.

```bash
npm install
cp .env.example .env      # Windows: copy .env.example .env
npm run setup             # prisma generate + db push + демо-данные
npm run dev               # API :8787 и web :5173
```

Откройте http://localhost:5173.

Демо-аккаунт: `demo@kanban.dev` / `demo1234`. Второй аккаунт для проверки совместной работы: `team@kanban.dev` / `demo1234` (он уже редактор демо-доски).

### Проверка realtime

1. Войдите как `demo@kanban.dev` в обычном окне.
2. Во втором окне (или в приватном режиме) войдите как `team@kanban.dev` и откройте ту же доску.
3. Перетащите карточку или создайте новую — второе окно обновится мгновенно, в шапке появятся оба участника онлайн.

## Команды

```bash
npm run dev        # API + Vite с hot reload
npm run dev:api    # только API
npm run dev:web    # только клиент
npm run typecheck  # tsc --noEmit по всему репозиторию
npm test           # unit-тесты
npm run test:e2e   # Playwright: два браузерных контекста
npm run build      # typecheck + production-сборка клиента в dist/web
npm run db:push    # применить схему Prisma
npm run db:seed    # демо-данные
```

## Структура

```
kanban/
├── apps/
│   ├── web/                 # React-клиент (Vite root)
│   └── api/                 # Express + Socket.IO
├── packages/
│   └── shared/              # типы DTO, Zod-схемы, роли, fractional indexing
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── docker-compose.yml       # PostgreSQL 16 для перехода с SQLite
├── .github/workflows/ci.yml
└── README.md
```

## Модель данных

```mermaid
erDiagram
    User ||--o{ Board : "владеет"
    User ||--o{ BoardMember : "участвует"
    Board ||--o{ BoardMember : "состав"
    Board ||--o{ Column : "колонки"
    Board ||--o{ Activity : "история"
    Column ||--o{ Card : "карточки"
    User ||--o{ Card : "создал"

    User { string id PK email passwordHash name }
    Board { string id PK title ownerId inviteToken }
    BoardMember { string boardId PK userId PK role }
    Column { string id PK boardId title position }
    Card { string id PK columnId title description dueDate position }
    Activity { string id PK boardId userId action detail createdAt }
```

`BoardMember.role` — `owner | editor | viewer`; составной первичный ключ `(boardId, userId)` не даёт добавить участника дважды.

## Порядок карточек: fractional indexing

Позиция — строка в base62, а не целое число. При перемещении карточки сервер сохраняет только её новую позицию между соседями:

```
A = "V"
C = "m"
B = generateKeyBetween("V", "m") // "c"
```

Вставка не переписывает остальные строки, поэтому одновременные перемещения разных карточек не блокируют друг друга и не требуют массовых `UPDATE`. Инварианты и алгоритм — `packages/shared/src/fractional.ts`, покрыты тестами (вставки, добавление в конец, бесконечное добавление в начало, недопустимые ключи).

## События WebSocket

| Событие | Направление | Описание |
| --- | --- | --- |
| `board:join` | клиент → сервер | Войти в комнату доски после проверки членства |
| `board:leave` | клиент → сервер | Покинуть комнату |
| `card:created` / `card:updated` / `card:moved` | сервер → клиенты | Карточка целиком с новой позицией |
| `card:deleted` | сервер → клиенты | `{ cardId, columnId }` |
| `column:created` / `column:updated` / `column:deleted` | сервер → клиенты | События колонок |
| `board:updated` | сервер → клиенты | Новое название доски |
| `presence:update` | сервер → клиенты | Уникальные пользователи онлайн |

Все изменения проходят через REST (проверка прав, валидация Zod), затем сервер рассылает событие. Клиент не доверяет событиям для прав: любое действие всё равно уходит на сервер, где проверяется роль.

## API

| Метод | Путь | Доступ |
| --- | --- | --- |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout` | публично |
| GET | `/api/auth/me` | авторизован |
| GET/POST | `/api/boards` | авторизован |
| GET/PATCH/DELETE | `/api/boards/:id` | участник / редактор / владелец |
| POST | `/api/boards/:id/members` | владелец |
| DELETE | `/api/boards/:id/members/:userId` | владелец |
| POST | `/api/boards/:id/invite` | владелец |
| POST | `/api/invites/:token` | авторизован |
| GET | `/api/boards/:id/activity` | участник |
| POST | `/api/boards/:id/columns` | редактор |
| PATCH/DELETE | `/api/columns/:id` | редактор |
| POST | `/api/columns/:id/cards` | редактор |
| PATCH/DELETE | `/api/cards/:id` | редактор |

## Безопасность

- Пароли только в виде bcrypt-хеша, секреты — в переменных окружения.
- Access-токен живёт 15 минут, refresh — httpOnly + SameSite=Lax cookie с областью `/api/auth`.
- Права проверяются на сервере для каждого REST-запроса и при входе в WebSocket-комнату; наблюдатель не может менять данные ни через UI, ни через API.
- Zod валидирует тела запросов, Prisma исключает SQL-инъекции; React экранирует вывод (XSS).
- Ограничение частоты попыток входа: 20 за 15 минут с одного IP.
- Ошибки не раскрывают внутренние детали; 404 для чужих досок не подтверждает их существование.

Для production дополнительно включите HTTPS (тогда `secure` cookie активируется через `NODE_ENV=production`) и задайте собственные `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.

## Тесты и CI

`npm test` запускает Vitest: 17 тестов на fractional indexing и матрицу ролей. CI (`.github/workflows/ci.yml`) на каждый push в `main` и pull request прогоняет `prisma generate`, `npm run typecheck`, `npm test` и `npm run build`.

`npm run test:e2e` запускает Playwright-сценарий `e2e/realtime-dnd.spec.ts`. Он создаёт доску и двух пользователей через API, открывает два изолированных браузерных контекста (владелец и наблюдатель) и проверяет, что:

- владелец перетаскивает карточку мышью из To Do в In Progress (dnd-kit работает на pointer-событиях);
- второй контекст видит карточку в новой колонке без перезагрузки (маркер на `window` доказывает, что страница не перезагружалась), а перемещение сохранилось на сервере;
- наблюдатель не может перетащить карточку, у него нет кнопки добавления, а карточка помечена `aria-disabled="true"`.

Нужен запущенный dev-сервер и база (`npm run setup`); если сервер не запущен, Playwright поднимет его сам. Для bundled Chromium: `npx playwright install chromium`. Если он не установлен, можно использовать системный Edge: `PLAYWRIGHT_CHANNEL=msedge npm run test:e2e`.

## Переход на PostgreSQL

1. `docker compose up -d` — поднимает PostgreSQL 16.
2. В `prisma/schema.prisma` замените `provider = "sqlite"` на `provider = "postgresql"`.
3. В `.env` укажите `DATABASE_URL="postgresql://kanban:kanban@localhost:5432/kanban?schema=public"`.
4. `npx prisma migrate dev --name init && npm run db:seed`.

SQLite выбран для локального запуска без Docker; схема и запросы переносимы, модели не используют SQLite-специфичных типов.

## Известные ограничения

- Нет rate limiting на остальные эндпоинты (только вход).
- История действий обновляется по таймеру (15 с), а не отдельным realtime-событием.
- Конфликты одновременного редактирования одной карточки решаются «последний запрос побеждает»; порядок карточек от этого не страдает благодаря fractional indexing.
- Сквозные тесты Playwright и замер покрытия не добавлены.
