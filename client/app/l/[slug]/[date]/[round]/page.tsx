"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { leagueRoundPath } from "../../../../../lib/leaguePaths";

// /l/:slug/:date/:round on its own has no view of its own — the round's landing
// screen is its live dashboard, and the shell there carries the rest of the nav.
export default function LeagueRoundIndex() {
  const router = useRouter();
  const { slug, date, round } = useParams<{
    slug: string;
    date: string;
    round: string;
  }>();

  useEffect(() => {
    router.replace(`${leagueRoundPath(slug, date, Number(round))}/live`);
  }, [router, slug, date, round]);

  return (
    <div dir="rtl" className="grid min-h-screen place-items-center text-muted">
      טוען…
    </div>
  );
}
