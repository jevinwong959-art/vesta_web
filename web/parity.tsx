import { businessDay, businessNow } from "./clock";
import React, { useState, useEffect, useRef } from "react";
import { X, Plus, Search } from "lucide-react";
import { orderStage, fmt } from "./workspace";
type Row = { id: string; [key: string]: any };
type Data = Record<string, Row[]>;
const day = (v: any) => (v ? String(v).slice(0, 10) : "—");
export const duePayment = (o: any, now = businessDay()) =>
  o.status !== "cancelled" &&
  o.total > o.paid &&
  o.balanceDue &&
  o.balanceDue < now;
export function Table({
  heads,
  rows,
}: {
  heads: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {heads.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={heads.length} className="empty">
                暂无记录 / No records
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
export function KV({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="profile-kv">
      {items.map(([label, value]) => (
        <div key={label}>
          <small>{label}</small>
          <strong>{value || "—"}</strong>
        </div>
      ))}
    </div>
  );
}
export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide = true,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const prior = document.activeElement as HTMLElement;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab") {
        const els = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input,select,textarea,a[href],[tabindex="0"]',
          ) || [],
        ).filter((e) => e.offsetParent !== null);
        const first = els[0],
          last = els.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    ref.current?.addEventListener("keydown", handler);
    return () => {
      ref.current?.removeEventListener("keydown", handler);
      prior?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop parity-overlay">
      <section
        ref={ref}
        tabIndex={-1}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <h2>{title}</h2>
          <button
            className="icon-btn"
            aria-label="关闭 / Close"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            关闭 / Close
          </button>
          {footer}
        </div>
      </section>
    </div>
  );
}
export function BusinessDetail({
  record,
  kind,
  data,
  portal,
  en,
  role,
  onDeliver,
}: {
  record: Row;
  kind: string;
  data: Data;
  portal: boolean;
  en: boolean;
  role: string;
  onDeliver: (r: Row) => void;
}) {
  const [full, setFull] = useState<Row>(record),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setFull(record);
    fetch(`/api/v1/detail/${kind}/${record.id}`)
      .then(async (r) => {
        const v = await r.json();
        if (!r.ok) throw Error(v.message);
        if (active) setFull(v);
      })
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [record.id, kind]);
  const o = full,
    T = (a: string, b: string) => (en ? b : a),
    isOrder = kind === "orders",
    c =
      o.customerSnapshot ||
      data.customers?.find((c) => c.id === o.customer) ||
      {},
    name = (u: string) =>
      data.salesDirectory?.find((x) => x.id === u)?.name || u;
  const items = o.items || [],
    shipments = (data.shipments || []).filter((s) => s.order === o.id),
    sum = (k: string) =>
      items.reduce((s: number, i: any) => s + Number(i[k] || 0), 0),
    qty = sum("qty");
  const stage =
    sum("delivered") === qty && qty
      ? 4
      : sum("shipped") > 0
        ? 3
        : sum("produced") === qty && qty
          ? 2
          : o.released
            ? 1
            : 0;
  const labels = en
    ? [
        "Deposit / Confirmation",
        "Production",
        "Ready to ship",
        "In transit",
        "Delivered",
      ]
    : ["收定 / 确认", "生产备货", "待发运", "运输中", "已签收"];
  return (
    <>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
      <div className="document-heading">
        <div>
          <h2>{en ? c.en || c.name : c.name}</h2>
          <p>
            {T(
              isOrder ? "确认日期" : "创建日期",
              isOrder ? "Confirmed" : "Created",
            )}{" "}
            {day(o.confirmedAt || o.createdAt)}{" "}
            {!portal && (
              <>
                {" "}
                · {T("负责人", "Owner")} {o.ownerName || name(o.createdBy)}
              </>
            )}
          </p>
        </div>
        <div className="actions">
          <span className="badge approved">
            {isOrder
              ? en
                ? [
                    "Awaiting deposit",
                    "Production",
                    "Ready to ship",
                    "In transit",
                    "Delivered",
                  ][stage]
                : orderStage(o)
              : o.published
                ? T("已发布", "Published")
                : T("未发布", "Unpublished")}
          </span>
          {isOrder && duePayment(o) && (
            <span className="badge rejected">
              {T("尾款逾期", "Payment overdue")}
            </span>
          )}
        </div>
      </div>
      {isOrder && o.status !== "cancelled" && (
        <ol className="fulfillment-steps">
          {labels.map((l, i) => (
            <li key={l} className={i <= stage ? "done" : ""}>
              <span>{i < stage ? "✓" : i + 1}</span>
              <small>{l}</small>
            </li>
          ))}
        </ol>
      )}
      <div className="money-summary">
        <KV
          items={
            isOrder
              ? [
                  [T("订单总额", "Order total"), fmt(o.total, o.currency)],
                  [
                    T("已核实回款", "Verified payments"),
                    fmt(o.paid, o.currency),
                  ],
                  [T("未结余额", "Balance"), fmt(o.total - o.paid, o.currency)],
                ]
              : [
                  [T("报价总额", "Quotation total"), fmt(o.total, o.currency)],
                  [T("有效期至", "Valid until"), day(o.valid)],
                  [T("版本", "Revision"), `V${o.revision}`],
                ]
          }
        />
      </div>
      <KV
        items={[
          [T("预计交付", "Delivery"), day(o.eta)],
          [
            T("预付款条件", "Deposit"),
            `${o.depositPct}% / ${fmt((o.total * o.depositPct) / 100, o.currency)}`,
          ],
          [
            T("尾款到期", "Balance due"),
            o.balanceDue || T("待补充", "Not recorded"),
          ],
        ]}
      />
      <h3>
        {T(
          isOrder ? "订单商品快照" : "报价商品",
          isOrder ? "Order item snapshot" : "Quotation items",
        )}
      </h3>
      <Table
        heads={[
          T("商品 / 规格", "Product / Specification"),
          T("数量", "Quantity"),
          T("单价", "Unit price"),
          T("金额", "Amount"),
          ...(!portal && role === "owner"
            ? [T("参考成本 / 件", "Cost / unit")]
            : []),
        ]}
        rows={items.map((i: any) => [
          <>
            <strong>{en ? i.en || i.name : i.name}</strong>
            <small className="sub">
              {i.sku} · {en ? i.specEn || i.spec : i.spec || "—"}
            </small>
          </>,
          i.qty,
          fmt(i.price, o.currency),
          fmt(i.price * i.qty, o.currency),
          ...(!portal && role === "owner"
            ? [i.cost == null ? "—" : fmt(i.cost)]
            : []),
        ])}
      />
      {!isOrder && (
        <KV
          items={[
            [T("运费", "Freight"), fmt(o.freight, o.currency)],
            [T("其他费用", "Other fees"), fmt(o.fees, o.currency)],
            [T("折扣", "Discount"), fmt(o.discount, o.currency)],
          ]}
        />
      )}
      <p>{o.paymentTerms}</p>
      <p>
        {o.terms} {o.port} {o.destination}
      </p>
      <p>{o.note}</p>
      {o.fx && (
        <div className="notice-box">
          {T("锁定参考汇率", "Locked reference FX")}: 1 USD = {o.fx.rate} CNY ·{" "}
          {o.fx.date} · {o.fx.source}
        </div>
      )}
      {isOrder && (
        <>
          <h3>{T("物流与交付", "Logistics & delivery")}</h3>
          <Table
            heads={[
              T("方式 / 承运商", "Mode / Carrier"),
              T("运单 / 柜号", "Tracking / Container"),
              T("商品 / 数量", "Item / Quantity"),
              T("预计到达", "Arrival"),
              T("签收", "Delivery"),
            ]}
            rows={shipments.map((s) => [
              `${s.mode || "—"} · ${s.carrier}`,
              <>
                {s.tracking}
                <small className="sub">{s.container || "—"}</small>
              </>,
              `${items.find((i: any) => i.product === s.product)?.name || s.product} × ${s.qty}`,
              day(s.eta),
              s.delivered ? (
                <>
                  {T("已签收", "Delivered")} {day(s.deliveredAt)}
                </>
              ) : role === "manager" ? (
                <button className="btn" onClick={() => onDeliver(s)}>
                  {T("登记签收", "Record delivery")}
                </button>
              ) : (
                T("运输中", "In transit")
              ),
            ])}
          />
          {!portal && (
            <>
              <h3>{T("分批履约数量", "Batch quantities")}</h3>
              <Table
                heads={[
                  "SKU",
                  T("有效数量", "Quantity"),
                  T("已生产", "Produced"),
                  T("已发货", "Shipped"),
                  T("已签收", "Delivered"),
                ]}
                rows={items.map((i: any) => [
                  i.sku,
                  i.qty,
                  i.produced,
                  i.shipped,
                  i.delivered,
                ])}
              />
            </>
          )}
          <h3>{T("回款记录", "Payment records")}</h3>
          <Table
            heads={[
              T("实际收款日期", "Received date"),
              T("收款编号", "Receipt"),
              T("本单核销金额", "Allocated amount"),
              T("状态", "Status"),
            ]}
            rows={(o.payments || []).map((r: any) => [
              r.receivedAt || T("待补充", "Not recorded"),
              r.id,
              fmt(r.amount, r.currency),
              r.status === "verified"
                ? T("已核实并核销", "Verified & allocated")
                : r.status === "reversed"
                  ? T("已冲正", "Reversed")
                  : T("待核实", "Pending"),
            ])}
          />
        </>
      )}
      {!portal && !isOrder && (
        <>
          <h3>审批流程</h3>
          <div className="approval-nodes">
            {o.approverNames?.map((n: string, i: number) => (
              <span
                className={`badge ${i < o.step ? "approved" : "pending"}`}
                key={i}
              >
                {i + 1}. {n}{" "}
                {i === o.step && o.status === "pending" ? "· 当前节点" : ""}
              </span>
            ))}
          </div>
          {o.riskReasons?.length > 0 && (
            <p className="notice-box">{o.riskReasons.join("；")}</p>
          )}
          <Table
            heads={["审批人", "时间", "结果", "意见"]}
            rows={(o.approvalLog || []).map((a: any) => [
              a.actorName || a.actor,
              a.at,
              a.approve ? "通过" : "退回",
              a.note,
            ])}
          />
        </>
      )}
      {!portal && (
        <>
          <h3>内部业务时间线</h3>
          <div className="crm-timeline">
            {(o.timeline || []).map((f: any) => (
              <article key={f.id}>
                <small>
                  {day(f.occurred || f.at)} · {f.actorName} · {f.channel}
                </small>
                <p>{f.note}</p>
                {f.next && <small>下次计划 {day(f.next)}</small>}
              </article>
            ))}
            {!o.timeline?.length && <p className="muted">暂无记录</p>}
          </div>
        </>
      )}
    </>
  );
}
export function QuoteDocument({
  q,
  onClose,
  en,
}: {
  q: Row;
  onClose: () => void;
  en: boolean;
}) {
  const T = (a: string, b: string) => (en ? b : a);
  return (
    <Dialog
      title={T("正式报价单", "Formal quotation")}
      onClose={onClose}
      footer={
        <button className="btn primary" onClick={() => window.print()}>
          {T("打印 / 保存 PDF", "Print / Save PDF")}
        </button>
      }
    >
      <article className="quotation-document">
        <header>
          <h1>VESTA</h1>
          <p>
            QUOTATION · {q.id} · V{q.revision}
          </p>
        </header>
        <KV
          items={[
            [
              T("客户", "Customer"),
              en ? q.customerSnapshot?.en : q.customerSnapshot?.name,
            ],
            [T("联系人", "Contact"), q.customerSnapshot?.contact],
            [T("地址", "Address"), q.customerSnapshot?.address],
            [T("币种", "Currency"), q.currency],
            [T("有效期", "Valid until"), q.valid],
            [T("交期", "Delivery"), q.eta],
          ]}
        />
        <Table
          heads={[
            T("商品 / 规格", "Product / Specification"),
            T("数量", "Quantity"),
            T("单价", "Unit price"),
            T("金额", "Amount"),
          ]}
          rows={q.items.map((i: any) => [
            <>
              {en ? i.en : i.name}
              <small className="sub">
                {i.sku} · {en ? i.specEn || i.spec : i.spec}
              </small>
            </>,
            i.qty,
            fmt(i.price, q.currency),
            fmt(i.price * i.qty, q.currency),
          ])}
        />
        <KV
          items={[
            [T("运费", "Freight"), fmt(q.freight, q.currency)],
            [
              T("其他费用 / 折扣", "Fees / Discount"),
              `${fmt(q.fees, q.currency)} / ${fmt(q.discount, q.currency)}`,
            ],
            [T("总额", "Total"), fmt(q.total, q.currency)],
          ]}
        />
        <p>
          {T("预付款", "Deposit")} {q.depositPct}% ·{" "}
          {T("尾款到期", "Balance due")} {q.balanceDue || "—"}
        </p>
        <p>{q.paymentTerms}</p>
        <p>
          {q.terms} · {q.port} · {q.destination}
        </p>
        <p>{q.note}</p>
      </article>
    </Dialog>
  );
}

