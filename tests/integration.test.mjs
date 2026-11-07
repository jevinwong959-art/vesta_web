import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import pg from "pg";
import { randomUUID } from "node:crypto";
import { startDatabase } from "../scripts/database.mjs";

const name = `vesta_test_${process.pid}`;
const base = new URL(
  process.env.DATABASE_URL ||
    "postgresql://vesta:vesta_local_only@127.0.0.1:55432/vesta",
);
base.pathname = "/postgres";
const admin = new pg.Client({ connectionString: base.toString() });
let processApi,
  logs = "",
  client,
  cluster;
const users = {};
const url = "http://127.0.0.1:3199/api/v1/";
async function request(who, path, body, expected = 200, csrf = true) {
  const u = users[who];
  const r = await fetch(url + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(u ? { Cookie: u.cookie } : {}),
      ...(body !== undefined
        ? {
            "Content-Type": "application/json",
            ...(csrf && u ? { "X-CSRF-Token": u.csrf } : {}),
          }
        : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  assert.equal(r.status, expected, JSON.stringify(data));
  return data;
}
const act = (who, name, b, status = 201) =>
  request(who, "actions/" + name, b, status);
before(async () => {
  cluster = await startDatabase();
  await admin.connect();
  await admin.query(`CREATE DATABASE "${name}"`);
  base.pathname = "/" + name;
  process.env.DATABASE_URL = base.toString();
  client = new pg.Client({ connectionString: base.toString() });
  await client.connect();
  processApi = spawn(process.execPath, ["dist/server/main.js"], {
    env: {
      ...process.env,
      DATABASE_URL: base.toString(),
      PORT: "3199",
      FX_AUTO: "false",
      UPLOAD_DIR: ".local/test-uploads",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processApi.stdout.on("data", (d) => (logs += d));
  processApi.stderr.on("data", (d) => (logs += d));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url + "health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error(logs);
  }
  for (const username of [
    "owner",
    "manager",
    "sales",
    "sales2",
    "finance",
    "warehouse",
    "admin",
    "buyer",
    "buyer2",
  ]) {
    const r = await fetch(url + "login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password: "VestaDemo2026!" }),
    });
    assert.equal(r.status, 201);
    users[username] = {
      ...(await r.json()),
      cookie: r.headers.get("set-cookie").split(";")[0],
    };
  }
});
after(async () => {
  if (processApi) {
    const exited = new Promise((r) => processApi.once("exit", r));
    processApi.kill();
    await exited;
  }
  await client?.end();
  await admin.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
  await admin.end();
  await cluster?.stop();
});

test("authentication, CSRF, row scopes and restricted fields", async () => {
  await request(null, "data/customers", undefined, 401);
  await request("sales", "actions/quote-submit", { id: "missing" }, 403, false);
  assert.equal((await request("sales", "data/customers")).length, 1);
  assert.equal((await request("buyer", "data/customers"))[0].id, "C-001");
  await request("buyer", "data/receipts", undefined, 403);
  await request("admin", "data/orders", undefined, 403);
  const p = await request("sales", "data/products");
  assert(!JSON.stringify(p).includes('"cost"'));
  const w = await request("warehouse", "data/products");
  for (const k of ['"cost"', '"price"', '"usd"'])
    assert(!JSON.stringify(w).includes(k));
  assert.equal((await request("owner", "data/products"))[0].cost, 31);
});

let quote, order;
test("quote approval and concurrent acceptance create exactly one order", async () => {
  quote = await act("sales", "quote-save", {
    customer: "C-001",
    currency: "CNY",
    items: [{ product: "P-001", qty: 100, price: 48 }],
    depositPct: 30,
    valid: "2099-01-01",
    eta: "2099-02-01",
  });
  await act("sales2", "quote-submit", { id: quote.id }, 403);
  await act("sales", "quote-submit", { id: quote.id });
  await act(
    "sales",
    "quote-decide",
    { id: quote.id, approve: true, note: "self approval" },
    403,
  );
  await act("manager", "quote-decide", {
    id: quote.id,
    approve: true,
    note: "checked",
  });
  await act("sales", "quote-publish", { id: quote.id });
  await act("buyer2", "quote-accept", { id: quote.id }, 403);
  const orders = await Promise.all([
    act("buyer", "quote-accept", { id: quote.id }),
    act("buyer", "quote-accept", { id: quote.id }),
  ]);
  assert.equal(orders[0].id, orders[1].id);
  order = orders[0];
  assert.equal((await request("buyer", "data/orders")).length, 1);
  assert.equal(order.total, 4800);
  assert(!JSON.stringify(order).includes('"cost"'));
});
test("verified deposit, repeated verification, split shipments, stock and settlement", async () => {
  await act("warehouse", "order-release", { id: order.id }, 400);
  const receipt = await act("sales", "receipt-create", {
    transaction: "TEST-DEPOSIT",
    currency: "CNY",
    amount: 1440,
    allocations: [{ order: order.id, amount: 1440 }],
    note: "fictional bank record",
  });
  await act("sales", "receipt-verify", { id: receipt.id }, 403);
  await Promise.all([
    act("finance", "receipt-verify", { id: receipt.id }),
    act("finance", "receipt-verify", { id: receipt.id }),
  ]);
  assert.equal((await request("owner", "data/orders"))[0].paid, 1440);
  await act("warehouse", "order-release", { id: order.id });
  const key = randomUUID();
  await Promise.all([
    act("warehouse", "order-produce", {
      id: order.id,
      product: "P-001",
      qty: 40,
      key,
    }),
    act("warehouse", "order-produce", {
      id: order.id,
      product: "P-001",
      qty: 40,
      key,
    }),
  ]);
  await act(
    "warehouse",
    "order-produce",
    { id: order.id, product: "P-001", qty: 61, key: randomUUID() },
    400,
  );
  await act("warehouse", "order-produce", {
    id: order.id,
    product: "P-001",
    qty: 60,
    key: randomUUID(),
  });
  await act(
    "warehouse",
    "order-ship",
    {
      id: order.id,
      product: "P-001",
      qty: 101,
      key: randomUUID(),
      carrier: "DEMO",
      tracking: "NO",
    },
    400,
  );
  for (const qty of [40, 60])
    await act("warehouse", "order-ship", {
      id: order.id,
      product: "P-001",
      qty,
      key: randomUUID(),
      carrier: "DEMO",
      tracking: "TRACK-" + qty,
    });
  const shipments = await request("warehouse", "data/shipments");
  for (const s of shipments)
    await act("warehouse", "shipment-deliver", { id: s.id });
  assert.equal((await request("owner", "data/orders"))[0].status, "confirmed");
  const remainder = await act("finance", "receipt-create", {
    transaction: "TEST-BALANCE",
    currency: "CNY",
    amount: 3360,
    allocations: [{ order: order.id, amount: 3360 }],
    note: "final payment",
  });
  await act("finance", "receipt-verify", { id: remainder.id });
  const complete = (await request("owner", "data/orders"))[0];
  assert.equal(complete.status, "completed");
  assert.equal(complete.paid, 4800);
  const p = (await request("owner", "data/products")).find(
    (p) => p.id === "P-001",
  );
  assert.equal(p.stock, 2400);
  assert.equal(p.reserved, 0);
  await act("finance", "receipt-reverse", {
    id: remainder.id,
    reason: "test reversal",
  });
  assert.equal((await request("owner", "data/orders"))[0].paid, 1440);
});
test("currency snapshot stays unchanged and stale rates require finance acknowledgement", async () => {
  const rate = await act("finance", "fx-manual", {
    rate: 7.21,
    date: "2020-01-01",
    reason: "historical negotiated reference",
  });
  const q = await act("sales", "quote-save", {
    customer: "C-001",
    currency: "USD",
    items: [{ product: "P-002", qty: 50, price: 18 }],
    depositPct: 30,
    valid: "2099-01-01",
    eta: "2099-02-01",
    fxId: rate.id,
  });
  await act("finance", "fx-manual", {
    rate: 8.1,
    date: "2099-01-01",
    reason: "another independent version",
  });
  assert.equal(
    (await request("sales", "data/quotes")).find((x) => x.id === q.id).fx.rate,
    "7.21",
  );
  await client.query(
    "INSERT INTO records(kind,id,data) VALUES('rates','STALE',$1)",
    [
      JSON.stringify({
        id: "STALE",
        date: "2020-01-01",
        rate: "7.00",
        source: "test fixture",
      }),
    ],
  );
  const staleQ = await act("sales", "quote-save", {
    customer: "C-001",
    currency: "USD",
    items: [{ product: "P-002", qty: 50, price: 18 }],
    depositPct: 30,
    valid: "2099-01-01",
    eta: "2099-02-01",
    fxId: "STALE",
  });
  await act("sales", "quote-submit", { id: staleQ.id }, 400);
});
test("reminders catch up, persist local mails, and deduplicate scans", async () => {
  await client.query(
    "UPDATE records SET data=jsonb_set(data,'{next}','\"2020-01-01\"') WHERE kind='customers' AND id='C-001'",
  );
  await act("owner", "scan", {});
  const first = await request("sales", "data/notifications");
  assert(first.length > 0);
  await act("owner", "scan", {});
  assert.equal(
    (await request("sales", "data/notifications")).length,
    first.length,
  );
  assert(
    (await request("owner", "data/mails")).every(
      (m) => m.channel === "local-only",
    ),
  );
  await act("sales", "notification-read", { id: first[0].id });
  assert.equal((await request("sales", "data/notifications"))[0].read, true);
});
test("account deactivation invalidates sessions immediately", async () => {
  await request("admin", "users/sales2/active", { active: false }, 201);
  await request("sales2", "me", undefined, 401);
});

test("CSV preview errors, atomic commit and repeated import are safe", async () => {
  const content =
    "sku,name,en,category,moq,price,usd,lead\nTEST-IMPORT,测试商品,Test product,Test,100,48,6.8,15";
  const p = await request(
    "owner",
    "imports/products/preview",
    { content },
    201,
  );
  assert.equal(p.rows[0].errors.length, 0);
  const commits = await Promise.all([
    request("owner", `imports/${p.id}/commit`, {}, 201),
    request("owner", `imports/${p.id}/commit`, {}, 201),
  ]);
  assert.equal(commits[0].id, commits[1].id);
  const again = await request(
    "owner",
    "imports/products/preview",
    { content },
    201,
  );
  assert.equal(again.status, "committed");
  assert.equal(
    (await request("owner", "data/products")).filter(
      (p) => p.sku === "TEST-IMPORT",
    ).length,
    1,
  );
  const bad = await request(
    "owner",
    "imports/products/preview",
    { content: content.replace("100,48", "0,48") },
    201,
  );
  assert(bad.rows[0].errors.some((e) => e.column === "moq"));
  await request("owner", `imports/${bad.id}/commit`, {}, 400);
  await request("buyer", "imports/products/preview", { content }, 403);
});

test("private PDF attachments enforce customer scope and reject invalid files", async () => {
  const doc = await request(
    "sales",
    "contracts",
    {
      order: order.id,
      name: "Demo contract.pdf",
      content: Buffer.from("%PDF-1.4\n% fictional fixture").toString("base64"),
      status: "draft",
    },
    201,
  );
  const own = await fetch(url + "contracts/" + doc.id + "/download", {
    headers: { Cookie: users.buyer.cookie },
  });
  assert.equal(own.status, 200);
  assert((await own.text()).startsWith("%PDF-"));
  const other = await fetch(url + "contracts/" + doc.id + "/download", {
    headers: { Cookie: users.buyer2.cookie },
  });
  assert.equal(other.status, 403);
  await request(
    "sales",
    "contracts",
    {
      order: order.id,
      name: "bad.pdf",
      content: Buffer.from("<script>bad</script>").toString("base64"),
    },
    400,
  );
});

test("provider refresh deduplicates, versions corrections, preserves cache on failure and follows Beijing slots", async () => {
  const fx = await import("../dist/server/fx.js");
  const db = await import("../dist/server/db.js");
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () =>
      Response.json({
        base: "USD",
        quote: "CNY",
        rate: 7.2345,
        date: "2026-11-06",
      });
    const a = await fx.refreshRates("test");
    const b = await fx.refreshRates("test");
    assert.equal(a.id, b.id);
    globalThis.fetch = async () =>
      Response.json({
        base: "USD",
        quote: "CNY",
        rate: 7.235,
        date: "2026-11-06",
      });
    const revised = await fx.refreshRates("test");
    assert.notEqual(revised.id, a.id);
    const count = (
      await client.query("SELECT count(*) FROM records WHERE kind='rates'")
    ).rows[0].count;
    globalThis.fetch = async () => {
      throw new Error("offline fixture");
    };
    await assert.rejects(fx.refreshRates("test"), /offline fixture/);
    assert.equal(
      (await client.query("SELECT count(*) FROM records WHERE kind='rates'"))
        .rows[0].count,
      count,
    );
    assert.equal(
      fx.scheduleSlot(new Date("2026-11-07T00:30:00Z")),
      "2026-11-07:startup",
    );
    assert.equal(
      fx.scheduleSlot(new Date("2026-11-07T01:00:00Z")),
      "2026-11-07:after09",
    );
    assert.equal(
      fx.stale({ date: "2026-11-01" }, new Date("2026-11-08T04:00:00Z")),
      false,
    );
    assert.equal(
      fx.stale({ date: "2026-11-01" }, new Date("2026-11-09T04:00:00Z")),
      true,
    );
  } finally {
    globalThis.fetch = original;
    await db.pool.end();
  }
});

test("new customer accounts, isolated profile updates and single-use password recovery", async () => {
  await request(
    "sales",
    "users",
    {
      username: "new_buyer",
      name: "New Buyer",
      role: "customer",
      customer: "C-001",
      password: "NewDemo2026!",
    },
    403,
  );
  const created = await request(
    "admin",
    "users",
    {
      username: "new_buyer",
      name: "New Buyer",
      role: "customer",
      customer: "C-001",
      password: "NewDemo2026!",
    },
    201,
  );
  assert(created.id);
  const r = await fetch(url + "login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "new_buyer", password: "NewDemo2026!" }),
  });
  assert.equal(r.status, 201);
  users.new_buyer = {
    ...(await r.json()),
    cookie: r.headers.get("set-cookie").split(";")[0],
  };
  await act("new_buyer", "customer-profile", {
    contact: "Updated Demo",
    email: "new@example.test",
    address: "New demo address",
    phone: "123",
  });
  assert.equal(
    (await request("new_buyer", "data/customers"))[0].contact,
    "Updated Demo",
  );
  assert.equal(
    (await request("buyer2", "data/customers"))[0].contact,
    "Alex Smith",
  );
  await request(null, "password/request", { username: "new_buyer" }, 201);
  const mail = (await request("admin", "data/mails")).find(
    (m) => m.recipient === "new_buyer" && m.sensitive,
  );
  assert(mail);
  assert(!(await request("manager", "data/mails")).some((m) => m.sensitive));
  const token = new URL(mail.body).searchParams.get("reset");
  await request(
    null,
    "password/reset",
    { token, password: "ChangedDemo2026!" },
    201,
  );
  await request("new_buyer", "me", undefined, 401);
  await request(
    null,
    "password/reset",
    { token, password: "AnotherDemo2026!" },
    400,
  );
  await request(
    null,
    "login",
    { username: "new_buyer", password: "NewDemo2026!" },
    401,
  );
  await request(
    null,
    "login",
    { username: "new_buyer", password: "ChangedDemo2026!" },
    201,
  );
});

test("one receipt allocates across orders and cancellation preserves original snapshots", async () => {
  const createOrder = async () => {
    const q = await act("sales", "quote-save", {
      customer: "C-001",
      currency: "CNY",
      items: [{ product: "P-001", qty: 100, price: 48 }],
      depositPct: 30,
      valid: "2099-01-01",
      eta: "2099-02-01",
    });
    await act("sales", "quote-submit", { id: q.id });
    await act("manager", "quote-decide", {
      id: q.id,
      approve: true,
      note: "checked",
    });
    await act("sales", "quote-publish", { id: q.id });
    return act("buyer", "quote-accept", { id: q.id });
  };
  const a = await createOrder(),
    b = await createOrder();
  const r = await act("finance", "receipt-create", {
    transaction: "SPLIT-TEST",
    currency: "CNY",
    amount: 2880,
    allocations: [
      { order: a.id, amount: 1440 },
      { order: b.id, amount: 1440 },
    ],
    note: "split deposit",
  });
  await act("finance", "receipt-verify", { id: r.id });
  const paid = await request("owner", "data/orders");
  assert.equal(paid.find((o) => o.id === a.id).paid, 1440);
  assert.equal(paid.find((o) => o.id === b.id).paid, 1440);
  await act("warehouse", "order-release", { id: a.id });
  await act("warehouse", "order-produce", {
    id: a.id,
    product: "P-001",
    qty: 40,
    key: randomUUID(),
  });
  await act(
    "manager",
    "order-cancel-remainder",
    {
      id: a.id,
      product: "P-001",
      qty: 61,
      reason: "over cancellation",
      key: randomUUID(),
    },
    400,
  );
  const payload = {
    id: a.id,
    product: "P-001",
    qty: 60,
    reason: "customer agrees to reduce unproduced quantity",
    key: randomUUID(),
  };
  const amended = await act("manager", "order-cancel-remainder", payload);
  await act("manager", "order-cancel-remainder", payload);
  assert.equal(amended.total, 1920);
  assert.equal(amended.originalTotal, 4800);
  assert.equal(amended.originalItems[0].qty, 100);
  assert.equal(amended.items[0].qty, 40);
  await act(
    "warehouse",
    "order-produce",
    { id: a.id, product: "P-001", qty: 1, key: randomUUID() },
    400,
  );
});

test("API process restart retains business records and sessions", async () => {
  const records = await request("owner", "data/orders");
  const exited = new Promise((r) => processApi.once("exit", r));
  processApi.kill();
  await exited;
  processApi = spawn(process.execPath, ["dist/server/main.js"], {
    env: {
      ...process.env,
      DATABASE_URL: base.toString(),
      PORT: "3199",
      FX_AUTO: "false",
      UPLOAD_DIR: ".local/test-uploads",
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processApi.stdout.on("data", (d) => (logs += d));
  processApi.stderr.on("data", (d) => (logs += d));
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(url + "health")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
    if (i === 99) throw new Error(logs);
  }
  assert.deepEqual(await request("owner", "data/orders"), records);
  assert.equal((await request("owner", "me")).id, "owner");
});
