import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chinaDay,
  queryReferenceRate,
  validateRate,
} from "../dist/server/fx-provider.js";

const now = new Date("2026-11-07T12:00:00Z");
const payload = (date = "2026-11-07", rate = 6.6636) => ({
  base: "USD",
  quote: "CNY",
  date,
  rate,
});
const queryDate = (url) => new URL(url).searchParams.get("date");

test("provider query pins Beijing day across UTC midnight and calendar boundaries", async () => {
  assert.equal(chinaDay(new Date("2026-12-31T16:00:00Z")), "2027-01-01");
  const result = await queryReferenceRate(async (url, options) => {
    assert.equal(queryDate(url), "2026-11-08");
    assert.ok(options.signal);
    return Response.json(payload("2026-11-08"));
  }, new Date("2026-11-07T16:01:00Z"));
  assert.equal(result.date, "2026-11-08");
});

test("future-dated latest response falls back without rewriting its observation date", async () => {
  const dates = [];
  const result = await queryReferenceRate(async (url) => {
    dates.push(queryDate(url));
    return Response.json(
      payload(dates.length === 1 ? "2026-11-08" : "2026-11-06"),
    );
  }, now);
  assert.deepEqual(dates, ["2026-11-07", "2026-11-06"]);
  assert.equal(result.date, "2026-11-06");
  assert.match(result.attempts[0].error, /2026-11-08.*2026-11-07/);
});

test("weekend response may legitimately contain an older date; 404 falls back", async () => {
  let calls = 0;
  const result = await queryReferenceRate(async () => {
    calls++;
    return Response.json(payload("2026-11-06"));
  }, now);
  assert.equal(calls, 1);
  assert.equal(result.requestedDate, "2026-11-07");
  assert.equal(result.date, "2026-11-06");
  calls = 0;
  const fallback = await queryReferenceRate(
    async () =>
      ++calls === 1
        ? new Response(null, { status: 404 })
        : Response.json(payload("2026-11-06")),
    now,
  );
  assert.equal(fallback.date, "2026-11-06");
  assert.equal(calls, 2);
});

test("invalid currencies, calendar dates and numeric values cannot become exchange rates", () => {
  for (const invalid of [
    { ...payload(), base: "CNY" },
    { ...payload(), quote: "EUR" },
    payload("2026-02-30"),
    payload("not-a-date"),
    payload("2026-11-08"),
    ...[0, -1, null, true, [], {}, "", "NaN", "Infinity"].map((value) =>
      payload("2026-11-07", value),
    ),
  ])
    assert.throws(() => validateRate(invalid, "2026-11-07"));
  assert.equal(
    validateRate(payload("2026-11-06", "6.66"), "2026-11-07").rate,
    "6.66",
  );
});

test("malformed JSON falls back; missing history is bounded to eight dates", async () => {
  let calls = 0;
  const recovered = await queryReferenceRate(
    async () =>
      ++calls === 1
        ? new Response("<html>bad gateway</html>")
        : Response.json(payload("2026-11-06")),
    now,
  );
  assert.match(recovered.attempts[0].error, /JSON/);
  calls = 0;
  await assert.rejects(
    queryReferenceRate(async () => {
      calls++;
      return new Response(null, { status: 404 });
    }, now),
    /暂无汇率/,
  );
  assert.equal(calls, 8);
});

test("transient server or network error retries once; rate limits stop immediately", async () => {
  let calls = 0;
  await queryReferenceRate(
    async () =>
      ++calls === 1
        ? new Response(null, { status: 503 })
        : Response.json(payload()),
    now,
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    queryReferenceRate(async () => {
      calls++;
      throw new Error("offline fixture");
    }, now),
    /offline fixture/,
  );
  assert.equal(calls, 2);
  calls = 0;
  await assert.rejects(
    queryReferenceRate(async () => {
      calls++;
      return new Response(null, { status: 429 });
    }, now),
    /HTTP 429/,
  );
  assert.equal(calls, 1);
});

test("timeouts are explicit and bounded; backtracking handles month boundaries", async () => {
  let calls = 0;
  await assert.rejects(
    queryReferenceRate(async () => {
      calls++;
      throw new DOMException("timeout", "TimeoutError");
    }, now),
    /请求超时/,
  );
  assert.equal(calls, 2);
  const dates = [];
  await queryReferenceRate(async (url) => {
    dates.push(queryDate(url));
    return dates.length === 1
      ? new Response(null, { status: 404 })
      : Response.json(payload("2026-10-31"));
  }, new Date("2026-11-01T01:00:00Z"));
  assert.deepEqual(dates, ["2026-11-01", "2026-10-31"]);
});
