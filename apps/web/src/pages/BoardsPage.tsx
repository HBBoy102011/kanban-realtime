import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BoardSummaryDto } from "@shared/types";
import { ROLE_LABELS } from "@shared/permissions";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ThemeToggle } from "../components/ThemeToggle";
import { api } from "../lib/api";

export function BoardsPage() {
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);

  const boardsQuery = useQuery({
    queryKey: ["boards"],
    queryFn: async () => (await api<{ boards: BoardSummaryDto[] }>("/api/boards")).boards,
  });

  const createBoard = useMutation({
    mutationFn: (boardTitle: string) =>
      api<{ board: { id: string } }>("/api/boards", { method: "POST", body: { title: boardTitle } }),
    onSuccess: () => {
      setTitle("");
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["boards"] });
    },
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Не удалось создать доску"),
  });

  const deleteBoard = useMutation({
    mutationFn: (boardId: string) => api<void>(`/api/boards/${boardId}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["boards"] }),
    onError: (cause) => setError(cause instanceof Error ? cause.message : "Не удалось удалить доску"),
  });

  function handleCreate(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    createBoard.mutate(title.trim());
  }

  function handleDelete(board: BoardSummaryDto) {
    if (window.confirm(`Удалить доску «${board.title}» вместе с колонками и карточками?`)) {
      deleteBoard.mutate(board.id);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-indigo-600 text-white">◧</span>
            Kanban Realtime
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-500 dark:text-slate-400 sm:inline">{user?.name}</span>
            <ThemeToggle />
            <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">Мои доски</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Откройте доску и пригласите команду — изменения появятся у всех сразу.
          </p>
        </div>

        <form onSubmit={handleCreate} className="mt-6 flex flex-col gap-2 sm:flex-row">
          <input
            className="input sm:max-w-sm"
            placeholder="Название новой доски"
            maxLength={80}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button className="btn btn-primary" disabled={createBoard.isPending || !title.trim()}>
            {createBoard.isPending ? "Создаём…" : "Создать доску"}
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        {boardsQuery.isLoading ? (
          <p className="mt-10 text-sm text-slate-500 dark:text-slate-400">Загружаем доски…</p>
        ) : boardsQuery.isError ? (
          <p className="mt-10 text-sm text-rose-600 dark:text-rose-400">
            {boardsQuery.error instanceof Error ? boardsQuery.error.message : "Не удалось загрузить доски"}
          </p>
        ) : boardsQuery.data && boardsQuery.data.length > 0 ? (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boardsQuery.data.map((board) => (
              <li key={board.id} className="surface group relative overflow-hidden">
                <div className="h-2 bg-gradient-to-r from-indigo-500 via-sky-500 to-emerald-500" />
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link to={`/b/${board.id}`} className="text-lg font-semibold hover:text-indigo-600 dark:hover:text-indigo-400">
                      {board.title}
                    </Link>
                    <span
                      className={`chip ${
                        board.role === "owner"
                          ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
                          : board.role === "editor"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {ROLE_LABELS[board.role]}
                    </span>
                  </div>
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                    Обновлена {new Date(board.updatedAt).toLocaleDateString("ru-RU")}
                  </p>
                  <div className="mt-4 flex items-center justify-between">
                    <Link to={`/b/${board.id}`} className="btn btn-primary">
                      Открыть
                    </Link>
                    {board.role === "owner" ? (
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(board)}>
                        Удалить
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="surface mt-8 p-10 text-center">
            <p className="font-medium">Пока нет ни одной доски</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Создайте первую — колонки To Do, In Progress и Done появятся автоматически.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
