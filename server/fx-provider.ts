// Provider I/O is isolated so date validation and failure recovery can be tested
// without a network or database. Never relabel the provider's observation date.
export const chinaDay = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

class ProviderError extends Error {
  constructor(
    message: string,
    readonly recovery: "older" | "retry" | "stop",
  ) {
    super(message);
  }
}

export function validateRate(raw: any, requestedDate: string) {
  if (!raw || raw.base !== "USD" || raw.quote !== "CNY")
    throw new ProviderError("供应商返回的币种不是USD/CNY", "older");
  if (
    typeof raw.date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(raw.date) ||
    !Number.isFinite(Date.parse(raw.date)) ||
    new Date(raw.date).toISOString().slice(0, 10) !== raw.date
  )
    throw new ProviderError("供应商数据日期格式无效", "older");
  if (raw.date > requestedDate)
    throw new ProviderError(
      `供应商数据日期${raw.date}晚于请求日期${requestedDate}`,
      "older",
    );
  if (
    !["number", "string"].includes(typeof raw.rate) ||
    !Number.isFinite(Number(raw.rate)) ||
    Number(raw.rate) <= 0
  )
    throw new ProviderError("供应商汇率必须为有效正数", "older");
  return { base: "USD", quote: "CNY", date: raw.date, rate: String(raw.rate) };
}

export async function queryReferenceRate(
  request: typeof fetch = fetch,
  now = new Date(),
) {
  const today = chinaDay(now);
  const deadline = Date.now() + 20000;
  const attempts: { requestedDate: string; error: string }[] = [];
  const fail = () =>
    new Error(attempts.map((a) => `${a.requestedDate}: ${a.error}`).join("；"));
  // Today plus seven preceding calendar dates; stop earlier on outages/rate limits.
  for (let daysBack = 0; daysBack <= 7; daysBack++) {
    const requestedDate = new Date(Date.parse(today) - daysBack * 86400000)
      .toISOString()
      .slice(0, 10);
    for (let retry = 0; retry < 2; retry++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        attempts.push({ requestedDate, error: "查询超过20秒总时限" });
        throw fail();
      }
      try {
        const response = await request(
          `https://api.frankfurter.dev/v2/rate/USD/CNY?date=${requestedDate}`,
          { signal: AbortSignal.timeout(Math.min(7000, remaining)) },
        );
        if (!response.ok)
          throw new ProviderError(
            response.status === 404
              ? "该日期暂无汇率（HTTP 404）"
              : `汇率服务HTTP ${response.status}`,
            response.status === 404
              ? "older"
              : response.status >= 500
                ? "retry"
                : "stop",
          );
        let raw: unknown;
        try {
          raw = await response.json();
        } catch (e) {
          if (
            (e as Error).name === "TimeoutError" ||
            (e as Error).name === "AbortError"
          )
            throw e;
          throw new ProviderError("供应商返回的内容不是有效JSON", "older");
        }
        return { ...validateRate(raw, requestedDate), requestedDate, attempts };
      } catch (e) {
        const error = e as Error;
        attempts.push({
          requestedDate,
          error:
            error.name === "TimeoutError" || error.name === "AbortError"
              ? "汇率服务请求超时"
              : error.message,
        });
        if (e instanceof ProviderError && e.recovery === "older") break;
        if (
          (e instanceof ProviderError && e.recovery === "stop") ||
          retry === 1
        )
          throw fail();
      }
    }
  }
  throw fail();
}
