"use client";

import type { ScorerProps } from "./types";
import { disciplineOf } from "../../../lib/disciplines";
import { DistanceScorer } from "./DistanceScorer";
import { ShuffleScorer } from "./ShuffleScorer";
import { WheelScorer } from "./WheelScorer";
import { AgilityScorer } from "./AgilityScorer";
import { CrissCrossScorer } from "./CrissCrossScorer";
import { TimedScorer } from "./TimedScorer";
import { FreestyleScorer } from "./FreestyleScorer";

// Dispatches to the right per-discipline scorer by the heat's category — one
// component per scorer family, mirroring the server's scoring/* modules.
export function DisciplineScorer(props: ScorerProps) {
  const discipline = disciplineOf(props.heat.categoryId);

  switch (discipline?.family) {
    case "zones":
      return <DistanceScorer {...props} />;
    case "count":
      return <ShuffleScorer {...props} />;
    case "area":
      return <WheelScorer {...props} />;
    case "agility":
      return <AgilityScorer {...props} />;
    case "crisscross":
      return <CrissCrossScorer {...props} />;
    case "timed":
      return <TimedScorer {...props} />;
    case "panel":
      return <FreestyleScorer {...props} />;
    default:
      return <ComingSoon nameHe={discipline?.nameHe ?? props.heat.categoryId} />;
  }
}

function ComingSoon({ nameHe }: { nameHe: string }) {
  return (
    <div className="ds-card p-8 text-center">
      <p className="text-lg font-bold">מסך השיפוט ל“{nameHe}” בבנייה</p>
      <p className="mt-1 text-sm text-muted">
        המקצה הזה יקבל מסך מותאם בקרוב.
      </p>
    </div>
  );
}
