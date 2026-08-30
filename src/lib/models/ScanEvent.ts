import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const VerificationRunSchema = new Schema(
  {
    layer1Json: { type: String, required: true },
    layer2Json: { type: String, required: true },
    layer3Json: { type: String, required: true },
  },
  { _id: false },
);

const ScanEventSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: "Product", default: null },
    decodedPayload: { type: String, required: true, index: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    deviceId: { type: String, default: null },
    imageMeta: { type: String, default: null },
    layer1Pass: { type: Boolean, default: false },
    layer2Pass: { type: Boolean, default: false },
    layer3Pass: { type: Boolean, default: false },
    riskFlags: { type: String, default: "[]" },
    outcome: { type: String, required: true, index: true },
    aiRemark: { type: String, default: null },
    aiRecommendations: { type: String, default: null },
    distanceMiles: { type: Number, default: null },
    hoursSinceLast: { type: Number, default: null },
    scanCountAtTime: { type: Number, default: 0 },
    reported: { type: Boolean, default: false },
    verificationRun: { type: VerificationRunSchema, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type ScanEventDoc = InferSchemaType<typeof ScanEventSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const ScanEvent: Model<ScanEventDoc> =
  mongoose.models.ScanEvent ||
  mongoose.model<ScanEventDoc>("ScanEvent", ScanEventSchema);
