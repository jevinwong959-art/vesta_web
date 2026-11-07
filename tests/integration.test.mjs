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
  const db = await import("../dist/server/db.js");
  await db.pool.end();
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
  await request("admin", "data/orders"); // Legacy admin now has the confirmed management role.
  assert.equal(users.admin.role, "owner");
  assert.equal(users.finance.role, "owner");
  assert.equal(users.warehouse.role, "manager");
  assert.deepEqual(
    [...new Set(Object.values(users).map((u) => u.role))].sort(),
    ["customer", "manager", "owner", "sales"],
  );
  const p = await request("sales", "data/products");
  assert(!JSON.stringify(p).includes('"cost"'));
  const w = await request("warehouse", "data/products");
  for (const k of ['"cost"']) assert(!JSON.stringify(w).includes(k));
  assert(w[0].price > 0);
  await act("manager", "receipt-verify", { id: "missing" }, 403);
  await act("sales", "order-produce", { id: "missing" }, 403);
  await act("buyer", "follow-create", { customer: "C-001" }, 403);
  await request("manager", "users", { username: "forbidden" }, 403);
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

test("follow-up channels, actual times, backfill, independent clocks and customer isolation", async () => {
  const now = Date.now(),
    recent = new Date(now - 3600000).toISOString(),
    old = new Date(now - 86400000 * 10).toISOString();
  await client.query(
    "UPDATE records SET data=data-'lastFollow'-'next' WHERE kind='customers' AND id='C-001'",
  );
  const f = await act("sales", "follow-create", {
    customer: "C-001",
    note: "确认客户新包装需求，等待图稿",
    channel: "邮件",
    occurred: recent,
    next: "2099-01-01",
  });
  assert.equal(f.occurred, recent);
  assert.equal(f.channel, "邮件");
  await act("sales", "follow-create", {
    customer: "C-001",
    note: "补录早期样品沟通记录",
    channel: "电话",
    occurred: old,
    next: "2098-01-01",
  });
  let c = (await request("sales", "data/customers")).find(
    (c) => c.id === "C-001",
  );
  assert.equal(c.lastFollow, recent);
  assert.equal(c.next, "2099-01-01");
  await act(
    "sales",
    "follow-create",
    { customer: "C-002", note: "越权修改客户沟通记录", next: "2099-01-01" },
    403,
  );
  await act(
    "sales",
    "follow-create",
    {
      customer: "C-001",
      note: "未来沟通时间不能保存",
      next: "2099-01-01",
      occurred: new Date(now + 86400000).toISOString(),
    },
    400,
  );
  const o = (await request("sales", "data/orders")).find(
    (o) => o.status === "confirmed",
  );
  assert(o);
  await act("sales", "follow-create", {
    customer: "C-001",
    kind: "orders",
    entity: o.id,
    note: "内部检查生产排期记录",
    channel: "内部进度",
    next: "2099-02-01",
  });
  c = (await request("sales", "data/customers")).find((c) => c.id === "C-001");
  assert.equal(c.lastFollow, recent);
  await act(
    "sales",
    "follow-create",
    {
      customer: "C-001",
      kind: "orders",
      entity: o.id,
      note: "内部沟通不可重置客户维护",
      channel: "内部进度",
      syncCustomer: true,
      next: "2099-02-01",
    },
    400,
  );
  await act("sales", "follow-create", {
    customer: "C-001",
    kind: "orders",
    entity: o.id,
    note: "已与客户确认分批发货安排",
    channel: "电话",
    syncCustomer: true,
    next: "2099-02-01",
  });
  c = (await request("sales", "data/customers")).find((c) => c.id === "C-001");
  assert.equal(c.next, "2099-02-01");
  await request("buyer", "data/follows", undefined, 403);
});

