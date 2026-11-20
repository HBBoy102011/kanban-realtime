import { generateKeyBetween } from "@shared/fractional";
import { canEdit, canManage } from "@shared/permissions";
import type { BoardDto, CardDto, PresenceUser } from "@shared/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ActivityPanel } from "../components/ActivityPanel";
import { BoardCanvas } from "../components/BoardCanvas";
import { CardDialog } from "../components/CardDialog";
import { MembersDialog } from "../components/MembersDialog";
import { ThemeToggle } from "../components/ThemeToggle";
import { useAuth } from "../auth/AuthProvider";
import { api } from "../lib/api";
import { createBoardSocket } from "../lib/boardSocket";
import { moveCard, removeCard, removeColumn, upsertCard, upsertColumn } from "../lib/boardCache";

function avatarColor(id: string): string {
  const palette = [
    "bg-indigo-500",
    "bg-emerald-500",
    "bg-amber-500",
    "bg-sky-500",
    "bg-rose-500",
    "bg-violet-500",
    "bg-teal-500",
  ];
  let hash = 0;
  for (const char of id) hash = (hash + char.charCodeAt(0)) % palette.length;
  return palette[hash];
}

export function BoardPage() {
  const { boardId = "" } = useParams();
  const { logout } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => ["board", boardId] as const, [boardId]);

  const boardQuery = useQuery({
    queryKey,
    queryFn: async () => (await api<{ board: BoardDto }>(`/api/boards/${boardId}`)).board,
    enabled: Boolean(boardId),
  });
  const board = boardQuery.data;

  const [presence, setPresence] = useState<PresenceUser[]>([]);
  const [socketNotice, setSocketNotice] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [openCardId, setOpenCardId] = useState<string | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const socketRef = useRef<ReturnType<typeof createBoardSocket> | null>(null);

  const setBoard = useCallback(
    (updater: (current: BoardDto) => BoardDto) => {
      queryClient.setQueryData<BoardDto>(queryKey, (current) => (current ? updater(current) : current));
    },
    [queryClient, queryKey],
  );

  useEffect(() => {
    if (board) setTitleDraft(board.title);
  }, [board?.title, board]);

  useEffect(() => {
    if (!boardId) return;
    const socket = createBoardSocket({
      onAuthLost: () => setSocketNotice("Сессия истекла — войдите заново"),
    });
    socketRef.current = socket;

    const join = () => {
      socket.emit("board:join", { boardId }, (result: { ok: boolean; error?: string }) => {
        if (!result?.ok) setSocketNotice("Нет доступа к realtime-каналу доски");
        else setSocketNotice(null);
      });
    };

    socket.on("connect", join);
    socket.on("connect_error", (error: Error) => {
      if (error.message === "unauthorized") return; // handled by createBoardSocket
      setSocketNotice("Realtime недоступен, переподключаемся…");
    });
    socket.on("disconnect", () => {
      setSocketNotice("Соединение потеряно, переподключаемся…");
      setPresence([]);
    });
    socket.on("presence:update", (payload: { users: PresenceUser[] }) => setPresence(payload.users));
    socket.on("card:created", (payload: { card: CardDto }) => setBoard((current) => upsertCard(current, payload.card)));
    socket.on("card:updated", (payload: { card: CardDto }) => setBoard((current) => upsertCard(current, payload.card)));
    socket.on("card:moved", (payload: { card: CardDto }) => setBoard((current) => upsertCard(current, payload.card)));
    socket.on("card:deleted", (payload: { cardId: string }) =>
      setBoard((current) => removeCard(current, payload.cardId)),
    );
    socket.on("column:created", (payload: { column: BoardDto["columns"][number] }) =>
      setBoard((current) => upsertColumn(current, payload.column)),
    );
    socket.on("column:updated", (payload: { column: BoardDto["columns"][number] }) =>
      setBoard((current) => upsertColumn(current, payload.column)),
    );
    socket.on("column:deleted", (payload: { columnId: string }) =>
      setBoard((current) => removeColumn(current, payload.columnId)),
    );
    socket.on("board:updated", (payload: { board: { id: string; title: string } }) =>
      setBoard((current) => ({ ...current, title: payload.board.title })),
    );

    return () => {
      socket.emit("board:leave", { boardId });
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [boardId, setBoard]);

  if (boardQuery.isLoading) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-slate-500 dark:text-slate-400">
        Открываем доску…
      </div>
    );
  }

  if (boardQuery.isError || !board) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="surface max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold">Доска недоступна</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {boardQuery.error instanceof Error ? boardQuery.error.message : "Возможно, доска удалена или нет прав."}
          </p>
          <Link to="/" className="btn btn-primary mt-5">
            К списку досок
          </Link>
        </div>
      </div>
    );
  }

  const canWrite = canEdit(board.role);
  const canManageBoard = canManage(board.role);
  const openCard = openCardId ? board.columns.flatMap((column) => column.cards).find((card) => card.id === openCardId) : null;
  const openColumn = openCard ? board.columns.find((column) => column.id === openCard.columnId) : null;

  async function saveTitle() {
    if (!board) return;
    const next = titleDraft.trim();
    if (!next || next === board.title) {
      setTitleDraft(board.title);
      return;
    }
    try {
      await api(`/api/boards/${board.id}`, { method: "PATCH", body: { title: next } });
      setBoard((current) => ({ ...current, title: next }));
    } catch (cause) {
      setTitleDraft(board.title);
      window.alert(cause instanceof Error ? cause.message : "Не удалось переименовать доску");
    }
  }

  async function handleMoveCard(cardId: string, toColumnId: string, overCardId: string | null) {
    if (!board) return;
    const optimistic = moveCard(board, cardId, toColumnId, overCardId);
    if (!optimistic) return;
    setBoard(() => optimistic.board);
    try {
      const response = await api<{ card: CardDto }>(`/api/cards/${cardId}`, {
        method: "PATCH",
        body: { columnId: toColumnId, position: optimistic.card.position },
      });
      setBoard((current) => upsertCard(current, response.card));
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось переместить карточку");
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  async function handleCreateCard(columnId: string, title: string) {
    const response = await api<{ card: CardDto }>(`/api/columns/${columnId}/cards`, {
      method: "POST",
      body: { title },
    });
    setBoard((current) => upsertCard(current, response.card));
  }

  async function handleSaveCard(
    cardId: string,
    data: { title: string; description: string; dueDate: string | null },
  ) {
    const response = await api<{ card: CardDto }>(`/api/cards/${cardId}`, { method: "PATCH", body: data });
    setBoard((current) => upsertCard(current, response.card));
  }

  async function handleDeleteCard(cardId: string) {
    await api<void>(`/api/cards/${cardId}`, { method: "DELETE" });
    setBoard((current) => removeCard(current, cardId));
  }

  async function handleCreateColumn(title: string) {
    const response = await api<{ column: BoardDto["columns"][number] }>(`/api/boards/${board!.id}/columns`, {
      method: "POST",
      body: { title },
    });
    setBoard((current) => upsertColumn(current, { ...response.column, cards: [] }));
  }

  async function handleRenameColumn(columnId: string, title: string) {
    setBoard((current) => ({
      ...current,
      columns: current.columns.map((column) => (column.id === columnId ? { ...column, title } : column)),
    }));
    try {
      await api(`/api/columns/${columnId}`, { method: "PATCH", body: { title } });
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось переименовать колонку");
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  async function handleDeleteColumn(columnId: string) {
    if (!window.confirm("Удалить колонку вместе со всеми карточками?")) return;
    try {
      await api<void>(`/api/columns/${columnId}`, { method: "DELETE" });
      setBoard((current) => removeColumn(current, columnId));
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось удалить колонку");
    }
  }

  async function handleMoveColumn(columnId: string, direction: -1 | 1) {
    if (!board) return;
    const columns = [...board.columns].sort((a, b) => a.position.localeCompare(b.position));
    const index = columns.findIndex((column) => column.id === columnId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= columns.length) return;
    const without = columns.filter((column) => column.id !== columnId);
    const position = generateKeyBetween(
      without[target - 1]?.position ?? null,
      without[target]?.position ?? null,
    );
    setBoard((current) => ({
      ...current,
      columns: current.columns
        .map((column) => (column.id === columnId ? { ...column, position } : column))
        .sort((a, b) => a.position.localeCompare(b.position)),
    }));
    try {
      await api(`/api/columns/${columnId}`, { method: "PATCH", body: { position } });
    } catch (cause) {
      window.alert(cause instanceof Error ? cause.message : "Не удалось переместить колонку");
      await queryClient.invalidateQueries({ queryKey });
    }
  }

  return (
    <div className="flex h-screen flex-col">
      <header className="border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-900/85">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:px-5">
          <Link to="/" className="btn btn-ghost" aria-label="К списку досок">
            ← Доски
          </Link>
          <div className="min-w-0 flex-1">
            {canWrite ? (
              <input
                className="w-full max-w-md truncate rounded-lg border border-transparent bg-transparent px-1 py-1 text-lg font-semibold outline-none hover:border-slate-200 focus:border-indigo-400 focus:bg-white dark:hover:border-slate-700 dark:focus:bg-slate-950"
                value={titleDraft}
                maxLength={80}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={() => void saveTitle()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                  if (event.key === "Escape") setTitleDraft(board.title);
                }}
                aria-label="Название доски"
              />
            ) : (
              <h1 className="truncate px-1 text-lg font-semibold">{board.title}</h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center -space-x-1.5 sm:flex" aria-label="Кто онлайн">
              {presence.slice(0, 5).map((person) => (
                <span
                  key={person.id}
                  className={`grid h-7 w-7 place-items-center rounded-full border-2 border-white text-[10px] font-semibold text-white dark:border-slate-900 ${avatarColor(person.id)}`}
                  title={`${person.name} — онлайн`}
                >
                  {person.name.slice(0, 2).toUpperCase()}
                </span>
              ))}
              {presence.length > 5 ? (
                <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-slate-400 text-[10px] font-semibold text-white dark:border-slate-900">
                  +{presence.length - 5}
                </span>
              ) : null}
            </div>
            {presence.length > 0 ? (
              <span className="chip bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {presence.length} онлайн
              </span>
            ) : null}
            <input
              className="input hidden w-44 md:block"
              placeholder="Поиск по карточкам"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Поиск по карточкам"
            />
            <button type="button" className="btn btn-ghost" onClick={() => setActivityOpen(true)} title="История">
              История
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setMembersOpen(true)}>
              Участники
            </button>
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              Выйти
            </button>
          </div>
        </div>
        <div className="px-3 pb-2 md:hidden">
          <input
            className="input"
            placeholder="Поиск по карточкам"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Поиск по карточкам"
          />
        </div>
        {socketNotice ? (
          <p className="border-t border-amber-200 bg-amber-50 px-4 py-1 text-xs text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {socketNotice}
          </p>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 bg-slate-100/60 dark:bg-slate-950/60">
        <BoardCanvas
          board={board}
          canEdit={canWrite}
          filter={search.trim()}
          onMoveCard={(cardId, toColumnId, overCardId) => void handleMoveCard(cardId, toColumnId, overCardId)}
          onOpenCard={(card) => setOpenCardId(card.id)}
          onCreateCard={handleCreateCard}
          onRenameColumn={(columnId, title) => void handleRenameColumn(columnId, title)}
          onDeleteColumn={(columnId) => void handleDeleteColumn(columnId)}
          onMoveColumn={(columnId, direction) => void handleMoveColumn(columnId, direction)}
          onCreateColumn={handleCreateColumn}
        />
      </main>

      {openCard ? (
        <CardDialog
          card={openCard}
          canEdit={canWrite}
          columnTitle={openColumn?.title ?? ""}
          onClose={() => setOpenCardId(null)}
          onSave={handleSaveCard}
          onDelete={handleDeleteCard}
        />
      ) : null}

      {membersOpen ? (
        <MembersDialog
          board={board}
          canManage={canManageBoard}
          onClose={() => setMembersOpen(false)}
          onChanged={() => void queryClient.invalidateQueries({ queryKey })}
        />
      ) : null}

      {activityOpen ? <ActivityPanel boardId={board.id} onClose={() => setActivityOpen(false)} /> : null}

    </div>
  );
}
