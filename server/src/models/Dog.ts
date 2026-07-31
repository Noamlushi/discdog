import { Schema, model, Types, type Document } from "mongoose";

// §4.2 Dog Schema
export interface IDog extends Document {
  ownerId: Types.ObjectId;
  name: string;
  dob: Date;
  isUnder35cm: boolean;
  medical_status: {
    rabies?: Date;
    brucella?: Date;
  };
}

const dogSchema = new Schema<IDog>(
  {
    ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, trim: true },
    // dob enforces min age (12 mo general, 15 mo Freestyle) — §4.2
    dob: { type: Date, required: true },
    // flags bar-height reduction in Frisbee Agility — §3.3 / §4.2
    isUnder35cm: { type: Boolean, default: false },
    medical_status: {
      rabies: { type: Date },
      brucella: { type: Date },
    },
  },
  { timestamps: true }
);

export const Dog = model<IDog>("Dog", dogSchema);
