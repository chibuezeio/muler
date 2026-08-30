import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ThresholdConfigSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: "default" },
    maxMilesX: { type: Number, required: true, default: 50 },
    minHoursY: { type: Number, required: true, default: 2 },
    maxScansN: { type: Number, required: true, default: 25 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

export type ThresholdConfigDoc = InferSchemaType<typeof ThresholdConfigSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ThresholdConfig: Model<ThresholdConfigDoc> =
  mongoose.models.ThresholdConfig ||
  mongoose.model<ThresholdConfigDoc>("ThresholdConfig", ThresholdConfigSchema);
