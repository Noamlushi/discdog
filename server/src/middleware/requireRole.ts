import type { Request, Response, NextFunction } from "express";
import type { UserRole } from "../types";

// §9.3 — role-based gate. Runs after `authenticate` has populated `req.user`.
// 403 when the caller's role is not in the allowed set.
export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
