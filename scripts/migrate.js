import "dotenv/config";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.js";

try {
  const schema = await readFile(fileURLToPath(new URL("../db/schema.sql", import.meta.url)), "utf8");
  await pool.query(schema);
  console.log("HealthLink database schema is ready.");
} catch (error) {
  console.error("Database migration failed:", error.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
