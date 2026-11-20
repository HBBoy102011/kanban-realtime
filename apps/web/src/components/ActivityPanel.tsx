import { useQuery } from "@tanstack/react-query";
import type { ActivityDto } from "@shared/types";
import { api } from "../lib/api";

const ACTION_LABELS: Record<string, string> = {
  "board.created": "создал(а) доску",
  "board.renamed": "переименовал(а) доску в",
  "member.added": "добавил(а) участника",
  "column.created": "добавил(а) колонку",
  "column.renamed": "переименовал(а) колонку в",
  "column.deleted": "удалил(а) колонку",
  "card.created": "создал(а) карточку",
  "card.renamed": "изменил(а) карточку",
  "card.moved": "переместил(а) карточку",
  "card.deleted": "удалил(а) карточку",
};

interface ActivityPanelProps {
  boardId: string;
  onClose: () => void;
}

export function ActivityPanel({ boardId, onClose }: ActivityPanelProps) {
  const activityQuery = useQuery({
    queryKey: ["activity", boardId],
    queryFn: async () => (await api<{ activity: ActivityDto[] }>(`/api/boards/${boardId}/activity`)).activity,
    refetchInterval: 15_000,
  });

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-sm flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="font-semibold">История действий</h2>
        <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Закрыть историю">
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activityQuery.isLoading ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Загружаем историю…</p>
        ) : activityQuery.isError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">Не удалось загрузить историю</p>
        ) : activityQuery.data && activityQuery.data.length > 0 ? (
          <ol className="space-y-3">
            {activityQuery.data.map((item) => (
              <li key={item.id} className="text-sm">
                <p>
                  <span className="font-medium">{item.user.name}</span>{" "}
                  <span className="text-slate-500 dark:text-slate-400">
                    {ACTION_LABELS[item.action] ?? item.action}
                  </span>{" "}
                  <span className="font-medium">{item.detail}</span>
                </p>
                <p className="text-xs text-slate-400">
                  {new Date(item.createdAt).toLocaleString("ru-RU", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-slate-500 dark:text-slate-400">Пока пусто</p>
        )}
      </div>
    </aside>
  );
}