export function RequestDialog({
  products,
  customers,
  portal,
  en,
  initial,
  onClose,
  submit,
}: {
  products: Row[];
  customers: Row[];
  portal: boolean;
  en: boolean;
  initial: any[];
  onClose: () => void;
  submit: (v: any) => Promise<any>;
}) {
  const T = (a: string, b: string) => (en ? b : a);
  const [items, setItems] = useState(
      initial.length
        ? initial
        : products[0]
          ? [{ product: products[0].id, qty: products[0].moq }]
          : [],
    ),
    [customer, setCustomer] = useState(customers[0]?.id || ""),
    [currency, setCurrency] = useState(customers[0]?.currency || "CNY"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Dialog
      title={T("提交采购需求", "Submit purchase request")}
      onClose={onClose}
      footer={
        <button
          form="purchase-request"
          className="btn primary"
          disabled={busy || !items.length}
        >
          {T("提交申请", "Submit request")}
        </button>
      }
    >
      <form
        id="purchase-request"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError("");
          const f = new FormData(e.currentTarget);
          try {
            await submit({
              customer,
              items,
              type: f.get("type"),
              currency,
              address: f.get("address"),
              eta: f.get("eta"),
              note: f.get("note"),
            });
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="notice-box">
          {T(
            "申请不是正式订单；确认已审批并发布的报价后才生成订单。",
            "A request is not an order. Accept an approved, published quotation to create an order.",
          )}
        </div>
        <div className="form-grid">
          {!portal && (
            <label>
              {T("客户", "Customer")}
              <select
                value={customer}
                onChange={(e) => {
                  setCustomer(e.target.value);
                  setCurrency(
                    customers.find((c) => c.id === e.target.value)?.currency ||
                      "CNY",
                  );
                }}
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            {T("申请类型", "Request type")}
            <select name="type">
              <option value="inquiry">{T("询价", "Inquiry")}</option>
              <option value="order_request">
                {T("订单申请", "Order request")}
              </option>
            </select>
          </label>
          <label>
            {T("币种", "Currency")}
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
            >
              <option>CNY</option>
              <option>USD</option>
            </select>
          </label>
          <label>
            {T("期望交期", "Requested delivery")}
            <input
              name="eta"
              type="date"
              required
              defaultValue={new Date(businessNow().getTime() + 30 * 86400000)
                .toISOString()
                .slice(0, 10)}
            />
          </label>
          <label className="full">
            {T("收货地址", "Delivery address")}
            <input
              key={customer}
              name="address"
              required
              defaultValue={
                customers.find((c) => c.id === customer)?.address || ""
              }
            />
          </label>
        </div>
        <h3>{T("商品清单", "Requested products")}</h3>
        {items.map((i, index) => {
          const p = products.find((p) => p.id === i.product);
          return (
            <div className="request-line" key={index}>
              <select
                aria-label="商品 / Product"
                value={i.product}
                onChange={(e) => {
                  const p = products.find((p) => p.id === e.target.value)!;
                  setItems(
                    items.map((v, n) =>
                      n === index ? { product: p.id, qty: p.moq } : v,
                    ),
                  );
                }}
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sku} · {en ? p.en : p.name}
                  </option>
                ))}
              </select>
              <label>
                {T("数量", "Quantity")} · MOQ {p?.moq}
                <input
                  type="number"
                  min={p?.moq || 1}
                  step="1"
                  required
                  value={i.qty}
                  onChange={(e) =>
                    setItems(
                      items.map((v, n) =>
                        n === index ? { ...v, qty: Number(e.target.value) } : v,
                      ),
                    )
                  }
                />
              </label>
              <span>
                {fmt(
                  i.qty * (currency === "USD" ? p?.usd : p?.price),
                  currency,
                )}
              </span>
              <button
                type="button"
                className="icon-btn"
                aria-label="移除商品 / Remove"
                onClick={() => setItems(items.filter((_, n) => n !== index))}
              >
                <X size={16} />
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className="btn"
          onClick={() => {
            const p = products.find(
              (p) => !items.some((i) => i.product === p.id),
            );
            if (p) setItems([...items, { product: p.id, qty: p.moq }]);
          }}
        >
          <Plus size={16} />
          {T("增加商品", "Add product")}
        </button>
        <p>
          {T(
            "参考合计（以正式报价为准）",
            "Reference total (subject to quotation)",
          )}
          :{" "}
          {fmt(
            items.reduce((s, i) => {
              const p = products.find((p) => p.id === i.product);
              return s + i.qty * (currency === "USD" ? p?.usd : p?.price);
            }, 0),
            currency,
          )}
        </p>
        <label>
          {T("包装、定制及其他要求", "Packaging, customization & notes")}
          <textarea name="note" />
        </label>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export function DataCenter({
  onOpen,
  onImport,
}: {
  onOpen: (kind: string, id: string) => void;
  onImport: (kind: string) => void;
}) {
  const [q, setQ] = useState(""),
    [results, setResults] = useState<any[]>([]),
    [error, setError] = useState("");
  return (
    <>
      <form
        className="crm-toolbar card"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const r = await fetch("/api/v1/search?q=" + encodeURIComponent(q)),
              v = await r.json();
            if (!r.ok) throw Error(v.message);
            setResults(v);
            setError("");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <Search />
        <input
          aria-label="全局搜索"
          placeholder="客户、商品、报价、订单编号…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn primary">搜索</button>
      </form>
      {error && <p role="alert">{error}</p>}
      <Table
        heads={["类型", "名称 / 编号", "说明", "操作"]}
        rows={results.map((r) => [
          r.kind,
          r.title,
          r.description,
          <button className="btn" onClick={() => onOpen(r.kind, r.id)}>
            查看
          </button>,
        ])}
      />
      <div className="introcard">
        <small>SHARED DATA / TRUSTED SOURCE</small>
        <h2>数据不只存起来，更要用起来。</h2>
        <p>
          产品资料内部共享，客户按负责人授权，成本独立分级。检索、导出与附件均遵循当前账号权限。
        </p>
      </div>
      <div className="data-cards">
        {[
          ["products", "商品与销售价格"],
          ["customers", "客户基础档案"],
          ["orders", "销售订单台账"],
        ].map(([key, title]) => (
          <section className="card" key={key}>
            <h3>{title}</h3>
            <div className="actions">
              <a className="btn" href={"/api/v1/export/" + key}>
                导出 CSV
              </a>
              <a className="btn" href={"/api/v1/templates/" + key}>
                字段模板
              </a>
              {key !== "orders" && (
                <button className="btn" onClick={() => onImport(key)}>
                  导入预检
                </button>
              )}
            </div>
            {key === "orders" && (
              <p className="muted">
                历史订单模板供映射核对；正式导入另行验收。
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
