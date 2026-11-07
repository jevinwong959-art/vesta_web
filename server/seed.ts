import { pool, transaction } from "./db";
import { hashPassword } from "./auth";
export async function seed() {
  await transaction(async (db) => {
    if ((await db.client.query("SELECT 1 FROM users LIMIT 1")).rowCount) return;
    const password = hashPassword(
      process.env.DEMO_PASSWORD || "VestaDemo2026!",
    );
    for (const [id, name, role, customer] of [
      ["owner", "经营负责人", "owner", null],
      ["manager", "销售经理", "manager", null],
      ["sales", "林悦", "sales", null],
      ["sales2", "陈默", "sales", null],
      ["finance", "财务", "finance", null],
      ["warehouse", "生产 / 仓储", "warehouse", null],
      ["admin", "系统管理员", "admin", null],
      ["buyer", "Hailan Buyer", "customer", "C-001"],
      ["buyer2", "Northstar Buyer", "customer", "C-002"],
    ])
      await db.client.query(
        "INSERT INTO users(id,username,name,role,customer,password) VALUES($1,$1,$2,$3,$4,$5)",
        [id, name, role, customer, password],
      );
    for (const c of [
      {
        id: "C-001",
        name: "海岚生活（演示）",
        en: "Hailan Living Demo",
        country: "Hong Kong",
        contact: "Jia Chen",
        email: "buyer@hailan.example",
        owner: "sales",
        currency: "USD",
        address: "Demo address, Hong Kong",
      },
      {
        id: "C-002",
        name: "北辰采购（演示）",
        en: "Northstar Sourcing Demo",
        country: "Germany",
        contact: "Alex Smith",
        email: "buyer@northstar.example",
        owner: "sales2",
        currency: "USD",
        address: "Demo address, Berlin",
      },
    ])
      await db.put("customers", { ...c, lastFollow: new Date().toISOString() });
    for (const [id, sku, name, en, price, usd, cost, stock, moq, category] of [
      [
        "P-001",
        "VT-TM500",
        "不锈钢保温杯",
        "Insulated Tumbler",
        48,
        6.8,
        31,
        2400,
        100,
        "日用礼品",
      ],
      [
        "P-002",
        "VT-BP156",
        "轻量商务双肩包",
        "Business Backpack",
        128,
        18,
        84,
        680,
        50,
        "商务出行",
      ],
      [
        "P-003",
        "VT-NB-A5",
        "A5 商务笔记本",
        "A5 Notebook",
        18,
        2.5,
        10.5,
        5000,
        100,
        "办公文具",
      ],
      [
        "P-004",
        "VT-UM03",
        "三折自动雨伞",
        "Compact Umbrella",
        36,
        5.1,
        24,
        900,
        100,
        "商务出行",
      ],
      [
        "P-005",
        "VT-CB12",
        "帆布手提袋",
        "Canvas Tote",
        22,
        3.1,
        13,
        1800,
        200,
        "日用礼品",
      ],
      [
        "P-006",
        "VT-GBOX",
        "定制礼品包装盒",
        "Gift Box",
        12,
        1.7,
        6.8,
        3600,
        100,
        "包装配套",
      ],
    ])
      await db.put("products", {
        id: String(id),
        sku,
        name,
        en,
        price,
        usd,
        cost,
        stock,
        reserved: 0,
        moq,
        category,
        unit: "件",
        lead: 15,
      });
    await db.put("rates", {
      id: "FX-DEMO",
      base: "USD",
      quote: "CNY",
      rate: "7.10",
      source: "SIMULATED · 离线模拟",
      date: new Date().toISOString().slice(0, 10),
      fetchedAt: new Date().toISOString(),
      simulated: true,
    });
    await db.put("settings", {
      id: "rules",
      orderDays: 3,
      quoteDays: 3,
      customerProspect: 7,
      customerActive: 30,
      escalationDays: 2,
      approvalHours: 24,
      riskAmount: 100000,
      discount: 0.9,
      margin: 0.2,
      depositPct: 30,
    });
    await db.audit("system", "seed fictional demo", "initial");
  });
}
