import type { Request, Response, NextFunction } from "express";
import { verifyToken } from "../services/auth.service";

// §9.3 — JWT authentication. Reads a `Bearer <token>` header, verifies it, and
// attaches the decoded payload to `req.user`. 401 if missing or invalid.
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

// Public endpoints that still want the user when a token is present (never
// blocks). Used where the response is public but management links depend on the
// caller's role/ownership.
export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const token = req.headers.authorization?.split(" ")[1];
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next();
}
