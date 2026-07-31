"use client";

import { Undo2 } from "lucide-react";

// §3.3 / §6.2 / §8.2 — floating Undo button pinned above the bottom nav. Removes
// the last judging action without disrupting the scoring flow. Oversized for
// fat-finger use on tablets.
export function UndoFab({
  onUndo,
  disabled,
}: {
  onUndo: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onUndo}
      disabled={disabled}
      aria-label="Undo last action"
      className="fixed bottom-28 right-4 z-20 flex h-tap w-tap items-center justify-center gap-1 rounded-full border border-line bg-elevated text-ink shadow-soft transition active:scale-95 disabled:opacity-40"
    >
      <Undo2 className="h-8 w-8" />
    </button>
  );
}
