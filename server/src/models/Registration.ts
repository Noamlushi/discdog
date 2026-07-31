import { Schema, model, Types, type Document } from "mongoose";
import { Discipline, ExperienceLevel } from "../types";

// Registration / Entry — one (player, dog) pairing entered into one discipline
// at one level for an event. Created by the roster import (§5.1) and consumed by
// the scheduler, which turns each registration into a Match/heat (§7).
export interface IRegistration extends Document {
  eventId: Types.ObjectId;
  // Set on the league master roster (imported once at league level). Round
  // Events clone these into their own eventId-scoped registrations.
  leagueId?: Types.ObjectId;
  playerId: Types.ObjectId;
  dogId: Types.ObjectId;
  discipline: Discipline; // mirrors Match.categoryId
  experienceLevel: ExperienceLevel;
}

const registrationSchema = new Schema<IRegistration>(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event" },
    leagueId: { type: Schema.Types.ObjectId, ref: "League" },
    playerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    dogId: { type: Schema.Types.ObjectId, ref: "Dog", required: true },
    discipline: {
      type: String,
      enum: Object.values(Discipline),
      required: true,
    },
    experienceLevel: {
      type: String,
      enum: Object.values(ExperienceLevel),
      required: true,
    },
  },
  { timestamps: true }
);

// Scheduler always loads registrations by event; league import loads by league.
registrationSchema.index({ eventId: 1 });
registrationSchema.index({ leagueId: 1 });

export const Registration = model<IRegistration>(
  "Registration",
  registrationSchema
);
