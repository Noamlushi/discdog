import type { Server } from "socket.io";
import { Match, type IMatch } from "../models";
import { MatchStatus } from "../types";
import { SERVER_EVENTS, eventRoom } from "../sockets/events";

// Heat status broadcasting (§5.2) — single source of truth for the
// `match_status_changed` payload, shared by the heats status route and
// Freestyle's all-judges-done auto-completion so both emit the same shape.

// The soonest upcoming heat on the same pitch — feeds the "on deck" panel (§3.4).
export function findNextOnDeck(match: IMatch) {
  return Match.findOne({
    eventId: match.eventId,
    pitchNumber: match.pitchNumber,
    _id: { $ne: match._id },
    status: { $in: [MatchStatus.Pending, MatchStatus.OnDeck] },
    isFinalsPlaceholder: { $ne: true }, // skip empty reserved finals slots
    scheduledTime: { $gte: match.scheduledTime },
  })
    .sort({ scheduledTime: 1 })
    .populate("team.playerId", "name")
    .populate("team.dogId", "name");
}

/** Build the canonical match_status_changed payload, populating team + next-up. */
export async function buildStatusPayload(match: IMatch) {
  const nextOnDeck = await findNextOnDeck(match);
  await match.populate([
    { path: "team.playerId", select: "name" },
    { path: "team.dogId", select: "name" },
  ]);

  return {
    matchId: String(match._id),
    eventId: String(match.eventId),
    pitchNumber: match.pitchNumber,
    categoryId: match.categoryId,
    experienceLevel: match.experienceLevel,
    status: match.status,
    liveStartedAt: match.liveStartedAt ?? null,
    finalScore: match.finalScore ?? null,
    team: match.team,
    nextOnDeck: nextOnDeck
      ? {
          matchId: String(nextOnDeck._id),
          scheduledTime: nextOnDeck.scheduledTime,
          team: nextOnDeck.team,
        }
      : null,
  };
}

/** Build + emit the status payload to the heat's event room. Returns the payload. */
export async function emitStatusChanged(
  io: Server | undefined,
  match: IMatch
) {
  const payload = await buildStatusPayload(match);
  io?.to(eventRoom(payload.eventId)).emit(
    SERVER_EVENTS.MATCH_STATUS_CHANGED,
    payload
  );
  return payload;
}
