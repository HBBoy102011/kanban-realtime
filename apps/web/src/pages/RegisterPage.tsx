import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { ThemeToggle } from "../components/ThemeToggle";

export function RegisterPage() {
  const { register } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(name, email, password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось зарегистрироваться");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <div className="flex items-center justify-between">
        <Link to="/login" className="text-sm font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white">
          ← Ко входу
        </Link>
        <ThemeToggle />
      </div>
      <div className="m-auto w-full max-w-sm">
        <h1 className="text-2xl font-semibold">Регистрация</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Аккаунт нужен, чтобы приглашать вас на доски и различать участников.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Имя</span>
            <input
              className="input"
              required
              maxLength={60}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
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
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">Минимум 8 символов</span>
          </label>
          {error ? <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}
          <button className="btn btn-primary w-full py-2" disabled={busy}>
            {busy ? "Создаём…" : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
}
