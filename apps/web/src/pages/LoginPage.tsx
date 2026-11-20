import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ThemeToggle } from "../components/ThemeToggle";

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("demo@kanban.dev");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось войти");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-slate-950 p-12 text-white lg:flex">
        <div className="absolute inset-0 bg-[radial-gradient(40rem_30rem_at_20%_10%,rgba(99,102,241,0.45),transparent),radial-gradient(30rem_30rem_at_90%_90%,rgba(14,165,233,0.35),transparent)]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-lg font-semibold">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 backdrop-blur">◧</span>
            Kanban Realtime
          </div>
          <h1 className="mt-16 max-w-md text-4xl font-semibold leading-tight">
            Доска, на которой команда видит изменения мгновенно.
          </h1>
          <p className="mt-4 max-w-md text-slate-300">
            Колонки, drag-and-drop, роли доступа и присутствие — без перезагрузки страницы.
          </p>
        </div>
        <ul className="relative space-y-2 text-sm text-slate-300">
          <li>• Синхронизация через Socket.IO</li>
          <li>• Права владельца, редактора и наблюдателя</li>
          <li>• Optimistic UI с откатом при ошибке</li>
        </ul>
      </div>

      <div className="flex flex-col px-6 py-8">
        <div className="flex justify-end">
          <ThemeToggle />
        </div>
        <div className="m-auto w-full max-w-sm">
          <h2 className="text-2xl font-semibold">Вход</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Демо-аккаунт: <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">demo@kanban.dev</code> /{" "}
            <code className="rounded bg-slate-200 px-1 dark:bg-slate-800">demo1234</code>
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Email</span>
              <input
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium">Пароль</span>
              <input
                className="input"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
            <button className="btn btn-primary w-full py-2" disabled={busy}>
              {busy ? "Входим…" : "Войти"}
            </button>
          </form>

          <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
            Нет аккаунта?{" "}
            <Link to="/register" className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
              Зарегистрироваться
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
