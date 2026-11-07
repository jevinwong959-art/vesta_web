import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Users,
  Package,
  FileText,
  Truck,
  Wallet,
  Bell,
  Settings,
  ArrowUpRight,
  Plus,
  Search,
  RefreshCw,
  LogOut,
  ChevronRight,
  Globe,
  X,
  Check,
  Shield,
  Download,
  Clock,
  Layers,
  Mail,
  Activity,
  Menu,
} from "lucide-react";
import "./style.css";

type Row = { id: string; [key: string]: any };
type User = {
  id: string;
  name: string;
  role: string;
  customer?: string;
  csrf: string;
};
type Field = {
  key: string;
  label: string;
  type?: string;
  options?: { value: string; label: string }[];
  value?: any;
  required?: boolean;
};
type Form = {
  title: string;
  fields: Field[];
  submit: (v: any) => Promise<any>;
  quote?: boolean;
  items?: any[];
  allocations?: { order: string; amount: number }[];
};
const ruleNames: Record<string, string> = {
  orderDays: "订单跟进周期（天）",
  quoteDays: "报价跟进周期（天）",
  customerProspect: "未成交客户维护（天）",
  customerActive: "已成交客户维护（天）",
  escalationDays: "逾期升级间隔（天）",
  approvalHours: "审批时限（小时）",
  riskAmount: "风险金额阈值（CNY）",
  discount: "折扣审批阈值（0–1）",
  margin: "毛利审批阈值（0–1）",
  depositPct: "预付款审批阈值（%）",
};
const money = (n: any, c = "CNY") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: c }).format(
    Number(n || 0),
  );
