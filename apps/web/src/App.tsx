import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { BoardPage } from "./pages/BoardPage";
import { BoardsPage } from "./pages/BoardsPage";
import { InvitePage } from "./pages/InvitePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center text-sm text-slate-500 dark:text-slate-400">
      Загружаем сессию…
    </div>
  );
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Splash />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export function App() {
  const { user, loading } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={loading ? <Splash /> : user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        path="/register"
        element={loading ? <Splash /> : user ? <Navigate to="/" replace /> : <RegisterPage />}
      />
      <Route
        path="/"
        element={
          <RequireAuth>
            <BoardsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/b/:boardId"
        element={
          <RequireAuth>
            <BoardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/invite/:token"
        element={
          <RequireAuth>
            <InvitePage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