test("additive demo fixtures are idempotent and reconcile money, quantities and stock", async () => {
  const { seedDemoScenarios } = await import("../dist/server/demo.js");
  const before = (
    await client.query(
      "SELECT data FROM records WHERE kind='products' ORDER BY id",
    )
  ).rows.map((r) => r.data);
  const previous = (
    await client.query(
      "SELECT data FROM records WHERE kind='customers' AND id='C-001'",
    )
  ).rows[0].data;
  assert.equal((await seedDemoScenarios()).created, true);
  assert.equal((await seedDemoScenarios()).created, false);
  const demoLogin = await fetch(url + "login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "buyer_demo",
      password: "VestaDemo2026!",
    }),
  });
  assert.equal(demoLogin.status, 201);
  users.buyer_demo = {
    ...(await demoLogin.json()),
    cookie: demoLogin.headers.get("set-cookie").split(";")[0],
  };
  const ownDemoOrders = await request("buyer_demo", "data/orders");
  assert.equal(ownDemoOrders.length, 1);
  assert.equal(ownDemoOrders[0].customer, "DEMO-C-1");
  assert(!JSON.stringify(ownDemoOrders).includes('"cost"'));
  const os = (await request("owner", "data/orders")).filter((o) => o.demo);
  assert.equal(os.length, 5);
  assert.equal(new Set(os.map((o) => o.customer)).size, 5);
  const receipts = (await request("owner", "data/receipts")).filter(
      (r) => r.demo,
    ),
    ships = (await request("owner", "data/shipments")).filter((r) => r.demo);
  for (const o of os) {
    assert.equal(
      o.paid,
      receipts
        .flatMap((r) => r.allocations)
        .filter((a) => a.order === o.id)
        .reduce((s, a) => s + a.amount, 0),
    );
    assert.equal(
      o.total,
      Math.round(o.items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100,
    );
    for (const i of o.items) {
      assert(
        i.delivered <= i.shipped &&
          i.shipped <= i.produced &&
          i.produced <= i.qty,
      );
      assert.equal(
        i.shipped,
        ships
          .filter((s) => s.order === o.id && s.product === i.product)
          .reduce((n, s) => n + s.qty, 0),
      );
      assert.equal(
        i.delivered,
        ships
          .filter(
            (s) => s.order === o.id && s.product === i.product && s.delivered,
          )
          .reduce((n, s) => n + s.qty, 0),
      );
    }
    if (o.status === "completed") {
      assert.equal(o.paid, o.total);
      assert(o.items.every((i) => i.delivered === i.qty));
    }
  }
  const products = await request("owner", "data/products");
  for (const p of before) {
    const n = products.find((x) => x.id === p.id),
      delta = os
        .flatMap((o) => o.items)
        .filter((i) => i.product === p.id)
        .reduce((s, i) => s + i.produced - i.shipped, 0);
    assert.equal(n.stock, p.stock + delta);
    assert.equal(n.reserved, p.reserved + delta);
  }
  assert.deepEqual(
    (
      await client.query(
        "SELECT data FROM records WHERE kind='customers' AND id='C-001'",
      )
    ).rows[0].data,
    previous,
  );
  assert(!(await request("buyer", "data/orders")).some((o) => o.demo));
  assert(
    (await request("sales", "data/customers"))
      .filter((c) => c.demo)
      .every((c) => c.owner === "sales"),
  );
});

test("existing role migration retains identity, scope and history and runs once", async () => {
  await client.query("UPDATE users SET role='finance' WHERE id='finance'");
  const { seed } = await import("../dist/server/seed.js");
  await seed();
  await seed();
  const u = (
    await client.query("SELECT id,username,role FROM users WHERE id='finance'")
  ).rows[0];
  assert.deepEqual(u, { id: "finance", username: "finance", role: "owner" });
  const audit = (
    await client.query(
      "SELECT data FROM records WHERE kind='audits' AND data->>'entity'='finance' AND data->>'action'='four-role-migration:owner'",
    )
  ).rows;
  assert.equal(audit.length, 1);
});

test("prototype multi-item requests preserve intent and convert every line with frozen specifications", async () => {
  const p = (await request("owner", "data/products")).find(
    (p) => p.id === "P-001",
  );
  await act("owner", "product-save", {
    ...p,
    spec: "500 mL • Ivory",
    specEn: "500 mL • Ivory",
    safe: 500,
  });
  await act("owner", "product-save", { ...p, cost: p.cost + 1 }, 400);
  const req = await act("buyer", "inquiry-create", {
    items: [
      { product: "P-001", qty: 100 },
      { product: "P-002", qty: 50 },
    ],
    type: "order_request",
    currency: "CNY",
    eta: "2027-02-01",
    address: "Fictional destination",
    note: "two products",
  });
  assert.equal(req.items.length, 2);
  assert.equal(req.type, "order_request");
  assert.equal(req.customer, "C-001");
  await act(
    "buyer",
    "inquiry-create",
    { items: [{ product: "P-001", qty: 1 }], eta: "2027-02-01" },
    400,
  );
  await act(
    "buyer",
    "inquiry-create",
    {
      items: [
        { product: "P-001", qty: 100 },
        { product: "P-001", qty: 100 },
      ],
      eta: "2027-02-01",
    },
    400,
  );
  const q = await act("sales", "quote-save", {
    customer: "C-001",
    inquiry: req.id,
    items: req.items.map((i) => ({
      ...i,
      price: i.product === "P-001" ? 48 : 128,
    })),
    currency: "CNY",
    depositPct: 30,
    eta: "2027-02-01",
    valid: "2027-01-01",
  });
  assert.equal(q.items.length, 2);
  assert.equal(q.balanceDue, "2027-02-08");
  assert.equal(q.items[0].spec, "500 mL • Ivory");
  await act("sales", "quote-submit", { id: q.id });
  await act("manager", "quote-decide", {
    id: q.id,
    approve: true,
    note: "approved",
  });
  await act("sales", "quote-publish", { id: q.id });
  const o = await act("buyer", "quote-accept", { id: q.id });
  assert.equal(o.total, 11200);
  assert.equal(o.balanceDue, q.balanceDue);
  assert(o.confirmedAt);
  await act("owner", "product-save", {
    ...p,
    spec: "Changed after order",
    safe: 600,
  });
  const detail = await request("buyer", "detail/orders/" + o.id);
  assert.equal(detail.items[0].spec, "500 mL • Ivory");
  assert.deepEqual(detail.timeline, []);
  assert(!JSON.stringify(detail).includes('"cost"'));
  assert(!JSON.stringify(detail).includes("approver"));
  await request("buyer2", "detail/orders/" + o.id, undefined, 404);
});