const today = () => new Date().toISOString().slice(0, 10);
const future = (n = 30) =>
  new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const statuses: Record<string, string> = {
  new: "待受理",
  draft: "草稿",
  pending: "待审批 / 核实",
  approved: "已批准",
  accepted: "已接受",
  rejected: "已退回",
  confirmed: "履约中",
  completed: "已完成",
  verified: "已核实",
  reversed: "已冲正",
  signed: "已签署",
  captured: "本地已捕获",
};
const roles: Record<string, string> = {
  owner: "经营负责人",
  manager: "销售经理",
  sales: "销售人员",
  finance: "财务人员",
  warehouse: "生产 / 仓储",
  admin: "系统管理员",
  customer: "客户门户",
};
const navigation = [
  ["dashboard", "经营总览", "Overview", LayoutDashboard],
  ["customers", "客户与跟进", "Customers", Users],
  ["products", "产品与价格", "Products", Package],
  ["inquiries", "采购需求", "Requests", Mail],
  ["quotes", "报价与审批", "Quotations", FileText],
  ["orders", "订单履约", "Orders", Truck],
  ["receipts", "回款管理", "Payments", Wallet],
  ["inventory", "库存台账", "Inventory", Layers],
  ["contracts", "合同档案", "Contracts", FileText],
  ["notifications", "待办与提醒", "Notifications", Bell],
  ["rates", "参考汇率", "Exchange rates", Globe],
  ["mails", "邮件捕获", "Mail capture", Mail],
  ["audits", "操作审计", "Audit trail", Activity],
  ["settings", "权限与设置", "Settings", Settings],
] as const;
function App() {
  const [user, setUser] = useState<User | null>(null),
    [ready, setReady] = useState(false),
    [page, setPage] = useState("dashboard"),
    [lang, setLang] = useState("zh"),
    [data, setData] = useState<Record<string, Row[]>>({}),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [query, setQuery] = useState(""),
    [form, setForm] = useState<Form | null>(null),
    [importKind, setImportKind] = useState<string | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [mobile, setMobile] = useState(false);
  const en = lang === "en",
    T = (zh: string, english: string) => (en ? english : zh);
  const portal = user?.role === "customer",
    sales = ["owner", "manager", "sales"].includes(user?.role || ""),
    finance = user?.role === "finance",
    warehouse = user?.role === "warehouse";
  async function api(path: string, body?: any) {
    const r = await fetch("/api/v1/" + path, {
      method: body === undefined ? "GET" : "POST",
      headers:
        body === undefined
          ? {}
          : {
              "Content-Type": "application/json",
              "X-CSRF-Token": user?.csrf || "",
            },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await r.json();
    if (!r.ok) {
      if (r.status === 401 && path !== "login") setUser(null);
      throw new Error(payload.message || "Request failed");
    }
    return payload;
  }
  async function load() {
    if (!user) return;
    const kinds =
      user.role === "admin"
        ? ["settings", "mails"]
        : portal
          ? [
              "customers",
              "products",
              "inquiries",
              "quotes",
              "orders",
              "shipments",
              "contracts",
              "notifications",
            ]
          : warehouse
            ? [
                "customers",
                "products",
                "orders",
                "shipments",
                "contracts",
                "ledger",
                "adjustments",
                "notifications",
              ]
            : [
                "customers",
                "products",
                "inquiries",
                "quotes",
                "orders",
                "receipts",
                "shipments",
                "contracts",
                "follows",
                "rates",
                "ledger",
                "adjustments",
                "notifications",
                ...(["owner", "manager", "finance"].includes(user.role)
                  ? ["settings", "mails"]
                  : []),
                ...(user.role === "owner" ? ["audits"] : []),
              ];
    const result = await Promise.all(
      kinds.map(async (k) => [k, await api("data/" + k)]),
    );
    const next = Object.fromEntries(result);
    if (["admin", "owner"].includes(user.role)) next.users = await api("users");
    if (user.role === "admin")
      next.customerDirectory = await api("customer-directory");
    if (["owner", "manager"].includes(user.role))
      next.salesDirectory = await api("sales-directory");
    setData(next);
  }
  useEffect(() => {
    fetch("/api/v1/me")
      .then(async (r) => {
        if (r.ok && !new URLSearchParams(location.search).has("reset"))
          setUser(await r.json());
      })
      .finally(() => setReady(true));
  }, []);
  useEffect(() => {
    if (user) load().catch((e) => setError(e.message));
  }, [user]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  async function run(name: string, payload: any) {
    setBusy(true);
    setError("");
    try {
      const r = await api("actions/" + name, payload);
      await load();
      setNotice(T("已保存，业务记录已更新。", "Saved successfully."));
      return r;
    } catch (e) {
      setError((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }
  const perform = (name: string, payload: any) => {
    void run(name, payload)
      .then(() => setDetail(null))
      .catch(() => {});
  };
  const rows = (kind: string) => data[kind] || [];
  const customer = (id: string) => {
    const c = rows("customers").find((c) => c.id === id);
    return c ? (en ? c.en : c.name) : id;
  };
  const productOptions = rows("products").map((p) => ({
    value: p.id,
    label: `${p.sku} · ${en ? p.en : p.name}`,
  }));
  const customerOptions = rows("customers").map((c) => ({
    value: c.id,
    label: en ? c.en : c.name,
  }));
  const orderOptions = rows("orders").map((o) => ({
    value: o.id,
    label: `${o.id} · ${customer(o.customer)}`,
  }));
  function openForm(
    title: string,
    fields: Field[],
    name: string,
    extra: any = {},
  ) {
    setDetail(null);
    setForm({ title, fields, submit: (v) => run(name, { ...extra, ...v }) });
  }
  function createCustomer(c?: Row) {
    openForm(
      T("客户档案", "Customer profile"),
      [
        { key: "name", label: "公司名称", value: c?.name },
        { key: "en", label: "Company name (English)", value: c?.en },
        { key: "country", label: "国家 / Region", value: c?.country },
        { key: "contact", label: "联系人 / Contact", value: c?.contact },
        { key: "email", label: "Email", type: "email", value: c?.email },
        { key: "address", label: "地址 / Address", value: c?.address },
        ...(["owner", "manager"].includes(user?.role || "")
          ? [
              {
                key: "owner",
                label: "业务负责人",
                options: rows("salesDirectory").map((s) => ({
                  value: s.id,
                  label: s.name,
                })),
                value: c?.owner || "sales",
              },
            ]
          : []),
        {
          key: "currency",
          label: "币种 / Currency",
          options: ["USD", "CNY"].map((v) => ({ value: v, label: v })),
          value: c?.currency,
        },
      ],
      "customer-save",
      c ? { id: c.id } : {},
    );
  }
  function createProduct(p?: Row) {
    openForm(
      T("产品资料", "Product details"),
      [
        { key: "sku", label: "SKU", value: p?.sku },
        { key: "name", label: "中文名称", value: p?.name },
        { key: "en", label: "English name", value: p?.en },
        { key: "category", label: "分类 / Category", value: p?.category },
        { key: "moq", label: "MOQ", type: "number", value: p?.moq || 100 },
        { key: "price", label: "CNY", type: "number", value: p?.price || 0 },
        { key: "usd", label: "USD", type: "number", value: p?.usd || 0 },
        ...(user?.role === "owner"
          ? [
              {
                key: "cost",
                label: "成本 CNY（受限）",
                type: "number",
                value: p?.cost || 0,
              },
            ]
          : []),
        {
          key: "lead",
          label: "交期（天）",
          type: "number",
          value: p?.lead || 15,
        },
      ],
      "product-save",
      p ? { id: p.id } : {},
    );
  }
  function inquiry(p?: Row) {
    openForm(
      T("提交采购需求", "Submit purchase request"),
      [
        ...(!portal
          ? [{ key: "customer", label: "客户", options: customerOptions }]
          : []),
        {
          key: "product",
          label: T("商品", "Product"),
          options: productOptions,
          value: p?.id,
        },
        {
          key: "qty",
          label: T("采购数量", "Quantity"),
          type: "number",
          value: p?.moq || 100,
        },
        {
          key: "eta",
          label: T("期望交期", "Requested delivery"),
          type: "date",
          value: future(),
        },
        {
          key: "note",
          label: T("包装、定制等要求", "Packaging / customization"),
          type: "textarea",
          required: false,
        },
      ],
      "inquiry-create",
    );
  }
  function quote(q?: Row, source?: Row) {
    setDetail(null);
    setForm({
      title: T(
        q ? "编辑 / 修订报价" : "新建报价",
        q ? "Edit / revise quotation" : "New quotation",
      ),
      quote: true,
      items: q?.items || [
        {
          product: source?.product || rows("products")[0]?.id,
          qty: source?.qty || 100,
          price: 6.8,
        },
      ],
      fields: [
        {
          key: "customer",
          label: "客户 / Customer",
          options: customerOptions,
          value: q?.customer || source?.customer,
        },
        {
          key: "currency",
          label: "币种 / Currency",
          options: ["USD", "CNY"].map((v) => ({ value: v, label: v })),
          value: q?.currency,
        },
        {
          key: "depositPct",
          label: "预付款 %",
          type: "number",
          value: q?.depositPct ?? 30,
        },
        {
          key: "valid",
          label: "有效期至 / Valid until",
          type: "date",
          value: q?.valid || future(14),
        },
        {
          key: "eta",
          label: "交期 / Delivery",
          type: "date",
          value: q?.eta || future(),
        },
        {
          key: "freight",
          label: "运费 / Freight",
          type: "number",
          value: q?.freight || 0,
        },
        {
          key: "fees",
          label: "其他费用 / Other fees",
          type: "number",
          value: q?.fees || 0,
        },
        {
          key: "discount",
          label: "优惠金额 / Discount",
          type: "number",
          value: q?.discount || 0,
        },
        {
          key: "fxId",
          label: "汇率版本 / FX version",
          required: false,
          options: [
            { value: "", label: "最新参考值 / Latest reference" },
            ...rows("rates").map((r) => ({
              value: r.id,
              label: `${r.date} · ${r.rate} · ${r.source}`,
            })),
          ],
          value: q?.fx?.id || "",
        },
        { key: "terms", label: "贸易条款 / Terms", value: q?.terms || "FOB" },
        { key: "port", label: "装运港 / Port", value: q?.port || "Shanghai" },
        {
          key: "destination",
          label: "目的地 / Destination",
          value: q?.destination || "",
        },
        {
          key: "note",
          label: "对客说明 / Notes",
          type: "textarea",
          required: false,
          value: q?.note || "",
        },
      ],
      submit: (v) =>
        run("quote-save", {
          ...v,
          inquiry: source?.id || q?.inquiry,
          fxId: v.fxId || undefined,
          ...(q
            ? q.status === "draft"
              ? { id: q.id }
              : { revisionOf: q.id }
            : {}),
        }),
    });
  }
  function receipt(o?: Row) {
    setDetail(null);
    setForm({
      title: T("提交回款线索", "Record receipt"),
      allocations: [
        {
          order: o?.id || orderOptions[0]?.value || "",
          amount: o ? Math.max(0, o.total - o.paid) : 0,
        },
      ],
      fields: [
        {
          key: "currency",
          label: "币种",
          options: ["USD", "CNY"].map((v) => ({ value: v, label: v })),
          value: o?.currency,
        },
        {
          key: "amount",
          label: "金额 / Amount",
          type: "number",
          value: o ? Math.max(0, o.total - o.paid) : 0,
        },
        { key: "transaction", label: "银行交易号 / Transaction ID" },
        { key: "note", label: "说明 / Note", type: "textarea" },
      ],
      submit: (v) =>
        run("receipt-create", {
          transaction: v.transaction,
          currency: v.currency,
          amount: v.amount,
          note: v.note,
          allocations: v.allocations,
        }),
    });
  }
  function batch(o: Row, ship: boolean) {
    openForm(
      ship ? "登记分批发运 / Ship batch" : "登记分批生产入库 / Produce batch",
      [
        {
          key: "product",
          label: "商品 / Product",
          options: o.items.map((i: any) => ({
            value: i.product,
            label: `${i.sku} · ${i.produced}/${i.qty} produced, ${i.shipped} shipped`,
          })),
        },
        {
          key: "qty",
          label: "本批数量 / Batch quantity",
          type: "number",
          value: 1,
        },
        ...(ship
          ? [
              { key: "carrier", label: "承运商 / Carrier" },
              { key: "tracking", label: "运单 / Tracking" },
            ]
          : []),
      ],
      ship ? "order-ship" : "order-produce",
      { id: o.id, key: crypto.randomUUID() },
    );
  }
  function follow(c: Row) {
    openForm(
      "记录跟进 / Follow up",
      [
        { key: "note", label: "跟进内容 / Note", type: "textarea" },
        {
          key: "next",
          label: "下次跟进 / Next follow-up",
          type: "date",
          value: future(7),
        },
      ],
      "follow-create",
      { customer: c.id },
    );
  }
  const allowed = (id: string) =>
    user?.role === "admin"
      ? ["settings", "mails"].includes(id)
      : portal
        ? [
            "dashboard",
            "products",
            "inquiries",
            "quotes",
            "orders",
            "contracts",
            "notifications",
          ].includes(id)
        : warehouse
          ? [
              "dashboard",
              "products",
              "orders",
              "inventory",
              "notifications",
            ].includes(id)
          : id === "audits"
            ? user?.role === "owner"
            : id === "mails"
              ? ["owner", "manager", "finance"].includes(user?.role || "")
              : id === "settings"
                ? ["owner", "manager", "finance"].includes(user?.role || "")
                : true;
  const go = (id: string) => {
    setPage(id);
    setQuery("");
    setDetail(null);
    setMobile(false);
  };
  const filtered = (kind: string) =>
    rows(kind).filter((r) =>
      JSON.stringify(r).toLowerCase().includes(query.toLowerCase()),
    );
  const title = navigation.find((n) => n[0] === page);
  if (!ready) return <div className="loading">VESTA · Loading workspace…</div>;
  if (!user)
    return (
      <Login
        onLogin={async (v) => {
          setError("");
          try {
            setUser(await api("login", v));
            setPage(v.username === "admin" ? "settings" : "dashboard");
          } catch (e) {
            setError((e as Error).message);
          }
        }}
        error={error}
      />
    );
  const btn = (label: string, onClick: () => void, primary = false) => (
    <button
      disabled={busy}
      className={primary ? "btn primary" : "btn"}
      onClick={onClick}
    >
      {label}
    </button>
  );
  const badge = (status: string) => (
    <span className={"badge " + status}>
      {en ? status : statuses[status] || status}
    </span>
  );
  const table = (heads: string[], body: React.ReactNode[][]) => (
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
        </tbody>
      </table>
      {!body.length && (
        <div className="empty">
          <Layers size={32} />
          <h3>{T("这里还没有业务记录", "No records yet")}</h3>
          <p>
            {T(
              "从创建第一条记录开始，进度会在这里汇总。",
              "Create your first record to get started.",
            )}
          </p>
        </div>
      )}
    </div>
  );
  const showMoney = !["warehouse", "admin"].includes(user.role);
  return (
    <div className="workspace">
      <aside className={mobile ? "sidebar mobile-open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go("dashboard");
          }}
        >
          <span className="brand-symbol">V</span>
          <div>
            VESTA<small>TRADE WORKSPACE</small>
          </div>
        </a>
        <div className="nav-caption">
          {portal ? "CUSTOMER PORTAL" : "BUSINESS OPERATIONS"}
        </div>
        <nav>
          {navigation
            .filter((n) => allowed(n[0]))
            .map(([id, zh, eng, Icon]) => (
              <button
                key={id}
                className={page === id ? "nav-item active" : "nav-item"}
                onClick={() => go(id)}
              >
                <Icon size={18} />
                <span>{T(zh, eng)}</span>
                {id === "notifications" &&
                  rows("notifications").some((n) => !n.read) && <i />}
              </button>
            ))}
        </nav>
        <div className="side-foot">
          <div className="local-label">
            <span />
            LOCAL DEMO <small>仅本地 · 虚构数据</small>
          </div>
          <div className="profile">
            <span className="avatar">{user.name.slice(0, 1)}</span>
            <div>
              <strong>{user.name}</strong>
              <small>{roles[user.role]}</small>
            </div>
            <button
              aria-label="退出登录"
              className="icon-btn"
              onClick={() => {
                void api("logout", {})
                  .then(() => {
                    setUser(null);
                    setData({});
                  })
                  .catch((e) => setError(e.message));
              }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-btn mobile-toggle"
              aria-label="打开导航菜单"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>{portal ? "Customer portal" : "Workspace"}</span>
            <ChevronRight size={14} />
            <strong>{T(title?.[1] || "", title?.[2] || "")}</strong>
          </div>
          <div className="top-actions">
            <span className="connection">
              <i />
              {T("本地数据库已连接", "Local database connected")}
            </span>
            <button
              className="btn compact"
              onClick={() => setLang(en ? "zh" : "en")}
            >
              <Globe size={15} />
              {en ? "中文" : "EN"}
            </button>
            <button
              className="icon-btn"
              aria-label="刷新"
              onClick={() => load().catch((e) => setError(e.message))}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <div className="content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                VESTA / {portal ? "CUSTOMER EXPERIENCE" : "SALES OPERATIONS"}
              </div>
              <h1>{T(title?.[1] || "", title?.[2] || "")}</h1>
              <p>
                {T(
                  "从每一次询价，到每一份如期交付。",
                  "From the first inquiry to every delivery on time.",
                )}
              </p>
            </div>
            <div className="heading-actions">
              {page === "settings" &&
                user.role === "admin" &&
                btn(
                  "+ 创建账号",
                  () =>
                    setForm({
                      title: "创建本地账号",
                      fields: [
                        { key: "username", label: "登录账号（小写字母开头）" },
                        { key: "name", label: "显示姓名" },
                        {
                          key: "role",
                          label: "角色",
                          options: [
                            { value: "sales", label: "销售" },
                            { value: "customer", label: "客户门户" },
                            { value: "finance", label: "财务" },
                            { value: "warehouse", label: "仓储" },
                          ],
                        },
                        {
                          key: "customer",
                          label: "关联客户公司（客户账号必选）",
                          required: false,
                          options: [
                            { value: "", label: "员工账号无需选择" },
                            ...rows("customerDirectory").map((c) => ({
                              value: c.id,
                              label: c.name,
                            })),
                          ],
                        },
                        {
                          key: "password",
                          label: "初始密码（至少10位）",
                          type: "password",
                          value: "VestaDemo2026!",
                        },
                      ],
                      submit: async (v) => {
                        const r = await api("users", v);
                        await load();
                        setNotice("账号已创建，本地邀请已捕获");
                        return r;
                      },
                    }),
                  true,
                )}
              {portal &&
                btn(T("修改联系资料", "Edit contact details"), () => {
                  const c = rows("customers")[0];
                  if (c)
                    openForm(
                      T("联系资料", "Contact details"),
                      [
                        {
                          key: "contact",
                          label: "联系人 / Contact",
                          value: c.contact,
                        },
                        {
                          key: "email",
                          label: "Email",
                          type: "email",
                          value: c.email,
                        },
                        {
                          key: "address",
                          label: "地址 / Address",
                          value: c.address,
                        },
                        {
                          key: "phone",
                          label: "电话 / Phone",
                          value: c.phone || "",
                          required: false,
                        },
                      ],
                      "customer-profile",
                    );
                })}
              {page === "customers" &&
                sales &&
                btn("+ 新增客户", () => createCustomer(), true)}
              {page === "products" &&
                ["owner", "manager"].includes(user.role) &&
                btn("+ 新增产品", () => createProduct(), true)}
              {page === "inquiries" &&
                (sales || portal) &&
                btn(T("+ 采购需求", "+ New request"), () => inquiry(), true)}
              {page === "quotes" &&
                sales &&
                btn("+ 新建报价", () => quote(), true)}
              {page === "receipts" &&
                (sales || finance) &&
                btn("+ 登记回款", () => receipt(), true)}
              {page === "rates" &&
                finance &&
                btn("立即查询参考汇率", () => perform("fx-refresh", {}), true)}
            </div>
          </div>
          {error && (
            <div role="alert" className="alert error">
              <span>{error}</span>
              <button onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div role="status" className="toast">
              <Check size={16} />
              {notice}
            </div>
          )}
          {page === "dashboard" && (
            <>
              <section className="welcome">
                <div>
                  <span className="eyebrow">
                    A CLEARER VIEW OF YOUR BUSINESS
                  </span>
                  <h2>
                    {T(
                      "让每一笔业务，有迹可循。",
                      "Every order. A clear way forward.",
                    )}
                  </h2>
                  <p>
                    {T(
                      "报价、交付与回款，汇聚在同一个工作空间。",
                      "Quotations, deliveries and payments in one workspace.",
                    )}
                  </p>
                  <button
                    className="welcome-link"
                    onClick={() => go(portal ? "products" : "quotes")}
                  >
                    {T(
                      portal ? "浏览产品目录" : "进入报价工作台",
                      portal
                        ? "Explore the catalogue"
                        : "Open quotation workspace",
                    )}{" "}
                    <ArrowUpRight size={18} />
                  </button>
                </div>
                <div className="orbit">
                  <div>
                    V
                    <span>
                      GLOBAL TRADE
                      <br />
                      LOCAL CONNECTIONS
                    </span>
                  </div>
                </div>
              </section>
              <div className="metrics">
                {[
                  [
                    T("客户档案", "Customers"),
                    rows("customers").length,
                    "customers",
                    Users,
                  ],
                  [
                    T("进行中报价", "Open quotations"),
                    rows("quotes").filter((q) =>
                      ["draft", "pending", "approved"].includes(q.status),
                    ).length,
                    "quotes",
                    FileText,
                  ],
                  [
                    T("履约中订单", "Active orders"),
                    rows("orders").filter((o) => o.status === "confirmed")
                      .length,
                    "orders",
                    Truck,
                  ],
                  [
                    T("未读提醒", "Unread notices"),
                    rows("notifications").filter((n) => !n.read).length,
                    "notifications",
                    Bell,
                  ],
                ].map(([label, n, id, Icon]: any) => (
                  <button key={id} className="metric" onClick={() => go(id)}>
                    <span className="metric-icon">
                      <Icon size={21} />
                    </span>
                    <span className="metric-label">{label}</span>
                    <strong>
                      {n}
                      <small>{T("条", "records")}</small>
                    </strong>
                    <span className="metric-hint">
                      {T("查看业务明细", "View details")}{" "}
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="card">
                  <div className="card-head">
                    <div>
                      <h3>{T("最新订单", "Recent orders")}</h3>
                      <small>
                        {T(
                          "交付进度与资金状态分别记录",
                          "Delivery and payment tracked independently",
                        )}
                      </small>
                    </div>
                    <button className="link" onClick={() => go("orders")}>
                      {T("全部订单", "View all")} →
                    </button>
                  </div>
                  {table(
                    [
                      T("订单 / 客户", "Order / Customer"),
                      T("状态", "Status"),
                      showMoney
                        ? T("订单金额", "Amount")
                        : T("交期", "Delivery"),
                    ],
                    rows("orders")
                      .slice(-5)
                      .reverse()
                      .map((o) => [
                        <button
                          className="link"
                          onClick={() => {
                            go("orders");
                            setDetail(o);
                          }}
                        >
                          {o.id}
                          <small className="sub">{customer(o.customer)}</small>
                        </button>,
                        badge(o.status),
                        showMoney ? money(o.total, o.currency) : o.eta,
                      ]),
                  )}
                </section>
                <section className="card">
                  <div className="card-head">
                    <h3>{T("工作提示", "Workspace notes")}</h3>
                    <Clock size={18} />
                  </div>
                  <div className="tips">
                    <div>
                      <span className="tip-index">01</span>
                      <h4>
                        {T("每个账号，独立权限", "Every account has its scope")}
                      </h4>
                      <p>
                        {T(
                          "真实后端校验，客户仅查看所属公司的记录。",
                          "Customer records are protected by server-side authorization.",
                        )}
                      </p>
                    </div>
                    <div>
                      <span className="tip-index">02</span>
                      <h4>
                        {T(
                          "历史报价，保持原样",
                          "Historical quotations stay intact",
                        )}
                      </h4>
                      <p>
                        {T(
                          "自动参考汇率不会改写已冻结的报价与订单。",
                          "Exchange rate updates never rewrite frozen quotations.",
                        )}
                      </p>
                    </div>
                    <div className="notice-box">
                      {T(
                        "这是本地 Demo。关闭后端后，后台任务会暂停；重新启动时补查。",
                        "Local Demo: background jobs pause when the server stops and catch up on restart.",
                      )}
                    </div>
                  </div>
                </section>
              </div>
              {showMoney && (
                <div className="currency-summary">
                  {["USD", "CNY"].map((c) => (
                    <div key={c}>
                      <small>
                        {c} ·{" "}
                        {T("已确认订单 / 待回款", "Confirmed / Outstanding")}
                      </small>
                      <strong>
                        {money(
                          rows("orders")
                            .filter((o) => o.currency === c)
                            .reduce((s, o) => s + o.total, 0),
                          c,
                        )}{" "}
                        <span>
                          /{" "}
                          {money(
                            rows("orders")
                              .filter((o) => o.currency === c)
                              .reduce((s, o) => s + o.total - o.paid, 0),
                            c,
                          )}
                        </span>
                      </strong>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
          {page !== "dashboard" && (
            <div className="toolbar">
              <div className="search">
                <Search size={16} />
                <input
                  aria-label="搜索"
                  placeholder={T("搜索当前记录…", "Search records…")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <span className="muted">
                {T(
                  "数据以当前账号权限为准",
                  "Records reflect your access permissions",
                )}
              </span>
              {["customers", "products", "quotes", "orders"].includes(page) &&
                showMoney &&
                !portal && (
                  <a className="btn" href={"/api/v1/export/" + page}>
                    <Download size={15} />
                    CSV
                  </a>
                )}
              {((page === "customers" && sales) ||
                (page === "products" &&
                  ["owner", "manager"].includes(user.role))) && (
                <button className="btn" onClick={() => setImportKind(page)}>
                  导入 CSV
                </button>
              )}
            </div>
          )}
          {page === "products" && (
            <div className="product-grid">
              {filtered("products").map((p, i) => (
                <article className="product-card" key={p.id}>
                  <div className={"product-art art-" + (i % 6)}>
                    <Package size={64} strokeWidth={1} />
                    <span>{p.sku}</span>
                  </div>
                  <div className="product-info">
                    <small>{p.category}</small>
                    <h3>{en ? p.en : p.name}</h3>
                    <p>{en ? p.name : p.en}</p>
                    <div className="product-meta">
                      <span>
                        MOQ <strong>{p.moq}</strong>
                      </span>
                      <span>
                        {T("交期", "Lead time")} <strong>{p.lead}d</strong>
                      </span>
                    </div>
                    {showMoney && (
                      <div className="product-price">
                        {money(p.usd, "USD")}{" "}
                        <small>
                          {money(p.price)} / {T("件", "unit")}
                        </small>
                      </div>
                    )}
                    {user.role === "owner" && (
                      <small className="muted">
                        成本 CNY {p.cost ?? "待核价"}
                      </small>
                    )}
                    <div className="card-actions">
                      {(portal || sales) &&
                        btn(
                          T("发起询价", "Request a quote"),
                          () => inquiry(p),
                          true,
                        )}
                      {["owner", "manager"].includes(user.role) &&
                        btn("编辑", () => createProduct(p))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          {page === "customers" && (
            <section className="card">
              {table(
                ["客户 / 公司", "地区 / 联系人", "负责人", "币种", "操作"],
                filtered("customers").map((c) => [
                  <>
                    <strong>{c.name}</strong>
                    <small className="sub">{c.en}</small>
                  </>,
                  <>
                    {c.country}
                    <small className="sub">
                      {c.contact} · {c.email}
                    </small>
                  </>,
                  c.owner,
                  c.currency,
                  <div className="actions">
                    {sales && btn("跟进", () => follow(c))}
                    {sales && btn("编辑", () => createCustomer(c))}
                  </div>,
                ]),
              )}
            </section>
          )}
          {page === "customers" && sales && (
            <section className="card section-gap">
              <div className="card-head">
                <h3>跟进历史</h3>
              </div>
              {table(
                ["客户", "内容", "下次跟进", "记录时间"],
                rows("follows")
                  .slice()
                  .reverse()
                  .map((f) => [
                    customer(f.customer),
                    f.note,
                    f.next,
                    new Date(f.at).toLocaleString(),
                  ]),
              )}
            </section>
          )}
          {page === "inquiries" && (
            <section className="card">
              {table(
                [
                  T("需求编号", "Request"),
                  T("客户", "Customer"),
                  T("商品 / 数量", "Product / Quantity"),
                  T("交期", "Delivery"),
                  T("操作", "Action"),
                ],
                filtered("inquiries").map((i) => [
                  i.id,
                  customer(i.customer),
                  <>
                    {rows("products").find((p) => p.id === i.product)?.sku} ×{" "}
                    {i.qty}
                    <small className="sub">{i.note}</small>
                  </>,
                  i.eta,
                  sales
                    ? btn("创建报价", () => quote(undefined, i))
                    : badge(i.status),
                ]),
              )}
            </section>
          )}
          {page === "quotes" && (
            <section className="card">
              {table(
                [
                  T("报价 / 版本", "Quotation / Version"),
                  T("客户", "Customer"),
                  T("金额", "Amount"),
                  T("状态", "Status"),
                  T("有效期", "Valid until"),
                  T("操作", "Action"),
                ],
                filtered("quotes")
                  .slice()
                  .reverse()
                  .map((q) => [
                    <strong>
                      {q.id}
                      <small className="sub">V{q.revision}</small>
                    </strong>,
                    customer(q.customer),
                    money(q.total, q.currency),
                    badge(q.status),
                    q.valid,
                    btn(T("查看详情", "View details"), () => setDetail(q)),
                  ]),
              )}
            </section>
          )}
          {page === "orders" && (
            <section className="card">
              {table(
                [
                  T("订单", "Order"),
                  T("客户", "Customer"),
                  T("履约进度", "Fulfillment"),
                  ...(showMoney ? [T("金额 / 已收", "Amount / Paid")] : []),
                  T("操作", "Action"),
                ],
                filtered("orders")
                  .slice()
                  .reverse()
                  .map((o) => [
                    <strong>
                      {o.id}
                      <small className="sub">{o.eta}</small>
                    </strong>,
                    customer(o.customer),
                    <>
                      {badge(o.status)}
                      <small className="sub">
                        {o.items.reduce(
                          (s: number, i: any) => s + i.shipped,
                          0,
                        )}{" "}
                        / {o.items.reduce((s: number, i: any) => s + i.qty, 0)}{" "}
                        {T("已发货", "shipped")}
                      </small>
                    </>,
                    ...(showMoney
                      ? [
                          <>
                            {money(o.total, o.currency)}
                            <small className="sub">
                              {money(o.paid, o.currency)} {T("已收", "paid")}
                            </small>
                          </>,
                        ]
                      : []),
                    btn(T("查看详情", "View details"), () => setDetail(o)),
                  ]),
              )}
            </section>
          )}
          {page === "receipts" && (
            <section className="card">
              {table(
                ["交易号 / 单据", "客户", "金额", "状态", "操作"],
                filtered("receipts").map((r) => [
                  <>
                    {r.transaction}
                    <small className="sub">{r.id}</small>
                  </>,
                  customer(r.customer),
                  money(r.amount, r.currency),
                  badge(r.status),
                  <div className="actions">
                    {finance &&
                      r.status === "pending" &&
                      btn(
                        "核实到账",
                        () => perform("receipt-verify", { id: r.id }),
                        true,
                      )}
                    {finance &&
                      r.status === "verified" &&
                      btn("冲正", () =>
                        openForm(
                          "回款冲正",
                          [{ key: "reason", label: "冲正原因" }],
                          "receipt-reverse",
                          { id: r.id },
                        ),
                      )}
                  </div>,
                ]),
              )}
            </section>
          )}
          {page === "inventory" && (
            <>
              <section className="card">
                {table(
                  ["SKU / 商品", "实物库存", "预留", "可用", "操作"],
                  filtered("products").map((p) => [
                    <>
                      {p.sku}
                      <small className="sub">{p.name}</small>
                    </>,
                    p.stock,
                    p.reserved,
                    p.stock - p.reserved,
                    warehouse
                      ? btn("申请调整", () =>
                          openForm(
                            "库存调整申请",
                            [
                              {
                                key: "qty",
                                label: "数量（增加填正数，减少填负数）",
                                type: "number",
                              },
                              { key: "reason", label: "调整依据" },
                            ],
                            "adjustment-create",
                            { product: p.id },
                          ),
                        )
                      : "—",
                  ]),
                )}
              </section>
              <section className="card section-gap">
                <div className="card-head">
                  <h3>库存调整审批</h3>
                </div>
                {table(
                  ["商品", "数量", "原因", "状态", "操作"],
                  rows("adjustments").map((r) => [
                    r.product,
                    r.qty,
                    r.reason,
                    badge(r.status),
                    user.role === "owner" && r.status === "pending"
                      ? btn("批准调整", () =>
                          perform("adjustment-approve", { id: r.id }),
                        )
                      : "—",
                  ]),
                )}
              </section>
              <section className="card section-gap">
                <div className="card-head">
                  <h3>库存流水</h3>
                </div>
                {table(
                  ["时间", "商品", "数量", "依据"],
                  rows("ledger")
                    .slice()
                    .reverse()
                    .map((r) => [
                      new Date(r.at).toLocaleString(),
                      r.product,
                      r.qty,
                      r.order || r.type,
                    ]),
                )}
              </section>
            </>
          )}
          {page === "rates" && (
            <>
              <div className="notice-box">
                每日参考汇率，不是银行成交价。查询时间与数据日期分别记录；已经提交的单据不会随更新重算。
              </div>
              <section className="card section-gap">
                {table(
                  ["版本 / 来源", "USD → CNY", "数据日期", "抓取时间", "操作"],
                  filtered("rates")
                    .slice()
                    .reverse()
                    .map((r) => [
                      <>
                        {r.id}
                        <small className="sub">
                          {r.source}
                          {r.simulated ? " · 模拟" : ""}
                          {r.invalid ? " · 数据日期异常（不可采用）" : ""}
                        </small>
                      </>,
                      <strong>{r.rate}</strong>,
                      r.date,
                      new Date(r.fetchedAt).toLocaleString(),
                      finance
                        ? btn("财务确认采用", () =>
                            openForm(
                              "确认旧参考值",
                              [{ key: "reason", label: "确认原因" }],
                              "fx-confirm",
                              { id: r.id },
                            ),
                          )
                        : "—",
                    ]),
                )}
              </section>
              {finance && (
                <div className="section-gap">
                  {btn("录入人工汇率", () =>
                    openForm(
                      "财务人工汇率",
                      [
                        { key: "rate", label: "1 USD = ? CNY", type: "number" },
                        {
                          key: "date",
                          label: "数据日期",
                          type: "date",
                          value: today(),
                        },
                        { key: "reason", label: "来源 / 指定原因" },
                      ],
                      "fx-manual",
                    ),
                  )}
                </div>
              )}
              {rows("settings").find((s) => s.id === "fx-status")?.error && (
                <div className="alert error section-gap">
                  上次查询失败：
                  {rows("settings").find((s) => s.id === "fx-status")?.error}
                  ；已保留旧值。
                </div>
              )}
            </>
          )}
          {page === "contracts" && (
            <>
              <div className="notice-box">
                {T(
                  "合同档案：仅上传 PDF，最大 5MB。签署状态是人工登记，不代表电子签章。",
                  "PDF archives only, up to 5MB. Signing status is recorded manually.",
                )}
              </div>
              {sales && (
                <ContractUpload
                  orders={orderOptions}
                  send={async (b) => {
                    await api("contracts", b);
                    await load();
                    setNotice("合同已保存");
                  }}
                  onError={setError}
                />
              )}
              <section className="card section-gap">
                {table(
                  [
                    T("合同", "Contract"),
                    T("订单", "Order"),
                    T("版本", "Version"),
                    T("状态", "Status"),
                    T("下载", "Download"),
                  ],
                  filtered("contracts").map((c) => [
                    c.name,
                    c.order,
                    "V" + c.version,
                    badge(c.status),
                    <a
                      className="btn"
                      href={"/api/v1/contracts/" + c.id + "/download"}
                    >
                      <Download size={14} />
                      PDF
                    </a>,
                  ]),
                )}
              </section>
            </>
          )}
          {page === "notifications" && (
            <>
              <div className="notice-box">
                {T(
                  "提醒由后端持续扫描。已读不会重置业务跟进时间。",
                  "Reminders run on the server. Reading does not reset follow-up dates.",
                )}
              </div>
              {["owner", "manager", "finance"].includes(user.role) && (
                <div className="section-gap">
                  {btn("立即扫描", () => perform("scan", {}))}
                </div>
              )}
              <section className="card section-gap">
                {table(
                  [
                    T("提醒", "Notification"),
                    T("关联记录", "Record"),
                    T("状态", "Status"),
                    T("操作", "Action"),
                  ],
                  filtered("notifications").map((n) => [
                    n.title,
                    n.entity,
                    n.read ? T("已读", "Read") : T("未读", "Unread"),
                    !n.read
                      ? btn(T("标记已读", "Mark as read"), () =>
                          perform("notification-read", { id: n.id }),
                        )
                      : "—",
                  ]),
                )}
              </section>
            </>
          )}
          {page === "mails" && (
            <>
              <div className="notice-box">
                本地邮件捕获箱。消息仅保存在本地数据库，未向真实邮箱发送。
              </div>
              <section className="card section-gap">
                {table(
                  ["收件账号", "主题", "正文", "时间"],
                  filtered("mails").map((m) => [
                    m.recipient,
                    m.subject,
                    m.body,
                    new Date(m.at).toLocaleString(),
                  ]),
                )}
              </section>
            </>
          )}
          {page === "audits" && (
            <section className="card">
              {table(
                ["时间", "操作人", "操作", "对象"],
                filtered("audits")
                  .slice()
                  .reverse()
                  .map((a) => [
                    new Date(a.at).toLocaleString(),
                    a.actor,
                    a.action,
                    a.entity,
                  ]),
              )}
            </section>
          )}
          {page === "settings" && (
            <>
              <div className="notice-box">
                真实登录与服务端权限已启用。本地演示账号使用虚构身份；正式上线前必须完成账户与安全验收。
              </div>
              {["admin", "owner"].includes(user.role) && (
                <section className="card section-gap">
                  {table(
                    ["账号", "姓名", "角色", "状态", "操作"],
                    rows("users").map((u) => [
                      u.username,
                      u.name,
                      roles[u.role],
                      u.active ? "启用" : "停用",
                      user.role === "admin" && u.id !== user.id
                        ? btn(u.active ? "停用并撤销登录" : "启用", () => {
                            void api("users/" + u.id + "/active", {
                              active: !u.active,
                            })
                              .then(load)
                              .catch((e) => setError(e.message));
                          })
                        : "—",
                    ]),
                  )}
                </section>
              )}
              <section className="card section-gap">
                <div className="card-head">
                  <h3>业务规则（当前配置）</h3>
                  {["owner", "manager"].includes(user.role) &&
                    btn("修改规则", () =>
                      openForm(
                        "业务规则",
                        Object.entries(
                          rows("settings").find((r) => r.id === "rules") || {},
                        )
                          .filter(([k]) => k !== "id")
                          .map(([key, value]) => ({
                            key,
                            label: ruleNames[key] || key,
                            type: "number",
                            value,
                          })),
                        "rules-save",
                      ),
                    )}
                </div>
                <div className="rule-grid">
                  {Object.entries(
                    rows("settings").find((r) => r.id === "rules") || {},
                  )
                    .filter(([k]) => k !== "id")
                    .map(([k, v]) => (
                      <div key={k}>
                        <small>{ruleNames[k] || k}</small>
                        <strong>{String(v)}</strong>
                      </div>
                    ))}
                </div>
              </section>
            </>
          )}
          <footer>
            VESTA TRADE WORKSPACE{" "}
            <span>
              {T(
                "本地演示 · 数据持久化于本机 · 未公开部署",
                "Local demonstration · Data stored locally · Not publicly deployed",
              )}
            </span>
          </footer>
        </div>
      </main>
      {importKind && (
        <ImportModal
          kind={importKind}
          api={api}
          onClose={() => setImportKind(null)}
          onDone={async () => {
            await load();
            setNotice("导入完成，数据已写入数据库");
          }}
        />
      )}
      {form && (
        <FormModal
          form={form}
          products={rows("products")}
          orders={orderOptions}
          onClose={() => setForm(null)}
          onError={setError}
          onSuccess={() => {
            setForm(null);
          }}
        />
      )}
      {detail && (
        <div className="modal-backdrop">
          <section className="modal wide">
            <div className="modal-head">
              <div>
                <small>{page === "quotes" ? "QUOTATION" : "SALES ORDER"}</small>
                <h2>{detail.id}</h2>
              </div>
              <button className="icon-btn" onClick={() => setDetail(null)}>
                <X />
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-summary">
                <div>
                  <small>{T("客户", "Customer")}</small>
                  <strong>{customer(detail.customer)}</strong>
                </div>
                <div>
                  <small>{T("状态", "Status")}</small>
                  {badge(detail.status)}
                </div>
                {showMoney && (
                  <div>
                    <small>{T("金额", "Amount")}</small>
                    <strong>{money(detail.total, detail.currency)}</strong>
                  </div>
                )}
                <div>
                  <small>{T("预计交期", "Delivery")}</small>
                  <strong>{detail.eta}</strong>
                </div>
              </div>
              {table(
                [
                  T("商品", "Product"),
                  T("数量", "Quantity"),
                  ...(showMoney ? [T("单价", "Price")] : []),
                  ...(page === "orders"
                    ? [
                        T(
                          "生产 / 发货 / 签收",
                          "Produced / Shipped / Delivered",
                        ),
                      ]
                    : []),
                ],
                detail.items.map((i: any) => [
                  en ? i.en : i.name,
                  i.qty,
                  ...(showMoney ? [money(i.price, detail.currency)] : []),
                  ...(page === "orders"
                    ? [`${i.produced} / ${i.shipped} / ${i.delivered}`]
                    : []),
                ]),
              )}
              {showMoney && detail.fx && (
                <div className="notice-box">
                  {T("锁定参考汇率", "Reference FX snapshot")}: 1 USD ={" "}
                  {detail.fx.rate} CNY · {detail.fx.date} · {detail.fx.source}
                </div>
              )}
              <p className="section-gap">{detail.note}</p>
              {page === "orders" && (
                <>
                  <div className="section-gap">
                    {showMoney && (
                      <strong>
                        {T("已核实回款", "Verified payments")}:{" "}
                        {money(detail.paid, detail.currency)} /{" "}
                        {money(detail.total, detail.currency)}
                      </strong>
                    )}
                  </div>
                  <h3 className="section-gap">{T("发运批次", "Shipments")}</h3>
                  {table(
                    [
                      T("运单", "Tracking"),
                      T("数量", "Quantity"),
                      T("签收", "Delivery"),
                    ],
                    rows("shipments")
                      .filter((s) => s.order === detail.id)
                      .map((s) => [
                        s.tracking,
                        s.qty,
                        s.delivered
                          ? T("已签收", "Delivered")
                          : warehouse
                            ? btn("登记签收", () =>
                                perform("shipment-deliver", { id: s.id }),
                              )
                            : T("运输中", "In transit"),
                      ]),
                  )}
                </>
              )}
              {detail.approvalLog?.length > 0 && (
                <div className="approval-log">
                  {detail.approvalLog.map((a: any, i: number) => (
                    <p key={i}>
                      {a.actor} · {a.approve ? "通过" : "退回"} · {a.note}
                    </p>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-actions">
              {page === "quotes" && sales && detail.status === "draft" && (
                <>
                  {btn("编辑草稿", () => quote(detail))}
                  {btn(
                    "提交审批",
                    () => perform("quote-submit", { id: detail.id }),
                    true,
                  )}
                </>
              )}
              {page === "quotes" &&
                detail.status === "pending" &&
                detail.approvers?.[detail.step] === user.id && (
                  <>
                    {btn(
                      "审批通过",
                      () =>
                        openForm(
                          "审批通过",
                          [{ key: "note", label: "审批意见" }],
                          "quote-decide",
                          { id: detail.id, approve: true },
                        ),
                      true,
                    )}
                    {btn("退回修改", () =>
                      openForm(
                        "退回报价",
                        [{ key: "note", label: "退回原因" }],
                        "quote-decide",
                        { id: detail.id, approve: false },
                      ),
                    )}
                  </>
                )}
              {page === "quotes" &&
                sales &&
                detail.status === "approved" &&
                !detail.published &&
                btn(
                  "发布给客户",
                  () => perform("quote-publish", { id: detail.id }),
                  true,
                )}
              {page === "quotes" &&
                sales &&
                ["rejected", "approved"].includes(detail.status) &&
                btn("创建修订版本", () => quote(detail))}
              {page === "quotes" &&
                portal &&
                detail.status === "approved" &&
                btn(
                  T("接受报价并生成订单", "Accept and create order"),
                  () => perform("quote-accept", { id: detail.id }),
                  true,
                )}
              {page === "quotes" &&
                showMoney &&
                btn(T("打印 / PDF", "Print / PDF"), () => window.print())}
              {page === "orders" && warehouse && (
                <>
                  {!detail.released ? (
                    btn(
                      "释放生产",
                      () => perform("order-release", { id: detail.id }),
                      true,
                    )
                  ) : (
                    <>
                      {btn("分批生产入库", () => batch(detail, false))}
                      {btn("分批发运", () => batch(detail, true), true)}
                    </>
                  )}
                </>
              )}
              {page === "orders" &&
                (sales || finance) &&
                btn("登记回款", () => receipt(detail), true)}
              {sales &&
                btn("记录跟进", () =>
                  openForm(
                    "单据跟进",
                    [
                      { key: "note", label: "跟进内容", type: "textarea" },
                      {
                        key: "next",
                        label: "下次跟进",
                        type: "date",
                        value: future(3),
                      },
                    ],
                    "follow-create",
                    {
                      customer: detail.customer,
                      kind: page,
                      entity: detail.id,
                    },
                  ),
                )}
              {page === "quotes" &&
                sales &&
                detail.status !== "accepted" &&
                btn("作废报价", () =>
                  openForm(
                    "作废报价",
                    [{ key: "reason", label: "作废原因" }],
                    "quote-void",
                    { id: detail.id },
                  ),
                )}
              {page === "orders" &&
                ["owner", "manager"].includes(user.role) &&
                detail.status === "confirmed" &&
                btn("取消未履约订单", () =>
                  openForm(
                    "取消订单",
                    [{ key: "reason", label: "取消原因" }],
                    "order-cancel",
                    { id: detail.id },
                  ),
                )}
              {page === "orders" &&
                ["owner", "manager"].includes(user.role) &&
                detail.status === "confirmed" &&
                btn("取消部分未生产数量", () =>
                  openForm(
                    "取消剩余数量",
                    [
                      {
                        key: "product",
                        label: "商品",
                        options: detail.items
                          .filter((i: any) => i.qty > i.produced)
                          .map((i: any) => ({
                            value: i.product,
                            label: `${i.sku} · 可取消 ${i.qty - i.produced}`,
                          })),
                      },
                      {
                        key: "qty",
                        label: "取消数量",
                        type: "number",
                        value: 1,
                      },
                      { key: "reason", label: "客户沟通依据 / 原因" },
                    ],
                    "order-cancel-remainder",
                    { id: detail.id, key: crypto.randomUUID() },
                  ),
                )}
              {btn(T("关闭", "Close"), () => setDetail(null))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function Login({
  onLogin,
  error,
}: {
  onLogin: (v: any) => Promise<void>;
  error: string;
}) {
  const [username, setUsername] = useState("owner"),
    [password, setPassword] = useState("VestaDemo2026!"),
    [resetToken, setResetToken] = useState(
      new URLSearchParams(location.search).get("reset") || "",
    ),
    [localMessage, setLocalMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <span className="brand-symbol">V</span>
          <div>
            VESTA<small>TRADE WORKSPACE</small>
          </div>
        </div>
        <div>
          <span className="eyebrow">
            CONNECTED BUSINESS. CLEARER POSSIBILITIES.
          </span>
          <h1>
            把全球生意，
            <br />
            带入清晰有序的日常。
          </h1>
          <p>
            从询价、报价到交付与回款，
            <br />
            让团队和客户始终保持同步。
          </p>
          <div className="login-stats">
            <span>
              01<small>销售协同</small>
            </span>
            <span>
              02<small>客户门户</small>
            </span>
            <span>
              03<small>履约追踪</small>
            </span>
          </div>
        </div>
        <small>VESTA · LOCAL DEMONSTRATION / 2026</small>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <span className="eyebrow">WELCOME TO YOUR WORKSPACE</span>
          <h2>{resetToken ? "设置新密码" : "登录工作空间"}</h2>
          <p>使用独立账号体验真实权限与业务流程。</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              if (resetToken) {
                try {
                  const r = await fetch("/api/v1/password/reset", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token: resetToken, password }),
                  });
                  const v = await r.json();
                  if (!r.ok) throw new Error(v.message);
                  setResetToken("");
                  history.replaceState(null, "", location.pathname);
                  setLocalMessage("密码已更新，请用新密码登录。");
                } catch (e) {
                  setLocalMessage((e as Error).message);
                }
              } else await onLogin({ username, password });
              setBusy(false);
            }}
          >
            <label>
              账号
              <input
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && <div className="alert error">{error}</div>}
            {localMessage && (
              <div className="notice-box section-gap">{localMessage}</div>
            )}
            <button className="btn primary login-submit" disabled={busy}>
              {busy ? "处理中…" : resetToken ? "保存新密码" : "进入工作空间"}
              <ArrowUpRight size={18} />
            </button>
          </form>
          {!resetToken && (
            <button
              className="link section-gap"
              onClick={async () => {
                try {
                  const r = await fetch("/api/v1/password/request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ username }),
                  });
                  const v = await r.json();
                  setLocalMessage(v.message);
                } catch (e) {
                  setLocalMessage((e as Error).message);
                }
              }}
            >
              忘记密码？生成本地恢复邮件
            </button>
          )}
          <div className="demo-accounts">
            <small>本地演示账号 · 密码 VestaDemo2026!</small>
            <div>
              {[
                ["owner", "经营"],
                ["manager", "经理"],
                ["sales", "销售"],
                ["finance", "财务"],
                ["warehouse", "仓储"],
                ["buyer", "客户"],
                ["admin", "管理"],
              ].map(([id, name]) => (
                <button
                  key={id}
                  onClick={() => setUsername(id)}
                  className={username === id ? "selected" : ""}
                >
                  {name}
                  <small>{id}</small>
                </button>
              ))}
            </div>
          </div>
          <p className="login-security">
            <Shield size={15} />
            仅本机访问 · 所有数据均为虚构样例
          </p>
        </div>
      </section>
    </div>
  );
}
function FormModal({
  form,
  products,
  orders,
  onClose,
  onError,
  onSuccess,
}: {
  form: Form;
  products: Row[];
  orders: { value: string; label: string }[];
  onClose: () => void;
  onError: (v: string) => void;
  onSuccess: () => void;
}) {
  const [values, setValues] = useState<any>(() =>
      Object.fromEntries(
        form.fields.map((f) => [f.key, f.value ?? f.options?.[0]?.value ?? ""]),
      ),
    ),
    [items, setItems] = useState<any[]>(form.items || []),
    [allocations, setAllocations] = useState(form.allocations || []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="modal-backdrop">
      <section className="modal wide">
        <div className="modal-head">
          <h2>{form.title}</h2>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              await form.submit({
                ...values,
                ...(form.quote ? { items } : {}),
                ...(form.allocations ? { allocations } : {}),
              });
              onSuccess();
            } catch (e) {
              setError((e as Error).message);
              onError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="modal-body">
            <div className="form-grid">
              {form.fields.map((f) => (
                <label
                  key={f.key}
                  className={f.type === "textarea" ? "full" : ""}
                >
                  {f.label}
                  {f.required !== false ? " *" : ""}
                  {f.options ? (
                    <select
                      value={values[f.key]}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                      required={f.required !== false}
                    >
                      {f.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : f.type === "textarea" ? (
                    <textarea
                      value={values[f.key]}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                      required={f.required !== false}
                    />
                  ) : (
                    <input
                      type={f.type || "text"}
                      step={f.type === "number" ? "any" : undefined}
                      value={values[f.key]}
                      onChange={(e) =>
                        setValues({ ...values, [f.key]: e.target.value })
                      }
                      required={f.required !== false}
                    />
                  )}
                </label>
              ))}
            </div>
            {form.allocations && (
              <div className="quote-lines">
                <h3>按订单分配收款（同一客户、相同币种）</h3>
                {allocations.map((a, i) => (
                  <div className="quote-line" key={i}>
                    <select
                      aria-label="核销订单"
                      value={a.order}
                      onChange={(e) =>
                        setAllocations(
                          allocations.map((x, j) =>
                            j === i ? { ...x, order: e.target.value } : x,
                          ),
                        )
                      }
                    >
                      {orders.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                    <label>
                      分配金额
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={a.amount}
                        onChange={(e) =>
                          setAllocations(
                            allocations.map((x, j) =>
                              j === i
                                ? { ...x, amount: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={allocations.length === 1}
                      onClick={() =>
                        setAllocations(allocations.filter((_, j) => i !== j))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    const o = orders.find(
                      (o) => !allocations.some((a) => a.order === o.value),
                    );
                    if (o)
                      setAllocations([
                        ...allocations,
                        { order: o.value, amount: 0 },
                      ]);
                  }}
                >
                  增加订单分配
                </button>
                <p className="section-gap muted">
                  已分配{" "}
                  {allocations.reduce((sum, a) => sum + a.amount, 0).toFixed(2)}
                  ；分配总额不能超过本笔收款。
                </p>
              </div>
            )}
            {form.quote && (
              <div className="quote-lines">
                <h3>报价商品 / Quotation lines</h3>
                {items.map((i, index) => (
                  <div className="quote-line" key={index}>
                    <select
                      aria-label="商品"
                      value={i.product}
                      onChange={(e) => {
                        const p = products.find(
                          (p) => p.id === e.target.value,
                        )!;
                        setItems(
                          items.map((x, n) =>
                            n === index
                              ? {
                                  product: p.id,
                                  qty: p.moq,
                                  price:
                                    values.currency === "USD" ? p.usd : p.price,
                                }
                              : x,
                          ),
                        );
                      }}
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} · {p.name}
                        </option>
                      ))}
                    </select>
                    <label>
                      数量
                      <input
                        aria-label="数量"
                        type="number"
                        min="1"
                        step="1"
                        value={i.qty}
                        onChange={(e) =>
                          setItems(
                            items.map((x, n) =>
                              n === index
                                ? { ...x, qty: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <label>
                      单价
                      <input
                        aria-label="单价"
                        type="number"
                        min="0"
                        step="0.01"
                        value={i.price}
                        onChange={(e) =>
                          setItems(
                            items.map((x, n) =>
                              n === index
                                ? { ...x, price: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={items.length === 1}
                      onClick={() =>
                        setItems(items.filter((_, n) => n !== index))
                      }
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const p = products.find(
                      (p) => !items.some((i) => i.product === p.id),
                    );
                    if (p)
                      setItems([
                        ...items,
                        {
                          product: p.id,
                          qty: p.moq,
                          price: values.currency === "USD" ? p.usd : p.price,
                        },
                      ]);
                  }}
                >
                  <Plus size={15} />
                  增加商品
                </button>
              </div>
            )}
            {error && <div className="alert error section-gap">{error}</div>}
          </div>
          <div className="modal-actions">
            <button type="button" className="btn" onClick={onClose}>
              取消 / Cancel
            </button>
            <button className="btn primary" disabled={busy}>
              {busy ? "保存中…" : "确认保存 / Save"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
function ContractUpload({
  orders,
  send,
  onError,
}: {
  orders: { value: string; label: string }[];
  send: (v: any) => Promise<void>;
  onError: (v: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="upload-form"
      onSubmit={async (e) => {
        e.preventDefault();
        const v = new FormData(e.currentTarget),
          file = v.get("file") as File;
        if (!file.size || file.size > 5 * 1024 * 1024) {
          onError("请选择 5MB 内 PDF");
          return;
        }
        setBusy(true);
        try {
          const reader = new FileReader();
          const content = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(String(reader.result).split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
          await send({
            order: v.get("order"),
            name: file.name,
            content,
            status: v.get("status"),
          });
        } catch (e) {
          onError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <select name="order" required aria-label="关联订单">
        {orders.map((o) => (
          <option value={o.value} key={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select name="status" aria-label="签署状态">
        <option value="draft">待签署</option>
        <option value="signed">已签署</option>
      </select>
      <input name="file" type="file" accept="application/pdf" required />
      <button className="btn primary" disabled={busy || !orders.length}>
        上传合同
      </button>
    </form>
  );
}

function ImportModal({
  kind,
  api,
  onClose,
  onDone,
}: {
  kind: string;
  api: (path: string, body?: any) => Promise<any>;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [preview, setPreview] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <div className="modal-backdrop">
      <section className="modal wide">
        <div className="modal-head">
          <h2>{kind === "products" ? "产品" : "客户"} CSV 导入</h2>
          <button className="icon-btn" onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="modal-body">
          <div className="notice-box">
            先下载模板填入虚构数据，再预检。每批最多 500
            行，仅新增；已存在的编号不会被覆盖。产品成本需经营负责人在导入后单独核定。
          </div>
          <div className="upload-form">
            <a className="btn" href={"/api/v1/templates/" + kind}>
              下载模板
            </a>
            <input
              aria-label="选择 CSV 文件"
              type="file"
              accept=".csv,text/csv"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setError("");
                setPreview(null);
                if (file.size > 1024 * 1024) {
                  setError("文件不得超过 1MB");
                  return;
                }
                setBusy(true);
                try {
                  setPreview(
                    await api("imports/" + kind + "/preview", {
                      content: await file.text(),
                    }),
                  );
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            />
          </div>
          {preview && (
            <>
              <p className="section-gap">
                {preview.count} 行 ·{" "}
                {preview.status === "committed"
                  ? "此文件已成功导入，不会重复新增"
                  : "预检完成"}
              </p>
              <div className="table-scroll section-gap">
                <table>
                  <thead>
                    <tr>
                      <th>文件行号</th>
                      <th>结果</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r: any) => (
                      <tr key={r.line}>
                        <td>{r.line}</td>
                        <td>
                          {r.errors.length
                            ? r.errors
                                .map((e: any) => `${e.column}: ${e.message}`)
                                .join("；")
                            : "可导入"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {error && <div className="alert error section-gap">{error}</div>}
        </div>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            关闭
          </button>
          <button
            className="btn primary"
            disabled={
              busy ||
              !preview ||
              preview.status === "committed" ||
              preview.rows.some((r: any) => r.errors.length)
            }
            onClick={async () => {
              setBusy(true);
              try {
                await api("imports/" + preview.id + "/commit", {});
                setPreview({ ...preview, status: "committed" });
                await onDone();
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            确认导入
          </button>
        </div>
      </section>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
