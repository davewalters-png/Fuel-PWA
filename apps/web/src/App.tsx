import { useEffect, useMemo, useState, type FormEvent } from "react";
import { fetchHealth, fetchProducts, searchUnits } from "./api";
import { enqueue, loadQueue, syncPending } from "./queue";
import type {
  LineDraft,
  ProductDefinition,
  QueuedTransaction,
  UnitSummary,
} from "./types";

function newClientId(): string {
  return `yf-${crypto.randomUUID()}`;
}

function emptyLine(productCode = "DIESEL"): LineDraft {
  return { productCode, quantity: "", unitCost: "", notes: "" };
}

export function App() {
  const [products, setProducts] = useState<ProductDefinition[]>([]);
  const [units, setUnits] = useState<UnitSummary[]>([]);
  const [unitQuery, setUnitQuery] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<UnitSummary | null>(null);
  const [meterReading, setMeterReading] = useState("");
  const [hourMeter, setHourMeter] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [locationName, setLocationName] = useState("");
  const [comments, setComments] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine("DIESEL")]);
  const [queue, setQueue] = useState<QueuedTransaction[]>([]);
  const [online, setOnline] = useState(navigator.onLine);
  const [health, setHealth] = useState<{
    ok: boolean;
    mock: boolean;
    detail: string;
  } | null>(null);
  const [toast, setToast] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"record" | "queue">("record");

  const primaryProducts = useMemo(
    () => products.filter((p) => p.kind === "primary"),
    [products],
  );
  const otherProducts = useMemo(
    () => products.filter((p) => p.kind === "other"),
    [products],
  );

  useEffect(() => {
    void (async () => {
      try {
        const [productList, healthStatus, stored] = await Promise.all([
          fetchProducts(),
          fetchHealth(),
          loadQueue(),
        ]);
        setProducts(productList);
        setHealth(healthStatus);
        setQueue(stored);
        const initialUnits = await searchUnits("");
        setUnits(initialUnits);
      } catch (err) {
        setToast({
          kind: "err",
          text:
            err instanceof Error
              ? err.message
              : "Unable to reach YardFuel API",
        });
      }
    })();
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      void syncPending(setQueue);
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void searchUnits(unitQuery).then(setUnits).catch(() => setUnits([]));
    }, 220);
    return () => window.clearTimeout(handle);
  }, [unitQuery]);

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  }

  function productUnit(code: string): string {
    return products.find((p) => p.code === code)?.unit ?? "gal";
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setToast(null);

    if (!selectedUnit) {
      setToast({ kind: "err", text: "Select an asset / unit first." });
      return;
    }

    const lineItems = lines
      .map((line) => ({
        productCode: line.productCode,
        quantity: Number(line.quantity),
        unitCost: line.unitCost === "" ? undefined : Number(line.unitCost),
        notes: line.notes.trim() || undefined,
      }))
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

    if (lineItems.length === 0) {
      setToast({
        kind: "err",
        text: "Add at least one product with a quantity.",
      });
      return;
    }

    const clientTransactionId = newClientId();
    const payload: QueuedTransaction["payload"] = {
      clientTransactionId,
      unitId: selectedUnit.unitId,
      ticketDate: new Date().toISOString(),
      meterReading:
        meterReading === "" ? undefined : Number(meterReading) || undefined,
      hourMeter: hourMeter === "" ? undefined : Number(hourMeter) || undefined,
      employeeId: employeeId.trim() || undefined,
      locationName: locationName.trim() || undefined,
      comments: comments.trim() || undefined,
      lineItems,
    };

    const item: QueuedTransaction = {
      id: clientTransactionId,
      createdAt: new Date().toISOString(),
      status: "pending",
      payload,
    };

    setSubmitting(true);
    try {
      let next = await enqueue(item);
      setQueue(next);

      if (online) {
        next = await syncPending(setQueue);
        const synced = next.find((q) => q.id === clientTransactionId);
        if (synced?.status === "synced") {
          setToast({
            kind: "ok",
            text: synced.ticketId
              ? `Pushed to TMT as ${synced.ticketId}`
              : "Fuel ticket pushed to TMT via MCP/client layer",
          });
          resetForm();
        } else {
          setToast({
            kind: "err",
            text: synced?.error ?? "Sync failed — queued for retry",
          });
        }
      } else {
        setToast({
          kind: "ok",
          text: "Saved offline. Will push to TMT when back online.",
        });
        resetForm();
      }
      setView("queue");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
    setSelectedUnit(null);
    setUnitQuery("");
    setMeterReading("");
    setHourMeter("");
    setComments("");
    setLines([emptyLine("DIESEL")]);
  }

  const pendingCount = queue.filter(
    (q) => q.status === "pending" || q.status === "error",
  ).length;

  return (
    <div className="app-shell">
      <header className="hero">
        <p className="status-pill">
          <span
            className={`status-dot ${online && health?.ok ? "ok" : online ? "err" : ""}`}
          />
          {online
            ? health?.mock
              ? "Online · TMT mock mode"
              : health?.ok
                ? "Online · TMT connected"
                : "Online · API issue"
            : "Offline · queueing locally"}
        </p>
        <h1 className="brand">
          Yard<span>Fuel</span>
        </h1>
        <p>
          Capture diesel, gasoline, propane, and yard fluids — then push a fuel
          ticket into TMT Fleet Maintenance.
        </p>
        <div className="hero-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setView("record")}
          >
            New ticket
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setView("queue")}
          >
            Queue{pendingCount ? ` (${pendingCount})` : ""}
          </button>
        </div>
      </header>

      {view === "record" ? (
        <section className="section">
          <h2>Fueling ticket</h2>
          <p className="lead">
            One asset, one visit — primary fuel plus any other products
            dispensed.
          </p>

          <form onSubmit={handleSubmit}>
            <div className="field-grid">
              <div className="field">
                <label htmlFor="unit">Asset / unit</label>
                <input
                  id="unit"
                  value={unitQuery}
                  onChange={(e) => {
                    setUnitQuery(e.target.value);
                    setSelectedUnit(null);
                  }}
                  placeholder="Search unit id, plate, or description"
                  autoComplete="off"
                />
                <div className="unit-results" role="listbox">
                  {units.slice(0, 6).map((unit) => (
                    <button
                      key={unit.unitId}
                      type="button"
                      className={`unit-option ${selectedUnit?.unitId === unit.unitId ? "selected" : ""}`}
                      onClick={() => {
                        setSelectedUnit(unit);
                        setUnitQuery(unit.unitId);
                        if (unit.meter != null)
                          setMeterReading(String(unit.meter));
                        if (unit.hourMeter != null)
                          setHourMeter(String(unit.hourMeter));
                      }}
                    >
                      <strong>{unit.unitId}</strong>
                      <span>
                        {[unit.description, unit.licensePlate]
                          .filter(Boolean)
                          .join(" · ") || "TMT unit"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
                <div className="field">
                  <label htmlFor="meter">Odometer</label>
                  <input
                    id="meter"
                    inputMode="decimal"
                    value={meterReading}
                    onChange={(e) => setMeterReading(e.target.value)}
                    placeholder="Miles"
                  />
                </div>
                <div className="field">
                  <label htmlFor="hours">Hour meter</label>
                  <input
                    id="hours"
                    inputMode="decimal"
                    value={hourMeter}
                    onChange={(e) => setHourMeter(e.target.value)}
                    placeholder="Hours"
                  />
                </div>
              </div>

              <div className="field-grid" style={{ gridTemplateColumns: "1fr 1fr", gap: "0.9rem" }}>
                <div className="field">
                  <label htmlFor="employee">Employee / driver</label>
                  <input
                    id="employee"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="field">
                  <label htmlFor="location">Location</label>
                  <input
                    id="location"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    placeholder="Yard, island, vendor"
                  />
                </div>
              </div>

              <div className="product-groups">
                <div className="product-group">
                  <h3>Primary products</h3>
                  <div className="product-list">
                    {lines.map((line, index) => {
                      const catalog = primaryProducts.length
                        ? primaryProducts
                        : fallbackPrimary;
                      if (!catalog.some((p) => p.code === line.productCode)) {
                        return null;
                      }
                      return (
                        <LineEditor
                          key={`line-${index}`}
                          line={line}
                          options={catalog}
                          unitLabel={productUnit(line.productCode)}
                          onChange={(patch) => updateLine(index, patch)}
                          onRemove={() =>
                            setLines((prev) =>
                              prev.length === 1
                                ? prev
                                : prev.filter((_, i) => i !== index),
                            )
                          }
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost add-line"
                    onClick={() =>
                      setLines((prev) => [
                        ...prev,
                        emptyLine(primaryProducts[0]?.code ?? "DIESEL"),
                      ])
                    }
                  >
                    + Primary product
                  </button>
                </div>

                <div className="product-group">
                  <h3>Other products</h3>
                  <div className="product-list">
                    {lines.map((line, index) => {
                      const catalog = otherProducts.length
                        ? otherProducts
                        : fallbackOther;
                      if (!catalog.some((p) => p.code === line.productCode)) {
                        return null;
                      }
                      return (
                        <LineEditor
                          key={`line-${index}`}
                          line={line}
                          options={catalog}
                          unitLabel={productUnit(line.productCode)}
                          onChange={(patch) => updateLine(index, patch)}
                          onRemove={() =>
                            setLines((prev) =>
                              prev.filter((_, i) => i !== index),
                            )
                          }
                        />
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost add-line"
                    onClick={() =>
                      setLines((prev) => [
                        ...prev,
                        emptyLine(otherProducts[0]?.code ?? "DEF"),
                      ])
                    }
                  >
                    + Antifreeze / oil / DEF
                  </button>
                </div>
              </div>

              <div className="field">
                <label htmlFor="comments">Notes</label>
                <textarea
                  id="comments"
                  rows={3}
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  placeholder="Island, pump, or exception notes"
                />
              </div>
            </div>

            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting
                  ? "Submitting…"
                  : online
                    ? "Push fuel ticket to TMT"
                    : "Save offline"}
              </button>
            </div>
          </form>

          {toast ? (
            <div className={`toast ${toast.kind}`}>{toast.text}</div>
          ) : null}
        </section>
      ) : (
        <section className="section">
          <h2>Sync queue</h2>
          <p className="lead">
            Pending tickets sync through the shared TMT client / MCP layer when
            the device is online.
          </p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!online}
              onClick={() => void syncPending(setQueue)}
            >
              Sync now
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setView("record")}
            >
              Back to ticket
            </button>
          </div>

          <div className="queue-list" style={{ marginTop: "1.1rem" }}>
            {queue.length === 0 ? (
              <p className="empty">No tickets yet.</p>
            ) : (
              queue.map((item) => (
                <article key={item.id} className="queue-item">
                  <div className="queue-top">
                    <strong>{item.payload.unitId}</strong>
                    <span className={`badge ${item.status}`}>{item.status}</span>
                  </div>
                  <div className="muted">
                    {new Date(item.createdAt).toLocaleString()} ·{" "}
                    {item.payload.lineItems
                      .map((l) => `${l.quantity} ${l.productCode}`)
                      .join(", ")}
                  </div>
                  {item.ticketId ? (
                    <div className="muted">TMT ticket {item.ticketId}</div>
                  ) : null}
                  {item.error ? (
                    <div className="muted" style={{ color: "var(--err)" }}>
                      {item.error}
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
}

const fallbackPrimary: ProductDefinition[] = [
  {
    code: "DIESEL",
    name: "Diesel Fuel",
    kind: "primary",
    unit: "gal",
    tmtFuelCode: "DSL",
  },
  {
    code: "GASOLINE",
    name: "Gasoline",
    kind: "primary",
    unit: "gal",
    tmtFuelCode: "GAS",
  },
  {
    code: "PROPANE",
    name: "Propane",
    kind: "primary",
    unit: "gal",
    tmtFuelCode: "LPG",
  },
];

const fallbackOther: ProductDefinition[] = [
  {
    code: "ANTIFREEZE",
    name: "Antifreeze",
    kind: "other",
    unit: "gal",
    tmtFuelCode: "AFRZ",
  },
  {
    code: "OIL",
    name: "Engine Oil",
    kind: "other",
    unit: "qt",
    tmtFuelCode: "OIL",
  },
  {
    code: "DEF",
    name: "Diesel Exhaust Fluid",
    kind: "other",
    unit: "gal",
    tmtFuelCode: "DEF",
  },
];

function LineEditor({
  line,
  options,
  unitLabel,
  onChange,
  onRemove,
}: {
  line: LineDraft;
  options: ProductDefinition[];
  unitLabel: string;
  onChange: (patch: Partial<LineDraft>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="line-row">
      <div className="field">
        <label>Product</label>
        <select
          value={line.productCode}
          onChange={(e) => onChange({ productCode: e.target.value })}
        >
          {options.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>Qty ({unitLabel})</label>
        <input
          inputMode="decimal"
          value={line.quantity}
          onChange={(e) => onChange({ quantity: e.target.value })}
          placeholder="0"
          required
        />
      </div>
      <div className="field">
        <label>Unit cost</label>
        <input
          inputMode="decimal"
          value={line.unitCost}
          onChange={(e) => onChange({ unitCost: e.target.value })}
          placeholder="Optional"
        />
      </div>
      <button
        type="button"
        className="icon-btn"
        aria-label="Remove line"
        onClick={onRemove}
      >
        ×
      </button>
    </div>
  );
}
