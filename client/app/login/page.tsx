"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { LogIn, PawPrint } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

// §9.3 — login for Admin/Organizer/Judge accounts. Public surfaces don't need it.
function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = params.get("next") || "/admin";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-arena px-4 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-lime to-lime-bright text-lime-ink shadow-glow">
            <PawPrint className="h-8 w-8" />
          </span>
          <h1 className="text-2xl font-black tracking-tight">כניסה למערכת</h1>
          <p className="mt-1 text-sm text-muted">
            אזור ניהול ושיפוט — J&apos;GAMES
          </p>
        </div>

        <form onSubmit={onSubmit} className="ds-card space-y-4 p-6">
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink/80">
              אימייל
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              dir="ltr"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-sm font-bold text-ink/80">
              סיסמה
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm text-ink outline-none focus:border-accent"
              dir="ltr"
            />
          </label>

          {error && (
            <p className="rounded-2xl border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="ds-btn ds-btn-primary w-full disabled:opacity-50"
          >
            <LogIn className="h-5 w-5" />
            {busy ? "מתחבר…" : "התחבר"}
          </button>
        </form>

        <Link
          href="/"
          className="mt-6 block text-center text-sm font-semibold text-muted hover:text-accent"
        >
          חזרה לדף הבית
        </Link>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
