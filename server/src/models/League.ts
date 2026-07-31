import { Schema, model, Types, type Document } from "mongoose";
import { Discipline, EventStatus, ExperienceLevel } from "../types";

// Distance League — a competition spread over several dates (מועדים), each with
// N rounds (סבבים, default 2). Every round is realized as an ordinary Event
// (see services/league-round.service) so the whole scheduler/judge/scoring
// pipeline is reused unchanged. The winner is decided across rounds by
// `scoring.mode` (best-of-N by default, or sum), so a team that skips a date is
// still ranked on its best runs.

export type LeagueScoringMode = "bestOf" | "sum";

export interface ILeagueDate {
  _id: Types.ObjectId;
  date: Date;
  roundsCount: number; // rounds run on this date (default 2)
  label?: string;
}

export interface ILeague extends Document {
  name: string;
  slug: string;
  ownerId?: Types.ObjectId;
  organizerIds: Types.ObjectId[];
  categoryId: Discipline; // fixed to Distance for now
  experienceLevels: ExperienceLevel[];
  dates: Types.DocumentArray<ILeagueDate>;
  scoring: {
    mode: LeagueScoringMode;
    bestN: number; // used when mode === "bestOf"
  };
  // Defaults propagated to each generated round Event.
  minRestTimeMinutes: number;
  activePitches: number;
  status: EventStatus;
}

const leagueDateSchema = new Schema<ILeagueDate>({
  date: { type: Date, required: true },
  roundsCount: { type: Number, required: true, default: 2, min: 1 },
  label: { type: String, trim: true },
});

const leagueSchema = new Schema<ILeague>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    organizerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    categoryId: {
      type: String,
      enum: Object.values(Discipline),
      default: Discipline.Distance,
    },
    experienceLevels: {
      type: [{ type: String, enum: Object.values(ExperienceLevel) }],
      default: [ExperienceLevel.Beginner, ExperienceLevel.Advanced],
    },
    dates: { type: [leagueDateSchema], default: [] },
    scoring: {
      mode: {
        type: String,
        enum: ["bestOf", "sum"],
        default: "bestOf",
      },
      bestN: { type: Number, default: 3, min: 1 },
    },
    minRestTimeMinutes: { type: Number, required: true, default: 0 },
    activePitches: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.Planning,
    },
  },
  { timestamps: true }
);

export const League = model<ILeague>("League", leagueSchema);
