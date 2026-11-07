import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { z } from "zod";
import { User, allow, digest } from "./auth";
import { Store, transaction } from "./db";

export const templates: Record<string, string> = {
  orders:
    "externalId,customerExternalId,currency,total,paid,confirmedAt,eta,balanceDue\r\nDEMO-SO,DEMO-C01,CNY,1000,300,2026-10-01,2026-10-20,2026-10-27",
  products:
    "sku,name,en,category,moq,price,lead,spec,specEn,safe\r\nDEMO-NEW,演示产品,Demo Product,日用礼品,100,48,15,示例规格,Sample specification,100",
  customers:
    "externalId,name,en,country,contact,email,currency,address\r\nDEMO-C01,演示客户,Demo Buyer,Singapore,Alex,buyer@example.test,USD,Demo address",
};
export function parseCsv(text: string): string[][] {
  if (text.length > 1024 * 1024) throw new BadRequestException("CSV 最大 1MB");
  const rows: string[][] = [];
  let row: string[] = [],
    value = "",
    quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i++) {
    const c = source[i];
    if (c === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else if (quoted || value === "") quoted = !quoted;
      else throw new BadRequestException("CSV 引号格式错误");
    } else if (c === "," && !quoted) {
      row.push(value);
      value = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && source[i + 1] === "\n") i++;
      row.push(value);
      if (row.some((v) => v.trim())) rows.push(row);
      row = [];
      value = "";
    } else value += c;
  }
  if (quoted) throw new BadRequestException("CSV 引号未闭合");
  row.push(value);
  if (row.some((v) => v.trim())) rows.push(row);
  if (rows.length > 501) throw new BadRequestException("每批最多 500 行");
  return rows;
}
const word = z.string().trim().min(1).max(500),
  number = z.coerce.number().finite().nonnegative().max(1e8);
const schemas = {
  products: z.object({
    sku: word,
    name: word,
    en: word,
    category: word,
    spec: z.string().max(500).optional(),
    specEn: z.string().max(500).optional(),
    safe: z.coerce.number().int().nonnegative().optional(),
    moq: z.coerce.number().int().positive().max(1e6),
    price: number,
    usd: number.optional(),
    lead: z.coerce.number().int().positive().max(365),
  }),
  customers: z.object({
    externalId: word,
    name: word,
    en: word,
    country: word,
    contact: word,
    email: z.email(),
    currency: z.enum(["CNY", "USD"]),
    address: word,
  }),
};
async function validate(
  db: Store,
  kind: "products" | "customers",
  text: string,
  u: User,
) {
  const parsed = parseCsv(text);
  if (parsed.length < 2) throw new BadRequestException("需要表头和数据行");
  const headers = parsed[0].map((v) => v.trim());
  if (new Set(headers).size !== headers.length)
    throw new BadRequestException("表头重复");
  const existing = await db.all(kind),
    seen = new Set<string>();
  const result = [];
  for (let i = 1; i < parsed.length; i++) {
    const values = Object.fromEntries(
      headers.map((h, j) => [h, parsed[i][j] ?? ""]),
    );
    const validation = schemas[kind].safeParse(values);
    const errors =
      parsed[i].length === headers.length
        ? []
        : [{ column: "CSV", message: "列数与表头不一致" }];
    if (!validation.success)
      errors.push(
        ...validation.error.issues.map((e) => ({
          column: e.path.join("."),
          message: e.message,
        })),
      );
    for (const column of headers.filter((h) =>
      ["cost", "margin", "stock", "reserved", "owner", "role"].includes(h),
    ))
      errors.push({ column, message: "此模板不允许维护受限字段" });
    const key = kind === "products" ? values.sku : values.externalId;
    if (seen.has(key))
      errors.push({
        column: kind === "products" ? "sku" : "externalId",
        message: "文件中编号重复",
      });
    seen.add(key);
    const id = `${kind === "products" ? "IMP-P" : "IMP-C"}-${digest(key || "").slice(0, 16)}`;
    if (
      existing.some((r) =>
        kind === "products" ? r.sku === key : r.externalId === key,
      )
    )
      errors.push({
        column: kind === "products" ? "sku" : "externalId",
        message: "编号已存在；本期导入只新增，不覆盖",
      });
    result.push({
      line: i + 1,
      errors,
      data: validation.success
        ? {
            ...validation.data,
            id,
            ...(kind === "products"
              ? { stock: 0, reserved: 0, cost: null, unit: "件" }
              : {
                  owner: u.role === "sales" ? u.id : "sales",
                  lastFollow: new Date().toISOString(),
                }),
          }
        : null,
    });
  }
  return result;
}
export async function previewImport(u: User, kind: string, content: string) {
  if (kind !== "products" && kind !== "customers")
    throw new BadRequestException("仅支持客户或产品模板");
  allow(
    u,
    kind === "products" ? ["owner", "manager"] : ["owner", "manager", "sales"],
  );
  return transaction(async (db) => {
    const id = "IMPORT-" + digest(u.id + kind + content).slice(0, 24);
    const previous = await db.get("imports", id);
    if (previous?.status === "committed")
      return {
        id,
        status: "committed",
        rows: previous.rows.map((r: any) => ({
          line: r.line,
          errors: r.errors,
        })),
        count: previous.rows.length,
      };
    const rows = await validate(db, kind, content, u);
    await db.put("imports", {
      id,
      actor: u.id,
      kind,
      content,
      rows,
      status: "preview",
    });
    return {
      id,
      status: "preview",
      rows: rows.map((r) => ({ line: r.line, errors: r.errors })),
      count: rows.length,
    };
  });
}
export async function commitImport(u: User, id: string) {
  return transaction(async (db) => {
    const job = await db.get("imports", id);
    if (!job || job.actor !== u.id) throw new ForbiddenException();
    if (job.status === "committed")
      return { id, count: job.rows.length, status: "committed" };
    const rows = await validate(db, job.kind, job.content, u);
    if (rows.some((r) => r.errors.length))
      throw new BadRequestException("预检结果已变化或仍有错误，请重新预检");
    for (const row of rows) await db.put(job.kind, row.data!);
    await db.put("imports", { ...job, rows, status: "committed" });
    await db.audit(u.id, "import-" + job.kind, id);
    return { id, count: rows.length, status: "committed" };
  });
}
