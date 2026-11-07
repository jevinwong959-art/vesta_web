import React from "react";

export const displayCurrency = (en: boolean) => (en ? "USD" : "CNY");
export const productPrice = (p: any, currency: string): number | null =>
  currency === "USD" ? (p?.usd ?? null) : (p?.price ?? null);

export function PricingNote({ product, en }: { product: any; en: boolean }) {
  const fx = product?.pricingFx;
  const T = (a: string, b: string) => (en ? b : a);
  return (
    <div className="notice-box pricing-note">
      <div role="status">
        {T("产品参考价 · CNY。", "Reference prices · USD.")}{" "}
        {fx ? (
          <>
            {fx.simulated && (
              <strong>
                {T(
                  "模拟汇率 · 非真实行情。",
                  "SIMULATED RATE · Not live market data.",
                )}{" "}
              </strong>
            )}
            {T("汇率日期", "Rate date")} {fx.date}.
            {fx.stale && (
              <strong>
                {" "}
                {T(
                  "汇率已超过7天，请在正式核价前核实。",
                  "Rate older than 7 days; verify before quoting.",
                )}
              </strong>
            )}
            {fx.updateFailed && (
              <span>
                {" "}
                {T(
                  "自动查询失败，暂用最近可用版本。",
                  "Automatic update failed; using the last available version.",
                )}
              </span>
            )}
          </>
        ) : (
          T(
            "没有有效汇率，美元价暂不可用；人民币价可正常查看。",
            "No valid exchange rate. USD prices unavailable; CNY prices remain available.",
          )
        )}
      </div>
      <details>
        <summary>
          {T("汇率与价格说明", "Exchange rate & pricing details")}
        </summary>
        <p>
          {fx && (
            <>
              {T("来源", "Source")}: {fx.source} · 1 USD = {fx.rate} CNY.{" "}
              {T(
                "美元价 = 人民币标准价 ÷ 汇率，保留两位小数。",
                "USD = CNY base price ÷ rate, rounded to two decimals.",
              )}{" "}
            </>
          )}
          {T(
            "已保存报价和订单沿用各自币种及锁定汇率。",
            "Saved quotations and orders keep their own currency and locked rate.",
          )}
        </p>
      </details>
    </div>
  );
}
