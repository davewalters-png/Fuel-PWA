export type ProductKind = "primary" | "other";

export interface ProductDefinition {
  code: string;
  name: string;
  kind: ProductKind;
  unit: "gal" | "qt" | "L" | "ea";
  /** Default TMT fuel/product code — override per customer catalog */
  tmtFuelCode: string;
}

/** Primary dispensed products + common add-on fluids for fuel-island tickets. */
export const PRODUCT_CATALOG: ProductDefinition[] = [
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

export function getProduct(code: string): ProductDefinition | undefined {
  return PRODUCT_CATALOG.find((p) => p.code === code);
}
