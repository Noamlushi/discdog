"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, Check, X } from "lucide-react";
import { updateLeague } from "../../lib/api";
import type { LeagueDto } from "../../lib/types";

// Managers rename the league's URL from here. It is the root of the round tree
// (/l/:slug/:date/:round), so leagues created before this existed are stuck with
// the random fallback slug until someone changes it — and changing it does break
// links already shared, which is why it asks first.
export function LeagueSlugEditor({ league }: { league: LeagueDto }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(league.slug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const next = value.trim();
    if (!next || next === league.slug) {
      setEditing(false);
      return;
    }
    if (
      !window.confirm(
        `לשנות את כתובת הליגה ל-/l/${next}?\nקישורים ישנים שכבר שיתפת יפסיקו לעבוד.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const updated = await updateLeague(league._id, { slug: next });
      router.replace(`/l/${updated.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה לא ידועה");
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-muted hover:border-accent/40 hover:text-ink"
      >
        <Link2 className="h-3.5 w-3.5" />
        <span dir="ltr" className="font-mono">
          /l/{league.slug}
        </span>
      </button>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted">/l/</span>
        <input
          autoFocus
          dir="ltr"
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-48 rounded-xl border border-line bg-surface-2 px-3 py-1.5 font-mono text-sm font-semibold text-ink outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          aria-label="שמור כתובת"
          className="rounded-lg p-1.5 text-accent hover:bg-lime/10 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(league.slug);
            setEditing(false);
          }}
          disabled={busy}
          aria-label="ביטול"
          className="rounded-lg p-1.5 text-muted hover:bg-surface-2 disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}
