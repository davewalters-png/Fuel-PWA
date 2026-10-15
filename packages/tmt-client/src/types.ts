import { z } from "zod";

export const FuelLineItemSchema = z.object({
  productCode: z.string().min(1),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
  taxAmount: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional(),
});

export const FuelingTransactionSchema = z.object({
  clientTransactionId: z.string().min(1),
  unitId: z.string().min(1),
  ticketDate: z.string().datetime({ offset: true }).or(z.string().min(8)),
  meterReading: z.number().nonnegative().optional(),
  hourMeter: z.number().nonnegative().optional(),
  vendorId: z.string().optional(),
  shopId: z.string().optional(),
  employeeId: z.string().optional(),
  locationName: z.string().optional(),
  comments: z.string().max(2000).optional(),
  lineItems: z.array(FuelLineItemSchema).min(1),
});

export type FuelLineItem = z.infer<typeof FuelLineItemSchema>;
export type FuelingTransaction = z.infer<typeof FuelingTransactionSchema>;

export interface TmtFuelTicketDetail {
  FuelCode: string;
  Quantity: number;
  UnitCost?: number;
  TaxAmount?: number;
  Comments?: string;
}

/** Payload shape posted to Fleet_ServiceCenter/FuelTicket */
export interface TmtFuelTicketPayload {
  UnitID: string;
  TicketDate: string;
  Meter?: number;
  HourMeter?: number;
  VendorID?: string;
  ShopID?: string;
  EmployeeID?: string;
  Comments?: string;
  ExternalReference?: string;
  FuelTicketDetails: TmtFuelTicketDetail[];
}

export interface FuelTicketResult {
  success: boolean;
  mock: boolean;
  ticketId?: string;
  externalReference: string;
  message: string;
  tmtPayload: TmtFuelTicketPayload;
  rawResponse?: unknown;
}

export interface TmtUnitSummary {
  unitId: string;
  description?: string;
  licensePlate?: string;
  meter?: number;
  hourMeter?: number;
}

export interface TmtClientConfig {
  baseUrl: string;
  username?: string;
  password?: string;
  /** When true, never call TMT — persist tickets locally for demo/dev */
  mock?: boolean;
}
