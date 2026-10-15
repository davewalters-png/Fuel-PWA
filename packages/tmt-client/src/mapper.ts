import { getProduct } from "./products.js";
import type {
  FuelingTransaction,
  TmtFuelTicketDetail,
  TmtFuelTicketPayload,
} from "./types.js";

export function toTmtFuelTicket(
  tx: FuelingTransaction,
): TmtFuelTicketPayload {
  const details: TmtFuelTicketDetail[] = tx.lineItems.map((line) => {
    const product = getProduct(line.productCode);
    const fuelCode = product?.tmtFuelCode ?? line.productCode;
    return {
      FuelCode: fuelCode,
      Quantity: line.quantity,
      ...(line.unitCost != null ? { UnitCost: line.unitCost } : {}),
      ...(line.taxAmount != null ? { TaxAmount: line.taxAmount } : {}),
      ...(line.notes ? { Comments: line.notes } : {}),
    };
  });

  const commentParts = [
    tx.comments,
    tx.locationName ? `Location: ${tx.locationName}` : undefined,
    `ClientTxn: ${tx.clientTransactionId}`,
  ].filter(Boolean);

  return {
    UnitID: tx.unitId,
    TicketDate: tx.ticketDate,
    ...(tx.meterReading != null ? { Meter: tx.meterReading } : {}),
    ...(tx.hourMeter != null ? { HourMeter: tx.hourMeter } : {}),
    ...(tx.vendorId ? { VendorID: tx.vendorId } : {}),
    ...(tx.shopId ? { ShopID: tx.shopId } : {}),
    ...(tx.employeeId ? { EmployeeID: tx.employeeId } : {}),
    ExternalReference: tx.clientTransactionId,
    Comments: commentParts.join(" | "),
    FuelTicketDetails: details,
  };
}
