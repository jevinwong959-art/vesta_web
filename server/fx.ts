import { BadRequestException } from "@nestjs/common";
import { read, transaction, uid, Store, RecordData } from "./db";
import { chinaDay, queryReferenceRate } from "./fx-provider";
export { chinaDay } from "./fx-provider";
export const stale = (r: RecordData, now = new Date()) =>
  Math.floor((Date.parse(chinaDay(now)) - Date.parse(r.date)) / 86400000) > 7;
export async function latestRate(db: Store) {
  const rates = (await db.all("rates")).filter(
    (r) =>
      !r.invalid &&
      Number.isFinite(Number(r.rate)) &&
      Number(r.rate) > 0 &&
      r.date <= chinaDay(),
  );
  const automatic = rates
    .filter(
      (x) => !x.manual && !x.simulated && !x.invalid && x.date <= chinaDay(),
    )
    .sort(
      (a, b) =>
        String(b.date).localeCompare(String(a.date)) ||
        String(b.fetchedAt || b.date).localeCompare(
          String(a.fetchedAt || a.date),
        ),
    );
  return automatic[0] || rates.filter((x) => x.simulated).at(-1);
}
let refreshing: Promise<RecordData> | undefined;
export function refreshRates(actor: string): Promise<RecordData> {
  if (refreshing) return refreshing;
  refreshing = fetchRate(actor).finally(() => {
    refreshing = undefined;
  });
  return refreshing;
}
async function fetchRate(actor: string) {
  let lastError = "汇率服务暂不可用";
  try {
    const raw = await queryReferenceRate();
    return await transaction(async (db) => {
      const source = "Frankfurter v2 · blended reference";
      const existing = (await db.all("rates")).find(
        (r) =>
          r.source === source &&
          !r.invalid &&
          !r.simulated &&
          !r.manual &&
          r.base === "USD" &&
          r.quote === "CNY" &&
          r.date === raw.date &&
          r.rate === String(raw.rate),
      );
      const value =
        existing ||
        (await db.put("rates", {
          id: uid("FX"),
          base: "USD",
          quote: "CNY",
          rate: String(raw.rate),
          source,
          date: raw.date,
          fetchedAt: new Date().toISOString(),
          simulated: false,
          requestedDate: raw.requestedDate,
        }));
      await db.put("settings", {
        id: "fx-status",
        checkedAt: new Date().toISOString(),
        successDay: chinaDay(),
        successSlot: scheduleSlot(),
        error: null,
        requestedDate: raw.requestedDate,
        dataDate: raw.date,
        rateId: value.id,
        attempts: raw.attempts,
      });
      await db.audit(actor, "refresh reference exchange rate", value.id);
      return value;
    });
  } catch (e) {
    lastError = (e as Error).message;
  }
  await transaction((db) =>
    db.put("settings", {
      id: "fx-status",
      checkedAt: new Date().toISOString(),
      error: lastError,
    }),
  );
  throw new BadRequestException(`汇率查询失败，保留已有版本：${lastError}`);
}
export function scheduleSlot(date = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hour12: false,
    }).format(date),
  );
  return `${chinaDay(date)}:${hour >= 9 ? "after09" : "startup"}`;
}
export async function scheduledFx() {
  if (process.env.FX_AUTO === "false") return;
  const status = await read((db) => db.get("settings", "fx-status"));
  if (status?.successSlot === scheduleSlot()) return;
  if (
    status?.error &&
    status?.checkedAt &&
    Date.now() - Date.parse(status.checkedAt) < 60 * 60 * 1000
  )
    return;
  try {
    await refreshRates("scheduler");
  } catch {
    /* persisted failure is visible in UI */
  }
}
