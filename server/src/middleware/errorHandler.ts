import type { Request, Response, NextFunction } from "express";

// 404 fallthrough for unmatched routes.
export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: "Not found" });
}

// Centralised error handler — must keep the 4-arg signature for Express.
export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("[error]", err);
  res.status(500).json({ error: err.message ?? "Internal server error" });
}
