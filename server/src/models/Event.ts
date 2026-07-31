import { Schema, model, Types, type Document } from "mongoose";
import { EventStatus } from "../types";

// §4.3 Event Schema
export interface IEvent extends Document {
  name: string;
  // Unique, shareable competition URL segment (/c/:slug). §3.1
  slug: string;
  // Ownership (§3.1): the Admin who created it + assigned Organizers who manage it.
  ownerId?: Types.ObjectId;
  organizerIds: Types.ObjectId[];
  estimatedStartTime: Date;
  estimatedEndTime: Date;
  minRestTimeMinutes: number;
  calculatedMinDuration?: number;
  activePitches: number;
  status: EventStatus;
  // League linkage (§ Distance League): when set, this Event is one round of a
  // league — otherwise it is a standalone competition. The scheduler/judge/
  // scoring pipeline treats league rounds like any other Event.
  leagueId?: Types.ObjectId;
  leagueDateId?: Types.ObjectId;
  roundIndex?: number;
}

const eventSchema = new Schema<IEvent>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    ownerId: { type: Schema.Types.ObjectId, ref: "User" },
    organizerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    estimatedStartTime: { type: Date, required: true },
    estimatedEndTime: { type: Date, required: true },
    // minimum rest between a dog's runs (§7.1 hard constraint)
    minRestTimeMinutes: { type: Number, required: true, default: 0 },
    // theoretical minimum, computed by the scheduler (§3.2 sanity check)
    calculatedMinDuration: { type: Number },
    activePitches: { type: Number, required: true, default: 1 },
    status: {
      type: String,
      enum: Object.values(EventStatus),
      default: EventStatus.Planning,
    },
    leagueId: { type: Schema.Types.ObjectId, ref: "League" },
    leagueDateId: { type: Schema.Types.ObjectId },
    roundIndex: { type: Number },
  },
  { timestamps: true }
);

export const Event = model<IEvent>("Event", eventSchema);