test("order detail exposes only this order's verified allocation and preserves actual receipt date", async () => {
  const o = (await request("owner", "data/orders")).find(
    (o) => o.total === 11200,
  );
  const r = await act("sales", "receipt-create", {
    transaction: "PARITY-RECEIPT",
    currency: "CNY",
    amount: 1000,
    receivedAt: "2026-11-01",
    note: "private bank information",
    allocations: [{ order: o.id, amount: 700 }],
  });
  assert.equal(
    (await request("buyer", "detail/orders/" + o.id)).payments.length,
    0,
  );
  await act("owner", "receipt-verify", { id: r.id });
  const d = await request("buyer", "detail/orders/" + o.id);
  assert.equal(d.payments[0].amount, 700);
  assert.equal(d.payments[0].receivedAt, "2026-11-01");
  assert(!JSON.stringify(d).includes("private bank information"));
  assert(!JSON.stringify(d).includes("PARITY-RECEIPT"));
  await act("owner", "receipt-reverse", {
    id: r.id,
    reason: "fictional correction",
  });
  assert.equal(
    (await request("buyer", "detail/orders/" + o.id)).payments.length,
    0,
  );
});

test("contract metadata, private upload, signing and version groups retain independent histories", async () => {
  const o = (await request("owner", "data/orders")).find(
    (o) => o.total === 11200,
  );
  const c = await act("sales", "contract-save", {
    order: o.id,
    name: "Test procurement contract",
    valid: "2027-12-31",
    terms: "Demo only",
  });
  assert.equal(c.version, 1);
  assert.equal(c.status, "draft");
  await act(
    "sales",
    "contract-sign",
    { id: c.id, signedAt: "2026-11-07" },
    400,
  );
  const body = {
    order: o.id,
    contract: c.id,
    name: "demo.pdf",
    content: Buffer.from("%PDF-1.4\nDemo archive").toString("base64"),
  };
  const attached = await request("sales", "contracts", body, 201);
  assert.equal(attached.id, c.id);
  assert.equal(attached.version, 1);
  await act("sales", "contract-sign", { id: c.id, signedAt: "2026-11-07" });
  await request("sales", "contracts", body, 400);
  const revised = await act("sales", "contract-save", {
    order: o.id,
    name: c.name,
    valid: "2028-01-01",
    revisionOf: c.id,
  });
  assert.equal(revised.version, 2);
  assert.equal(revised.group, c.group);
  const other = await act("sales", "contract-save", {
    order: o.id,
    name: "Independent contract",
    valid: "2028-01-01",
  });
  assert.equal(other.version, 1);
  assert.notEqual(other.group, c.group);
  await request("buyer2", "detail/contracts/" + c.id, undefined, 404);
});

test("balance reminders use agreed payment due dates, and authorized search omits other customers", async () => {
  const o = (await request("owner", "data/orders")).find(
    (o) => o.total === 11200,
  );
  await client.query(
    "UPDATE records SET data=data || $1::jsonb WHERE kind='orders' AND id=$2",
    [JSON.stringify({ eta: "2020-01-01", balanceDue: "2099-01-01" }), o.id],
  );
  await act("owner", "scan", {});
  assert(
    !(await request("owner", "data/notifications")).some(
      (n) =>
        n.entity === o.id && !n.resolved && n.title.includes("Payment due"),
    ),
  );
  await client.query(
    "UPDATE records SET data=data || $1::jsonb WHERE kind='orders' AND id=$2",
    [JSON.stringify({ eta: "2099-01-01", balanceDue: "2020-01-01" }), o.id],
  );
  await act("owner", "scan", {});
  assert(
    (await request("owner", "data/notifications")).some(
      (n) =>
        n.entity === o.id && !n.resolved && n.title.includes("Payment due"),
    ),
  );
  assert.equal((await request("sales", "search?q=C-002")).length, 0);
  await request("buyer", "search?q=anything", undefined, 403);
  const productResults = await request("sales", "search?q=VT-TM500");
  assert(productResults.length);
  assert(!JSON.stringify(productResults).includes("cost"));
});

