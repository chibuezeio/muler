import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const ProductSchema = new Schema(
  {
    productId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    batch: { type: String, required: true },
    manufacturer: { type: String, required: true },
    qrPayload: { type: String, required: true, unique: true, index: true },
    description: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type ProductDoc = InferSchemaType<typeof ProductSchema> & {
  _id: mongoose.Types.ObjectId;
};

export const Product: Model<ProductDoc> =
  mongoose.models.Product || mongoose.model<ProductDoc>("Product", ProductSchema);
