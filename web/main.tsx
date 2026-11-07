import Decimal from "decimal.js";
import { PricingNote, displayCurrency, productPrice } from "./pricing";
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
import "./prototype.css";
import "./parity.css";
import "./refinement.css";
import { ModalAccess } from "./modal-access";
import { businessDay, businessNow, setReferenceDate } from "./clock";
import {
  BusinessDetail,
  QuoteDocument,
  RequestDialog,
  Dialog,
  Table as ParityTable,
  KV,
  DataCenter,
  duePayment,
} from "./parity";
import {
  Customers,
  Overview,
  PortalHome,
  Stats,
  orderStage,
} from "./workspace";

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
  new Intl.NumberFormat(c === "CNY" ? "zh-CN" : "en-US", {
    style: "currency",
    currency: c,
  }).format(Number(n || 0));
const today = businessDay;
const future = (n = 30) =>
  new Date(businessNow().getTime() + n * 86400000).toISOString().slice(0, 10);
const statuses: Record<string, string> = {
  cancelled: "已取消",
  void: "已作废",
  quoted: "已报价",
  closed: "已关闭",
  ordered: "已转订单",
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
const productKinds: Record<string, string> = {
  "VT-TM500": "cup",
  "VT-BP156": "bag",
  "VT-NB-A5": "book",
  "VT-UM03": "umbrella",
  "VT-CB12": "tote",
  "VT-GBOX": "box",
};
const pageDescriptions: Record<string, string> = {
  dashboard: "订单、交付、回款与待办，掌握当前业务进展。",
  customers: "一客一档，把每次沟通、历史订单和维护计划沉淀在一起。",
  products: "共享产品资料、销售价与交期；成本仅对管理角色开放。",
  inquiries:
    "产品页发起的询价统一汇总于此。客户自行提交，内部人员可代客户登记，受理后创建报价。",
  quotes: "草稿 → 提交审批 → 版本冻结 → 对客发布。正式报价始终有据可查。",
  orders: "从预付款到生产、分批发货与签收，履约和资金状态独立记录。",
  receipts: "到账线索、管理核实与订单核销分开记录，按原币追踪每一笔收款。",
  inventory:
    "库存 = 期初 + 入库 − 出库；经理登记生产、出库与调整申请，管理审批调整。",
  contracts: "以订单归档合同与版本，授权查看和下载。",
  notifications: "客户维护、报价审批、订单交付与尾款提醒；已读不等于完成跟进。",
  rates: "每日参考汇率自动查询，保留来源、数据日期和版本；历史单据保持锁定。",
  mails: "本地邮件捕获箱，查看提醒与账号邮件。不会向真实客户发送。",
  audits: "追溯每次业务操作的时间、操作者和关联对象。",
  settings: "管理、经理、销售、客户四类角色，各司其职，独立审批。",
};
const roles: Record<string, string> = {
  owner: "管理",
  manager: "经理",
  sales: "销售人员",
  customer: "客户门户",
};
const portalTitles: Record<string, [string, string]> = {
  dashboard: ["客户中心", "Customer centre"],
  products: ["产品目录", "Products"],
  inquiries: ["我的询价", "My requests"],
  quotes: ["我的报价", "My quotations"],
  orders: ["我的订单", "My orders"],
  contracts: ["我的合同", "My contracts"],
  notifications: ["消息中心", "Notifications"],
  profile: ["公司资料", "Company profile"],
};
const navigation = [
  ["dashboard", "经营总览", "Overview", LayoutDashboard],
  ["customers", "客户与跟进", "Customers", Users],
  ["products", "产品与价格", "Products", Package],
  ["inquiries", "询价申请", "Requests", Mail],
  ["quotes", "报价与审批", "Quotations", FileText],
  ["orders", "订单履约", "Orders", Truck],
  ["receipts", "回款管理", "Payments", Wallet],
  ["inventory", "库存台账", "Inventory", Layers],
  ["contracts", "合同档案", "Contracts", FileText],
  ["notifications", "待办与提醒", "Notifications", Bell],
  ["rates", "参考汇率", "Exchange rates", Globe],
  ["mails", "邮件捕获", "Mail capture", Mail],
  ["audits", "操作审计", "Audit trail", Activity],
  ["data", "数据中心", "Data centre", Search],
  ["profile", "公司资料", "Company profile", Users],
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
    [statusFilter, setStatusFilter] = useState("all"),
    [form, setForm] = useState<Form | null>(null),
    [importKind, setImportKind] = useState<string | null>(null),
    [detail, setDetail] = useState<Row | null>(null),
    [mobile, setMobile] = useState(false),
    [requestItems, setRequestItems] = useState<any[] | null>(null),
    [basket, setBasket] = useState<any[]>([]),
    [aux, setAux] = useState<{ kind: string; row: Row } | null>(null),
    [printQuote, setPrintQuote] = useState<Row | null>(null),
    [paymentTab, setPaymentTab] = useState("receivables"),
    [paymentCurrency, setPaymentCurrency] = useState("CNY"),
    [taskTab, setTaskTab] = useState("todo"),
    [settingsTab, setSettingsTab] = useState("permissions"),
    [reference, setReference] = useState<string | null>(null);
  const en = lang === "en",
    T = (zh: string, english: string) => (en ? english : zh);
  const portal = user?.role === "customer",
    sales = ["owner", "manager", "sales"].includes(user?.role || ""),
    finance = user?.role === "owner",
    warehouse = user?.role === "manager";
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
    const health = await api("health");
    setReferenceDate(health.referenceDate);
    setReference(health.referenceDate);
    const kinds = portal
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
          ...(["owner", "manager"].includes(user.role)
            ? ["settings", "mails"]
            : []),
          ...(user.role === "owner" ? ["audits"] : []),
        ];
    const result = await Promise.all(
      kinds.map(async (k) => [k, await api("data/" + k)]),
    );
    const next = Object.fromEntries(result);
    if (["owner"].includes(user.role)) next.users = await api("users");
    if (user.role === "owner")
      next.customerDirectory = await api("customer-directory");
    if (["owner", "manager", "sales"].includes(user.role))
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
    if (user) {
      load().catch((e) => setError(e.message));
      if (user.role === "customer") setPage("products");
    }
  }, [user]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    const refreshProducts = async () => {
      try {
        const products = await api("data/products");
        if (active)
          setData((previous) =>
            previous.products ? { ...previous, products } : previous,
          );
      } catch {
        /* Existing values remain visible; explicit refresh reports network failures. */
      }
    };
    void refreshProducts();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void refreshProducts();
    }, 60000);
    window.addEventListener("focus", refreshProducts);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refreshProducts);
    };
  }, [user, lang]);
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
    setForm({
      title,
      fields,
      submit: (v) =>
        run(name, {
          ...extra,
          ...v,
          ...(name === "customer-save"
            ? {
                tags: String(v.tags || "")
                  .split(/[,，]/)
                  .map((x) => x.trim())
                  .filter(Boolean),
              }
            : {}),
        }),
    });
  }
  function createCustomer(c?: Row) {
    openForm(
      T("客户档案", "Customer profile"),
      [
        { key: "name", label: "公司名称", value: c?.name },
        { key: "en", label: "Company name (English)", value: c?.en },
        { key: "country", label: "国家 / Region", value: c?.country },
        {
          key: "industry",
          label: "行业",
          value: c?.industry || "",
          required: false,
        },
        {
          key: "tier",
          label: "客户分级",
          value: c?.tier || "B",
          options: [
            { value: "A", label: "A · 重点客户" },
            { value: "B", label: "B · 成长客户" },
            { value: "C", label: "C · 普通客户" },
          ],
        },
        { key: "phone", label: "电话", value: c?.phone || "", required: false },
        {
          key: "tags",
          label: "客户标签（逗号分隔）",
          value: (c?.tags || []).join("，"),
          required: false,
        },
        {
          key: "since",
          label: "建档日期",
          type: "date",
          value: c?.since || c?.createdAt?.slice(0, 10) || today(),
        },
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
        { key: "spec", label: "规格", value: p?.spec || "", required: false },
        {
          key: "specEn",
          label: "English specifications",
          value: p?.specEn || "",
          required: false,
        },
        { key: "safe", label: "安全库存", type: "number", value: p?.safe || 0 },
        { key: "warehouse", label: "仓位", value: p?.warehouse || "WH-01" },
        ...(user?.role === "owner"
          ? [
              {
                key: "costReason",
                label: "成本维护原因（修改成本必填）",
                required: false,
              },
            ]
          : []),
        { key: "category", label: "分类 / Category", value: p?.category },
        { key: "moq", label: "MOQ", type: "number", value: p?.moq || 100 },
        {
          key: "price",
          label: "人民币标准价 CNY（美元按汇率换算）",
          type: "number",
          value: p?.price || 0,
        },

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
    setRequestItems(p ? [{ product: p.id, qty: p.moq }] : basket);
  }
  function quote(q?: Row, source?: Row) {
    setDetail(null);
    setForm({
      title: T(
        q ? "编辑 / 修订报价" : "新建报价",
        q ? "Edit / revise quotation" : "New quotation",
      ),
      quote: true,
      items: q?.items ||
        source?.items?.map((i: any) => ({
          ...i,
          price:
            (source.currency === "CNY"
              ? rows("products").find((p) => p.id === i.product)?.price
              : rows("products").find((p) => p.id === i.product)?.usd) || 0,
        })) || [
          {
            product: source?.product || rows("products")[0]?.id,
            qty: source?.qty || 100,
            price:
              productPrice(
                rows("products").find(
                  (p) => p.id === (source?.product || rows("products")[0]?.id),
                ),
                source?.currency || displayCurrency(en),
              ) ?? 0,
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
          value: q?.currency || source?.currency || displayCurrency(en),
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
          value: q?.eta || source?.eta || future(),
        },
        {
          key: "balanceDue",
          label: "尾款到期 / Balance due",
          type: "date",
          value:
            q?.balanceDue ||
            new Date(
              Date.parse(q?.eta || source?.eta || future()) + 7 * 86400000,
            )
              .toISOString()
              .slice(0, 10),
        },
        {
          key: "paymentTerms",
          label: "付款条款 / Payment terms",
          value: q?.paymentTerms || "预付款到账安排生产，余款于约定日期结清",
          required: false,
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
            ...rows("rates")
              .filter((r) => !r.invalid || r.id === q?.fx?.id)
              .map((r) => ({
                value: r.id,
                label: `${r.date} · ${r.rate} · ${r.source}`,
              })),
          ],
          value: q?.fx?.id || rows("products")[0]?.pricingFx?.id || "",
        },
        { key: "terms", label: "贸易条款 / Terms", value: q?.terms || "FOB" },
        { key: "port", label: "装运港 / Port", value: q?.port || "Shanghai" },
        {
          key: "destination",
          label: "目的地 / Destination",
          value: q?.destination || source?.address || "",
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
        {
          key: "receivedAt",
          label: "实际收款日期 / Received date",
          type: "date",
          value: today(),
        },
        { key: "transaction", label: "银行交易号 / Transaction ID" },
        { key: "note", label: "说明 / Note", type: "textarea" },
      ],
      submit: (v) =>
        run("receipt-create", {
          receivedAt: v.receivedAt,
          transaction: v.transaction,
          currency: v.currency,
          amount: v.amount,
          note: v.note,
          allocations: v.allocations,
        }),
    });
  }
  function contract(c?: Row) {
    openForm(
      c ? "创建合同新版本" : "创建合同档案",
      [
        {
          key: "order",
          label: "关联订单",
          options: c ? [{ value: c.order, label: c.order }] : orderOptions,
          value: c?.order,
        },
        { key: "name", label: "合同标题", value: c?.name || "采购合同" },
        {
          key: "valid",
          label: "有效期",
          type: "date",
          value: c?.valid || future(90),
        },
        {
          key: "terms",
          label: "合同条款 / 说明",
          type: "textarea",
          value: c?.terms || "",
          required: false,
        },
      ],
      "contract-save",
      c ? { revisionOf: c.id } : {},
    );
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
              {
                key: "mode",
                label: "运输方式 / Mode",
                options: [
                  { value: "express", label: "快递 / Express" },
                  { value: "sea", label: "海运 / Sea" },
                  { value: "pickup", label: "自提 / Pickup" },
                ],
              },
              {
                key: "container",
                label: "柜号（海运必填） / Container",
                required: false,
              },
              {
                key: "eta",
                label: "预计到达 / Arrival",
                type: "date",
                value: o.eta,
              },
              { key: "carrier", label: "承运商 / Carrier" },
              { key: "tracking", label: "运单 / Tracking" },
            ]
          : []),
      ],
      ship ? "order-ship" : "order-produce",
      { id: o.id, key: crypto.randomUUID() },
    );
  }
  function follow(c: Row, kind = "customers") {
    const isCustomer = kind === "customers";
    const customerId = isCustomer ? c.id : c.customer;
    const hasOrder = rows("orders").some(
      (o) => o.customer === customerId && o.status !== "cancelled",
    );
    const rules = rows("settings").find((r) => r.id === "rules");
    const now = businessNow();
    const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setDetail(null);
    setForm({
      title: isCustomer ? "记录客户维护" : "记录单据跟进",
      fields: [
        {
          key: "channel",
          label: "沟通方式",
          options: [
            "电话",
            "邮件",
            "即时消息",
            "拜访",
            "视频会议",
            ...(!isCustomer ? ["内部进度"] : []),
          ].map((v) => ({ value: v, label: v })),
        },
        {
          key: "occurred",
          label: "实际发生时间",
          type: "datetime-local",
          value: local,
        },
        {
          key: "note",
          label: "沟通摘要与下一步动作（至少5字）",
          type: "textarea",
        },
        {
          key: "next",
          label: "下次计划跟进",
          type: "date",
          value: future(
            isCustomer
              ? hasOrder
                ? rules?.customerActive || 30
                : rules?.customerProspect || 7
              : 3,
          ),
        },
        ...(!isCustomer
          ? [
              {
                key: "syncCustomer",
                label: "同步为客户维护（确实与客户沟通时选择）",
                options: [
                  { value: "no", label: "不同步，独立记录单据进度" },
                  { value: "yes", label: "同步，确实与客户进行了沟通" },
                ],
              },
            ]
          : []),
      ],
      submit: (v) =>
        run("follow-create", {
          ...v,
          customer: customerId,
          kind,
          entity: c.id,
          occurred: new Date(v.occurred).toISOString(),
          syncCustomer: v.syncCustomer === "yes",
        }),
    });
  }
  const allowed = (id: string) =>
    portal
      ? ["products", "quotes", "orders", "profile"].includes(id)
      : id === "audits"
        ? user?.role === "owner"
        : id === "mails"
          ? ["owner", "manager"].includes(user?.role || "")
          : id === "settings"
            ? ["owner", "manager"].includes(user?.role || "")
            : id !== "profile";
  const go = (id: string) => {
    window.scrollTo({ top: 0 });
    setPage(id);
    setQuery("");
    setStatusFilter("all");
    setDetail(null);
    setMobile(false);
  };
  const filtered = (kind: string) =>
    rows(kind).filter(
      (r) =>
        (
          JSON.stringify(r) +
          " " +
          customer(r.customer) +
          " " +
          (kind === "orders"
            ? rows("shipments")
                .filter((s) => s.order === r.id)
                .map((s) => [s.tracking, s.container].join(" "))
                .join(" ")
            : "")
        )
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (statusFilter === "all" ||
          (kind === "products"
            ? page === "inventory"
              ? (r.stock - r.reserved < (r.safe || 0) ? "低库存" : "正常") ===
                statusFilter
              : r.category === statusFilter
            : kind === "orders"
              ? orderStage(r) === statusFilter
              : r.status === statusFilter)),
    );
  const count = (kind: string, status: string) =>
    rows(kind).filter((r) => r.status === status).length;
  const sum = (kind: string, key: string) =>
    rows(kind).reduce((n, r) => n + Number(r[key] || 0), 0);
  const metric = (label: string, value: any, hint: string) => ({
    label,
    value,
    hint,
  });
  const summaries: Record<string, any[]> = {
    inquiries: [
      metric(
        "全部询价",
        rows("inquiries").length,
        "产品快捷入口与本页统一汇总",
      ),
      metric("待受理", count("inquiries", "new"), "等待业务人员创建报价"),
      metric(
        "已报价 / 转订单",
        count("inquiries", "quoted") + count("inquiries", "ordered"),
        "按关联业务自动更新",
      ),
    ],
    quotes: [
      metric(
        "待发布",
        rows("quotes").filter((q) => q.status === "approved" && !q.published)
          .length,
        "已批准，等待对客发布",
      ),
      metric("待审批", count("quotes", "pending"), "由独立审批人处理"),
      metric(
        "客户已接受",
        rows("quotes").filter((q) => q.status === "accepted").length,
        "等待客户确认",
      ),
    ],
    orders: [
      metric("履约中", count("orders", "confirmed"), "交付与资金分别追踪"),
      metric(
        "待生产释放",
        rows("orders").filter((o) => o.status === "confirmed" && !o.released)
          .length,
        "先核实预付款，再安排生产",
      ),
      metric("已完成", count("orders", "completed"), "全部签收且应收结清"),
    ],
    inventory: [
      metric("库存商品", rows("products").length, "单仓成品库存 SKU"),
      metric(
        "实物 / 预留",
        sum("products", "stock") + " / " + sum("products", "reserved"),
        "单位：件；预留属于实物库存",
      ),
      metric(
        "低库存商品",
        rows("products").filter((p) => p.stock - p.reserved < (p.safe || 0))
          .length,
        "可用库存低于安全库存",
      ),
    ],
    contracts: [
      metric("合同版本", rows("contracts").length, "按订单归档、保留版本"),
      metric("已签署", count("contracts", "signed"), "人工登记的签署状态"),
      metric(
        "关联订单",
        new Set(rows("contracts").map((c) => c.order)).size,
        "附件按客户权限授权下载",
      ),
    ],
    receipts: [
      metric(
        paymentCurrency + " · 待收余额",
        money(
          rows("orders")
            .filter(
              (o) => o.currency === paymentCurrency && o.status !== "cancelled",
            )
            .reduce((s, o) => s + o.total - o.paid, 0),
          paymentCurrency,
        ),
        "按有效订单原币统计",
      ),
      metric(
        "逾期未结金额",
        money(
          rows("orders")
            .filter((o) => o.currency === paymentCurrency && duePayment(o))
            .reduce((s, o) => s + o.total - o.paid, 0),
          paymentCurrency,
        ),
        "按约定尾款到期日判断",
      ),
      metric(
        "待核实线索",
        rows("receipts").filter(
          (r) => r.currency === paymentCurrency && r.status === "pending",
        ).length,
        "核实后才计入已收",
      ),
    ],
    notifications: [
      metric(
        "待处理",
        rows("notifications").filter((n) => !n.resolved).length,
        "业务处理后自动解除",
      ),
      metric(
        "未读",
        rows("notifications").filter((n) => !n.read && !n.resolved).length,
        "已读不会重置业务时间",
      ),
      metric(
        "已升级",
        rows("notifications").filter(
          (n) => n.level === "escalation" && !n.resolved,
        ).length,
        "逾期提醒升级至管理",
      ),
    ],
  };
  const title = navigation.find((n) => n[0] === page);
  if (!ready) return <div className="loading">VESTA · Loading workspace…</div>;
  if (user && !data.products && !error)
    return (
      <div className="loading">
        {T("正在加载授权业务数据…", "Loading your workspace…")}
      </div>
    );
  if (!user)
    return (
      <Login
        onLogin={async (v) => {
          setError("");
          try {
            const logged = await api("login", v);
            setUser(logged);
            setPage(logged.role === "customer" ? "products" : "dashboard");
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
      {en
        ? {
            draft: "Draft",
            pending: "Pending",
            approved: "Approved",
            accepted: "Accepted",
            confirmed: "Active",
            completed: "Completed",
            new: "Under review",
            quoted: "Quoted",
            ordered: "Ordered",
            closed: "Closed",
            signed: "Signed",
            verified: "Verified",
            reversed: "Reversed",
            rejected: "Rejected",
            cancelled: "Cancelled",
            void: "Voided",
          }[status as string] || status
        : statuses[status] || status}
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
  const showMoney = true;
  return (
    <div className={portal ? "workspace portal-layout" : "workspace"}>
      <a className="skip-link" href="#workspace-content">
        {T("跳转到页面内容", "Skip to content")}
      </a>
      <ModalAccess />
      {mobile && !portal && (
        <button
          className="navigation-shade"
          aria-label={T("收起导航", "Dismiss navigation")}
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={mobile ? "sidebar mobile-open" : "sidebar"}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            go(portal ? "products" : "dashboard");
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
        <nav
          id="workspace-navigation"
          aria-label={T("主导航", "Main navigation")}
        >
          {navigation
            .filter((n) => allowed(n[0]))
            .map(([id, zh, eng, Icon]) => (
              <React.Fragment key={id}>
                {!portal && id === "notifications" && (
                  <div className="nav-section">
                    {T("协作与管理", "Workspace tools")}
                  </div>
                )}
                <button
                  aria-current={page === id ? "page" : undefined}
                  className={page === id ? "nav-item active" : "nav-item"}
                  onClick={() => go(id)}
                >
                  <Icon size={18} />
                  <span>{portal ? T(...portalTitles[id]) : T(zh, eng)}</span>
                  {id === "notifications" &&
                    rows("notifications").some((n) => !n.read) && <i />}
                </button>
              </React.Fragment>
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
              <small>
                {en
                  ? {
                      owner: "Management",
                      manager: "Manager",
                      sales: "Sales",
                      customer: "Customer portal",
                    }[user.role]
                  : roles[user.role]}
              </small>
            </div>
            <button
              aria-label={T("退出登录", "Sign out")}
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
              aria-label={
                mobile
                  ? T("关闭导航菜单", "Close navigation")
                  : T("打开导航菜单", "Open navigation")
              }
              aria-expanded={mobile}
              aria-controls="workspace-navigation"
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} />
            </button>
            <span>{portal ? "Customer portal" : "Workspace"}</span>
            <ChevronRight size={14} />
            <strong>
              {portal
                ? T(...portalTitles[page])
                : T(title?.[1] || "", title?.[2] || "")}
            </strong>
          </div>
          <div className="top-actions">
            {!portal && (
              <form
                className="top-search"
                onSubmit={(e) => {
                  e.preventDefault();
                  go("data");
                }}
              >
                <button className="btn compact">
                  <Search size={14} />
                  全局检索
                </button>
              </form>
            )}
            <button
              className="btn compact"
              onClick={() => setAux({ kind: "guide", row: { id: "使用指引" } })}
            >
              {T("使用指引", "Guide")}
            </button>
            <span className="connection">
              <i />
              {T("本地数据库已连接", "Local database connected")}
            </span>
            {portal && (
              <>
                <button className="btn compact" onClick={() => go("contracts")}>
                  {T("合同", "Contracts")}
                </button>
                <button
                  className="btn compact"
                  onClick={() => go("notifications")}
                >
                  {T("消息", "Messages")}
                </button>
              </>
            )}
            <button
              className="btn compact"
              onClick={() => setLang(en ? "zh" : "en")}
            >
              <Globe size={15} />
              {en ? "中文" : "EN"}
            </button>
            <button
              className="icon-btn"
              aria-label={T("刷新", "Refresh")}
              onClick={() => load().catch((e) => setError(e.message))}
            >
              <RefreshCw size={17} />
            </button>
          </div>
        </header>
        <div className="content" id="workspace-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                VESTA / {portal ? "CUSTOMER EXPERIENCE" : "SALES OPERATIONS"}
              </div>
              <h1>
                {portal
                  ? T(...portalTitles[page])
                  : T(title?.[1] || "", title?.[2] || "")}
              </h1>
              <p>
                {T(
                  (portal
                    ? "浏览产品、提交询价、确认报价，跟踪您公司的订单与交付。"
                    : pageDescriptions[page]) ||
                    "从每一次询价，到每一份如期交付。",
                  "From the first inquiry to every delivery on time.",
                )}
              </p>
            </div>
            <div className="heading-actions">
              {page === "settings" &&
                user.role === "owner" &&
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
                            { value: "owner", label: "管理" },
                            { value: "manager", label: "经理" },
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
                page === "profile" &&
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
                btn(T("+ 新建询价", "+ New request"), () => inquiry(), true)}
              {(detail?.detailKind || page) === "quotes" &&
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
          {page === "dashboard" && portal && (
            <PortalHome data={data} en={en} onGo={go} />
          )}
          {page === "dashboard" && !portal && (
            <Overview
              data={data}
              en={en}
              onGo={go}
              onOrder={(o) => {
                setDetail({ ...o, detailKind: "orders" });
              }}
            />
          )}
          {summaries[page] && !portal && <Stats items={summaries[page]} />}
          {page !== "dashboard" &&
            page !== "customers" &&
            page !== "settings" &&
            !(portal && page === "products") &&
            !["data", "profile", "notifications", "receipts"].includes(
              page,
            ) && (
              <div className="toolbar">
                <div className="search">
                  <Search size={16} />
                  <input
                    aria-label={T("搜索", "Search")}
                    placeholder={T("搜索当前记录…", "Search records…")}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <select
                  aria-label={T("记录筛选", "Filter records")}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">
                    {T("全部状态 / 分类", "All states / categories")}
                  </option>
                  {Array.from(
                    new Set(
                      rows(page === "inventory" ? "products" : page)
                        .map((r) =>
                          page === "products"
                            ? r.category
                            : page === "orders"
                              ? orderStage(r)
                              : page === "inventory"
                                ? r.stock - r.reserved < (r.safe || 0)
                                  ? "低库存"
                                  : "正常"
                                : r.status,
                        )
                        .filter(Boolean),
                    ),
                  ).map((v) => (
                    <option key={v} value={v}>
                      {en
                        ? (
                            {
                              已完成: "Completed",
                              已签收待尾款: "Delivered, unpaid",
                              "生产 / 备货": "Production",
                              待发运: "Ready to ship",
                              "运输 / 分批发货": "In transit / Split shipments",
                              待收预付款: "Awaiting deposit",
                              approved: "Approved",
                              accepted: "Accepted",
                              pending: "Pending",
                              draft: "Draft",
                              rejected: "Returned",
                              cancelled: "Cancelled",
                              signed: "Signed",
                              new: "New",
                              quoted: "Quoted",
                              ordered: "Ordered",
                              closed: "Closed",
                            } as Record<string, string>
                          )[v] || v
                        : statuses[v] || v}
                    </option>
                  ))}
                </select>
                <span className="muted">
                  {filtered(page === "inventory" ? "products" : page).length}{" "}
                  {T("条记录 · 当前授权范围", "records in scope")}
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
            <PricingNote product={rows("products")[0]} en={en} />
          )}
          {page === "products" && !portal && (
            <section className="card">
              {table(
                [
                  "产品 / 规格",
                  "分类",
                  "标准售价",
                  "起订量 / 交期",
                  "可用库存",
                  ...(user.role === "owner" ? ["成本（受限）"] : []),
                  "操作",
                ],
                filtered("products").map((p) => [
                  <div className="crm-identity">
                    <span className="product-mini">
                      <img
                        src={
                          "/products/" +
                          (p.kind || productKinds[p.sku] || "box") +
                          ".svg"
                        }
                        alt=""
                      />
                    </span>
                    <div>
                      <strong>{p.name}</strong>
                      <small className="sub">
                        {p.sku} · {p.spec || p.en}
                      </small>
                    </div>
                  </div>,
                  p.category,
                  <>
                    {productPrice(p, displayCurrency(en)) === null
                      ? T("暂无美元参考价", "USD price unavailable")
                      : money(
                          productPrice(p, displayCurrency(en))!,
                          displayCurrency(en),
                        )}
                    <small className="sub">{displayCurrency(en)}</small>
                  </>,
                  <>
                    {p.moq} 件<small className="sub">{p.lead} 天</small>
                  </>,
                  <>
                    {p.stock - p.reserved}
                    <small
                      className={
                        p.stock - p.reserved < (p.safe || 0)
                          ? "sub overdue"
                          : "sub"
                      }
                    >
                      {p.stock - p.reserved < (p.safe || 0) ? "低库存 · " : ""}
                      安全库存 {p.safe ?? "待补充"} · {p.warehouse || "WH-01"}
                    </small>
                  </>,
                  ...(user.role === "owner"
                    ? [p.cost == null ? "待核价" : money(p.cost)]
                    : []),
                  <div className="actions">
                    <button
                      className="btn"
                      onClick={() => setAux({ kind: "products", row: p })}
                    >
                      资料
                    </button>
                    <button className="btn soft" onClick={() => inquiry(p)}>
                      发起询价
                    </button>
                    {["owner", "manager"].includes(user.role) &&
                      btn("编辑", () => createProduct(p))}
                  </div>,
                ]),
              )}
            </section>
          )}
          {page === "products" && portal && (
            <PortalHome data={data} en={en} onGo={go} />
          )}
          {page === "products" && portal && (
            <>
              <div
                className="catalog-heading"
                id="product-selection"
                tabIndex={-1}
              >
                <div>
                  <h2>{T("产品精选", "Explore our collection")}</h2>
                  <p className="muted">
                    {T(
                      "登录客户参考价 · 正式价格以审批后的报价为准",
                      "Account reference prices · Approved quotations are authoritative",
                    )}
                  </p>
                </div>
                <input
                  aria-label={T("搜索产品", "Search products")}
                  placeholder={T("搜索产品、型号…", "Search products or SKU…")}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <div className="filter-chips">
                {[
                  "all",
                  ...new Set(rows("products").map((p) => p.category)),
                ].map((c) => (
                  <button
                    key={c}
                    className={statusFilter === c ? "active" : ""}
                    onClick={() => setStatusFilter(c)}
                  >
                    {c === "all"
                      ? T("全部产品", "All products")
                      : en
                        ? {
                            日用礼品: "Everyday gifts",
                            商务出行: "Travel",
                            办公文具: "Office",
                            包装配套: "Packaging",
                          }[c as string] || c
                        : c}
                  </button>
                ))}
              </div>
            </>
          )}
          {page === "products" && portal && (
            <div className="product-grid">
              {filtered("products").map((p, i) => (
                <article className="product-card" key={p.id}>
                  <div className={"product-art art-" + (i % 6)}>
                    <img
                      src={
                        "/products/" +
                        (p.kind || productKinds[p.sku] || "box") +
                        ".svg"
                      }
                      alt={(en ? p.en : p.name) + T(" 示意图", " illustration")}
                    />
                    <span>{p.sku}</span>
                  </div>
                  <div className="product-info">
                    <small>{p.category}</small>
                    <h3>{en ? p.en : p.name}</h3>
                    <p>{en ? p.specEn || p.en : p.spec || p.en}</p>
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
                        {productPrice(p, displayCurrency(en)) === null
                          ? T("暂无美元参考价", "USD price unavailable")
                          : money(
                              productPrice(p, displayCurrency(en))!,
                              displayCurrency(en),
                            )}{" "}
                        <small>/ {T("件", "unit")}</small>
                      </div>
                    )}
                    {user.role === "owner" && (
                      <small className="muted">
                        成本 CNY {p.cost ?? "待核价"}
                      </small>
                    )}
                    <div className="card-actions">
                      {btn(T("产品资料", "Details"), () =>
                        setAux({ kind: "products", row: p }),
                      )}
                      {(portal || sales) &&
                        btn(
                          T("加入需求清单", "Add to basket"),
                          () => {
                            setBasket(
                              basket.some((i) => i.product === p.id)
                                ? basket.map((i) =>
                                    i.product === p.id
                                      ? { ...i, qty: i.qty + p.moq }
                                      : i,
                                  )
                                : [...basket, { product: p.id, qty: p.moq }],
                            );
                            setNotice(T("已加入需求清单", "Added to basket"));
                          },
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
          {portal && basket.length > 0 && (
            <div className="basket-bar">
              <span>
                {basket.length} {T("种商品", "products")} ·{" "}
                {basket.reduce((s, i) => s + i.qty, 0)} {T("件", "units")}
              </span>
              <button className="btn primary" onClick={() => inquiry()}>
                {T("查看清单并提交需求", "Review and submit")}
              </button>
            </div>
          )}
          {page === "data" && !portal && (
            <DataCenter
              onImport={setImportKind}
              canImportProducts={user.role === "owner"}
              onOpen={(kind, id) => {
                const row = rows(kind).find((r) => r.id === id);
                if (!row) return;
                if (kind === "products") {
                  setAux({ kind, row });
                  return;
                }
                if (kind === "customers") {
                  go("customers");
                  setQuery(id);
                  return;
                }
                go(kind);
                setDetail(row);
              }}
            />
          )}
          {page === "profile" && portal && (
            <section className="card profile-page">
              <h2>
                {en ? rows("customers")[0]?.en : rows("customers")[0]?.name}
              </h2>
              <KV
                items={[
                  [T("联系人", "Contact"), rows("customers")[0]?.contact],
                  [T("电子邮箱", "Email"), rows("customers")[0]?.email],
                  [T("联系电话", "Phone"), rows("customers")[0]?.phone],
                  [T("地区", "Region"), rows("customers")[0]?.country],
                  [T("地址", "Address"), rows("customers")[0]?.address],
                  [T("约定币种", "Currency"), rows("customers")[0]?.currency],
                  [
                    T("专属联系人", "Account contact"),
                    rows("customers")[0]?.assignedContact?.name || "—",
                  ],
                ]}
              />
            </section>
          )}
          {page === "customers" && (
            <Customers
              data={data}
              user={user}
              openCustomer={query}
              onFollow={follow}
              onEdit={createCustomer}
              onImport={() => setImportKind("customers")}
              onOrder={(o) => {
                setDetail({ ...o, detailKind: "orders" });
              }}
            />
          )}
          {page === "inquiries" && (
            <section className="card">
              {table(
                [
                  T("申请编号", "Request"),
                  T("客户", "Customer"),
                  T("商品 / 数量", "Product / Quantity"),
                  T("交期", "Delivery"),
                  T("状态", "Status"),
                  T("操作", "Action"),
                ],
                filtered("inquiries").map((i) => [
                  <button
                    className="link"
                    onClick={() => setAux({ kind: "inquiries", row: i })}
                  >
                    {i.id}
                  </button>,
                  customer(i.customer),
                  <>
                    {(i.items || [{ product: i.product, qty: i.qty }])
                      .map(
                        (x: any) =>
                          `${x.sku || rows("products").find((p) => p.id === x.product)?.sku} × ${x.qty}`,
                      )
                      .join(" / ")}
                    <small className="sub">{i.note}</small>
                  </>,
                  i.eta,
                  badge(i.status),
                  sales
                    ? i.status === "new"
                      ? btn("创建报价", () => quote(undefined, i))
                      : btn("查看关联报价", () => {
                          go("quotes");
                          setQuery(i.id);
                        })
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
                  portal
                    ? T("商品与数量", "Products / quantities")
                    : T("客户", "Customer"),
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
                    portal ? (
                      <>
                        {q.items.map((i: any) => (
                          <small className="sub" key={i.product}>
                            {en ? i.en : i.name} × {i.qty}
                          </small>
                        ))}
                      </>
                    ) : (
                      customer(q.customer)
                    ),
                    money(q.total, q.currency),
                    <>
                      {badge(q.status)}
                      <small className="sub">
                        {q.published
                          ? T("已发布", "Published")
                          : T("未发布", "Unpublished")}{" "}
                        · {q.depositPct}% {T("预付", "deposit")}
                      </small>
                      {!portal && (
                        <small className="sub">
                          {rows("salesDirectory").find(
                            (u) => u.id === q.createdBy,
                          )?.name || q.createdBy}{" "}
                          ·{" "}
                          {rows("salesDirectory").find(
                            (u) => u.id === q.approvers?.[q.step],
                          )?.name ||
                            q.approvers?.[q.step] ||
                            ""}
                        </small>
                      )}
                    </>,
                    q.valid,
                    btn(T("查看详情", "View details"), () => setDetail(q)),
                  ]),
              )}
            </section>
          )}
          {page === "orders" && portal && (
            <section className="card section-gap">
              <div className="card-head">
                <h3>{T("已提交的申请", "Submitted requests")}</h3>
                {btn(
                  T("新建订单申请", "New order request"),
                  () => go("products"),
                  true,
                )}
              </div>
              <ParityTable
                heads={[
                  T("申请编号", "Reference"),
                  T("类型", "Type"),
                  T("商品数量", "Units"),
                  T("状态", "Status"),
                  T("操作", "Action"),
                ]}
                rows={rows("inquiries").map((i) => [
                  i.id,
                  i.type === "order_request"
                    ? T("订单申请", "Order request")
                    : T("询价申请", "Inquiry"),
                  (i.items || [{ qty: i.qty }]).reduce(
                    (s: number, x: any) => s + x.qty,
                    0,
                  ),
                  badge(i.status),
                  btn(T("详情", "Details"), () =>
                    setAux({ kind: "inquiries", row: i }),
                  ),
                ])}
              />
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
                    <>
                      {customer(o.customer)}
                      {!portal && (
                        <small className="sub">
                          {rows("salesDirectory").find(
                            (u) => u.id === o.createdBy,
                          )?.name || o.createdBy}
                        </small>
                      )}
                    </>,
                    <>
                      <span className="badge approved">
                        {orderStage(o, en)}
                      </span>
                      {duePayment(o) && (
                        <span className="badge rejected">
                          {T("尾款逾期", "Payment overdue")}
                        </span>
                      )}
                      <small className="sub">
                        {rows("shipments")
                          .filter((s) => s.order === o.id)
                          .map((s) =>
                            [s.tracking, s.container]
                              .filter(Boolean)
                              .join(" / "),
                          )
                          .join("；")}
                      </small>
                      {!portal && (
                        <small className="sub">
                          最近跟进 {o.lastFollow?.slice(0, 10) || "—"} · 下次{" "}
                          {o.next || "—"}
                        </small>
                      )}
                      <small className="sub">
                        {o.items.reduce(
                          (s: number, i: any) => s + i.shipped,
                          0,
                        )}{" "}
                        / {o.items.reduce((s: number, i: any) => s + i.qty, 0)}{" "}
                        {T("已发货", "shipped")}
                      </small>
                      <div className="crm-progress">
                        <i
                          style={{
                            width: `${
                              (o.items.reduce(
                                (s: number, i: any) => s + i.shipped,
                                0,
                              ) /
                                Math.max(
                                  1,
                                  o.items.reduce(
                                    (s: number, i: any) => s + i.qty,
                                    0,
                                  ),
                                )) *
                              100
                            }%`,
                          }}
                        />
                      </div>
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
                    <div className="actions">
                      {btn(T("查看详情", "View details"), () => setDetail(o))}
                      {sales &&
                        o.status === "confirmed" &&
                        btn("跟进", () => follow(o, "orders"))}
                    </div>,
                  ]),
              )}
            </section>
          )}
          {page === "receipts" && (
            <>
              <div className="tabs">
                {[
                  ["receivables", "订单应收"],
                  ["ledger", "回款流水"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={paymentTab === key ? "active" : ""}
                    onClick={() => setPaymentTab(key)}
                  >
                    {label}
                  </button>
                ))}
                <select
                  aria-label="回款币种"
                  value={paymentCurrency}
                  onChange={(e) => setPaymentCurrency(e.target.value)}
                >
                  <option>CNY</option>
                  <option>USD</option>
                </select>
              </div>
              {paymentTab === "receivables" && (
                <section className="card">
                  <ParityTable
                    heads={[
                      "订单 / 客户",
                      "订单金额",
                      "已核实",
                      "余额",
                      "尾款到期",
                      "操作",
                    ]}
                    rows={rows("orders")
                      .filter(
                        (o) =>
                          o.currency === paymentCurrency &&
                          o.status !== "cancelled",
                      )
                      .map((o) => [
                        <button
                          className="link"
                          onClick={() =>
                            setDetail({ ...o, detailKind: "orders" })
                          }
                        >
                          {o.id}
                          <small className="sub">{customer(o.customer)}</small>
                        </button>,
                        money(o.total, o.currency),
                        money(o.paid, o.currency),
                        money(o.total - o.paid, o.currency),
                        <span className={duePayment(o) ? "overdue" : ""}>
                          {o.balanceDue || "待补充"}
                        </span>,
                        o.total > o.paid && btn("登记回款", () => receipt(o)),
                      ])}
                  />
                </section>
              )}
            </>
          )}
          {page === "receipts" && paymentTab === "ledger" && (
            <section className="card">
              {table(
                ["交易号 / 单据", "客户", "金额", "状态", "操作"],
                filtered("receipts")
                  .filter((r) => r.currency === paymentCurrency)
                  .map((r) => [
                    <>
                      <button
                        className="link"
                        onClick={() => setAux({ kind: "receipts", row: r })}
                      >
                        {r.transaction}
                      </button>
                      <small className="sub">
                        {r.id} · {r.receivedAt || "收款日期待补充"}
                      </small>
                    </>,
                    customer(r.customer),
                    money(r.amount, r.currency),
                    badge(r.status),
                    <div className="actions">
                      {finance &&
                        r.status === "pending" &&
                        btn(
                          "核实到账",
                          () => setAux({ kind: "verify-receipt", row: r }),
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
                  ["SKU / 商品", "实物库存", "预留", "可用 / 安全库存", "操作"],
                  filtered("products").map((p) => [
                    <>
                      {p.sku}
                      <small className="sub">{p.name}</small>
                    </>,
                    p.stock,
                    p.reserved,
                    <>
                      {p.stock - p.reserved}
                      <small
                        className={
                          p.stock - p.reserved < (p.safe || 0)
                            ? "sub overdue"
                            : "sub"
                        }
                      >
                        {p.stock - p.reserved < (p.safe || 0)
                          ? "低库存 · "
                          : ""}
                        安全库存 {p.safe ?? "待补充"} · {p.warehouse || "WH-01"}
                      </small>
                    </>,
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
                        ? btn("管理确认采用", () =>
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
                      "人工汇率（管理）",
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
          {page === "contracts" && sales && (
            <div className="section-gap">
              {btn("+ 创建合同档案", () => contract(), true)}
            </div>
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
                  contracts={rows("contracts")}
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
                    <button
                      className="link"
                      onClick={() => setAux({ kind: "contracts", row: c })}
                    >
                      {c.name}
                      <small className="sub">
                        {c.id} ·{" "}
                        {c.valid || T("有效期待补充", "Validity not recorded")}
                      </small>
                    </button>,
                    <>
                      {c.order}
                      <small className="sub">
                        {customer(c.customer)} · {money(c.amount, c.currency)}
                      </small>
                    </>,
                    "V" + c.version,
                    badge(c.status),
                    <div className="actions">
                      {c.bytes ? (
                        <a
                          className="btn"
                          href={"/api/v1/contracts/" + c.id + "/download"}
                        >
                          <Download size={14} />
                          PDF
                        </a>
                      ) : (
                        <small>{T("附件待补充", "No attachment")}</small>
                      )}
                      {sales && btn("新版本", () => contract(c))}
                      {sales &&
                        c.status === "draft" &&
                        !!c.bytes &&
                        btn("登记签署", () =>
                          openForm(
                            "登记人工签署",
                            [
                              {
                                key: "signedAt",
                                label: "实际签署日期",
                                type: "date",
                                value: today(),
                              },
                            ],
                            "contract-sign",
                            { id: c.id },
                          ),
                        )}
                    </div>,
                  ]),
                )}
              </section>
            </>
          )}
          {page === "notifications" && (
            <div className="tabs">
              {[
                ["todo", T("待处理", "To do")],
                ["history", T("提醒历史", "History")],
                ...(!portal ? [["rules", T("提醒规则", "Rules")]] : []),
              ].map(([key, label]) => (
                <button
                  className={taskTab === key ? "active" : ""}
                  key={key}
                  onClick={() => setTaskTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {page === "notifications" && taskTab === "rules" && (
            <section className="card profile-page">
              <h3>跟进与升级规则</h3>
              <KV
                items={Object.entries(
                  rows("settings").find((r) => r.id === "rules") || {},
                )
                  .filter(([k]) => k !== "id")
                  .map(([k, v]) => [ruleNames[k] || k, String(v)])}
              />
              {["owner", "manager"].includes(user.role) &&
                btn("配置提醒规则", () => {
                  go("settings");
                  setSettingsTab("rules");
                })}
              {user.role === "sales" && (
                <p>客户维护与单据跟进分别计时，已读不重置到期时间。</p>
              )}
            </section>
          )}
          {page === "notifications" && taskTab !== "rules" && (
            <>
              <div className="notice-box">
                {T(
                  "提醒由后端持续扫描。已读不会重置业务跟进时间。",
                  "Reminders run on the server. Reading does not reset follow-up dates.",
                )}
              </div>
              {["owner", "manager"].includes(user.role) && (
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
                  filtered("notifications")
                    .filter((n) => taskTab === "history" || !n.resolved)
                    .map((n) => [
                      <>
                        {n.title}
                        <small className="sub">
                          {n.due ? new Date(n.due).toLocaleString() : ""} ·{" "}
                          {n.level} · {n.recipient}
                        </small>
                      </>,
                      <button
                        className="link"
                        onClick={() => {
                          for (const kind of [
                            "orders",
                            "quotes",
                            "customers",
                          ]) {
                            const row = rows(kind).find(
                              (r) => r.id === n.entity,
                            );
                            if (row) {
                              if (kind === "customers") {
                                go(kind);
                                setQuery(row.id);
                              } else setDetail({ ...row, detailKind: kind });
                              return;
                            }
                          }
                        }}
                      >
                        {n.entity}
                      </button>,
                      n.resolved
                        ? T("已解除", "Resolved")
                        : n.read
                          ? T("已读，待处理", "Read, pending")
                          : T("未读", "Unread"),
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
              <div className="tabs">
                {[
                  ["permissions", "角色与数据范围"],
                  ["rules", "提醒规则"],
                  ...(user.role === "owner" ? [["audit", "操作审计"]] : []),
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={settingsTab === key ? "active" : ""}
                    onClick={() => setSettingsTab(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {settingsTab === "permissions" && (
                <>
                  <section className="card">
                    <div className="card-head">
                      <h3>四类角色与职责</h3>
                    </div>
                    {table(
                      ["角色", "主要职责", "数据与限制"],
                      [
                        [
                          "管理",
                          "成本、风险审批、回款核实/冲正、汇率、账号",
                          "全量业务；禁止自批",
                        ],
                        [
                          "经理",
                          "团队客户、报价审批、生产、发货、签收",
                          "全量业务，无成本；不能核实回款",
                        ],
                        [
                          "销售",
                          "客户维护、询价、报价、订单与回款线索",
                          "仅本人客户；不能审批、核款或扣减库存",
                        ],
                        [
                          "客户",
                          "询价、确认报价、查询订单和合同",
                          "仅所属公司；无内部备注和成本",
                        ],
                      ],
                    )}
                  </section>
                  {["owner"].includes(user.role) && (
                    <section className="card section-gap">
                      {table(
                        ["账号", "姓名", "角色", "状态", "操作"],
                        rows("users").map((u) => [
                          u.username,
                          u.name,
                          roles[u.role],
                          u.active ? "启用" : "停用",
                          user.role === "owner" && u.id !== user.id
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
                </>
              )}
              {settingsTab === "rules" && (
                <section className="card section-gap">
                  <div className="card-head">
                    <h3>业务规则（当前配置）</h3>
                    {["owner", "manager"].includes(user.role) &&
                      btn("修改规则", () =>
                        openForm(
                          "业务规则",
                          Object.entries(
                            rows("settings").find((r) => r.id === "rules") ||
                              {},
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
              )}
              {settingsTab === "audit" && (
                <ParityTable
                  heads={["时间", "操作人", "操作", "对象"]}
                  rows={rows("audits")
                    .slice()
                    .reverse()
                    .map((a) => [a.at, a.actor, a.action, a.entity])}
                />
              )}
            </>
          )}
          {reference && (
            <div className="reference-banner">
              {T("原型参考库 · 演示日期", "Prototype reference · Demo date")}{" "}
              {reference} ·{" "}
              {T("与日常本地库隔离", "Separate from your local workspace")}
              {user.role === "owner" && (
                <button
                  className="btn compact"
                  onClick={() =>
                    setForm({
                      title: "恢复原型参考数据（仅隔离参考库）",
                      fields: [
                        {
                          key: "confirm",
                          label: "输入 RESET 确认清除本参考库的测试改动",
                        },
                      ],
                      submit: async (v) => {
                        if (v.confirm !== "RESET") throw Error("请输入 RESET");
                        await api("reference/reset", {});
                        await load();
                      },
                    })
                  }
                >
                  恢复参考数据
                </button>
              )}
            </div>
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
          rates={rows("rates")}
          orders={orderOptions}
          onClose={() => setForm(null)}
          onError={setError}
          onSuccess={() => {
            setForm(null);
          }}
        />
      )}
      {requestItems && (
        <RequestDialog
          products={rows("products")}
          customers={rows("customers")}
          portal={!!portal}
          en={en}
          initial={requestItems}
          onClose={() => setRequestItems(null)}
          submit={async (v) => {
            await run("inquiry-create", v);
            setBasket([]);
          }}
        />
      )}
      {printQuote && (
        <QuoteDocument
          q={printQuote}
          en={en}
          onClose={() => setPrintQuote(null)}
        />
      )}
      {aux && (
        <Dialog
          title={
            T("业务资料", "Business details") +
            " · " +
            (aux.row.name || aux.row.id)
          }
          onClose={() => setAux(null)}
          footer={
            aux.kind === "verify-receipt" ? (
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  try {
                    await run("receipt-verify", { id: aux.row.id });
                    setAux(null);
                  } catch {}
                }}
              >
                确认核实到账并核销
              </button>
            ) : aux.kind === "accept" ? (
              <button
                className="btn primary"
                disabled={busy}
                onClick={async () => {
                  try {
                    await run("quote-accept", { id: aux.row.id });
                    setAux(null);
                    setDetail(null);
                    go("orders");
                  } catch {}
                }}
              >
                {T("确认接受并生成订单", "Confirm and create order")}
              </button>
            ) : aux.kind === "products" ? (
              <button
                className="btn primary"
                onClick={() => {
                  inquiry(aux.row);
                  setAux(null);
                }}
              >
                {T("发起询价", "Request quotation")}
              </button>
            ) : aux.kind === "inquiries" &&
              sales &&
              aux.row.status === "new" ? (
              <button
                className="btn primary"
                onClick={() => {
                  quote(undefined, aux.row);
                  setAux(null);
                }}
              >
                创建报价
              </button>
            ) : undefined
          }
        >
          {aux.kind === "contracts" && (
            <>
              <h3>合同版本</h3>
              <ParityTable
                heads={["版本", "日期", "状态", "附件"]}
                rows={rows("contracts")
                  .filter(
                    (c) => (c.group || c.id) === (aux.row.group || aux.row.id),
                  )
                  .map((c) => [
                    "V" + c.version,
                    c.at,
                    badge(c.status),
                    c.bytes ? (
                      <a href={"/api/v1/contracts/" + c.id + "/download"}>
                        PDF
                      </a>
                    ) : (
                      "待补充"
                    ),
                  ])}
              />
            </>
          )}
          {aux.kind === "guide" ? (
            <>
              <h3>{T("从选品到交付", "From products to delivery")}</h3>
              <ol>
                {[
                  T(
                    "客户选品并提交需求，销售集中受理。",
                    "Customers submit requests; sales receive them.",
                  ),
                  T(
                    "销售创建报价并提交独立审批，批准后发布。",
                    "Sales create quotations for independent approval and publication.",
                  ),
                  T(
                    "客户确认报价生成订单；管理核实预付款。",
                    "Customers accept quotations; management verifies deposits.",
                  ),
                  T(
                    "经理释放生产、分批入库发货并记录签收。",
                    "Managers release production, ship batches and record delivery.",
                  ),
                  T(
                    "管理核实回款；全部签收且结清后完成。",
                    "Management verifies payments; delivered and settled orders complete.",
                  ),
                  T(
                    "客户维护和单据跟进独立计时，待办可进入业务记录。",
                    "Customer maintenance and document follow-ups have independent schedules.",
                  ),
                ].map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </>
          ) : aux.kind === "accept" ? (
            <>
              <p>
                {T(
                  "请核对金额和付款条款，确认后生成正式订单。",
                  "Review the amount and payment terms before creating an order.",
                )}
              </p>
              <KV
                items={[
                  [T("金额", "Amount"), money(aux.row.total, aux.row.currency)],
                  [T("预付款", "Deposit"), aux.row.depositPct + "%"],
                  [T("尾款到期", "Balance due"), aux.row.balanceDue],
                ]}
              />
            </>
          ) : aux.kind === "products" ? (
            <>
              <PricingNote product={aux.row} en={en} />
              <img
                className="detail-product-art"
                src={
                  "/products/" +
                  (aux.row.kind || productKinds[aux.row.sku] || "box") +
                  ".svg"
                }
                alt=""
              />
              <KV
                items={[
                  ["SKU", aux.row.sku],
                  [
                    T("规格", "Specifications"),
                    en ? aux.row.specEn || aux.row.spec : aux.row.spec,
                  ],
                  ["MOQ", aux.row.moq],
                  [
                    displayCurrency(en),
                    productPrice(aux.row, displayCurrency(en)) === null
                      ? T("暂无美元参考价", "USD price unavailable")
                      : money(
                          productPrice(aux.row, displayCurrency(en))!,
                          displayCurrency(en),
                        ),
                  ],
                  [
                    T("可用库存", "Available"),
                    aux.row.stock - aux.row.reserved,
                  ],
                  [T("交期（天）", "Lead days"), aux.row.lead],
                  ...(!portal && user.role === "owner"
                    ? [
                        ["成本 CNY", money(aux.row.cost)] as [
                          string,
                          React.ReactNode,
                        ],
                      ]
                    : []),
                ]}
              />
            </>
          ) : aux.kind === "inquiries" ? (
            <>
              <KV
                items={[
                  [
                    T("类型", "Type"),
                    aux.row.type === "order_request"
                      ? T("订单申请", "Order request")
                      : T("询价", "Inquiry"),
                  ],
                  [T("客户", "Customer"), customer(aux.row.customer)],
                  [T("币种", "Currency"), aux.row.currency],
                  [T("期望交期", "Delivery"), aux.row.eta],
                  [T("地址", "Address"), aux.row.address],
                  [T("状态", "Status"), badge(aux.row.status)],
                ]}
              />
              <ParityTable
                heads={[T("商品", "Product"), T("数量", "Quantity")]}
                rows={(
                  aux.row.items || [
                    { product: aux.row.product, qty: aux.row.qty },
                  ]
                ).map((i: any) => [
                  i.name ||
                    rows("products").find((p) => p.id === i.product)?.name,
                  i.qty,
                ])}
              />
              <p>{aux.row.note}</p>
              <p className="notice-box">
                {T(
                  "申请不是正式订单，确认已发布报价后转单。",
                  "Requests become orders only after accepting a published quotation.",
                )}
              </p>
            </>
          ) : (
            <>
              <KV
                items={Object.entries(aux.row)
                  .filter(
                    ([k, v]) =>
                      [
                        "name",
                        "order",
                        "version",
                        "status",
                        "valid",
                        "amount",
                        "currency",
                        "receivedAt",
                        "transaction",
                        "note",
                        "terms",
                      ].includes(k) && typeof v !== "object",
                  )
                  .map(([k, v]) => [
                    (
                      {
                        name: T("标题", "Title"),
                        order: T("订单", "Order"),
                        version: T("版本", "Version"),
                        status: T("状态", "Status"),
                        valid: T("有效期", "Valid until"),
                        amount: T("金额", "Amount"),
                        currency: T("币种", "Currency"),
                        receivedAt: T("实际收款日期", "Received on"),
                        transaction: T("银行流水号", "Transaction"),
                        note: T("备注", "Note"),
                        terms: T("条款", "Terms"),
                      } as Record<string, string>
                    )[k],
                    k === "status" ? badge(String(v)) : String(v),
                  ])}
              />
              {aux.row.allocations && (
                <ParityTable
                  heads={["订单", "分配金额"]}
                  rows={aux.row.allocations.map((a: any) => [
                    a.order,
                    money(a.amount, aux.row.currency),
                  ])}
                />
              )}
            </>
          )}
        </Dialog>
      )}
      {detail && (
        <div className="modal-backdrop">
          <section className="modal wide">
            <div className="modal-head">
              <div>
                <small>{page === "quotes" ? "QUOTATION" : "SALES ORDER"}</small>
                <h2>
                  {(detail.detailKind || page) === "quotes"
                    ? T("报价详情", "Quotation details")
                    : T("订单详情", "Order details")}{" "}
                  · {detail.id}
                </h2>
              </div>
              <button className="icon-btn" onClick={() => setDetail(null)}>
                <X />
              </button>
            </div>
            <div className="modal-body">
              <BusinessDetail
                record={detail}
                kind={detail.detailKind || page}
                data={data}
                portal={!!portal}
                en={en}
                role={user.role}
                onDeliver={(s) =>
                  openForm(
                    "登记签收 / Record delivery",
                    [
                      {
                        key: "deliveredAt",
                        label: "实际签收日期 / Delivered date",
                        type: "date",
                        value: today(),
                      },
                      {
                        key: "note",
                        label: "签收说明 / Note",
                        required: false,
                      },
                    ],
                    "shipment-deliver",
                    { id: s.id },
                  )
                }
              />
            </div>
            <div className="modal-actions">
              {(detail.detailKind || page) === "quotes" &&
                sales &&
                detail.status === "draft" && (
                  <>
                    {btn("编辑草稿", () => quote(detail))}
                    {btn(
                      "提交审批",
                      () => perform("quote-submit", { id: detail.id }),
                      true,
                    )}
                  </>
                )}
              {(detail?.detailKind || page) === "quotes" &&
                detail.status === "pending" &&
                detail.approvers?.[detail.step] === user.id && (
                  <>
                    {btn(
                      "审批通过",
                      () =>
                        openForm(
                          "审批通过 · " +
                            detail.id +
                            " · " +
                            money(detail.total, detail.currency),
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
              {(detail?.detailKind || page) === "quotes" &&
                sales &&
                detail.status === "approved" &&
                !detail.published &&
                btn(
                  "发布给客户",
                  () => perform("quote-publish", { id: detail.id }),
                  true,
                )}
              {(detail?.detailKind || page) === "quotes" &&
                sales &&
                ["rejected", "approved"].includes(detail.status) &&
                btn("创建修订版本", () => quote(detail))}
              {(detail?.detailKind || page) === "quotes" &&
                portal &&
                detail.status === "approved" &&
                detail.published &&
                detail.valid >= today() &&
                btn(
                  T("接受报价并生成订单", "Accept and create order"),
                  () => setAux({ kind: "accept", row: detail }),
                  true,
                )}
              {(detail?.detailKind || page) === "quotes" &&
                ["approved", "accepted"].includes(detail.status) &&
                btn(T("正式报价 / PDF", "Quotation / PDF"), () =>
                  setPrintQuote(detail),
                )}
              {(detail.detailKind || page) === "quotes" &&
                ["approved", "accepted"].includes(detail.status) && (
                  <a
                    className="btn"
                    href={"/api/v1/quotes/" + detail.id + "/items.csv"}
                  >
                    {T("商品明细 CSV", "Item details CSV")}
                  </a>
                )}
              {(detail.detailKind || page) === "orders" &&
                warehouse &&
                detail.status === "confirmed" && (
                  <>
                    {!detail.released ? (
                      btn(
                        "释放生产",
                        () => perform("order-release", { id: detail.id }),
                        true,
                      )
                    ) : (
                      <>
                        {detail.items.some((i: any) => i.produced < i.qty) &&
                          btn("分批生产入库", () => batch(detail, false))}
                        {detail.items.some(
                          (i: any) => i.shipped < i.produced,
                        ) && btn("分批发运", () => batch(detail, true), true)}
                      </>
                    )}
                  </>
                )}
              {(detail?.detailKind || page) === "orders" &&
                (sales || finance) &&
                detail.total > detail.paid &&
                detail.status !== "cancelled" &&
                btn("登记回款", () => receipt(detail), true)}
              {sales &&
                ["confirmed", "draft", "pending", "approved"].includes(
                  detail.status,
                ) &&
                btn("记录跟进", () =>
                  follow(detail, detail.detailKind || page),
                )}
              {(detail?.detailKind || page) === "quotes" &&
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
              {(detail?.detailKind || page) === "orders" &&
                ["owner", "manager"].includes(user.role) &&
                detail.status === "confirmed" &&
                !detail.paid &&
                detail.items.every((i: any) => !i.produced) &&
                btn("取消未履约订单", () =>
                  openForm(
                    "取消订单",
                    [{ key: "reason", label: "取消原因" }],
                    "order-cancel",
                    { id: detail.id },
                  ),
                )}
              {(detail?.detailKind || page) === "orders" &&
                ["owner", "manager"].includes(user.role) &&
                detail.status === "confirmed" &&
                detail.items.some((i: any) => i.qty > i.produced) &&
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
      <a className="skip-link" href="#login-form">
        跳转到登录表单
      </a>
      <section className="login-story">
        <div className="brand">
          <span className="brand-symbol">V</span>
          <div>
            VESTA<small>TRADE WORKSPACE</small>
          </div>
        </div>
        <div>
          <span className="eyebrow">VESTA / 销售与客户协作</span>
          <h1>
            Vesta 外贸协作，
            <br />
            从询价到回款。
          </h1>
          <p>
            团队跟进销售，客户查看订单。
            <br />
            在同一个工作空间，接续每一步业务。
          </p>
          <div className="login-stats">
            <span>
              01<small>询价与报价</small>
            </span>
            <span>
              02<small>生产与交付</small>
            </span>
            <span>
              03<small>核款与结清</small>
            </span>
          </div>
        </div>
        <small>VESTA · LOCAL DEMONSTRATION / 2026</small>
      </section>
      <section className="login-panel">
        <div className="login-card" id="login-form" tabIndex={-1}>
          <span className="eyebrow">VESTA WORKSPACE</span>
          <h2>{resetToken ? "设置新密码" : "登录工作空间"}</h2>
          <p>选择演示角色，或使用你的账号继续工作。</p>
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
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>
            <label>
              密码
              <input
                type="password"
                autoComplete={resetToken ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            {error && (
              <div className="alert error" role="alert">
                {error}
              </div>
            )}
            {localMessage && (
              <div className="notice-box section-gap" role="status">
                {localMessage}
              </div>
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
                ["owner", "管理"],
                ["manager", "经理"],
                ["sales", "销售"],
                ["buyer", "客户"],
              ].map(([id, name]) => (
                <button
                  key={id}
                  aria-pressed={username === id}
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
  rates,
  orders,
  onClose,
  onError,
  onSuccess,
}: {
  form: Form;
  products: Row[];
  rates: Row[];
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
  const quoteFx = values.fxId
    ? rates.find((r) => r.id === values.fxId)
    : products[0]?.pricingFx;
  const canConvert =
    quoteFx &&
    !quoteFx.invalid &&
    Number.isFinite(Number(quoteFx.rate)) &&
    Number(quoteFx.rate) > 0;
  const referenceUnit = (p: Row) =>
    values.currency === "USD"
      ? canConvert
        ? new Decimal(p.price).div(quoteFx.rate).toDecimalPlaces(2).toNumber()
        : null
      : p.price;
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
                      onChange={(e) => {
                        if (
                          form.quote &&
                          f.key === "currency" &&
                          values.currency !== e.target.value
                        ) {
                          const fx = values.fxId
                            ? rates.find((r) => r.id === values.fxId)
                            : products[0]?.pricingFx;
                          if (
                            !fx ||
                            fx.invalid ||
                            !Number.isFinite(Number(fx.rate)) ||
                            Number(fx.rate) <= 0
                          ) {
                            setError(
                              "没有有效汇率，无法切换报价币种 / No valid exchange rate",
                            );
                            return;
                          }
                          const convert = (n: any) =>
                            (e.target.value === "USD"
                              ? new Decimal(n || 0).div(fx.rate)
                              : new Decimal(n || 0).times(fx.rate)
                            )
                              .toDecimalPlaces(2)
                              .toNumber();
                          setItems(
                            items.map((i) => ({
                              ...i,
                              price: convert(i.price),
                            })),
                          );
                          setValues({
                            ...values,
                            currency: e.target.value,
                            fxId: fx.id,
                            freight: convert(values.freight),
                            fees: convert(values.fees),
                            discount: convert(values.discount),
                          });
                          setError("");
                        } else
                          setValues({ ...values, [f.key]: e.target.value });
                      }}
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
                <p className="muted">
                  {canConvert
                    ? "1 USD = " +
                      quoteFx.rate +
                      " CNY · " +
                      quoteFx.date +
                      " · " +
                      quoteFx.source
                    : "无可用汇率 / No valid exchange rate"}
                </p>
                <button
                  type="button"
                  className="btn"
                  disabled={values.currency === "USD" && !canConvert}
                  onClick={() =>
                    setItems(
                      items.map((i) => {
                        const p = products.find((p) => p.id === i.product);
                        return p ? { ...i, price: referenceUnit(p) } : i;
                      }),
                    )
                  }
                >
                  按所选汇率采用当前产品参考价 / Apply reference prices
                </button>
                <p className="muted">
                  已录入单价不会因后台汇率更新自动变化；采用参考价会替换本草稿商品单价。
                </p>
                <p className="notice-box">
                  合计 / Total:{" "}
                  {money(
                    items.reduce(
                      (s, i) => s + Number(i.qty) * Number(i.price),
                      0,
                    ) +
                      Number(values.freight || 0) +
                      Number(values.fees || 0) -
                      Number(values.discount || 0),
                    values.currency || "CNY",
                  )}{" "}
                  · 预付款 / Deposit:{" "}
                  {money(
                    ((items.reduce(
                      (s, i) => s + Number(i.qty) * Number(i.price),
                      0,
                    ) +
                      Number(values.freight || 0) +
                      Number(values.fees || 0) -
                      Number(values.discount || 0)) *
                      Number(values.depositPct || 0)) /
                      100,
                    values.currency || "CNY",
                  )}
                </p>
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
                                  price: referenceUnit(p),
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
                        value={i.price ?? ""}
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
                          price: referenceUnit(p),
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
  contracts,
  send,
  onError,
}: {
  orders: { value: string; label: string }[];
  contracts: Row[];
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
            contract: v.get("contract") || undefined,
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
      <select name="contract" aria-label="合同档案">
        <option value="">新建独立附件档案</option>
        {contracts
          .filter((c) => !c.bytes && c.status !== "signed")
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.order} · {c.name} V{c.version}
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
            行，仅新增；已存在的编号不会被覆盖。产品成本需管理人员在导入后单独核定。
          </div>
          <div className="upload-form">
            <a className="btn" href={"/api/v1/templates/" + kind}>
              下载模板
            </a>
            {kind === "products" && (
              <button
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    setPreview(
                      await api("imports/products/preview", {
                        content:
                          "sku,name,en,category,moq,price,usd,lead\nDEMO-PREVIEW-A,预检样例,Preview,gifts,100,48,6.8,15\nDEMO-PREVIEW-B,错误MOQ,Invalid MOQ,gifts,0,48,6.8,15\nDEMO-PREVIEW-A,重复编号,Duplicate,gifts,100,48,6.8,15",
                      }),
                    );
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                查看预检样例
              </button>
            )}
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
