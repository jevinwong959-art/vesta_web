import Decimal from "decimal.js";
import React, { useState } from "react";
import { X, Plus } from "lucide-react";
import { fmt as money } from "./workspace";
import type { Form } from "./form-types";
type Row = { id: string; [key: string]: any };

export default function FormModal({
  en,
  form,
  products,
  rates,
  orders,
  onClose,
  onError,
  onSuccess,
}: {
  en: boolean;
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
          <button
            className="icon-btn"
            aria-label={en ? "Close" : "关闭"}
            onClick={onClose}
          >
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
                <React.Fragment key={f.key}>
                  {f.section && (
                    <h3 className="full form-section-heading">{f.section}</h3>
                  )}
                  <label className={f.type === "textarea" ? "full" : ""}>
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
                </React.Fragment>
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
                      aria-label={
                        en
                          ? `Remove allocation ${i + 1}`
                          : `移除第${i + 1}项核销`
                      }
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
                      aria-label={
                        en
                          ? `Remove product ${index + 1}`
                          : `移除第${index + 1}项商品`
                      }
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
            {error && (
              <div role="alert" className="alert error section-gap">
                {error}
              </div>
            )}
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

export type FormModalProps = Parameters<typeof FormModal>[0];
