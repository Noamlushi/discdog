import type { Server, Socket } from "socket.io";
import { CLIENT_EVENTS, eventRoom } from "./events";

export function registerSocketHandlers(io: Server): void {
  io.on("connection", (socket: Socket) => {
    console.log(`[socket] connected: ${socket.id}`);

    // §5.2 — scoped rooms: a client subscribes to one event's updates.
    socket.on(CLIENT_EVENTS.JOIN_EVENT_ROOM, (eventId: string) => {
      socket.join(eventRoom(eventId));
    });

    socket.on("disconnect", () => {
      console.log(`[socket] disconnected: ${socket.id}`);
    });
  });
}
