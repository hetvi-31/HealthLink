import "dotenv/config";
import mongoose from "mongoose";

if (!process.env.MONGODB_URI) {
  throw new Error("MONGODB_URI is missing from backend/.env");
}

try {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("MongoDB connected successfully.");
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}