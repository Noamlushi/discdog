import { Schema, model, type Document } from "mongoose";
import { UserRole } from "../types";

// §4.1 User Schema
export interface IUser extends Document {
  name: string;
  phone_number: string;
  role: UserRole;
  // Login credentials — present only for Admin/Organizer/Judge accounts (§9.3).
  // Players imported from the roster (§5.1) have neither and cannot log in.
  email?: string;
  passwordHash?: string;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    phone_number: { type: String, trim: true },
    // role is critical for preventing judge–competitor conflicts (§3.1 / §7.1)
    role: { type: String, enum: Object.values(UserRole), required: true },
    // Unique when present; roster-imported players simply omit it (sparse).
    email: {
      type: String,
      trim: true,
      lowercase: true,
      unique: true,
      sparse: true,
    },
    passwordHash: { type: String, select: false },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
