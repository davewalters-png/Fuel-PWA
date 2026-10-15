# YardFuel — TMT Fuel Ticket PWA

Progressive Web App for recording fueling transactions (diesel, gasoline, propane) plus other dispensed products (antifreeze, oil, DEF), then pushing them into **TMT Fleet Maintenance** as fuel tickets through a shared Integration Toolkit client and MCP layer.

## Architecture

```
Browser PWA  ──POST /api/fuel-tickets──►  Express API
                                              │
                                              ▼
                                   @tmt-fueling/tmt-client
                                              │
                     ┌────────────────────────┴────────────────────────┐
                     ▼                                                 ▼
        TMT Integration Toolkit                         MCP stdio server
   POST /Fleet_ServiceCenter/FuelTicket            packages/tmt-mcp
   GET  /System/Unit                               (same client methods)
```

The PWA never talks to TMT directly. Both the HTTP API and the MCP tools call `@tmt-fueling/tmt-client`, so agent-driven and browser-driven tickets produce the same payload.

## Products

| Kind | Codes |
|------|--------|
| Primary | `DIESEL`, `GASOLINE`, `PROPANE` |
| Other | `ANTIFREEZE`, `OIL`, `DEF` |

Product codes map to TMT `FuelCode` values (`DSL`, `GAS`, `LPG`, `AFRZ`, `OIL`, `DEF`). Adjust `packages/tmt-client/src/products.ts` to match your TMT catalog.

## Quick start

```bash
cp .env.example .env
npm install
npm run build
npm run dev
```

- PWA: http://127.0.0.1:5173  
- API: http://127.0.0.1:8787  

`TMT_MOCK=true` (default) stores tickets in-memory so you can demo without a live TMT server.

### Live TMT

Set in `.env`:

```env
TMT_MOCK=false
TMT_BASE_URL=https://your-tmt-server/AMSApp/Integration
TMT_USERNAME=...
TMT_PASSWORD=...
```

Confirm the exact `FuelTicket` request schema against your instance Swagger at `{server}/{app-path}/swagger`. Field names in `toTmtFuelTicket()` can be adjusted if your tenant differs.

## MCP server

```bash
npm run mcp
```

Cursor / Claude Desktop example:

```json
{
  "mcpServers": {
    "tmt-fleet": {
      "command": "node",
      "args": ["/absolute/path/to/tmt-fueling/packages/tmt-mcp/dist/index.js"],
      "env": {
        "TMT_MOCK": "true",
        "TMT_BASE_URL": "https://your-tmt-server/AMSApp/Integration",
        "TMT_USERNAME": "",
        "TMT_PASSWORD": ""
      }
    }
  }
}
```

### Tools

- `tmt_health`
- `tmt_list_products`
- `tmt_search_units`
- `tmt_create_fuel_ticket`
- `tmt_list_recent_tickets` (mock store)

## PWA behavior

- Installable on phones, tablets, and desktops
- Offline queue in IndexedDB; sync when connectivity returns
- Asset search, meter/hour entry, multi-line products, notes

## API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/health` | API + TMT/mock status |
| GET | `/api/products` | Product catalog |
| GET | `/api/units?q=` | Unit search |
| POST | `/api/fuel-tickets` | Create / push fuel ticket |
| GET | `/api/fuel-tickets` | Recent tickets (mock) |
