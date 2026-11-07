import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { User } from "./auth";
import { read } from "./db";
import { canCustomer, listData, sanitize } from "./domain";

export async function detailView(u: User, kind: string, id: string) {
  if (
    ![
      "orders",
      "quotes",
      "inquiries",
      "contracts",
      "receipts",
      "products",
    ].includes(kind)
  )
    throw new NotFoundException();
  const row = (await listData(u, kind)).find((r) => r.id === id);
  if (!row) throw new NotFoundException();
  return read(async (db) => {
    const users = (await db.client.query("SELECT id,name FROM users")).rows;
    const names = Object.fromEntries(users.map((x) => [x.id, x.name]));
    const payments =
      kind === "orders"
        ? (await db.all("receipts"))
            .filter(
              (r) =>
                r.allocations?.some((a: any) => a.order === id) &&
                (u.role !== "customer" || r.status === "verified"),
            )
            .map((r) => ({
              id: r.id,
              receivedAt: r.receivedAt || null,
              registeredAt: r.at,
              amount: r.allocations.find((a: any) => a.order === id).amount,
              currency: r.currency,
              status: r.status,
            }))
        : [];
    const timeline =
      u.role === "customer"
        ? []
        : (await db.all("follows"))
            .filter((f) => f.entity === id)
            .map((f) => ({ ...f, actorName: names[f.actor] || f.actor }));
    const events =
      u.role === "customer"
        ? []
        : (await db.all("audits"))
            .filter((a) => a.entity === id)
            .map((a) => ({
              id: a.id,
              at: a.at,
              note: a.action,
              actorName: names[a.actor] || a.actor,
            }));
    return {
      ...row,
      payments,
      timeline: [...timeline, ...events].sort((a: any, b: any) =>
        String(b.occurred || b.at).localeCompare(String(a.occurred || a.at)),
      ),
      ...(u.role !== "customer"
        ? {
            ownerName: names[row.createdBy],
            approvalLog: row.approvalLog?.map((a: any) => ({
              ...a,
              actorName: names[a.actor] || a.actor,
            })),
            approverNames: row.approvers?.map((a: string) => names[a] || a),
          }
        : {}),
    };
  });
}

export async function searchView(u: User, query: string) {
  if (u.role === "customer") throw new ForbiddenException();
  const q = query.trim().toLowerCase().slice(0, 200);
  if (!q) return [];
  const results = [];
  for (const kind of ["customers", "products", "quotes", "orders"]) {
    for (const row of await listData(u, kind)) {
      if (
        [
          row.id,
          row.name,
          row.en,
          row.sku,
          row.spec,
          row.contact,
          row.email,
          row.customerSnapshot?.name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(q)
      )
        results.push({
          kind,
          id: row.id,
          title: row.name || row.id,
          description:
            row.sku || row.customerSnapshot?.name || row.contact || "",
        });
    }
  }
  return results.slice(0, 100);
}

export function businessExport(kind: string, rows: any[]) {
  const schemas: Record<string, [string, (r: any) => any][]> = {
    products: [
      ["SKU", (r) => r.sku],
      ["名称", (r) => r.name],
      ["规格", (r) => r.spec],
      ["MOQ", (r) => r.moq],
      ["标准价CNY", (r) => r.price],
      ["标准价USD", (r) => r.usd],
      ["交期天数", (r) => r.lead],
      ["库存", (r) => r.stock],
      ["预留", (r) => r.reserved],
    ],
    customers: [
      ["客户编号", (r) => r.id],
      ["公司", (r) => r.name],
      ["地区", (r) => r.country],
      ["联系人", (r) => r.contact],
      ["邮箱", (r) => r.email],
      ["联系电话", (r) => r.phone],
      ["地址", (r) => r.address],
      ["币种", (r) => r.currency],
    ],
    orders: [
      ["订单", (r) => r.id],
      ["客户", (r) => r.customerSnapshot?.name || r.customer],
      ["确认日期", (r) => r.confirmedAt || r.createdAt],
      ["币种", (r) => r.currency],
      ["金额", (r) => r.total],
      ["已收", (r) => r.paid],
      ["余额", (r) => r.total - r.paid],
      ["交期", (r) => r.eta],
      ["尾款到期", (r) => r.balanceDue],
      ["状态", (r) => r.status],
    ],
    quotes: [
      ["报价", (r) => r.id],
      ["版本", (r) => r.revision],
      ["客户", (r) => r.customerSnapshot?.name || r.customer],
      ["币种", (r) => r.currency],
      ["金额", (r) => r.total],
      ["有效期", (r) => r.valid],
      ["状态", (r) => r.status],
      ["已发布", (r) => (r.published ? "是" : "否")],
    ],
  };
  const cols = schemas[kind];
  if (kind === "products" && rows.some((r) => r.cost !== undefined))
    cols.push(["成本CNY", (r) => r.cost]);
  const cell = (v: any) =>
    '"' +
    String(v ?? "")
      .replace(/^[\s]*[=+@-]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [cols.map((c) => c[0]), ...rows.map((r) => cols.map((c) => c[1](r)))]
      .map((r) => r.map(cell).join(","))
      .join("\r\n")
  );
}
