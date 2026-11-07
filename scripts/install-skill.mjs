import { cp, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";
const target = resolve(
  process.env.CODEX_HOME || resolve(homedir(), ".codex"),
  "skills/vesta-website-build",
);
await mkdir(target, { recursive: true });
await cp(resolve("skills/vesta-website-build"), target, { recursive: true });
console.log(`Installed vesta-website-build: ${target}`);