test("formal quote CSV is public-field only, scoped, and ordinary databases cannot reset", async () => {
  const q = (await request("owner", "data/quotes")).find(
    (q) => q.status === "accepted" && q.total === 11200,
  );
  assert(q);
  const response = await fetch(url + "quotes/" + q.id + "/items.csv", {
    headers: { Cookie: users.buyer.cookie },
  });
  assert.equal(response.status, 200);
  const csv = await response.text();
  assert(csv.includes("SKU") && csv.includes("规格"));
  assert(!/成本|cost|margin|approval/i.test(csv));
  await request("buyer2", "quotes/" + q.id + "/items.csv", undefined, 403);
  await request("owner", "reference/reset", {}, 403);
  const preview = await request(
    "owner",
    "imports/products/preview",
    { content: "sku,name,moq,price,cost\nLIMITED,Test,10,20,8" },
    201,
  );
  assert(preview.rows[0].errors.some((e) => e.column === "cost"));
});

test("catalogue USD follows reference FX while manual rates and saved quotations remain independent", async () => {
  const backup = (
    await client.query("SELECT id,data FROM records WHERE kind='rates'")
  ).rows;
  const put = async (r) =>
    client.query(
      "INSERT INTO records(kind,id,data) VALUES('rates',$1,$2) ON CONFLICT(kind,id) DO UPDATE SET data=excluded.data",
      [r.id, JSON.stringify(r)],
    );
  try {
    await client.query("DELETE FROM records WHERE kind='rates'");
    const date = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Shanghai",
    });
    await put({
      id: "PRICE-REF-1",
      base: "USD",
      quote: "CNY",
      rate: "7.5",
      date,
      source: "test reference",
      fetchedAt: "2026-01-01T00:00:00Z",
    });
    const p = await act("owner", "product-save", {
      sku: "PRICE-CHECK",
      name: "汇率测试",
      en: "FX test",
      category: "test",
      moq: 100,
      price: 48,
      usd: 99,
      cost: 30,
      lead: 10,
    });
    const get = async (who) =>
      (await request(who, "data/products")).find((x) => x.id === p.id);
    for (const role of ["owner", "manager", "sales", "buyer"]) {
      const row = await get(role);
      assert.equal(row.usd, 6.4);
      assert.equal(row.price, 48);
      assert.equal(row.pricingFx.id, "PRICE-REF-1");
      if (role !== "owner") assert(!("cost" in row));
    }
    const q = await act("sales", "quote-save", {
      customer: "C-001",
      currency: "USD",
      items: [{ product: p.id, qty: 100, price: 6.4 }],
      depositPct: 30,
      valid: "2099-01-01",
      eta: "2099-02-01",
    });
    assert.equal(q.items[0].listPrice, 6.4);
    await put({
      id: "PRICE-REF-2",
      base: "USD",
      quote: "CNY",
      rate: "8",
      date,
      source: "test reference",
      fetchedAt: "2026-02-01T00:00:00Z",
    });
    assert.equal((await get("buyer")).usd, 6);
    const saved = (await request("sales", "data/quotes")).find(
      (x) => x.id === q.id,
    );
    assert.equal(saved.fx.id, "PRICE-REF-1");
    assert.equal(saved.items[0].price, 6.4);
    const manual = await act("owner", "fx-manual", {
      rate: 9,
      date,
      reason: "only for a selected quotation",
    });
    assert.equal((await get("buyer")).usd, 6);
    const manualQ = await act("sales", "quote-save", {
      customer: "C-001",
      currency: "USD",
      items: [{ product: p.id, qty: 100, price: 5.33 }],
      depositPct: 30,
      valid: "2099-01-01",
      eta: "2099-02-01",
      fxId: manual.id,
    });
    assert.equal(manualQ.items[0].listPrice, 5.33);
    await request("buyer", "data/rates", undefined, 403);
    await client.query("DELETE FROM records WHERE kind='rates'");
    await put({ id: "INVALID", rate: "0", date, simulated: true });
    await put({
      id: "FUTURE",
      rate: "6",
      date: "2999-01-01",
      fetchedAt: "2999-01-01",
    });
    assert.equal((await get("buyer")).usd, null);
    assert.equal((await get("buyer")).price, 48);
    await put({
      id: "OFFLINE",
      rate: "7.5",
      date: "2020-01-01",
      source: "SIMULATED",
      simulated: true,
    });
    const fallback = await get("buyer");
    assert.equal(fallback.usd, 6.4);
    assert.equal(fallback.pricingFx.simulated, true);
    assert.equal(fallback.pricingFx.stale, true);
  } finally {
    await client.query("DELETE FROM records WHERE kind='rates'");
    for (const r of backup) await put(r.data);
  }
});
