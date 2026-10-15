import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import {
  createTmtClientFromEnv,
  FuelingTransactionSchema,
} from "@tmt-fueling/tmt-client";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);
dotenv.config({ path: path.join(rootDir, ".env") });

const app = express();
const client = createTmtClientFromEnv();
const port = Number(process.env.PORT ?? 8787);
const host = process.env.HOST ?? "0.0.0.0";

app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
  }),
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res) => {
  const health = await client.health();
  res.json({
    service: "tmt-fueling-api",
    ...health,
    mcpLayer: "packages/tmt-mcp (stdio MCP) + shared @tmt-fueling/tmt-client",
  });
});

app.get("/api/products", (_req, res) => {
  res.json({ products: client.listProducts() });
});

app.get("/api/units", async (req, res) => {
  try {
    const query = typeof req.query.q === "string" ? req.query.q : undefined;
    const units = await client.searchUnits(query);
    res.json({ units, mock: client.isMock });
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * Primary write path used by the PWA.
 * Uses the same TMT client as the MCP tools so browser submissions and
 * agent/MCP submissions populate identical FuelTicket payloads.
 */
app.post("/api/fuel-tickets", async (req, res) => {
  try {
    const tx = FuelingTransactionSchema.parse(req.body);
    const result = await client.createFuelTicketFromTransaction(tx);
    res.status(result.success ? 201 : 502).json(result);
  } catch (err) {
    if (err && typeof err === "object" && "issues" in err) {
      res.status(400).json({ error: "Validation failed", details: err });
      return;
    }
    res.status(502).json({
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

app.get("/api/fuel-tickets", (req, res) => {
  const limit = Number(req.query.limit ?? 50);
  if (!client.isMock) {
    res.json({
      mock: false,
      tickets: [],
      message:
        "Configure a customer-specific FuelTicket list GET against your TMT Swagger, or use mock mode.",
    });
    return;
  }
  res.json({ mock: true, tickets: client.listMockTickets(limit) });
});

// Serve built PWA in production when present
const webDist = path.join(rootDir, "apps/web/dist");
app.use(express.static(webDist));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(webDist, "index.html"), (err) => {
    if (err) next();
  });
});

app.listen(port, host, () => {
  console.log(
    `TMT Fueling API listening on http://${host}:${port} (mock=${client.isMock})`,
  );
});
