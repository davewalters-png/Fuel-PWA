import type {
  FuelTicketResponse,
  ProductDefinition,
  QueuedTransaction,
  UnitSummary,
} from "./types";

const API_BASE = "";

export async function fetchProducts(): Promise<ProductDefinition[]> {
  const res = await fetch(`${API_BASE}/api/products`);
  if (!res.ok) throw new Error("Failed to load products");
  const data = (await res.json()) as { products: ProductDefinition[] };
  return data.products;
}

export async function searchUnits(query: string): Promise<UnitSummary[]> {
  const url = new URL(`${API_BASE}/api/units`, window.location.origin);
  if (query.trim()) url.searchParams.set("q", query.trim());
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to search units");
  const data = (await res.json()) as { units: UnitSummary[] };
  return data.units;
}

export async function submitFuelTicket(
  payload: QueuedTransaction["payload"],
): Promise<FuelTicketResponse> {
  const res = await fetch(`${API_BASE}/api/fuel-tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as FuelTicketResponse & { error?: string };
  if (!res.ok) {
    throw new Error(data.error ?? data.message ?? "Submit failed");
  }
  return data;
}

export async function fetchHealth(): Promise<{
  ok: boolean;
  mock: boolean;
  detail: string;
}> {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("API unreachable");
  return res.json();
}
