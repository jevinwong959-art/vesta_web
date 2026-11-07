import { businessNow, businessDay } from "./clock";
import React, { useState, useEffect } from "react";
import {
  Users,
  Check,
  Clock,
  X,
  Search,
  FileText,
  Wallet,
  Truck,
  Bell,
} from "lucide-react";
type Row = { id: string; [key: string]: any };
type Data = Record<string, Row[]>;
export function PortalHome({
  data,
  en,
  onGo,
}: {
  data: Data;
  en: boolean;
  onGo: (p: string) => void;
}) {
  const T = (zh: string, eng: string) => (en ? eng : zh),
    c = data.customers?.[0],
    orders = (data.orders || []).filter((o) => o.status !== "cancelled"),
    quotes = (data.quotes || []).filter((q) => q.status === "approved");
  return (
    <section className="portal-welcome">
      <div>
        <small className="eyebrow">MADE FOR YOUR BUSINESS</small>
        <h2>
          {T("专属报价，放心交付。", "Your next order. Clearly connected.")}
        </h2>
        <p>
          {T(
            "精选企业采购产品，透明的沟通与可追踪的交付。从一份清单开始，让每一次合作更简单。",
            "Curated products for your business, with dedicated quotes and visible delivery milestones. Start with a request list.",
          )}
        </p>
        <div className="portal-benefits">
          <span>✓ {T("专属销售服务", "Dedicated support")}</span>
          <span>✓ {T("审批后正式报价", "Approved quotations")}</span>
          <span>✓ {T("订单全程可追踪", "Track every milestone")}</span>
        </div>
      </div>
      <div className="portal-company">
        <small>
          {T("欢迎回来 / YOUR COMPANY", "WELCOME BACK / YOUR COMPANY")}
        </small>
        <h3>{en ? c?.en : c?.name}</h3>
        <p>
          {T("专属业务", "Your contact")}: {c?.assignedContact?.name || "—"} ·{" "}
          {c?.currency}
        </p>
        <div>
          <button onClick={() => onGo("quotes")}>
            <strong>{quotes.length}</strong>
            {T("可确认报价", "Open quotes")}
          </button>
          <button onClick={() => onGo("orders")}>
            <strong>
              {orders.filter((o) => o.status === "confirmed").length}
            </strong>
            {T("履约中订单", "Active orders")}
          </button>
          <button onClick={() => onGo("orders")}>
            <strong>
              {orders.filter((o) => o.status === "completed").length}
            </strong>
            {T("已完成合作", "Completed")}
          </button>
        </div>
      </div>
    </section>
  );
}

export const fmt = (n: number | null, c = "CNY") =>
  n == null
    ? "—"
    : new Intl.NumberFormat(c === "CNY" ? "zh-CN" : "en-US", {
        style: "currency",
        currency: c,
      }).format(n || 0);
const date = (v?: string) =>
  v
    ? new Date(v).toLocaleDateString("en-CA", { timeZone: "Asia/Shanghai" })
    : "—";
