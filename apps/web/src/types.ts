export type ProductKind = "primary" | "other";

export interface ProductDefinition {
  code: string;
  name: string;
  kind: ProductKind;
  unit: "gal" | "qt" | "L" | "ea";
  tmtFuelCode: string;
}

export interface UnitSummary {
  unitId: string;
  description?: string;
  licensePlate?: string;
  meter?: number;
  hourMeter?: number;
}

export interface LineDraft {
  productCode: string;
  quantity: string;
  unitCost: string;
  notes: string;
}

export interface FuelTicketResponse {
  success: boolean;
  mock: boolean;
  ticketId?: string;
  externalReference: string;
  message: string;
}

export type QueueStatus = "pending" | "syncing" | "synced" | "error";

export interface QueuedTransaction {
  id: string;
  createdAt: string;
  status: QueueStatus;
  error?: string;
  ticketId?: string;
  payload: {
    clientTransactionId: string;
    unitId: string;
    ticketDate: string;
    meterReading?: number;
    hourMeter?: number;
    employeeId?: string;
    locationName?: string;
    comments?: string;
    lineItems: Array<{
      productCode: string;
      quantity: number;
      unitCost?: number;
      notes?: string;
    }>;
  };
}
