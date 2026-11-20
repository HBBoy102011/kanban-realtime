import type { CardDto } from "@shared/types";
import { useEffect, useState, type FormEvent } from "react";

interface CardDialogProps {
  card: CardDto;
  canEdit: boolean;
  columnTitle: string;
  onClose: () => void;
  onSave: (cardId: string, data: { title: string; description: string; dueDate: string | null }) => Promise<void>;
  onDelete: (cardId: string) => Promise<void>;
}

function toDateInput(dueDate: string | null): string {
  if (!dueDate) return "";
  return new Date(dueDate).toISOString().slice(0, 10);
}

export function CardDialog({ card, canEdit, columnTitle, onClose, onSave, onDelete }: CardDialogProps) {
  const [title, setTitle] = useState(card.title);
  const [description, setDescription] = useState(card.description);
  const [dueDate, setDueDate] = useState(toDateInput(card.dueDate));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTitle(card.title);
    setDescription(card.description);
    setDueDate(toDateInput(card.dueDate));
  }, [card.id, card.title, card.description, card.dueDate]);

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setError(null);
    try {
      await onSave(card.id, {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!window.confirm("Удалить карточку?")) return;
    setBusy(true);
    setError(null);
    try {
      await onDelete(card.id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label={`Карточка ${card.title}`} className="surface w-full max-w-lg p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{columnTitle}</p>
            <h2 className="text-lg font-semibold">Карточка</h2>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Название</span>
            <input
              className="input"
              required
              maxLength={160}
              value={title}
              readOnly={!canEdit}
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Описание</span>
            <textarea
              className="input min-h-[120px] resize-y"
              maxLength={4000}
              placeholder="Детали задачи, критерии готовности…"
              value={description}
              readOnly={!canEdit}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>

          <label className="block text-sm sm:max-w-[220px]">
            <span className="mb-1 block font-medium">Дедлайн</span>
            <input
              className="input"
              type="date"
              value={dueDate}
              disabled={!canEdit}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </label>

          {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            {canEdit ? (
              <button type="button" className="btn btn-danger" onClick={() => void handleDelete()} disabled={busy}>
                Удалить
              </button>
            ) : (
              <span className="chip bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                Только просмотр
              </span>
            )}
            <div className="flex gap-2">
              <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
                Закрыть
              </button>
              {canEdit ? (
                <button className="btn btn-primary" disabled={busy || !title.trim()}>
                  {busy ? "Сохраняем…" : "Сохранить"}
                </button>
              ) : null}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
