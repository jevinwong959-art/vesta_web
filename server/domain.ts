import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from "@nestjs/common";
import { z } from "zod";
import Decimal from "decimal.js";
import { RecordData, Store, read, transaction, uid } from "./db";
import { User, allow } from "./auth";
import { latestRate, stale, refreshRates, chinaDay } from "./fx";

const text = z.string().trim().min(1).max(500);
const amount = z.coerce
  .number()
  .finite()
  .min(0)
  .max(100000000)
  .refine((x) => new Decimal(x).decimalPlaces() <= 2, "金额最多两位小数");
const qty = z.coerce.number().int().min(1).max(1000000);
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((x) => !isNaN(Date.parse(x)));
const salesRoles = ["owner", "manager", "sales"];
export const money = (n: Decimal.Value) =>
  new Decimal(n).toDecimalPlaces(2).toNumber();
const fail = (message: string): never => {
  throw new BadRequestException(message);
};
async function required(db: Store, kind: string, id: string) {
  const r = await db.get(kind, id);
  if (!r) throw new NotFoundException("记录不存在 / Not found");
  return r;
}
export async function canCustomer(db: Store, u: User, id: string) {
  const c = await db.get("customers", id);
  if (!c || u.role === "admin") return false;
  return u.role === "customer"
    ? u.customer === id
    : u.role === "sales"
      ? c.owner === u.id
      : true;
}
async function scoped(db: Store, u: User, kind: string, id: string) {
  const r = await required(db, kind, id);
  if (!(await canCustomer(db, u, r.customer))) throw new ForbiddenException();
  return r;
}
export function sanitize(value: any, u: User): any {
  if (Array.isArray(value)) return value.map((v) => sanitize(v, u));
  if (!value || typeof value !== "object") return value;
  const result: any = {};
  for (const [k, v] of Object.entries(value)) {
    if (["password", "content", "token"].includes(k)) continue;
    if (["cost", "margin", "costSnapshot"].includes(k) && u.role !== "owner")
      continue;
    if (
      ["warehouse", "admin"].includes(u.role) &&
      [
        "price",
        "usd",
        "total",
        "amount",
        "paid",
        "balance",
        "depositPct",
        "freight",
        "discount",
        "fees",
        "unitPrice",
        "listPrice",
        "rate",
        "fx",
        "itemsTotal",
      ].includes(k)
    )
      continue;
    if (
      u.role === "customer" &&
      [
        "internal",
        "approvers",
        "approvalLog",
        "submittedBy",
        "risk",
        "owner",
        "lastFollow",
      ].includes(k)
    )
      continue;
    result[k] = sanitize(v, u);
  }
  return result;
}
export async function listData(u: User, kind: string) {
  const supported = [
    "customers",
    "products",
    "inquiries",
    "quotes",
    "orders",
    "receipts",
    "shipments",
    "contracts",
    "follows",
    "notifications",
    "mails",
    "audits",
    "rates",
    "ledger",
    "settings",
    "adjustments",
  ];
  if (!supported.includes(kind)) throw new NotFoundException();
  return read(async (db) => {
    if (u.role === "admin") {
      if (!["settings", "mails"].includes(kind)) throw new ForbiddenException();
    }
    if (
      u.role === "customer" &&
      ![
        "customers",
        "products",
        "inquiries",
        "quotes",
        "orders",
        "shipments",
        "contracts",
        "notifications",
      ].includes(kind)
    )
      throw new ForbiddenException();
    if (
      u.role === "warehouse" &&
      ["quotes", "receipts", "rates", "audits", "mails", "inquiries"].includes(
        kind,
      )
    )
      throw new ForbiddenException();
    if (kind === "audits") allow(u, ["owner"]);
    if (kind === "mails") allow(u, ["admin", "owner", "finance", "manager"]);
    if (kind === "rates") allow(u, ["owner", "manager", "sales", "finance"]);
    if (kind === "settings") allow(u, ["owner", "manager", "finance", "admin"]);
    let rows = await db.all(kind);
    if (kind === "rates")
      rows = rows.map((r) => ({
        ...r,
        invalid:
          !r.manual &&
          r.date >
            new Date().toLocaleDateString("en-CA", {
              timeZone: "Asia/Shanghai",
            }),
      }));
    if (kind === "customers")
      rows = rows.filter((c) =>
        u.role === "customer"
          ? c.id === u.customer
          : u.role === "sales"
            ? c.owner === u.id
            : true,
      );
    const selected: RecordData[] = [];
    for (const r of rows) {
      if (kind === "mails" && r.sensitive && u.role !== "admin") continue;
      if (r.customer && !(await canCustomer(db, u, r.customer))) continue;
      if (
        kind === "quotes" &&
        u.role === "customer" &&
        (!r.published || !["approved", "accepted"].includes(r.status))
      )
        continue;
      if (kind === "notifications" && r.recipient !== u.id) continue;
      selected.push(sanitize(r, u));
    }
    return selected;
  });
}

