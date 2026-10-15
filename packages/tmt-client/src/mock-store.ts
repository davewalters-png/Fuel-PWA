import { randomUUID } from "node:crypto";
import type { FuelTicketResult, TmtFuelTicketPayload, TmtUnitSummary } from "./types.js";

const tickets: Array<{
  ticketId: string;
  createdAt: string;
  payload: TmtFuelTicketPayload;
}> = [];

export const MOCK_UNITS: TmtUnitSummary[] = [
  {
    unitId: "TRK-1042",
    description: "Freightliner Cascadia",
    licensePlate: "TX-8F492",
    meter: 214880,
  },
  {
    unitId: "TRK-2201",
    description: "Kenworth T680",
    licensePlate: "TX-3K771",
    meter: 98720,
  },
  {
    unitId: "EQ-088",
    description: "Yard Tractor",
    licensePlate: "YARD-088",
    hourMeter: 6420,
  },
  {
    unitId: "GEN-014",
    description: "Portable Generator",
    hourMeter: 1835,
  },
];

export function mockCreateFuelTicket(
  payload: TmtFuelTicketPayload,
): FuelTicketResult {
  const ticketId = `MOCK-FT-${randomUUID().slice(0, 8).toUpperCase()}`;
  tickets.unshift({
    ticketId,
    createdAt: new Date().toISOString(),
    payload,
  });
  return {
    success: true,
    mock: true,
    ticketId,
    externalReference: payload.ExternalReference ?? ticketId,
    message: `Mock fuel ticket ${ticketId} created for unit ${payload.UnitID}`,
    tmtPayload: payload,
    rawResponse: { ticketId, status: "Created" },
  };
}

export function mockListTickets(limit = 50) {
  return tickets.slice(0, limit);
}

export function mockGetTicket(ticketId: string) {
  return tickets.find((t) => t.ticketId === ticketId);
}
