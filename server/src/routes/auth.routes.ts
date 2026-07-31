import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { UserRole } from "../types";
import { User } from "../models";
import { login, createAccount, toSafeUser } from "../services/auth.service";

// §9.3 — authentication endpoints. Login is public; account creation is
// Admin-only (the owner provisions organizers/judges).
const router = Router();

// Roles that may hold login credentials.
const CREDENTIALED_ROLES = new Set<UserRole>([
  UserRole.Admin,
  UserRole.Organizer,
  UserRole.Judge,
]);

// POST /api/auth/login — email + password → { token, user }
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }
    const result = await login(String(email), String(password));
    if (!result) return res.status(401).json({ error: "Invalid credentials" });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register — provision an Organizer/Judge/Admin (Admin only)
router.post(
  "/register",
  authenticate,
  requireRole(UserRole.Admin),
  async (req, res, next) => {
    try {
      const { name, email, password, role, phone_number } = req.body ?? {};
      if (!name || !email || !password || !role) {
        return res
          .status(400)
          .json({ error: "name, email, password, and role are required" });
      }
      if (!CREDENTIALED_ROLES.has(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      const exists = await User.findOne({ email: String(email).toLowerCase() })
        .select("_id")
        .lean();
      if (exists) {
        return res.status(409).json({ error: "Email already in use" });
      }
      const user = await createAccount({ name, email, password, role, phone_number });
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  }
);

// GET /api/auth/me — current user from the token
router.get("/me", authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.user!.sub).lean();
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(toSafeUser(user as never));
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/organizers — list Organizer accounts, for the assign-organizer
// UI (Admin only).
router.get(
  "/organizers",
  authenticate,
  requireRole(UserRole.Admin),
  async (_req, res, next) => {
    try {
      const organizers = await User.find({ role: UserRole.Organizer })
        .select("name email")
        .sort({ name: 1 })
        .lean();
      res.json(organizers);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
