// §5.2 socket event names — mirror of the server's sockets/events.ts. Reference
// these constants instead of inlining string literals.

export const SERVER_EVENTS = {
  LIVE_SCORE_UPDATED: "live_score_updated",
  MATCH_STATUS_CHANGED: "match_status_changed",
  FREESTYLE_SYNC: "freestyle_sync",
  SCHEDULE_REORDERED: "schedule_reordered",
} as const;

export const CLIENT_EVENTS = {
  JOIN_EVENT_ROOM: "join_event_room",
} as const;
