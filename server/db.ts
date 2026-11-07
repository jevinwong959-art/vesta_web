import { Pool, PoolClient } from "pg";
import { randomUUID } from "node:crypto";
export type RecordData = { id: string; [key: string]: any };
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    "postgresql://vesta:vesta_local_only@127.0.0.1:55432/vesta",
});
export const uid = (prefix: string) => `${prefix}-${randomUUID().slice(0, 12)}`;
export class Store {
  constructor(public client: PoolClient) {}
  async all(kind: string): Promise<RecordData[]> {
    return (
      await this.client.query(
        "SELECT data FROM records WHERE kind=$1 ORDER BY created_at,id",
        [kind],
      )
    ).rows.map((r) => r.data);
  }
  async get(kind: string, id: string): Promise<RecordData | undefined> {
    return (
      await this.client.query(
        "SELECT data FROM records WHERE kind=$1 AND id=$2",
        [kind, id],
      )
    ).rows[0]?.data;
  }
  async put(kind: string, data: RecordData) {
    await this.client.query(
      "INSERT INTO records(kind,id,data) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      [kind, data.id, data],
    );
    return data;
  }
  async audit(actor: string, action: string, entity: string) {
    return this.put("audits", {
      id: uid("AUD"),
      actor,
      action,
      entity,
      at: new Date().toISOString(),
    });
  }
}
export async function transaction<T>(
  fn: (db: Store) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // A single transaction lock intentionally serializes the small local Demo's writes.
    // All inventory, acceptance and receipt changes use this boundary.
    await client.query("SELECT pg_advisory_xact_lock(6842331)");
    const value = await fn(new Store(client));
    await client.query("COMMIT");
    return value;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}
export async function read<T>(fn: (db: Store) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    return await fn(new Store(c));
  } finally {
    c.release();
  }
}
export async function migrate() {
  await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz DEFAULT now());
    CREATE TABLE IF NOT EXISTS records(kind text NOT NULL,id text NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,id),CHECK(data->>'id'=id));
    CREATE TABLE IF NOT EXISTS users(id text PRIMARY KEY, username text UNIQUE NOT NULL, name text NOT NULL, role text NOT NULL, customer text, password text NOT NULL, active boolean NOT NULL DEFAULT true);
    CREATE TABLE IF NOT EXISTS sessions(token text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id),csrf text NOT NULL,expires timestamptz NOT NULL);
    CREATE INDEX IF NOT EXISTS records_customer_idx ON records(kind,(data->>'customer'));
    INSERT INTO schema_migrations(version) VALUES(1) ON CONFLICT DO NOTHING;`);
}
