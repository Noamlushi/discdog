import mongoose from "mongoose";
import { env } from "../config/env";
import { connectDB } from "../config/db";
import { User } from "../models";
import { UserRole } from "../types";
import { hashPassword } from "../services/auth.service";

// One-time bootstrap (§9.3): create (or reset the password of) the owner's Admin
// account from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME. Run: `npm run seed:admin`.
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL?.toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment");
  }

  await connectDB();
  const passwordHash = await hashPassword(password);

  const existing = await User.findOne({ email });
  if (existing) {
    existing.passwordHash = passwordHash;
    existing.role = UserRole.Admin;
    existing.name = name;
    await existing.save();
    console.log(`[seed] Updated admin ${email}`);
  } else {
    await User.create({ name, email, role: UserRole.Admin, passwordHash });
    console.log(`[seed] Created admin ${email}`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[seed] Failed:", err);
  process.exit(1);
});

// Silence unused-import warning for env side-effect load ordering.
void env;
