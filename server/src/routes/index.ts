import { Router } from "express";
import authRouter from "./auth.routes";
import eventsRouter from "./events.routes";
import leaguesRouter from "./leagues.routes";
import scheduleRouter from "./schedule.routes";
import heatsRouter from "./heats.routes";
import scoringRouter from "./scoring.routes";
import leaderboardsRouter from "./leaderboards.routes";

// Aggregates all /api routers — mounted in app.ts under "/api".
const router = Router();

router.use("/auth", authRouter);
router.use("/events", eventsRouter);
router.use("/leagues", leaguesRouter);
router.use("/schedule", scheduleRouter);
router.use("/heats", heatsRouter);
router.use("/scoring", scoringRouter);
router.use("/leaderboards", leaderboardsRouter);

export default router;
