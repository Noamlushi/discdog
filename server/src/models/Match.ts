import { Schema, model, Types, type Document } from "mongoose";
import { ExperienceLevel, MatchStatus } from "../types";

// §4.4 Match / Heat Schema
export interface IMatch extends Document {
  eventId: Types.ObjectId;
  categoryId: string; // e.g. Distance, Freestyle, CrissCross
  experienceLevel: ExperienceLevel;
  pitchNumber: number;
  scheduledTime: Date;
  // Optional: finals placeholder slots (§7.2) are reserved before the
  // qualifying teams are known, so the team is filled in after prelims.
  team?: {
    playerId?: Types.ObjectId;
    dogId?: Types.ObjectId;
  };
  judgeIds: Types.ObjectId[];
  status: MatchStatus;
  // Wall-clock moment the heat went Live — lets the live/spectator view compute
  // an accurate "time left" countdown even on a fresh page load (§3.4).
  liveStartedAt?: Date;
  finalScore?: number | string; // Mixed — numeric score or time string
  // True for empty finals slots awaiting qualifiers (§7.2).
  isFinalsPlaceholder: boolean;
}

const matchSchema = new Schema<IMatch>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    categoryId: { type: String, required: true },
    experienceLevel: {
      type: String,
      enum: Object.values(ExperienceLevel),
      required: true,
    },
    pitchNumber: { type: Number, required: true },
    scheduledTime: { type: Date, required: true },
    team: {
      playerId: { type: Schema.Types.ObjectId, ref: "User" },
      dogId: { type: Schema.Types.ObjectId, ref: "Dog" },
    },
    judgeIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    status: {
      type: String,
      enum: Object.values(MatchStatus),
      default: MatchStatus.Pending,
    },
    // Set when the heat transitions into Live; powers the spectator countdown.
    liveStartedAt: { type: Date },
    // Mixed (Number | String): numeric points or a time string — §4.4
    finalScore: { type: Schema.Types.Mixed },
    // Reserved-but-empty finals slot until qualifiers are filled in (§7.2).
    isFinalsPlaceholder: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Match = model<IMatch>("Match", matchSchema);
