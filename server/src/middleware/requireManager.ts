import type { Request, Response, NextFunction } from "express";
import { Types } from "mongoose";
import { UserRole } from "../types";
import { Event, League } from "../models";

// §3.1 ownership gate — a competition/league is managed by the Admin (owner) or
// by an Organizer explicitly assigned to it. Runs after `authenticate`.
//
// The Admin passes for everything. An Organizer passes only for resources whose
// `ownerId` is them or whose `organizerIds` includes them. Any other role → 403.

// A minimal shape both Event and League satisfy once ownership fields exist.
interface Ownable {
  ownerId?: Types.ObjectId;
  organizerIds?: Types.ObjectId[];
}

function isManager(doc: Ownable, userId: string): boolean {
  if (doc.ownerId && String(doc.ownerId) === userId) return true;
  return (doc.organizerIds ?? []).some((id) => String(id) === userId);
}

// Pull the resource id from the usual places (route param, body, query).
function resolveId(req: Request, keys: string[]): string | null {
  for (const k of keys) {
    const v =
      req.params?.[k] ??
      (req.body as Record<string, unknown> | undefined)?.[k] ??
      (req.query as Record<string, unknown> | undefined)?.[k];
    if (typeof v === "string" && Types.ObjectId.isValid(v)) return v;
  }
  return null;
}

function makeGate(
  load: (id: string) => Promise<Ownable | null>,
  idKeys: string[]
) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (req.user.role === UserRole.Admin) {
      next();
      return;
    }
    if (req.user.role !== UserRole.Organizer) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const id = resolveId(req, idKeys);
    if (!id) {
      res.status(400).json({ error: "A valid resource id is required" });
      return;
    }
    try {
      const doc = await load(id);
      if (!doc) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      if (!isManager(doc, req.user.sub)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

// Event manager gate — resolves the event id from :id / eventId.
export const requireEventManager = makeGate(
  (id) => Event.findById(id).select("ownerId organizerIds").lean() as Promise<Ownable | null>,
  ["id", "eventId"]
);

// League manager gate — resolves the league id from :id / leagueId.
export const requireLeagueManager = makeGate(
  (id) => League.findById(id).select("ownerId organizerIds").lean() as Promise<Ownable | null>,
  ["id", "leagueId"]
);