function stageText(o: Row) {
  if (o.status === "cancelled") return "已取消";
  if (o.status === "completed") return "已完成";
  if (!o.released)
    return o.paid >= (o.total * o.depositPct) / 100
      ? "待生产释放"
      : "待收预付款";
  if (o.items.every((i: any) => i.delivered >= i.qty)) return "已签收待尾款";
  if (o.items.some((i: any) => i.shipped > 0)) return "运输 / 分批发货";
  if (o.items.every((i: any) => i.produced >= i.qty)) return "待发运";
  return "生产 / 备货";
}
export function orderStage(o: Row, en = false) {
  const stage = stageText(o);
  return en
    ? {
        已取消: "Cancelled",
        已完成: "Completed",
        已签收待尾款: "Delivered, unpaid",
        待生产释放: "Ready to release",
        待收预付款: "Awaiting deposit",
        "运输 / 分批发货": "In transit / partial shipment",
        待发运: "Ready to ship",
        "生产 / 备货": "Production",
      }[stage] || stage
    : stage;
}
export function Stats({
  items,
}: {
  items: { label: string; value: React.ReactNode; hint: string; icon?: any }[];
}) {
  return (
    <div
      className="crm-stats"
      style={{ gridTemplateColumns: `repeat(${items.length},minmax(0,1fr))` }}
    >
      {items.map(({ label, value, hint, icon: Icon = FileText }) => (
        <div className="card crm-stat" key={label}>
          <div className="stat-label">
            {label}
            <span>
              <Icon size={19} />
            </span>
          </div>
          <strong>{value}</strong>
          <small>{hint}</small>
        </div>
      ))}
    </div>
  );
}
export function GridTable({
  heads,
  body,
}: {
  heads: string[];
  body: React.ReactNode[][];
}) {
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
          {!body.length && (
            <tr>
              <td colSpan={heads.length} className="empty">
                暂无匹配记录
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function Customers({
  data,
  user,
  onFollow,
  onEdit,
  onOrder,
  onImport,
  openCustomer,
}: {
  data: Data;
  user: any;
  onFollow: (c: Row) => void;
  onEdit: (c: Row) => void;
  onOrder: (o: Row) => void;
  onImport: () => void;
  openCustomer?: string;
}) {
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (openCustomer && data.customers?.some((c) => c.id === openCustomer))
      setSelected(openCustomer);
  }, [openCustomer]);
  const customers = data.customers || [],
    orders = (data.orders || []).filter((o) => o.status !== "cancelled"),
    rules = (data.settings || []).find((r) => r.id === "rules");
  const won = (c: Row) => orders.some((o) => o.customer === c.id);
  const due = (c: Row) =>
    c.maintenanceDue ||
    c.next ||
    (c.lastFollow
      ? new Date(
          Date.parse(c.lastFollow) +
            (won(c)
              ? rules?.customerActive || 30
              : rules?.customerProspect || 7) *
              86400000,
        )
          .toISOString()
          .slice(0, 10)
      : null);
  const overdue = (c: Row) =>
    due(c) && date(due(c)) <= date(businessNow().toISOString());
  const name = (id: string) =>
    data.salesDirectory?.find((u) => u.id === id)?.name ||
    (id === user.id ? user.name : id);
  const tier = (c: Row) =>
    ({ A: "A · 重点客户", B: "B · 成长客户", C: "C · 普通客户" })[
      c.tier as string
    ] || "未分级";
  const matching = customers.filter(
    (c) =>
      [c.name, c.en, c.contact, c.country, c.email, c.industry]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (status === "all" ||
        (status === "won" ? won(c) : status === "due" ? overdue(c) : !won(c))),
  );
  const c = customers.find((c) => c.id === selected),
    history = c
      ? orders
          .filter((o) => o.customer === c.id)
          .sort((a, b) =>
            a.referenceIndex != null && b.referenceIndex != null
              ? a.referenceIndex - b.referenceIndex
              : String(b.confirmedAt || b.createdAt).localeCompare(
                  a.confirmedAt || a.createdAt,
                ),
          )
      : [],
    annual = history.filter((o) =>
      date(o.confirmedAt || o.createdAt).startsWith(
        String(businessNow().getFullYear()),
      ),
    );
  const communication = c
    ? (data.follows || [])
        .filter((f) => f.customer === c.id)
        .sort(
          (a, b) =>
            Date.parse(b.occurred || b.at) - Date.parse(a.occurred || a.at),
        )
    : [];
  return (
    <>
      <Stats
        items={[
          {
            label: "客户总数",
            value: customers.length,
            hint: "当前授权范围内的客户档案",
            icon: Users,
          },
          {
            label: "已成交客户",
            value: customers.filter(won).length,
            hint: "至少有一笔非取消正式订单",
            icon: Check,
          },
          {
            label: "维护已到期",
            value: customers.filter(overdue).length,
            hint: "日常维护与订单跟进独立计时",
            icon: Clock,
          },
        ]}
      />
      <section className="card">
        <div className="crm-toolbar">
          <div className="search">
            <Search size={16} />
            <input
              aria-label="搜索客户"
              placeholder="搜索客户、联系人、地区…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="客户状态"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">全部状态</option>
            <option value="won">已成交</option>
            <option value="prospect">未成交</option>
            <option value="due">维护已到期</option>
          </select>
          <span className="count">
            {matching.length} 条记录 ·{" "}
            {user.role === "sales" ? "本人负责客户" : "企业全量业务数据"}
          </span>
          <a className="btn" href="/api/v1/export/customers">
            导出
          </a>
          <button className="btn" onClick={onImport}>
            导入
          </button>
        </div>
        <GridTable
          heads={[
            "客户名称 / 地区",
            "联系人",
            "交易状态 / 分级",
            "负责人",
            "最近维护 / 下次计划",
            "操作",
          ]}
          body={matching.map((c) => [
            <div className="crm-identity">
              <span className="crm-avatar">
                {(c.en || c.name).slice(0, 2).toUpperCase()}
              </span>
              <div>
                <button className="link" onClick={() => setSelected(c.id)}>
                  {c.name}
                </button>
                <small className="sub">
                  {c.country} · {c.industry || "行业待补充"}
                  {c.demo ? " · 模拟" : ""}
                </small>
              </div>
            </div>,
            <>
              {c.contact}
              <small className="sub">{c.email}</small>
            </>,
            <>
              <span className={`badge ${won(c) ? "approved" : "pending"}`}>
                {won(c) ? "已成交" : "未成交"}
              </span>
              <small className="sub">{tier(c)}</small>
            </>,
            name(c.owner),
            <>
              {date(c.lastFollow)}
              <small className={overdue(c) ? "sub overdue" : "sub"}>
                下次 {date(due(c))}
              </small>
            </>,
            <div className="actions">
              <button className="btn" onClick={() => setSelected(c.id)}>
                档案
              </button>
              <button className="btn soft" onClick={() => onFollow(c)}>
                跟进
              </button>
            </div>,
          ])}
        />
      </section>
      {c && (
        <div className="modal-backdrop">
          <section
            className="modal crm-profile"
            role="dialog"
            aria-modal="true"
            aria-label="客户档案"
          >
            <div className="modal-head">
              <div>
                <small className="eyebrow">CUSTOMER PROFILE</small>
                <h2>客户档案 · {c.name}</h2>
              </div>
              <button
                className="icon-btn"
                aria-label="关闭档案"
                onClick={() => setSelected(null)}
              >
                <X />
              </button>
            </div>
            <div className="modal-body">
              <div className="profile-summary">
                <span className="crm-avatar">
                  {(c.en || c.name).slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h3>{c.name}</h3>
                  <p>
                    {c.country} · {c.industry || "行业待补充"} · 建档{" "}
                    {date(c.since || c.createdAt)}
                  </p>
                </div>
                <span className={`badge ${won(c) ? "approved" : "pending"}`}>
                  {won(c) ? "已成交" : "未成交"}
                </span>
                {(c.tags || []).map((tag: string) => (
                  <span className="badge" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
              <div className="profile-kv">
                {[
                  ["联系人", c.contact],
                  ["电子邮箱", c.email],
                  ["联系电话", c.phone || "待补充"],
                  ["负责人", name(c.owner)],
                  ["最近有效维护", date(c.lastFollow)],
                  ["下次维护计划", date(due(c))],
                ].map(([label, value]) => (
                  <div key={label}>
                    <small>{label}</small>
                    <strong>
                      {value}
                      {label === "下次维护计划" && overdue(c) && (
                        <span className="badge rejected">已到期</span>
                      )}
                    </strong>
                  </div>
                ))}
              </div>
              <h3>客户年度小结 · {businessNow().getFullYear()}</h3>
              <div className="profile-totals">
                {["CNY", "USD"]
                  .filter((currency) =>
                    annual.some((o) => o.currency === currency),
                  )
                  .map((currency) => {
                    const os = annual.filter((o) => o.currency === currency),
                      total = os.reduce((s, o) => s + o.total, 0),
                      paid = os.reduce((s, o) => s + o.paid, 0);
                    return (
                      <div className="card" key={currency}>
                        <h4>
                          {currency} · {businessNow().getFullYear()} 年{" "}
                          <span className="badge approved annual-count">
                            {os.length} 笔订单
                          </span>
                        </h4>
                        <div className="profile-kv">
                          {[
                            ["订单金额", total],
                            ["已核实回款", paid],
                            ["未结余额", total - paid],
                          ].map(([k, v]) => (
                            <div key={k}>
                              <small>{k}</small>
                              <strong>{fmt(Number(v), currency)}</strong>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
              <p className="muted">
                统计口径：本年确认的非取消订单，按原币分别统计；已收为这些订单当前有效核销额。
              </p>
              <p className="purchase-summary">
                本年采购商品：
                {Object.entries(
                  annual
                    .flatMap((o) => o.items)
                    .reduce(
                      (r: any, i: any) => ({
                        ...r,
                        [i.name]: (r[i.name] || 0) + i.qty,
                      }),
                      {},
                    ),
                )
                  .map(([n, q]) => `${n} × ${q} 件`)
                  .join(" / ") || "暂无订单"}
              </p>
              <h3>订单历史</h3>
              <GridTable
                heads={["订单", "状态", "金额", "已收 / 余额", "操作"]}
                body={history.map((o) => [
                  o.id,
                  <span
                    className={
                      "badge " +
                      (o.status === "completed" ||
                      (o.items || []).every((i: any) => i.delivered >= i.qty)
                        ? "approved"
                        : "confirmed")
                    }
                  >
                    {orderStage(o)}
                  </span>,
                  fmt(o.total, o.currency),
                  `${fmt(o.paid, o.currency)} / ${fmt(o.total - o.paid, o.currency)}`,
                  <button
                    className="btn"
                    onClick={() => {
                      onOrder(o);
                    }}
                  >
                    查看
                  </button>,
                ])}
              />
              <h3 className="section-gap">沟通时间线</h3>
              <div className="crm-timeline">
                {communication.map((f) => (
                  <article key={f.id}>
                    <p>{f.note}</p>
                    <small>
                      {f.channel || "历史记录"} · {name(f.actor)} ·{" "}
                      {new Date(f.occurred || f.at).toLocaleString()} ·{" "}
                      {{
                        customers: "客户维护",
                        quotes: "报价跟进",
                        orders: "订单跟进",
                      }[f.kind as string] || f.kind}{" "}
                      {f.kind !== "customers" ? f.entity : ""}
                    </small>
                    <small>
                      下次计划 {f.next}{" "}
                      {f.syncCustomer ? "· 已同步客户维护" : ""}
                    </small>
                  </article>
                ))}
                {!communication.length && <p className="empty">暂无沟通记录</p>}
              </div>
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => setSelected(null)}>
                关闭
              </button>
              <button
                className="btn"
                onClick={() => {
                  setSelected(null);
                  onEdit(c);
                }}
              >
                编辑资料
              </button>
              <button
                className="btn primary"
                onClick={() => {
                  setSelected(null);
                  onFollow(c);
                }}
              >
                记录客户维护
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
export function Overview({
  data,
  onGo,
  onOrder,
  en = false,
}: {
  data: Data;
  onGo: (s: string) => void;
  onOrder: (o: Row) => void;
  en?: boolean;
}) {
  const [currency, setCurrency] = useState("CNY"),
    orders = (data.orders || []).filter((o) => o.status !== "cancelled"),
    os = orders.filter((o) => o.currency === currency),
    active = orders.filter((o) => o.status === "confirmed"),
    T = (zh: string, eng: string) => (en ? eng : zh);
  const total = os.reduce((s, o) => s + o.total, 0),
    paid = os.reduce((s, o) => s + o.paid, 0),
    tasks = (data.notifications || []).filter((n) => !n.resolved);
  const months = Array.from({ length: 6 }, (_, i) => {
      const d = businessNow();
      d.setDate(1);
      d.setMonth(d.getMonth() - 5 + i);
      const key = d.toISOString().slice(0, 7),
        rows = os.filter((o) => o.createdAt?.startsWith(key));
      return {
        key,
        total: rows.reduce((s, o) => s + o.total, 0),
        paid: rows.reduce((s, o) => s + o.paid, 0),
      };
    }),
    max = Math.max(1, ...months.map((m) => m.total));
  return (
    <>
      <div className="overview-control">
        <span>
          {T(
            "按订单原币统计，不混合人民币和美元",
            "Totals in original currency",
          )}
        </span>
        <select
          aria-label="统计币种"
          value={currency}
          onChange={(e) => setCurrency(e.target.value)}
        >
          <option>CNY</option>
          <option>USD</option>
        </select>
      </div>
      <Stats
        items={[
          {
            label: T("已确认订单金额", "Confirmed orders"),
            value: fmt(total, currency),
            hint: `${os.length} ${T("笔非取消订单", "orders")}`,
            icon: FileText,
          },
          {
            label: T("已核实回款", "Verified payments"),
            value: fmt(paid, currency),
            hint: `${T("回款覆盖率", "Payment coverage")} ${total ? ((100 * paid) / total).toFixed(1) : 0}%`,
            icon: Wallet,
          },
          {
            label: T("逾期未结金额", "Overdue balance"),
            value: fmt(
              os
                .filter(
                  (o) =>
                    o.balanceDue &&
                    o.balanceDue < businessNow().toISOString().slice(0, 10),
                )
                .reduce((s, o) => s + Math.max(0, o.total - o.paid), 0),
              currency,
            ),
            hint: T("签收和收款独立记录", "Delivery and payment are separate"),
            icon: Clock,
          },
          {
            label: T("待处理事项", "Pending tasks"),
            value: tasks.length,
            hint: T(
              "生产、发货和签收进度",
              "Production, shipments and delivery",
            ),
            icon: Truck,
          },
        ]}
      />
      <div className="stage-flow">
        {[
          [
            "inquiries",
            T("询价申请", "Requests"),
            (data.inquiries || []).filter((i) => i.status === "new").length,
          ],
          [
            "quotes",
            T("报价审批", "Approvals"),
            (data.quotes || []).filter((q) => q.status === "pending").length,
          ],
          [
            "orders",
            T("待生产释放", "Awaiting release"),
            active.filter((o) => !o.released).length,
          ],
          [
            "orders",
            T("生产 / 备货", "Production"),
            active.filter(
              (o) => o.released && o.items.some((i: any) => i.produced < i.qty),
            ).length,
          ],
          [
            "orders",
            T("发货 / 签收", "Delivery"),
            active.filter((o) =>
              o.items.some((i: any) => i.shipped > i.delivered),
            ).length,
          ],
          [
            "orders",
            T("已签收待结清", "Delivered, unpaid"),
            active.filter(
              (o) =>
                o.items.every((i: any) => i.delivered === i.qty) &&
                o.paid < o.total,
            ).length,
          ],
        ].map(([page, label, n], i) => (
          <button key={i} onClick={() => onGo(String(page))}>
            <small>{label}</small>
            <strong>{n}</strong>
            <span>0{i + 1}</span>
          </button>
        ))}
      </div>
      <div className="dashboard-grid">
        <section className="card">
          <div className="card-head">
            <h3>
              {T("订单与回款趋势", "Orders and payments")} · {currency}
            </h3>
            <small>
              {T(
                "近六个月订单；已收按该批订单统计",
                "Last six months of orders",
              )}
            </small>
          </div>
          <div className="crm-chart" aria-label="订单与回款趋势">
            {months.map((m) => (
              <div className="chart-month" key={m.key}>
                <div className="bars">
                  <i
                    title={`${m.key} ${fmt(m.total, currency)}`}
                    style={{ height: `${(m.total / max) * 100}%` }}
                  />
                  <i
                    title={fmt(m.paid, currency)}
                    style={{ height: `${(m.paid / max) * 100}%` }}
                  />
                </div>
                <small>
                  {m.key.slice(5)}
                  {T("月", "")}
                </small>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <span>● {T("订单金额", "Orders")}</span>
            <span>● {T("上述订单已收", "Received")}</span>
          </div>
          <details className="chart-details">
            <summary>{T("查看每月金额明细", "View monthly amounts")}</summary>
            <div className="table-scroll">
              <table>
                <caption>
                  {T(
                    "近六个月订单与已收金额",
                    "Orders and receipts for the last six months",
                  )}{" "}
                  · {currency}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">{T("月份", "Month")}</th>
                    <th scope="col">{T("订单金额", "Orders")}</th>
                    <th scope="col">{T("上述订单已收", "Received")}</th>
                  </tr>
                </thead>
                <tbody>
                  {months.map((m) => (
                    <tr key={m.key}>
                      <th scope="row">{m.key}</th>
                      <td>{fmt(m.total, currency)}</td>
                      <td>{fmt(m.paid, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </section>
        <section className="card">
          <div className="card-head">
            <h3>{T("优先处理", "Priority tasks")}</h3>
            <Bell size={18} />
          </div>
          <div className="priority-tasks">
            {tasks.slice(0, 4).map((n) => (
              <button key={n.id} onClick={() => onGo("notifications")}>
                <Clock size={18} />
                <div>
                  <strong>{n.title}</strong>
                  <small>
                    {n.entity} · {date(n.due)}
                  </small>
                </div>
              </button>
            ))}
            {!tasks.length && (
              <p className="empty">
                {T("当前没有未读待办", "No unread tasks")}
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="card section-gap">
        <div className="card-head">
          <h3>{T("重点订单跟踪", "Priority orders")}</h3>
          <button className="link" onClick={() => onGo("orders")}>
            {T("全部订单", "All orders")} →
          </button>
        </div>
        <GridTable
          heads={[
            T("订单 / 客户", "Order / Customer"),
            T("履约状态", "Fulfillment"),
            T("金额", "Amount"),
            T("已收 / 余额", "Paid / Balance"),
            T("交期", "Delivery"),
          ]}
          body={active
            .slice()
            .sort((a, b) =>
              String(a.lastFollow || a.createdAt).localeCompare(
                b.lastFollow || b.createdAt,
              ),
            )
            .slice(0, 5)
            .map((o) => [
              <button className="link" onClick={() => onOrder(o)}>
                {o.id}
                <small className="sub">
                  {data.customers?.find((c) => c.id === o.customer)?.name}
                </small>
              </button>,
              orderStage(o),
              fmt(o.total, o.currency),
              `${fmt(o.paid, o.currency)} / ${fmt(o.total - o.paid, o.currency)}`,
              o.eta,
            ])}
        />
      </section>
    </>
  );
}
