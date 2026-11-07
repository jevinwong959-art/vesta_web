import "dotenv/config";
import EmbeddedPostgres from "embedded-postgres";
import pg from "pg";
import { existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
export async function startDatabase() {
  const url =
    process.env.DATABASE_URL ||
    "postgresql://vesta:vesta_local_only@127.0.0.1:55432/vesta";
  const probe = new pg.Client({
    connectionString: url,
    connectionTimeoutMillis: 1500,
  });
  try {
    await probe.connect();
    await probe.end();
    return { stop: async () => {} };
  } catch {
    await probe.end().catch(() => {});
  }
  if (process.env.EXTERNAL_DATABASE === "true")
    throw new Error(
      "External PostgreSQL unavailable. Start docker compose up -d postgres first.",
    );
  const parsed = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(parsed.hostname))
    throw new Error("Portable database must be loopback only");
  const databaseDir = resolve(
    process.env.LOCAL_DATABASE_DIR || ".local/postgres",
  );
  mkdirSync(databaseDir, { recursive: true });
  const cluster = new EmbeddedPostgres({
    databaseDir,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    port: Number(parsed.port),
    persistent: true,
    authMethod: "scram-sha-256",
    postgresFlags: ["-h", "127.0.0.1"],
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
    onLog: () => {},
    onError: (msg) => {
      if (String(msg).includes("FATAL")) console.error(msg);
    },
  });
  if (!existsSync(resolve(databaseDir, "PG_VERSION")))
    await cluster.initialise();
  await cluster.start();
  const maintenanceUrl = new URL(url);
  maintenanceUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  const dbname = parsed.pathname.slice(1);
  if (!/^[a-z][a-z0-9_]*$/.test(dbname))
    throw new Error("Invalid database name");
  if (
    !(
      await client.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbname])
    ).rowCount
  )
    await client.query(`CREATE DATABASE "${dbname}"`);
  await client.end();
  console.log(`PostgreSQL ready on 127.0.0.1:${parsed.port}`);
  return cluster;
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === resolve("scripts/database.mjs")
) {
  const db = await startDatabase();
  const keep = setInterval(() => {}, 60000);
  const stop = async () => {
    clearInterval(keep);
    await db.stop();
    process.exit(0);
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
