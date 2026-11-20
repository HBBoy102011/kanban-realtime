import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

const API = "http://localhost:8787";
const PASSWORD = "password123";

interface Account {
  email: string;
  name: string;
  token: string;
}

interface Column {
  id: string;
  title: string;
}

interface Board {
  id: string;
  title: string;
  columns: Column[];
}

async function createAccount(api: APIRequestContext, suffix: string): Promise<Account> {
  const email = `e2e-${suffix}-${Date.now()}@kanban.dev`;
  const name = `E2E ${suffix}`;
  const response = await api.post("/api/auth/register", { data: { email, name, password: PASSWORD } });
  expect(response.status(), `register ${suffix}`).toBe(201);
  const body = (await response.json()) as { accessToken: string };
  return { email, name, token: body.accessToken };
}

async function createBoard(api: APIRequestContext, token: string): Promise<Board> {
  const response = await api.post("/api/boards", {
    headers: { Authorization: `Bearer ${token}` },
    data: { title: `E2E drag ${Date.now()}` },
  });
  expect(response.status()).toBe(201);
  const body = (await response.json()) as { board: Board };
  return body.board;
}

async function addViewer(api: APIRequestContext, token: string, boardId: string, email: string): Promise<void> {
  const response = await api.post(`/api/boards/${boardId}/members`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { email, role: "viewer" },
  });
  expect(response.status()).toBe(201);
}

async function createCard(api: APIRequestContext, token: string, columnId: string, title: string): Promise<void> {
  const response = await api.post(`/api/columns/${columnId}/cards`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { title },
  });
  expect(response.status()).toBe(201);
}

async function signIn(page: Page, email: string, boardTitle: string): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Пароль").fill(PASSWORD);
  await page.getByRole("button", { name: "Войти" }).click();

  await expect(page.getByRole("heading", { name: "Мои доски" })).toBeVisible();
  await page.getByRole("link", { name: boardTitle }).click();
  await expect(page.getByRole("region", { name: "Колонка To Do" })).toBeVisible();
}

/**
 * dnd-kit listens to pointer events, not HTML5 drag and drop, so the gesture is
 * performed with the real mouse: press, cross the 6px activation threshold,
 * glide to the target column, release.
 */
async function dragCardToColumn(page: Page, cardTitle: string, columnName: string): Promise<void> {
  const card = page.getByRole("button", { name: `Карточка ${cardTitle}` });
  await card.scrollIntoViewIfNeeded();
  const cardBox = await card.boundingBox();
  const columnBox = await page.getByRole("region", { name: `Колонка ${columnName}` }).boundingBox();
  expect(cardBox, "card is visible").not.toBeNull();
  expect(columnBox, "target column is visible").not.toBeNull();

  const startX = cardBox!.x + Math.min(40, cardBox!.width / 2);
  const startY = cardBox!.y + cardBox!.height / 2;
  const endX = columnBox!.x + columnBox!.width / 2;
  const endY = columnBox!.y + 80;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 14, startY + 14, { steps: 6 });
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.waitForTimeout(150);
  await page.mouse.up();
}

test("owner drags a card with the mouse, viewer sees it without reload and cannot drag", async ({ browser }) => {
  const api = await playwrightRequest.newContext({ baseURL: API });

  const owner = await createAccount(api, "owner");
  const viewer = await createAccount(api, "viewer");

  const board = await createBoard(api, owner.token);
  await addViewer(api, owner.token, board.id, viewer.email);

  const todo = board.columns.find((column) => column.title === "To Do");
  const doing = board.columns.find((column) => column.title === "In Progress");
  expect(todo && doing, "default columns exist").toBeTruthy();

  const movedCard = "Перетащи меня";
  const stillCard = "Не двигай меня";
  await createCard(api, owner.token, todo!.id, movedCard);
  await createCard(api, owner.token, todo!.id, stillCard);

  const ownerPage = await browser.newPage();
  const viewerPage = await browser.newPage();

  try {
    await signIn(ownerPage, owner.email, board.title);
    await signIn(viewerPage, viewer.email, board.title);

    const ownerTodo = ownerPage.getByRole("region", { name: "Колонка To Do" });
    const viewerTodo = viewerPage.getByRole("region", { name: "Колонка To Do" });
    const viewerDoing = viewerPage.getByRole("region", { name: "Колонка In Progress" });

    await expect(ownerTodo.getByRole("button", { name: `Карточка ${movedCard}` })).toBeVisible();
    await expect(viewerTodo.getByRole("button", { name: `Карточка ${movedCard}` })).toBeVisible();

    // Viewer UI is read-only: no add-card affordance and no sortable drag handle.
    await expect(viewerPage.getByRole("button", { name: "+ Добавить карточку" })).toHaveCount(0);
    await expect(viewerTodo.getByRole("button", { name: `Карточка ${movedCard}` })).toHaveAttribute(
      "aria-disabled",
      "true",
    );

    // A real mouse drag by the viewer must not move anything.
    await dragCardToColumn(viewerPage, stillCard, "Done");
    const dialog = viewerPage.getByRole("dialog");
    if (await dialog.isVisible()) await viewerPage.keyboard.press("Escape");
    await expect(viewerTodo.getByRole("button", { name: `Карточка ${stillCard}` })).toBeVisible();
    await expect(viewerPage.getByRole("region", { name: "Колонка Done" }).getByRole("button", { name: "Карточка Не двигай меня" })).toHaveCount(0);

    // Marker disappears only on a page reload, so it proves the viewer updated live.
    await viewerPage.evaluate(() => {
      (window as unknown as { __noReload?: boolean }).__noReload = true;
    });

    await dragCardToColumn(ownerPage, movedCard, "In Progress");

    const ownerDoing = ownerPage.getByRole("region", { name: "Колонка In Progress" });
    await expect(ownerDoing.getByRole("button", { name: `Карточка ${movedCard}` })).toBeVisible({ timeout: 7_000 });
    await expect(ownerTodo.getByRole("button", { name: `Карточка ${movedCard}` })).toHaveCount(0);

    await expect(viewerDoing.getByRole("button", { name: `Карточка ${movedCard}` })).toBeVisible({ timeout: 7_000 });
    await expect(viewerTodo.getByRole("button", { name: `Карточка ${movedCard}` })).toHaveCount(0);
    expect(await viewerPage.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

    // The move is persisted, not just rendered locally.
    const persisted = await api.get(`/api/boards/${board.id}`, {
      headers: { Authorization: `Bearer ${owner.token}` },
    });
    const persistedBoard = (await persisted.json()) as { board: { columns: { id: string; cards: { title: string }[] }[] } };
    const doingColumn = persistedBoard.board.columns.find((column) => column.id === doing!.id);
    expect(doingColumn?.cards.map((card) => card.title)).toContain(movedCard);
  } finally {
    await api.delete(`/api/boards/${board.id}`, { headers: { Authorization: `Bearer ${owner.token}` } }).catch(() => undefined);
    await ownerPage.close();
    await viewerPage.close();
    await api.dispose();
  }
});
