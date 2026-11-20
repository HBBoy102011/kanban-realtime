import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    api<{ boardId: string; title: string }>(`/api/invites/${token}`, { method: "POST" })
      .then((result) => {
        if (cancelled) return;
        setState("ok");
        setMessage(`Вы добавлены на доску «${result.title}»`);
        navigate(`/b/${result.boardId}`, { replace: true });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setState("error");
        setMessage(cause instanceof Error ? cause.message : "Приглашение недействительно");
      });
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="surface w-full max-w-md p-8 text-center">
        {state === "loading" ? <p className="text-sm text-slate-500 dark:text-slate-400">Принимаем приглашение…</p> : null}
        {state === "ok" ? <p className="text-sm">{message}</p> : null}
        {state === "error" ? (
          <>
            <p className="text-sm text-rose-600 dark:text-rose-400">{message}</p>
            <Link to="/" className="btn btn-primary mt-4">
              К моим доскам
            </Link>
          </>
        ) : null}
      </div>
    </div>
  );
}
