import { toTmtFuelTicket } from "./mapper.js";
import {
  MOCK_UNITS,
  mockCreateFuelTicket,
  mockGetTicket,
  mockListTickets,
} from "./mock-store.js";
import { PRODUCT_CATALOG } from "./products.js";
import {
  FuelingTransactionSchema,
  type FuelTicketResult,
  type FuelingTransaction,
  type TmtClientConfig,
  type TmtUnitSummary,
} from "./types.js";

export class TmtClient {
  private token?: string;
  private tokenExpiresAt = 0;

  constructor(private readonly config: TmtClientConfig) {}

  get isMock(): boolean {
    return Boolean(
      this.config.mock ||
        !this.config.baseUrl ||
        this.config.baseUrl.includes("your-tmt-server"),
    );
  }

  listProducts() {
    return PRODUCT_CATALOG;
  }

  async health(): Promise<{ ok: boolean; mock: boolean; detail: string }> {
    if (this.isMock) {
      return {
        ok: true,
        mock: true,
        detail: "Mock TMT mode — no live Integration Toolkit calls",
      };
    }
    try {
      const res = await this.request("GET", "/System/Health");
      return { ok: true, mock: false, detail: JSON.stringify(res) };
    } catch (err) {
      return {
        ok: false,
        mock: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async searchUnits(query?: string): Promise<TmtUnitSummary[]> {
    if (this.isMock) {
      const q = (query ?? "").trim().toLowerCase();
      if (!q) return MOCK_UNITS;
      return MOCK_UNITS.filter(
        (u) =>
          u.unitId.toLowerCase().includes(q) ||
          u.description?.toLowerCase().includes(q) ||
          u.licensePlate?.toLowerCase().includes(q),
      );
    }

    const path = query
      ? `/System/Unit?search=${encodeURIComponent(query)}`
      : "/System/Unit";
    const data = (await this.request("GET", path)) as unknown;
    return normalizeUnits(data);
  }

  async createFuelTicketFromTransaction(
    input: FuelingTransaction,
  ): Promise<FuelTicketResult> {
    const tx = FuelingTransactionSchema.parse(input);
    const payload = toTmtFuelTicket(tx);

    if (this.isMock) {
      return mockCreateFuelTicket(payload);
    }

    const raw = await this.request(
      "POST",
      "/Fleet_ServiceCenter/FuelTicket",
      payload,
    );
    const ticketId = extractTicketId(raw);
    return {
      success: true,
      mock: false,
      ticketId,
      externalReference: payload.ExternalReference ?? "",
      message: ticketId
        ? `Fuel ticket ${ticketId} created in TMT`
        : "Fuel ticket posted to TMT",
      tmtPayload: payload,
      rawResponse: raw,
    };
  }

  listMockTickets(limit = 50) {
    return mockListTickets(limit);
  }

  getMockTicket(ticketId: string) {
    return mockGetTicket(ticketId);
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${trimSlash(this.config.baseUrl)}${path.startsWith("/") ? path : `/${path}`}`;
    const headers: Record<string, string> = {
      Accept: "application/json",
      "Content-Type": "application/json",
    };

    const auth = await this.getAuthHeader();
    if (auth) headers.Authorization = auth;

    const res = await fetch(url, {
      method,
      headers,
      body: body == null ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // keep raw text
    }

    if (!res.ok) {
      throw new Error(
        `TMT ${method} ${path} failed (${res.status}): ${typeof parsed === "string" ? parsed : JSON.stringify(parsed)}`,
      );
    }
    return parsed;
  }

  private async getAuthHeader(): Promise<string | undefined> {
    if (!this.config.username || !this.config.password) {
      return undefined;
    }

    // Prefer OAuth token when available; fall back to basic auth.
    try {
      if (!this.token || Date.now() >= this.tokenExpiresAt) {
        const tokenUrl = `${trimSlash(this.config.baseUrl)}/OAuth/Token`;
        const res = await fetch(tokenUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            username: this.config.username,
            password: this.config.password,
          }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            access_token?: string;
            expires_in?: number;
          };
          if (data.access_token) {
            this.token = data.access_token;
            this.tokenExpiresAt =
              Date.now() + Math.max(30, (data.expires_in ?? 3600) - 60) * 1000;
          }
        }
      }
      if (this.token) return `Bearer ${this.token}`;
    } catch {
      // fall through to basic
    }

    const basic = Buffer.from(
      `${this.config.username}:${this.config.password}`,
    ).toString("base64");
    return `Basic ${basic}`;
  }
}

export function createTmtClientFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): TmtClient {
  const mockFlag = (env.TMT_MOCK ?? "true").toLowerCase();
  return new TmtClient({
    baseUrl: env.TMT_BASE_URL ?? "",
    username: env.TMT_USERNAME,
    password: env.TMT_PASSWORD,
    mock: mockFlag === "true" || mockFlag === "1",
  });
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function extractTicketId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  for (const key of [
    "TicketID",
    "ticketId",
    "FuelTicketID",
    "Id",
    "ID",
    "DocumentNumber",
  ]) {
    const val = obj[key];
    if (typeof val === "string" || typeof val === "number") return String(val);
  }
  return undefined;
}

function normalizeUnits(data: unknown): TmtUnitSummary[] {
  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && Array.isArray((data as { value?: unknown }).value)
      ? ((data as { value: unknown[] }).value)
      : data && typeof data === "object" && Array.isArray((data as { Units?: unknown }).Units)
        ? ((data as { Units: unknown[] }).Units)
        : [];

  return rows.map((row) => {
    const r = row as Record<string, unknown>;
    return {
      unitId: String(r.UnitID ?? r.unitId ?? r.UnitNumber ?? r.id ?? ""),
      description:
        typeof r.Description === "string"
          ? r.Description
          : typeof r.description === "string"
            ? r.description
            : undefined,
      licensePlate:
        typeof r.LicensePlate === "string"
          ? r.LicensePlate
          : typeof r.licensePlate === "string"
            ? r.licensePlate
            : undefined,
      meter:
        typeof r.Meter === "number"
          ? r.Meter
          : typeof r.meter === "number"
            ? r.meter
            : undefined,
      hourMeter:
        typeof r.HourMeter === "number"
          ? r.HourMeter
          : typeof r.hourMeter === "number"
            ? r.hourMeter
            : undefined,
    };
  }).filter((u) => u.unitId);
}
