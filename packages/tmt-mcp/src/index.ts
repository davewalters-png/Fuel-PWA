#!/usr/bin/env node
/**
 * MCP server for TMT Fleet Maintenance fuel tickets.
 * Exposes tools that map fueling transactions onto Integration Toolkit
 * Fleet_ServiceCenter/FuelTicket and System/Unit endpoints.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  createTmtClientFromEnv,
  FuelingTransactionSchema,
} from "@tmt-fueling/tmt-client";
import { z } from "zod";

const client = createTmtClientFromEnv();

const server = new Server(
  {
    name: "tmt-fleet-maintenance",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "tmt_health",
      description:
        "Check connectivity to TMT Integration Toolkit (or mock mode status).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "tmt_list_products",
      description:
        "List primary and other products that can be dispensed on a fuel ticket (diesel, gasoline, propane, antifreeze, oil, DEF).",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
    },
    {
      name: "tmt_search_units",
      description:
        "Search TMT units/assets that can receive a fuel ticket.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "Unit id, description, or license plate fragment",
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "tmt_create_fuel_ticket",
      description:
        "Create a TMT Fleet Maintenance fuel ticket for an asset, including primary fuel and other dispensed products. Pushes through Integration Toolkit Fleet_ServiceCenter/FuelTicket.",
      inputSchema: {
        type: "object",
        properties: {
          clientTransactionId: {
            type: "string",
            description: "Idempotent client-side transaction id",
          },
          unitId: { type: "string", description: "TMT UnitID" },
          ticketDate: {
            type: "string",
            description: "ISO-8601 ticket date/time",
          },
          meterReading: { type: "number" },
          hourMeter: { type: "number" },
          vendorId: { type: "string" },
          shopId: { type: "string" },
          employeeId: { type: "string" },
          locationName: { type: "string" },
          comments: { type: "string" },
          lineItems: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                productCode: {
                  type: "string",
                  description:
                    "DIESEL | GASOLINE | PROPANE | ANTIFREEZE | OIL | DEF",
                },
                quantity: { type: "number" },
                unitCost: { type: "number" },
                taxAmount: { type: "number" },
                notes: { type: "string" },
              },
              required: ["productCode", "quantity"],
            },
          },
        },
        required: ["clientTransactionId", "unitId", "ticketDate", "lineItems"],
        additionalProperties: false,
      },
    },
    {
      name: "tmt_list_recent_tickets",
      description:
        "List recently created fuel tickets from the mock store (mock mode) or report that live listing requires customer Swagger confirmation.",
      inputSchema: {
        type: "object",
        properties: {
          limit: { type: "number" },
        },
        additionalProperties: false,
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "tmt_health": {
        const result = await client.health();
        return text(result);
      }
      case "tmt_list_products": {
        return text(client.listProducts());
      }
      case "tmt_search_units": {
        const query = z
          .object({ query: z.string().optional() })
          .parse(args ?? {}).query;
        return text(await client.searchUnits(query));
      }
      case "tmt_create_fuel_ticket": {
        const tx = FuelingTransactionSchema.parse(args);
        const result = await client.createFuelTicketFromTransaction(tx);
        return text(result);
      }
      case "tmt_list_recent_tickets": {
        const limit = z
          .object({ limit: z.number().int().positive().max(200).optional() })
          .parse(args ?? {}).limit;
        if (!client.isMock) {
          return text({
            message:
              "Live ticket listing depends on your TMT Swagger FuelTicket GET contract. Use mock mode or configure a customer-specific list endpoint.",
            tickets: [],
          });
        }
        return text(client.listMockTickets(limit ?? 50));
      }
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (err) {
    return {
      content: [
        {
          type: "text",
          text: err instanceof Error ? err.message : String(err),
        },
      ],
      isError: true,
    };
  }
});

function text(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
