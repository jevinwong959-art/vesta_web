import "dotenv/config";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { startDatabase } from "./database.mjs";
const db = await startDatabase();
const run = (file, args = []) =>
  spawn(process.execPath, [resolve(file), ...args], {
    stdio: "inherit",
    windowsHide: true,
  });
const build = run("node_modules/typescript/bin/tsc", [
  "-p",
  "tsconfig.server.json",
]);
const code = await new Promise((r) => build.once("exit", r));
if (code !== 0) {
  await db.stop();
  process.exit(1);
}
const api = run("dist/server/main.js");
const web = run("node_modules/vite/bin/vite.js");
let closing = false;
const stop = async () => {
  if (closing) return;
  closing = true;
  api.kill();
  web.kill();
  await db.stop();
  process.exit(0);
};
api.once("exit", stop);
web.once("exit", stop);
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
