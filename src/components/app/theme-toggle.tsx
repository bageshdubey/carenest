"use client";

import { Moon, Sun } from "lucide-react";

/**
 * Switches light and dark, and remembers the choice on this device. The icon follows the
 * "dark" class through CSS, so the first paint is always right without waiting for React.
 */
export function ThemeToggle({ label, className = "size-10 rounded-xl border" }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid shrink-0 place-items-center text-foreground hover:bg-muted ${className}`}
      onClick={() => {
        const dark = !document.documentElement.classList.contains("dark");
        document.documentElement.classList.toggle("dark", dark);
        try {
          localStorage.setItem("theme", dark ? "dark" : "light");
        } catch {
          // Private browsing can block storage: the switch still works until the page closes.
        }
      }}
    >
      <Moon className="size-5 dark:hidden" aria-hidden />
      <Sun className="hidden size-5 dark:block" aria-hidden />
    </button>
  );
}