export async function action(
  u: User,
  actionName: string,
  body: unknown,
): Promise<any> {
  if (actionName === "fx-refresh") {
    allow(u, ["finance"]);
    return refreshRates(u.id);
  }
  const b = (body || {}) as any;
  const result = await transaction(async (db) => {
    let out: RecordData;
    switch (actionName) {
      case "customer-profile": {
        allow(u, ["customer"]);
        const v = z
          .object({
            contact: text,
            email: z.email(),
            address: text,
            phone: z.string().max(80).default(""),
          })
          .parse(b);
        const c = await required(db, "customers", u.customer!);
        out = await db.put("customers", { ...c, ...v });
        break;
      }
      case "customer-save": {
        allow(u, salesRoles);
        const v = z
          .object({
            id: text.optional(),
            name: text,
            en: text,
            country: text,
            contact: text,
            email: z.email(),
            currency: z.enum(["CNY", "USD"]),
            address: text,
            owner: text.optional(),
          })
          .parse(b);
        if (v.id && !(await canCustomer(db, u, v.id)))
          throw new ForbiddenException();
        const previous = v.id
          ? await required(db, "customers", v.id)
          : undefined;
        const owner =
          u.role === "sales" ? u.id : v.owner || previous?.owner || "sales";
        if (
          !(
            await db.client.query(
              "SELECT id FROM users WHERE id=$1 AND role IN ('sales','manager','owner') AND active=true",
              [owner],
            )
          ).rowCount
        )
          fail("负责人不存在");
        out = await db.put("customers", {
          ...previous,
          ...v,
          id: v.id || uid("C"),
          owner,
          lastFollow: previous?.lastFollow || new Date().toISOString(),
        });
        break;
      }
      case "product-save": {
        allow(u, ["owner", "manager"]);
        const v = z
          .object({
            id: text.optional(),
            sku: text,
            name: text,
            en: text,
            category: text,
            moq: qty,
            price: amount,
            usd: amount,
            cost: amount.optional(),
            lead: qty,
          })
          .parse(b);
        if (
          (await db.all("products")).some(
            (p) => p.sku === v.sku && p.id !== v.id,
          )
        )
          fail("SKU 已存在");
        const old = v.id ? await required(db, "products", v.id) : undefined;
        if (u.role !== "owner" && v.cost !== undefined)
          throw new ForbiddenException("仅经营负责人可维护成本");
        out = await db.put("products", {
          ...old,
          ...v,
          id: v.id || uid("P"),
          cost:
            u.role === "owner"
              ? (v.cost ?? old?.cost ?? null)
              : (old?.cost ?? null),
          stock: old?.stock || 0,
          reserved: old?.reserved || 0,
          unit: "件",
        });
        break;
      }
      case "inquiry-create": {
        allow(u, ["customer", ...salesRoles]);
        const v = z
          .object({
            customer: text.optional(),
            product: text,
            qty,
            eta: day,
            note: z.string().max(2000).default(""),
          })
          .parse(b);
        const customer = u.role === "customer" ? u.customer! : v.customer!;
        if (!(await canCustomer(db, u, customer)))
          throw new ForbiddenException();
        const p = await required(db, "products", v.product);
        if (v.qty < p.moq) fail("数量低于 MOQ");
        out = await db.put("inquiries", {
          ...v,
          id: uid("IQ"),
          customer,
          status: "new",
          createdAt: new Date().toISOString(),
        });
        break;
      }
      case "quote-save": {
        allow(u, salesRoles);
        const v = z
          .object({
            id: text.optional(),
            revisionOf: text.optional(),
            inquiry: text.optional(),
            customer: text,
            currency: z.enum(["CNY", "USD"]),
            items: z
              .array(z.object({ product: text, qty, price: amount }))
              .min(1)
              .max(100),
            depositPct: z.coerce.number().min(0).max(100),
            valid: day,
            eta: day,
            fxId: text.optional(),
            freight: amount.default(0),
            fees: amount.default(0),
            discount: amount.default(0),
            note: z.string().max(2000).default(""),
            terms: text.default("FOB"),
            port: z.string().max(200).default(""),
            destination: z.string().max(200).default(""),
          })
          .parse(b);
        if (!(await canCustomer(db, u, v.customer)))
          throw new ForbiddenException();
        if (v.inquiry) {
          const inquiry = await scoped(db, u, "inquiries", v.inquiry);
          if (inquiry.customer !== v.customer) fail("询价客户与报价客户不一致");
          await db.put("inquiries", { ...inquiry, status: "quoted" });
        }
        const previous = v.id ? await scoped(db, u, "quotes", v.id) : undefined;
        if (previous && previous.status !== "draft")
          fail("冻结版本不能修改，请创建新版本");
        const revision = v.revisionOf
          ? await scoped(db, u, "quotes", v.revisionOf)
          : undefined;
        if (revision?.status === "accepted")
          fail("已成交报价不能修订，请新建报价");
        if (v.id && v.revisionOf) fail("草稿编辑与修订不能同时指定");
        if (new Set(v.items.map((i) => i.product)).size !== v.items.length)
          fail("同一商品请合并数量");
        const items = [];
        let total = new Decimal(0);
        for (const item of v.items) {
          const p = await required(db, "products", item.product);
          if (item.qty < p.moq) fail("商品数量低于 MOQ");
          const line = {
            ...item,
            price: money(item.price),
            name: p.name,
            en: p.en,
            sku: p.sku,
            cost: p.cost,
            listPrice: v.currency === "USD" ? p.usd : p.price,
            produced: 0,
            shipped: 0,
            delivered: 0,
          };
          items.push(line);
          total = total.plus(new Decimal(line.price).times(line.qty));
        }
        total = total.plus(v.freight).plus(v.fees).minus(v.discount);
        if (total.lte(0) || total.gt(1e10)) fail("报价总额无效");
        const fx =
          v.currency === "USD"
            ? v.fxId
              ? await required(db, "rates", v.fxId)
              : previous?.fx || (await latestRate(db))
            : undefined;
        if (v.currency === "USD" && !fx) fail("缺少可用汇率");
        if (
          fx &&
          (fx.invalid ||
            (!fx.manual &&
              fx.date >
                new Date().toLocaleDateString("en-CA", {
                  timeZone: "Asia/Shanghai",
                })))
        )
          fail("汇率日期无效，请选择可用版本");
        const customer = await required(db, "customers", v.customer);
        const group = revision?.group || previous?.group || uid("QG");
        const revisionNo = revision
          ? Math.max(
              ...(await db.all("quotes"))
                .filter((q) => q.group === group)
                .map((q) => q.revision),
            ) + 1
          : previous?.revision || 1;
        out = await db.put("quotes", {
          ...previous,
          ...v,
          id: previous?.id || uid("QT"),
          group,
          revision: revisionNo,
          items,
          total: money(total),
          fx,
          customerSnapshot: customer,
          createdBy: previous?.createdBy || u.id,
          status: "draft",
          published: false,
          approvalLog: [],
          createdAt: previous?.createdAt || new Date().toISOString(),
        });
        break;
      }
      case "quote-submit": {
        allow(u, salesRoles);
        const q = await scoped(db, u, "quotes", text.parse(b.id));
        if (q.status !== "draft") fail("仅草稿可提交");
        if (q.valid < chinaDay()) fail("报价已过期");
        if (q.items.some((i: any) => i.cost == null))
          fail("存在未核定成本，请经营负责人维护");
        if (q.fx && stale(q.fx) && !q.fx.confirmedBy)
          fail("汇率已过期，需财务确认或指定新版本");
        const rule = await required(db, "settings", "rules");
        const rate =
          q.currency === "USD" ? new Decimal(q.fx.rate) : new Decimal(1);
        const cost = q.items.reduce(
          (sum: Decimal, i: any) => sum.plus(new Decimal(i.cost).times(i.qty)),
          new Decimal(0),
        );
        const converted = new Decimal(q.total).times(rate);
        const risk =
          converted.gte(rule.riskAmount) ||
          q.items.some((i: any) => i.price < i.listPrice * rule.discount) ||
          converted.minus(cost).div(converted).lt(rule.margin) ||
          q.depositPct < rule.depositPct;
        if (risk && u.role === "owner")
          fail("高风险报价需要经营负责人独立审批，请由销售或经理发起");
        const approvers =
          u.role === "owner"
            ? ["manager"]
            : u.role === "manager"
              ? ["owner"]
              : risk
                ? ["manager", "owner"]
                : ["manager"];
        for (const id of approvers)
          if (
            !(
              await db.client.query(
                "SELECT id FROM users WHERE id=$1 AND active=true",
                [id],
              )
            ).rowCount
          )
            fail("审批人不存在或已停用");
        out = await db.put("quotes", {
          ...q,
          status: "pending",
          submittedBy: u.id,
          approvers,
          step: 0,
          risk,
          submittedAt: new Date().toISOString(),
          stepStartedAt: new Date().toISOString(),
        });
        break;
      }
      case "quote-decide": {
        const v = z
          .object({ id: text, approve: z.boolean(), note: text })
          .parse(b);
        const q = await scoped(db, u, "quotes", v.id);
        if (
          q.status !== "pending" ||
          q.approvers[q.step] !== u.id ||
          q.submittedBy === u.id
        )
          throw new ForbiddenException("不允许审批自己的版本或非当前节点");
        const step = q.step + 1;
        out = await db.put("quotes", {
          ...q,
          step,
          stepStartedAt: new Date().toISOString(),
          status: v.approve
            ? step === q.approvers.length
              ? "approved"
              : "pending"
            : "rejected",
          approvalLog: [
            ...q.approvalLog,
            {
              actor: u.id,
              approve: v.approve,
              note: v.note,
              at: new Date().toISOString(),
            },
          ],
        });
        break;
      }
      case "quote-publish": {
        allow(u, salesRoles);
        const q = await scoped(db, u, "quotes", text.parse(b.id));
        if (q.status !== "approved") fail("仅审批通过的报价可发布");
        // A later approved revision supersedes other unaccepted versions in this group.
        for (const old of (await db.all("quotes")).filter(
          (x) =>
            x.group === q.group && x.id !== q.id && x.status !== "accepted",
        ))
          await db.put("quotes", { ...old, published: false });
        out = await db.put("quotes", { ...q, published: true });
        break;
      }
      case "quote-accept": {
        allow(u, ["customer"]);
        const q = await scoped(db, u, "quotes", text.parse(b.id));
        const existing = (await db.all("orders")).find((o) => o.quote === q.id);
        if (existing) return existing;
        if (q.status !== "approved" || !q.published || q.valid < chinaDay())
          fail("报价未发布、已过期或已作废");
        if ((await db.all("orders")).some((o) => o.quoteGroup === q.group))
          fail("同一报价系列已成交");
        out = await db.put("orders", {
          ...q,
          id: uid("SO"),
          quote: q.id,
          quoteGroup: q.group,
          status: "confirmed",
          released: false,
          paid: 0,
          createdAt: new Date().toISOString(),
        });
        await db.put("quotes", { ...q, status: "accepted" });
        if (q.inquiry) {
          const inquiry = await db.get("inquiries", q.inquiry);
          if (inquiry)
            await db.put("inquiries", {
              ...inquiry,
              status: "ordered",
              order: out.id,
            });
        }
        break;
      }
      case "receipt-create": {
        allow(u, ["finance", ...salesRoles]);
        const v = z
          .object({
            transaction: text,
            currency: z.enum(["CNY", "USD"]),
            amount: amount.refine((x) => x > 0),
            allocations: z
              .array(
                z.object({ order: text, amount: amount.refine((x) => x > 0) }),
              )
              .min(1)
              .max(100),
            note: text,
          })
          .parse(b);
        if (
          (await db.all("receipts")).some(
            (r) => r.transaction === v.transaction,
          )
        )
          fail("交易号已登记");
        if (
          new Set(v.allocations.map((x) => x.order)).size !==
          v.allocations.length
        )
          fail("订单分配重复");
        if (
          new Decimal(
            v.allocations.reduce(
              (s, x) => money(new Decimal(s).plus(x.amount)),
              0,
            ),
          ).gt(v.amount)
        )
          fail("核销分配超过收款总额");
        for (const a of v.allocations) {
          const o = await scoped(db, u, "orders", a.order);
          if (o.status !== "confirmed") fail("订单不在可收款状态");
          if (o.currency !== v.currency) fail("币种不一致");
          if (a.amount > money(new Decimal(o.total).minus(o.paid)))
            fail("超过订单未结余额");
        }
        const first = await required(db, "orders", v.allocations[0].order);
        for (const a of v.allocations)
          if (
            (await required(db, "orders", a.order)).customer !== first.customer
          )
            fail("一笔收款仅支持同一客户");
        out = await db.put("receipts", {
          ...v,
          amount: money(v.amount),
          allocations: v.allocations.map((a) => ({
            ...a,
            amount: money(a.amount),
          })),
          customer: first.customer,
          id: uid("RC"),
          status: "pending",
          createdBy: u.id,
          createdAt: new Date().toISOString(),
        });
        break;
      }
      case "receipt-verify":
      case "receipt-reverse": {
        allow(u, ["finance"]);
        const r = await scoped(db, u, "receipts", text.parse(b.id));
        const reverse = actionName === "receipt-reverse";
        if (r.status === (reverse ? "reversed" : "verified")) return r;
        if (r.status !== (reverse ? "verified" : "pending"))
          fail("收款状态不允许此操作");
        if (reverse) text.parse(b.reason);
        for (const a of r.allocations) {
          const o = await required(db, "orders", a.order);
          const paid = money(
            new Decimal(o.paid).plus(reverse ? -a.amount : a.amount),
          );
          if (paid < 0 || paid > o.total) fail("核销金额超出余额");
          await db.put("orders", {
            ...o,
            paid,
            status:
              !reverse &&
              paid === o.total &&
              o.items.every((i: any) => i.delivered === i.qty)
                ? "completed"
                : "confirmed",
          });
        }
        out = await db.put("receipts", {
          ...r,
          status: reverse ? "reversed" : "verified",
          verifiedBy: u.id,
          reason: reverse ? b.reason : undefined,
        });
        break;
      }
      case "order-release": {
        allow(u, ["warehouse"]);
        const o = await scoped(db, u, "orders", text.parse(b.id));
        if (o.status !== "confirmed") fail("订单状态不允许生产");
        if (o.paid < money(new Decimal(o.total).times(o.depositPct).div(100)))
          fail("已核实预付款不足");
        out = await db.put("orders", { ...o, released: true });
        break;
      }
      case "order-produce":
      case "order-ship": {
        allow(u, ["warehouse"]);
        const v = z
          .object({
            id: text,
            key: text,
            product: text,
            qty,
            carrier: text.optional(),
            tracking: text.optional(),
          })
          .parse(b);
        const o = await scoped(db, u, "orders", v.id);
        const old = await db.get("operations", v.key);
        if (old) {
          if (old.action !== actionName || old.entity !== v.id)
            fail("幂等键已用于其他操作");
          return o;
        }
        if (o.status !== "confirmed") fail("订单不在履约状态");
        if (!o.released) fail("请先释放生产");
        const index = o.items.findIndex((i: any) => i.product === v.product);
        if (index < 0) fail("订单无此商品");
        const i = { ...o.items[index] },
          p = await required(db, "products", v.product);
        const ship = actionName === "order-ship";
        if (ship) {
          text.parse(v.carrier);
          text.parse(v.tracking);
          if (i.shipped + v.qty > i.produced) fail("发货超过已生产数量");
          if (p.stock < v.qty || p.reserved < v.qty) fail("预留库存不足");
          i.shipped += v.qty;
          p.stock -= v.qty;
          p.reserved -= v.qty;
          await db.put("shipments", {
            id: uid("SH"),
            order: o.id,
            customer: o.customer,
            product: v.product,
            qty: v.qty,
            carrier: v.carrier,
            tracking: v.tracking,
            delivered: false,
            at: new Date().toISOString(),
          });
        } else {
          if (i.produced + v.qty > i.qty) fail("生产超过订单数量");
          i.produced += v.qty;
          p.stock += v.qty;
          p.reserved += v.qty;
        }
        o.items[index] = i;
        await db.put("products", p);
        await db.put("ledger", {
          id: uid("LG"),
          product: p.id,
          order: o.id,
          customer: o.customer,
          qty: ship ? -v.qty : v.qty,
          type: ship ? "shipment" : "production",
          actor: u.id,
          at: new Date().toISOString(),
        });
        await db.put("operations", {
          id: v.key,
          action: actionName,
          entity: v.id,
        });
        out = await db.put("orders", o);
        break;
      }
      case "shipment-deliver": {
        allow(u, ["warehouse"]);
        const s = await scoped(db, u, "shipments", text.parse(b.id));
        if (s.delivered) return s;
        const o = await required(db, "orders", s.order);
        const i = o.items.find((i: any) => i.product === s.product);
        i.delivered += s.qty;
        await db.put("orders", {
          ...o,
          status:
            o.paid === o.total &&
            o.items.every((i: any) => i.delivered === i.qty)
              ? "completed"
              : "confirmed",
        });
        out = await db.put("shipments", { ...s, delivered: true });
        break;
      }
      case "follow-create": {
        allow(u, salesRoles);
        const v = z
          .object({
            customer: text,
            note: text,
            next: day,
            kind: z
              .enum(["customers", "quotes", "orders"])
              .default("customers"),
            entity: text.optional(),
          })
          .parse(b);
        if (!(await canCustomer(db, u, v.customer)))
          throw new ForbiddenException();
        const c = await required(db, v.kind, v.entity || v.customer);
        if (v.kind !== "customers" && c.customer !== v.customer)
          throw new ForbiddenException();
        await db.put(v.kind, {
          ...c,
          lastFollow: new Date().toISOString(),
          next: v.next,
        });
        out = await db.put("follows", {
          ...v,
          id: uid("FL"),
          actor: u.id,
          at: new Date().toISOString(),
        });
        break;
      }
      case "fx-manual": {
        allow(u, ["finance"]);
        const v = z
          .object({
            rate: z.coerce.number().positive().max(1000),
            reason: text,
            date: day,
          })
          .parse(b);
        out = await db.put("rates", {
          id: uid("FX"),
          base: "USD",
          quote: "CNY",
          rate: String(v.rate),
          date: v.date,
          source: "Finance manual",
          manual: true,
          reason: v.reason,
          confirmedBy: u.id,
          fetchedAt: new Date().toISOString(),
        });
        break;
      }
      case "fx-confirm": {
        allow(u, ["finance"]);
        const r = await required(db, "rates", text.parse(b.id));
        const reason = text.parse(b.reason);
        out = await db.put("rates", {
          ...r,
          id: uid("FX"),
          manual: true,
          confirmedBy: u.id,
          reason,
          fetchedAt: new Date().toISOString(),
        });
        break;
      }
      case "notification-read": {
        const r = await required(db, "notifications", text.parse(b.id));
        if (r.recipient !== u.id) throw new ForbiddenException();
        out = await db.put("notifications", { ...r, read: true });
        break;
      }
      case "rules-save": {
        allow(u, ["owner", "manager"]);
        const days = z.coerce.number().int().min(1).max(365);
        const v = z
          .object({
            orderDays: days,
            quoteDays: days,
            customerProspect: days,
            customerActive: days,
            escalationDays: days,
            approvalHours: z.coerce.number().int().min(1).max(168),
            riskAmount: amount.refine((x) => x > 0),
            discount: z.coerce.number().positive().max(1),
            margin: z.coerce.number().min(0).max(1),
            depositPct: z.coerce.number().min(0).max(100),
          })
          .parse(b);
        out = await db.put("settings", { id: "rules", ...v });
        break;
      }
      case "quote-void": {
        allow(u, salesRoles);
        const q = await scoped(db, u, "quotes", text.parse(b.id));
        if (q.status === "accepted") fail("已成交报价不能作废");
        out = await db.put("quotes", {
          ...q,
          status: "void",
          published: false,
          voidReason: text.parse(b.reason),
        });
        break;
      }
      case "order-cancel": {
        allow(u, ["owner", "manager"]);
        const o = await scoped(db, u, "orders", text.parse(b.id));
        if (o.items.some((i: any) => i.produced > 0) || o.paid > 0)
          fail(
            "已有生产或回款，需先走人工业务核对；当前只允许取消未履约、未收款订单",
          );
        out = await db.put("orders", {
          ...o,
          status: "cancelled",
          cancelReason: text.parse(b.reason),
        });
        break;
      }
      case "order-cancel-remainder": {
        allow(u, ["owner", "manager"]);
        const v = z
          .object({ id: text, product: text, qty, reason: text, key: text })
          .parse(b);
        const o = await scoped(db, u, "orders", v.id);
        const op = await db.get("operations", v.key);
        if (op) {
          if (op.entity !== o.id || op.action !== actionName)
            fail("幂等键冲突");
          return o;
        }
        if (o.status !== "confirmed") fail("订单不在履约状态");
        const i = o.items.find((i: any) => i.product === v.product);
        if (!i || v.qty > i.qty - i.produced) fail("只能取消尚未生产的数量");
        const originalItems = o.originalItems || structuredClone(o.items);
        const originalTotal = o.originalTotal ?? o.total;
        i.qty -= v.qty;
        i.cancelled = (i.cancelled || 0) + v.qty;
        const empty = o.items.every((i: any) => i.qty === 0);
        const total = empty
          ? 0
          : money(
              o.items
                .reduce(
                  (sum: Decimal, i: any) =>
                    sum.plus(new Decimal(i.price).times(i.qty)),
                  new Decimal(0),
                )
                .plus(o.freight || 0)
                .plus(o.fees || 0)
                .minus(o.discount || 0),
            );
        if (total < 0 || o.paid > total)
          fail("取消后已收超过新总额或总额无效，请先由财务冲正并核对条款");
        out = await db.put("orders", {
          ...o,
          originalItems,
          originalTotal,
          total,
          status: empty
            ? "cancelled"
            : o.paid === total &&
                o.items.every((i: any) => i.delivered === i.qty)
              ? "completed"
              : "confirmed",
          amendments: [
            ...(o.amendments || []),
            {
              product: v.product,
              qty: v.qty,
              reason: v.reason,
              actor: u.id,
              at: new Date().toISOString(),
            },
          ],
        });
        await db.put("operations", {
          id: v.key,
          action: actionName,
          entity: o.id,
        });
        break;
      }
      case "adjustment-create": {
        allow(u, ["warehouse"]);
        const v = z
          .object({
            product: text,
            qty: z.coerce
              .number()
              .int()
              .min(-1000000)
              .max(1000000)
              .refine((x) => x !== 0),
            reason: text,
          })
          .parse(b);
        await required(db, "products", v.product);
        out = await db.put("adjustments", {
          ...v,
          id: uid("ADJ"),
          createdBy: u.id,
          status: "pending",
        });
        break;
      }
      case "adjustment-approve": {
        allow(u, ["owner"]);
        const r = await required(db, "adjustments", text.parse(b.id));
        if (r.status === "approved") return r;
        const p = await required(db, "products", r.product);
        if (p.stock + r.qty < p.reserved) fail("调整后库存少于预留库存");
        await db.put("products", { ...p, stock: p.stock + r.qty });
        await db.put("ledger", {
          id: uid("LG"),
          product: p.id,
          qty: r.qty,
          type: "adjustment",
          actor: u.id,
          at: new Date().toISOString(),
        });
        out = await db.put("adjustments", {
          ...r,
          status: "approved",
          approvedBy: u.id,
        });
        break;
      }
      default:
        throw new NotFoundException("未知操作");
    }
    await db.audit(u.id, actionName, out.id);
    return out;
  });
  return sanitize(result, u);
}

