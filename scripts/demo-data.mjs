import "dotenv/config";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { seedDemoScenarios } = require("../dist/server/demo.js");
const { pool } = require("../dist/server/db.js");
try {
  console.log(await seedDemoScenarios());
} finally {
  await pool.end();
}
