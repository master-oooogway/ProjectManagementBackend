import mongoose from "mongoose";

export const objectIdOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  // If it's already a valid ObjectId string, keep it.
  if (mongoose.isValidObjectId(value)) return new mongoose.Types.ObjectId(value);
  return null;
};

export const assertObjectId = (value, name) => {
  if (!mongoose.isValidObjectId(value)) {
    const field = name ? `${name} ` : "";
    throw new Error(`${field}must be a valid 24-character hex ObjectId`);
  }
  return new mongoose.Types.ObjectId(value);
};

