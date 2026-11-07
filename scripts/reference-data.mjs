// Isolated prototype fixtures. Never points at the normal vesta database.
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import pg from "pg";
import { startDatabase } from "./database.mjs";
await startDatabase();
const base = new URL(
  process.env.DATABASE_URL ||
    "postgresql://vesta:vesta_local_only@127.0.0.1:55432/vesta",
);
base.pathname = "/postgres";
const admin = new pg.Client({ connectionString: base.toString() });
await admin.connect();
const dbName = "vesta_reference";
if (
  !(await admin.query("SELECT 1 FROM pg_database WHERE datname=$1", [dbName]))
    .rowCount
)
  await admin.query("CREATE DATABASE vesta_reference");
await admin.end();
base.pathname = "/" + dbName;
process.env.DATABASE_URL = base.toString();
const { migrate, transaction, pool } = await import("../dist/server/db.js");
const { seed } = await import("../dist/server/seed.js");
await migrate();
await seed();
const html = await readFile(
  new URL("../CRM销售管理系统_演示Demo.html", import.meta.url),
  "utf8",
);
const line = html.split("\n").find((l) => l.startsWith("const SEED="));
const source = JSON.parse(
  line.slice("const SEED=".length).replace(/;\s*$/, ""),
);
await transaction(async (db) => {
  if (await db.get("settings", "reference-import")) return;
  // New reference database only: remove initial business fixtures, preserving users and rules.
  await db.client.query("DELETE FROM records WHERE kind <> 'settings'");
  for (const p of source.products)
    await db.put("products", {
      ...p,
      price: p.price / 100,
      usd: p.usd / 100,
      cost: p.cost / 100,
      reserved: 0,
      warehouse: "WH-01",
    });
  for (const c of source.customers)
    await db.put("customers", {
      ...c,
      tier: c.tier[0],
      lastFollow: c.last,
      next: c.next?.slice(0, 10),
      createdAt: c.since + "T00:00:00+08:00",
    });
  await db.client.query(
    "UPDATE users SET customer='c1' WHERE username='buyer'",
  );
  await db.client.query(
    "UPDATE users SET customer='c2' WHERE username='buyer2'",
  );
  const item = (i, o) => {
    const p = source.products.find((p) => p.id === i.product);
    const shipped =
        ["shipped", "delivered"].includes(o.stage) || o.status === "completed",
      delivered = o.stage === "delivered" || o.status === "completed",
      produced = shipped || o.stage === "ready";
    return {
      ...i,
      price: i.price / 100,
      cost: p.cost / 100,
      en: p.en,
      specEn: p.specEn,
      unit: p.unit,
      listPrice: (o.currency === "USD" ? p.usd : p.price) / 100,
      produced: produced ? i.qty : 0,
      shipped: shipped ? i.qty : 0,
      delivered: delivered ? i.qty : 0,
    };
  };
  for (const o of source.orders) {
    const paid = source.receipts
      .filter((r) => r.order === o.id && r.status === "verified")
      .reduce((s, r) => s + r.amount / 100, 0);
    const items = o.items.map((i) => item(i, o));
    await db.put("orders", {
      ...o,
      items,
      total: o.total / 100,
      paid,
      released: o.stage !== "not_started",
      createdBy: o.owner,
      confirmedAt: o.date + "T00:00:00+08:00",
      createdAt: o.date + "T00:00:00+08:00",
      lastFollow: o.last,
      next: o.next?.slice(0, 10),
      customerSnapshot: source.customers.find((c) => c.id === o.customer),
      paymentTerms: `预付 ${o.depositPct}%，余款于约定日期结清`,
    });
    for (const i of items) {
      if (i.shipped)
        await db.put("shipments", {
          id: "REF-SH-" + o.id + "-" + i.product,
          order: o.id,
          customer: o.customer,
          product: i.product,
          qty: i.shipped,
          mode: o.container ? "sea" : "express",
          carrier: o.carrier,
          tracking: o.tracking,
          container: o.container,
          eta: o.eta,
          delivered: i.delivered === i.qty,
          deliveredAt: i.delivered ? o.eta : null,
          at: o.date,
        });
      const p = await db.get("products", i.product);
      p.reserved += i.produced - i.shipped;
      await db.put("products", p);
    }
    for (const [n, h] of (o.history || []).entries())
      await db.put("follows", {
        id: "REF-H-" + o.id + "-" + n,
        entity: o.id,
        customer: o.customer,
        kind: "orders",
        at: h.at,
        occurred: h.at,
        actor: h.actor,
        note: h.text,
      });
  }
  for (const r of source.receipts) {
    const o = source.orders.find((o) => o.id === r.order);
    await db.put("receipts", {
      ...r,
      amount: r.amount / 100,
      customer: o.customer,
      allocations: [{ order: r.order, amount: r.amount / 100 }],
      receivedAt: r.date,
      at: r.date,
      createdBy: "owner",
    });
  }
  for (const q of source.quotes)
    await db.put("quotes", {
      ...q,
      items: q.items.map((i) => item(i, q)),
      total: q.total / 100,
      createdAt: q.date + "T00:00:00+08:00",
      lastFollow: q.last,
      next: q.next?.slice(0, 10),
      customerSnapshot: source.customers.find((c) => c.id === q.customer),
      balanceDue: new Date(Date.parse(q.eta) + 7 * 86400000)
        .toISOString()
        .slice(0, 10),
      freight: 0,
      discount: 0,
      fees: 0,
    });
  for (const i of source.inquiries)
    await db.put("inquiries", {
      ...i,
      createdAt: i.date,
      items: i.items.map((x) => ({
        ...x,
        ...Object.fromEntries(
          Object.entries(
            source.products.find((p) => p.id === x.product),
          ).filter(([k]) =>
            ["name", "en", "sku", "spec", "specEn"].includes(k),
          ),
        ),
      })),
    });
  for (const f of source.follows)
    await db.put("follows", {
      ...f,
      kind:
        f.type === "order"
          ? "orders"
          : f.type === "quote"
            ? "quotes"
            : "customers",
      note: f.summary,
      occurred: f.at,
      next: f.next?.slice(0, 10),
    });
  for (const c of source.contracts) {
    const o = source.orders.find((o) => o.id === c.order);
    await db.put("contracts", {
      ...c,
      name: c.title,
      group: c.id,
      customer: o.customer,
      currency: o.currency,
      amount: o.total / 100,
      at: c.date,
      referenceOnly: true,
    });
  }
  await db.put("settings", { id: "reference-import", date: source.now });
});
await pool.end();
console.log(
  "Reference database ready: vesta_reference; fixed display date 2026-10-20. Normal database unchanged.",
);
if (process.argv.includes("--serve")) {
  const child = spawn(process.execPath, ["dist/server/main.js"], {
    env: {
      ...process.env,
      PORT: "3101",
      APP_ORIGINS: "http://127.0.0.1:3101,http://localhost:3101",
      FX_AUTO: "false",
      REFERENCE_DATE: "2026-10-20",
      UPLOAD_DIR: ".local/reference-uploads",
    },
    stdio: "inherit",
    windowsHide: true,
  });
  process.on("SIGINT", () => child.kill());
  process.on("SIGTERM", () => child.kill());
}
