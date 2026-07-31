import type { AuthPayload } from "./index";

// Attach the decoded JWT (§9.3) to every request. Populated by the
// `authenticate` / `optionalAuth` middleware.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export {};
