// §5.2 WebSocket event names — single source of truth for both layers.

// Server → Client
export const SERVER_EVENTS = {
  LIVE_SCORE_UPDATED: "live_score_updated",
  MATCH_STATUS_CHANGED: "match_status_changed",
  FREESTYLE_SYNC: "freestyle_sync",
  // The run order on a pitch was changed mid-competition (§3.2) — every judge,
  // organizer and spectator screen re-pulls the heat list.
  SCHEDULE_REORDERED: "schedule_reordered",
} as const;

// Client → Server
export const CLIENT_EVENTS = {
  JOIN_EVENT_ROOM: "join_event_room",
} as const;

// Scoped room name for a single event (§5.2).
export const eventRoom = (eventId: string): string => `event:${eventId}`;
