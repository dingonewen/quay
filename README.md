# quay

Spin + TypeScript prototype on Akamai Functions: PostgreSQL, built-in KV store, and Outbound Redis — all from a single Wasm component.

## What This Proves

1. **PostgreSQL from Wasm**: A Spin TypeScript app can query, insert, update, and delete a PostgreSQL database using Spin's native RDBMS SDK. No TCP sockets, no ORM, no driver — the Spin Runtime proxies all database connections via host calls.

2. **KV Store vs Outbound Redis**: Akamai's built-in key-value store is platform-managed, globally replicated, and app-scoped. Outbound Redis connects to a user-owned instance with full Redis command support including `EXECUTE` for arbitrary commands and `PUBLISH` for pub/sub.

## Architecture

| Data Backend | Route Prefix | SDK | Config |
|---|---|---|---|
| PostgreSQL (NEON) | `/pg/products` | `@spinframework/spin-postgres` | `allowed_outbound_hosts` + connection string variable |
| Built-in KV Store | `/kv/:key` | `@spinframework/spin-kv` | `key_value_stores = ["default"]` |
| Outbound Redis (Redis Cloud) | `/redis/:key` | `@spinframework/spin-redis` | `allowed_outbound_hosts` + connection string variable |

All three serve from a single Wasm component compiled from TypeScript.

## How It Works

```
TypeScript code                 Spin Runtime (Rust)
─────────────────               ─────────────────────
Postgres.open(connStr)  ──→    Parse URL → TCP/TLS → PostgreSQL
conn.query(sql, params) ──→    Send SQL → return rows

Kv.openDefault()        ──→    Open SQLite-backed store
store.setJson(k, v)     ──→    Write to store

Redis.open(addr)        ──→    TCP → Redis
conn.get(key)           ──→    GET → return bytes
```

Wasm has no TCP sockets. Every database call crosses the Wasm boundary into Spin Runtime, which handles networking, TLS, and connection pooling in native Rust code.

## KV Store vs Outbound Redis

| | Built-in KV | Outbound Redis |
|---|---|---|
| Infrastructure | Platform-managed (Akamai) | User-provisioned (Redis Cloud) |
| Scope | App-scoped, isolated | Shared instance |
| Replication | Automatic global replication | Depends on your Redis config |
| API surface | `exists` `getJson` `setJson` `getKeys` `delete` | Full Redis: `PING` `GET` `SET` `DEL` `EXECUTE` `PUBLISH` |
| Pub/Sub | Not supported | Supported (function publishes/subscribes) |
| Redis trigger | N/A | Not supported (Akamai HTTP trigger only) |

## Project Structure

```
quay/
├── README.md
├── ARCHITECTURE.md
└── quay-prototype/
    ├── spin.toml          # Manifest: triggers, variables, outbound hosts
    ├── package.json
    ├── tsconfig.json
    ├── build.mjs          # esbuild configuration
    ├── .gitignore
    └── src/
        └── index.ts       # All routes: PG, KV, Redis
```

## API Endpoints

```
GET  /                    API listing
GET  /products            List all products
POST /products            Create product  {"name":"…","price":9.99}
PUT  /products/:id        Update product
DELETE /products/:id      Delete product

GET  /kv                  List all KV keys
GET  /kv/:key             Get JSON value
POST /kv/:key             Set JSON value  (any valid JSON)
DELETE /kv/:key           Delete key

GET  /redis/ping          Ping via EXECUTE
GET  /redis/:key          Get string value
POST /redis/:key          Set string value (plain text body)
DELETE /redis/:key        Delete key
```

## Local Development

```bash
npm install

export SPIN_VARIABLE_PG_CONNECTION_STRING="postgresql://…"
export SPIN_VARIABLE_REDIS_CONNECTION_STRING="redis://…"

spin build && spin up
# → http://127.0.0.1:3000
```

## Deploy to Akamai Functions

```bash
spin plugins install aka
spin aka login

spin aka deploy --build \
  --variable pg_connection_string="postgresql://…" \
  --variable redis_connection_string="redis://…"
```

## Tech Stack

- **Runtime**: Spin 4.0 (Wasm component model)
- **Language**: TypeScript → esbuild → JS → j2w → Wasm
- **Platform**: Akamai Functions (globally distributed edge)
- **Database**: NEON serverless PostgreSQL
- **Redis**: Redis Cloud
