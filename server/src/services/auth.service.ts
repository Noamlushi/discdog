import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthPayload, UserRole } from "../types";
import { User, type IUser } from "../models/User";

// §9.3 — JWT authentication for Admin/Organizer/Judge accounts. Public endpoints
// stay open; these helpers back the /api/auth routes and the auth middleware.

const TOKEN_TTL = "7d";
const SALT_ROUNDS = 10;

export const hashPassword = (plain: string): Promise<string> =>
  bcrypt.hash(plain, SALT_ROUNDS);

export const verifyPassword = (
  plain: string,
  hash: string
): Promise<boolean> => bcrypt.compare(plain, hash);

export function signToken(user: Pick<IUser, "role" | "name"> & { _id: unknown }): string {
  const payload: AuthPayload = {
    sub: String(user._id),
    role: user.role,
    name: user.name,
  };
  return jwt.sign(payload, env.jwtSecret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): AuthPayload {
  return jwt.verify(token, env.jwtSecret) as AuthPayload;
}

/** Login by email + password. Returns the token + a safe (no-hash) user, or null. */
export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: SafeUser } | null> {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash"
  );
  if (!user?.passwordHash) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  return { token: signToken(user), user: toSafeUser(user) };
}

/** Create a credentialed account (Admin/Organizer/Judge). Throws on duplicate email. */
export async function createAccount(input: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  phone_number?: string;
}): Promise<SafeUser> {
  const passwordHash = await hashPassword(input.password);
  const user = await User.create({
    name: input.name,
    email: input.email.toLowerCase(),
    phone_number: input.phone_number,
    role: input.role,
    passwordHash,
  });
  return toSafeUser(user);
}

export interface SafeUser {
  _id: string;
  name: string;
  email?: string;
  role: UserRole;
}

export function toSafeUser(user: IUser): SafeUser {
  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
  };
}
