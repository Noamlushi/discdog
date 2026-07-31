"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

// §8.1 — light/dark switch. Small pill button; drop it into any header/top bar.
// Shows the icon of the theme you'd switch TO so the affordance reads clearly.
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const toDark = theme === "light";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={toDark ? "מעבר למצב כהה" : "מעבר למצב בהיר"}
      title={toDark ? "מצב כהה" : "מצב בהיר"}
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 text-muted transition hover:text-ink ${className}`}
    >
      {toDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  );
}
