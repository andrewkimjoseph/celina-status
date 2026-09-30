import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faSun, faMoon } from "@fortawesome/free-solid-svg-icons";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";

config.autoAddCss = false;

type Theme = "light" | "dark";

function getInitialTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setTheme(getInitialTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.classList.toggle("dark", next === "dark");
    try {
      localStorage.setItem("celina-theme", next);
    } catch {
      /* private mode */
    }
  };

  const isDark = mounted ? theme === "dark" : false;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-[2px] border-2 border-foreground bg-card text-foreground/80 shadow-[var(--shadow-brutal-sm)] transition-[transform,box-shadow,background-color,color] hover:bg-muted hover:text-foreground active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
    >
      <FontAwesomeIcon icon={isDark ? faSun : faMoon} className="h-4 w-4" />
    </button>
  );
}
