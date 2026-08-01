"use client";

import Link from "next/link";
import { Undo2 } from "lucide-react";
import { leaguePath } from "../../lib/leaguePaths";

// Shown when a /l/:slug/:date/:round path doesn't resolve. Names the level that
// is missing — an unknown league, a date that was removed, or (the ordinary
// case) a round nobody has generated yet — and always offers the way back up
// the tree, so no round URL is ever a dead end.
export function RoundMissing({
  slug,
  missing,
}: {
  slug: string;
  missing: "league" | "date" | "round" | null;
}) {
  const text =
    missing === "league"
      ? "הליגה לא נמצאה"
      : missing === "date"
        ? "המועד הזה לא קיים בליגה"
        : "הסבב הזה עדיין לא נוצר";

  return (
    <div
      dir="rtl"
      className="grid min-h-screen place-items-center px-6 text-center"
    >
      <div className="space-y-4">
        <p className="text-muted">{text}</p>
        {missing !== "league" && (
          <Link href={leaguePath(slug)} className="ds-btn ds-btn-primary">
            <Undo2 className="h-5 w-5" />
            חזרה לעמוד הליגה
          </Link>
        )}
      </div>
    </div>
  );
}
