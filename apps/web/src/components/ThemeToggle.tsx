import { useEffect, useState } from "react";

const STORAGE_KEY = "kanban-theme";

function initialTheme(): "dark" | "light" {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">(initialTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
      aria-label={theme === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
      title="Переключить тему"
    >
      {theme === "dark" ? "☀" : "☾"}
    </button>
  );
}