export async function scanReminders() {
  return transaction(async (db) => {
    const rule = await required(db, "settings", "rules");
    const now = Date.now();
    let added = 0;
    const candidates: any[] = [];
    for (const c of await db.all("customers")) {
      const active = (await db.all("orders")).some((o) => o.customer === c.id);
      const due = c.next
        ? Date.parse(c.next + "T09:00:00+08:00")
        : Date.parse(c.lastFollow) +
          86400000 * (active ? rule.customerActive : rule.customerProspect);
      candidates.push({
        customer: c.id,
        entity: c.id,
        recipient: c.owner,
        title: "客户维护到期 / Customer follow-up",
        due,
      });
    }
    for (const q of await db.all("quotes")) {
      if (q.status === "pending")
        candidates.push({
          customer: q.customer,
          entity: q.id,
          recipient: q.approvers[q.step],
          title: "报价审批逾期 / Approval overdue",
          due:
            Date.parse(q.stepStartedAt || q.submittedAt) +
            rule.approvalHours * 3600000,
        });
      if (q.status === "approved" && q.published)
        candidates.push({
          customer: q.customer,
          entity: q.id,
          recipient: q.createdBy,
          title: "已发布报价待跟进 / Quotation follow-up",
          due: q.next
            ? Date.parse(q.next + "T09:00:00+08:00")
            : Date.parse(q.lastFollow || q.createdAt) +
              rule.quoteDays * 86400000,
        });
    }
    for (const o of await db.all("orders"))
      if (o.status === "confirmed") {
        candidates.push({
          customer: o.customer,
          entity: o.id,
          recipient: o.createdBy,
          title: "订单待跟进 / Order follow-up",
          due: o.next
            ? Date.parse(o.next + "T09:00:00+08:00")
            : Date.parse(o.lastFollow || o.createdAt) +
              rule.orderDays * 86400000,
        });
        if (o.paid < o.total)
          candidates.push({
            customer: o.customer,
            entity: o.id,
            recipient: "finance",
            title: "交期已到，核对尾款 / Payment follow-up",
            due: Date.parse(o.eta + "T09:00:00+08:00"),
          });
      }
    const activeKeys = new Set<string>();
    for (const t of candidates.filter((t) => t.due <= now)) {
      for (const level of now - t.due >= rule.escalationDays * 86400000
        ? ["normal", "escalation"]
        : ["normal"]) {
        const recipient = level === "escalation" ? "owner" : t.recipient;
        const key = `${t.entity}:${t.title}:${t.due}:${recipient}:${level}`;
        activeKeys.add(key);
        if (await db.get("notifications", key)) continue;
        await db.put("notifications", {
          ...t,
          id: key,
          recipient,
          level,
          read: false,
          at: new Date().toISOString(),
        });
        await db.put("mails", {
          id: uid("MAIL"),
          recipient,
          subject: t.title,
          body: `${t.entity} 请登录处理 / Please sign in to review.`,
          status: "captured",
          channel: "local-only",
          at: new Date().toISOString(),
        });
        added++;
      }
    }
    for (const n of await db.all("notifications"))
      if (!activeKeys.has(n.id) && !n.resolved)
        await db.put("notifications", { ...n, resolved: true });
    return { added };
  });
}
