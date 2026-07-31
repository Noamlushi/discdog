import { Schema, model, Types, type Document } from "mongoose";

// §4.5 Action Log Schema (Undo Support)
export interface IActionLog extends Document {
  matchId: Types.ObjectId;
  timestamp: string; // elapsed time at moment of action, e.g. '00:45'
  actionData: unknown; // Mixed tap payload, e.g. { zone: 4, points: 3 }
}

const actionLogSchema = new Schema<IActionLog>(
  {
    matchId: { type: Schema.Types.ObjectId, ref: "Match", required: true },
    timestamp: { type: String, required: true },
    actionData: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const ActionLog = model<IActionLog>("ActionLog", actionLogSchema);
