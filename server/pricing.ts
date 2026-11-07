import Decimal from "decimal.js";
import { Store } from "./db";
import { latestRate, stale } from "./fx";
import { businessNow } from "./clock";

// The catalogue has one base price. Legacy stored USD values are not prices
// derived from today's rate and must not be presented as such.
export async function cataloguePricing(db: Store, products: any[]) {
  const rate = await latestRate(db);
  const status = await db.get("settings", "fx-status");
  const fx = rate && {
    id: rate.id,
    rate: rate.rate,
    date: rate.date,
    source: rate.source,
    fetchedAt: rate.fetchedAt || null,
    simulated: !!rate.simulated,
    stale: stale(rate, businessNow()),
    updateFailed: !!status?.error,
  };
  return products.map((p) => ({
    ...p,
    usd: fx
      ? new Decimal(p.price).div(fx.rate).toDecimalPlaces(2).toNumber()
      : null,
    pricingFx: fx || null,
  }));
}
