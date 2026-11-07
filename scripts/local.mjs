import "dotenv/config";
import { spawn } from "node:child_process";
import { startDatabase } from "./database.mjs";
const db = await startDatabase();
const child = spawn(process.execPath, ["dist/server/main.js"], {
  stdio: "inherit",
  windowsHide: true,
});
let closing = false;
async function stop() {
  if (closing) return;
  closing = true;
  child.kill();
  await db.stop();
  process.exitCode = 0;
}
child.once("exit", stop);
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
