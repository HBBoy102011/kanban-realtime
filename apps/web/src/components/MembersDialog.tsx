import type { BoardDto } from "@shared/types";
import { ROLE_LABELS, type Role } from "@shared/permissions";
import { useState, type FormEvent } from "react";
import { api } from "../lib/api";

interface MembersDialogProps {
  board: BoardDto;
  canManage: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export function MembersDialog({ board, canManage, onClose, onChanged }: MembersDialogProps) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addMember(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/boards/${board.id}/members`, { method: "POST", body: { email: email.trim(), role } });
      setEmail("");
      setNotice("Участник добавлен");
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось добавить участника");
    } finally {
      setBusy(false);
    }
  }

  async function createInvite() {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ url: string }>(`/api/boards/${board.id}/invite`, { method: "POST" });
      setInviteUrl(data.url);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать ссылку");
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(userId: string, name: string) {
    if (!window.confirm(`Удалить ${name} с доски?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api<void>(`/api/boards/${board.id}/members/${userId}`, { method: "DELETE" });
      onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось удалить участника");
    } finally {
      setBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setNotice("Ссылка скопирована");
    } catch {
      setNotice("Скопируйте ссылку вручную");
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-label="Участники доски" className="surface w-full max-w-lg p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Участники</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">{board.title}</p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Закрыть">
            ✕
          </button>
        </div>

        <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
          {board.members.map((member) => (
            <li key={member.userId} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{member.name}</p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">{member.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {ROLE_LABELS[member.role as Role]}
                </span>
                {canManage && member.role !== "owner" ? (
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={() => void removeMember(member.userId, member.name)}
                    disabled={busy}
                  >
                    Убрать
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>

        {canManage ? (
          <div className="mt-5 space-y-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            <form onSubmit={(event) => void addMember(event)} className="space-y-2">
              <p className="text-sm font-medium">Пригласить по email</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  className="input"
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <select
                  className="input sm:w-36"
                  value={role}
                  onChange={(event) => setRole(event.target.value as "editor" | "viewer")}
                >
                  <option value="editor">Редактор</option>
                  <option value="viewer">Наблюдатель</option>
                </select>
                <button className="btn btn-primary" disabled={busy || !email.trim()}>
                  Добавить
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Пользователь должен быть зарегистрирован в приложении.
              </p>
            </form>

            <div className="space-y-2">
              <p className="text-sm font-medium">Ссылка-приглашение</p>
              {inviteUrl ? (
                <div className="flex gap-2">
                  <input className="input text-xs" readOnly value={inviteUrl} />
                  <button type="button" className="btn btn-primary" onClick={() => void copyInvite()}>
                    Копировать
                  </button>
                </div>
              ) : (
                <button type="button" className="btn btn-ghost" onClick={() => void createInvite()} disabled={busy}>
                  Создать ссылку (роль: редактор)
                </button>
              )}
            </div>
          </div>
        ) : null}

        {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-emerald-600 dark:text-emerald-400">{notice}</p> : null}
      </div>
    </div>
  );
}
