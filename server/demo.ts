import { transaction } from "./db";
import { hashPassword } from "./auth";

// Explicit, additive Demo fixture. No existing customer, product or document is reset.
export async function seedDemoScenarios() {
  return transaction(async (db) => {
    const marker = "demo-scenarios-v1";
    // A separate fictional customer login leaves existing buyer accounts and scopes intact.
    if (
      !(
        await db.client.query(
          "SELECT id FROM users WHERE username='buyer_demo'",
        )
      ).rowCount
    )
      await db.client.query(
        "INSERT INTO users(id,username,name,role,customer,password) VALUES('DEMO-BUYER','buyer_demo','海岚模拟采购员','customer','DEMO-C-1',$1)",
        [hashPassword(process.env.DEMO_PASSWORD || "VestaDemo2026!")],
      );
    if (await db.get("migrations", marker)) return { created: false };
    const date = (days: number) =>
      new Date(Date.now() + days * 86400000).toISOString();
    const companies = [
      [
        "海岚生活（香港）有限公司",
        "Hailan Living",
        "中国香港",
        "生活方式零售",
        "陈佳宁",
        "sales",
        "A",
        "USD",
      ],
      [
        "青禾品牌管理（上海）有限公司",
        "Qinghe Brands",
        "中国大陆",
        "品牌营销",
        "周雨晴",
        "sales",
        "A",
        "CNY",
      ],
      [
        "Nordwell Supply GmbH",
        "Nordwell Supply",
        "德国",
        "办公用品分销",
        "Lena Fischer",
        "sales2",
        "B",
        "USD",
      ],
      [
        "星野百货（深圳）有限公司",
        "Xingye Stores",
        "中国大陆",
        "连锁百货",
        "赵明",
        "sales2",
        "B",
        "CNY",
      ],
      [
        "Mori Living Pte. Ltd.",
        "Mori Living",
        "新加坡",
        "家居零售",
        "Amelia Tan",
        "sales",
        "C",
        "USD",
      ],
      [
        "Atlas Retail LLC",
        "Atlas Retail",
        "阿联酋",
        "礼品分销",
        "Omar Ali",
        "sales2",
        "B",
        "USD",
      ],
    ];
    for (let index = 0; index < companies.length; index++) {
      const [name, en, country, industry, contact, owner, tier, currency] =
        companies[index];
      const id = `DEMO-C-${index + 1}`;
      if (await db.get("customers", id))
        throw new Error("Demo fixture ID collision: " + id);
      await db.put("customers", {
        id,
        name,
        en,
        country,
        industry,
        contact,
        owner,
        tier,
        currency,
        email: `buyer${index + 1}@vesta-demo.example`,
        phone: "演示联系方式",
        address: country + "（虚构地址）",
        demo: true,
        lastFollow: date([-45, -10, -16, -42, -4, -5][index]),
        next: date([-15, 20, 14, -12, 3, -1][index]).slice(0, 10),
        since: date(-150).slice(0, 10),
      });
      await db.put("follows", {
        id: `DEMO-F-${index + 1}`,
        customer: id,
        kind: "customers",
        entity: id,
        channel: index % 2 ? "电话" : "邮件",
        note: [
          "确认秋季补货意向，等待客户反馈包装方案。",
          "已确认样品颜色，下一次沟通确认生产排期。",
          "第一批货物已签收，等待余量发货安排。",
          "客户已确认到货，提醒月底安排剩余货款。",
          "初次联系并发送产品目录，计划下周确认意向。",
          "完成季度回访，准备新一轮采购计划。",
        ][index],
        actor: owner,
        at: date(-3),
        occurred: date([-45, -10, -16, -42, -4, -5][index]),
        next: date([-15, 20, 14, -12, 3, -1][index]).slice(0, 10),
        demo: true,
      });
    }
    // ordered, produced, shipped, delivered, paid ratio; each represents an actionable stage.
    const scenarios = [
      [1, "P-001", 200, 0, 0, 0, 0, "待收预付款"],
      [2, "P-002", 100, 50, 0, 0, 0.3, "分批生产中"],
      [3, "P-003", 400, 400, 200, 100, 0.5, "分批发货中"],
      [4, "P-004", 200, 200, 200, 200, 0.3, "已签收待尾款"],
      [6, "P-005", 200, 200, 200, 200, 1, "已交付并结清"],
    ] as const;
    for (const [
      ci,
      pid,
      qty,
      produced,
      shipped,
      delivered,
      ratio,
      label,
    ] of scenarios) {
      const id = `DEMO-SO-${ci}`,
        qid = `DEMO-Q-${ci}`,
        customer = `DEMO-C-${ci}`;
      const c = (await db.get("customers", customer))!,
        p = (await db.get("products", pid))!;
      if (!p || (await db.get("orders", id)) || (await db.get("quotes", qid)))
        throw new Error("Demo prerequisite/collision");
      const price = c.currency === "USD" ? p.usd : p.price,
        total = Math.round(price * qty * 100) / 100,
        paid = Math.round(total * ratio * 100) / 100;
      const item = {
        product: pid,
        name: p.name,
        en: p.en,
        sku: p.sku,
        qty,
        price,
        listPrice: price,
        cost: p.cost,
        produced: 0,
        shipped: 0,
        delivered: 0,
      };
      const q = {
        id: qid,
        group: qid,
        revision: 1,
        customer,
        customerSnapshot: {
          name: c.name,
          en: c.en,
          contact: c.contact,
          email: c.email,
          address: c.address,
        },
        currency: c.currency,
        items: [item],
        itemsTotal: total,
        total,
        freight: 0,
        fees: 0,
        discount: 0,
        depositPct: 30,
        valid: date(20).slice(0, 10),
        eta: date(ci === 4 ? -5 : 15).slice(0, 10),
        terms: "FOB",
        port: "Shenzhen",
        note: `模拟场景：${label}`,
        status: "accepted",
        published: true,
        createdBy: c.owner,
        createdAt: date(-ci * 10),
        submittedBy: c.owner,
        approvers: ["manager"],
        approvalLog: [
          {
            actor: "manager",
            approve: true,
            note: "虚构历史审批",
            at: date(-ci * 10),
          },
        ],
        step: 1,
        fx:
          c.currency === "USD"
            ? {
                id: "FX-DEMO",
                rate: "7.10",
                date: date(-ci * 10).slice(0, 10),
                source: "SIMULATED · 离线模拟",
                simulated: true,
              }
            : null,
        demo: true,
      };
      await db.put("quotes", q);
      await db.put("orders", {
        ...q,
        id,
        quote: qid,
        quoteGroup: qid,
        status: ratio === 1 ? "completed" : "confirmed",
        released: produced > 0,
        paid,
        items: [{ ...item, produced, shipped, delivered }],
        lastFollow: date(-4),
        next: date(2).slice(0, 10),
      });
      if (paid)
        await db.put("receipts", {
          id: `DEMO-R-${ci}`,
          transaction: `DEMO-BANK-${ci}`,
          customer,
          currency: c.currency,
          amount: paid,
          allocations: [{ order: id, amount: paid }],
          status: "verified",
          note: "虚构已核实回款",
          createdBy: c.owner,
          verifiedBy: "owner",
          at: date(-ci * 10 + 1),
          demo: true,
        });
      for (const [type, n] of [
        ["production", produced],
        ["shipment", -shipped],
      ] as const)
        if (n)
          await db.put("ledger", {
            id: `DEMO-L-${ci}-${type}`,
            product: pid,
            order: id,
            customer,
            qty: n,
            type,
            actor: "manager",
            at: date(-2),
            demo: true,
          });
      await db.put("products", {
        ...p,
        stock: p.stock + produced - shipped,
        reserved: p.reserved + produced - shipped,
      });
      if (shipped)
        for (const [suffix, n, done] of [
          ["A", delivered, true],
          ["B", shipped - delivered, false],
        ] as const)
          if (n)
            await db.put("shipments", {
              id: `DEMO-SH-${ci}-${suffix}`,
              order: id,
              customer,
              product: pid,
              qty: n,
              carrier: "Demo Logistics",
              tracking: `DEMO-TRACK-${ci}-${suffix}`,
              delivered: done,
              at: date(-2),
              demo: true,
            });
    }
    await db.put("inquiries", {
      id: "DEMO-I-5",
      customer: "DEMO-C-5",
      product: "P-006",
      qty: 300,
      eta: date(30).slice(0, 10),
      note: "模拟询价：定制包装盒，询问印刷与交货时间。",
      status: "new",
      createdBy: "sales",
      at: date(-1),
      demo: true,
    });
    await db.put("migrations", { id: marker, at: date(0) });
    await db.audit("system", "seed-demo-scenarios", marker);
    return { created: true, customers: 6, orders: 5 };
  });
}
