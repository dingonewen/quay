# Architecture & Design: Spin PostgreSQL + KV Store Prototype

## Overview

This prototype demonstrates two key capabilities of the Akamai Functions (Spin-based) platform:

1. **PostgreSQL on Spin**: An HTTP API that connects to an external PostgreSQL database using Spin's native PostgreSQL interface — proving read, write, and query operations work in a Wasm environment without TCP sockets.
2. **Key-Value Store vs Outbound Redis**: A side-by-side demonstration of Akamai's built-in KV store (platform-managed, globally replicated, app-scoped) vs Outbound Redis (your own instance, full command set).

The project uses **TypeScript**, the **Spin framework (v2)**, and deploys to **Akamai Functions**.

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Akamai Functions                         │
│  (Spin Wasm Runtime — globally distributed edge)             │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Spin App (TypeScript → Wasm)                        │   │
│  │                                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │   │
│  │  │ /pg/*        │  │ /kv/*        │  │ /redis/*    │ │   │
│  │  │ PostgreSQL   │  │ Built-in KV  │  │ Outbound    │ │   │
│  │  │ Handler      │  │ Handler      │  │ Redis       │ │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘ │   │
│  │         │                 │                 │       │   │
│  │         │  Spin SDK       │  Spin SDK       │ Spin  │   │
│  │         │  Postgres.open  │  Kv.openDefault │ SDK   │   │
│  │         │  .query()       │  .getJson()     │ Redis │   │
│  │         │  .execute()     │  .setJson()     │ .open │   │
│  │         │                 │  .exists()      │       │   │
│  └─────────┼─────────────────┼─────────────────┼───────┘   │
│            │                 │                 │            │
└────────────┼─────────────────┼─────────────────┼────────────┘
             │                 │                 │
             ▼                 │                 ▼
      ┌──────────┐             │          ┌──────────┐
      │ NEON     │             │          │ Your Own │
      │ PostgreSQL│            │          │ Redis    │
      │ (external)│            │          │ Instance │
      └──────────┘             │          └──────────┘
                               ▼
                    ┌──────────────────┐
                    │ Akamai KV Store  │
                    │ (platform-managed│
                    │  globally        │
                    │  replicated,     │
                    │  app-scoped)     │
                    └──────────────────┘
```

### Key Design Insight: Wasm Has No TCP Sockets

Traditional Node.js database drivers (`pg`, `node-postgres`, `ioredis`) open raw TCP sockets. Wasm components have no socket access — the Spin runtime provides a **host-level interface** that makes the connection on behalf of the component and exposes high-level operations (`query`, `execute`, `get`, `set`). This is why we use `@spinframework/spin-postgres` instead of `pg` or Drizzle.

### Component Breakdown

| Route | Handler | Purpose | SDK Module |
|-------|---------|---------|------------|
| `POST /pg/products` | `createProduct` | Insert a row | `Postgres` |
| `GET /pg/products` | `listProducts` | Query all rows | `Postgres` |
| `GET /pg/products/:id` | `getProduct` | Query by ID | `Postgres` |
| `PUT /pg/products/:id` | `updateProduct` | Update a row | `Postgres` |
| `DELETE /pg/products/:id` | `deleteProduct` | Delete a row | `Postgres` |
| `POST /kv/:key` | `kvSet` | `setJson` with request body | `Kv` |
| `GET /kv/:key` | `kvGet` | `getJson` + `exists` check | `Kv` |
| `DELETE /kv/:key` | `kvDelete` | Delete a key | `Kv` |
| `GET /redis/ping` | `redisPing` | Prove connectivity | `Redis` |
| `POST /redis/:key` | `redisSet` | SET a key | `Redis` |
| `GET /redis/:key` | `redisGet` | GET a key | `Redis` |

### KV Store vs Outbound Redis — Key Differences

| Dimension | Built-in KV Store | Outbound Redis |
|-----------|-------------------|----------------|
| **Infrastructure** | Platform-managed (Akamai) | You provision & operate |
| **Scope** | App-scoped, isolated | Shared (your instance) |
| **Replication** | Automatic global replication | Depends on your Redis setup |
| **API surface** | `exists`, `getJson`, `setJson` (limited) | Full Redis commands (`execute` for arbitrary) |
| **Pub/Sub** | Not supported | Supported (publish + subscribe from the function) |
| **Redis trigger** | N/A | NOT supported on Akamai Functions (HTTP trigger only) |
| **Config** | `key_value_stores = ["default"]` | `allowed_outbound_hosts = ["redis://host:6379"]` |
| **Storage limit** | ~1 MB per value, ~1024 keys per store | Your Redis instance capacity |
| **Consistency** | No atomic guarantees (`wasi:keyvalue/atomic` unsupported) | Your Redis config |

**Redis trigger vs Outbound Redis**: A "Redis trigger" means the function is *invoked by* a Redis pub/sub message — the function sits dormant and Redis pushes work to it. Akamai Functions only supports HTTP triggers. "Outbound Redis" means the function *connects out to* Redis and issues commands (including SUBSCRIBE for pub/sub). The function can still participate in pub/sub — it just has to initiate the connection.

---

## Project Structure

```
quay/
├── ARCHITECTURE.md          # This file
├── spin.toml                # Spin manifest (single app, multiple components)
├── package.json             # Root package (workspace)
├── tsconfig.json            # TypeScript config
├── webpack.config.js        # Webpack bundler config (Spin JS SDK standard)
├── src/
│   ├── index.ts             # Router entry point — dispatches to sub-routers
│   ├── pg/
│   │   └── handler.ts       # PostgreSQL CRUD handlers
│   ├── kv/
│   │   └── handler.ts       # KV store handlers
│   └── redis/
│       └── handler.ts       # Outbound Redis handlers
└── README.md                # Setup and run instructions
```

### Design Decision: Single Component vs Multiple Components

**Choice: Single component** with an internal router (using `itty-router`).

**Why**: Spin components are compiled to separate `.wasm` files. Multiple components provide better isolation but add build complexity and cold-start overhead. For a prototype demonstrating different capabilities, a single component with internal routing is simpler and sufficient. The `spin.toml` routes everything through one component, and the TypeScript router dispatches to the correct handler.

### spin.toml Configuration Plan

```toml
spin_manifest_version = 2

[application]
name = "quay-prototype"
version = "0.1.0"
description = "PostgreSQL + KV Store + Redis prototype on Akamai Functions"

[variables]
pg_connection_string = { required = true }
redis_connection_string = { required = false, default = "redis://localhost:6379" }

[[trigger.http]]
route = "/..."
component = "api"

[component.api]
source = "target/quay-prototype.wasm"
exclude_files = ["**/node_modules"]
allowed_outbound_hosts = [
    "postgres://*:*",       # Allow any PostgreSQL host (tighten for production)
    "redis://*:*",           # Allow any Redis host (tighten for production)
]
key_value_stores = ["default"]

[component.api.variables]
pg_connection_string = "{{ pg_connection_string }}"
redis_connection_string = "{{ redis_connection_string }}"

[component.api.build]
command = "npm run build"
watch = ["src/**/*.ts", "package.json"]
```

---

## Implementation Plan

### Phase 1: Scaffold the Spin TypeScript Project

1. Run `spin new -E akamai-functions -t http-ts -a quay-prototype`
2. Install dependencies: `npm install`
3. Install additional packages:
   - `@spinframework/spin-postgres` — PostgreSQL SDK
   - `@spinframework/spin-variables` — application variables
   - `@spinframework/spin-kv` — KV store SDK
   - `itty-router` — lightweight HTTP router
   - `uuid` — UUID generation for product IDs
4. Configure `spin.toml` as specified above
5. Verify `spin build && spin up` works locally

**Commit**: `scaffold: Spin TypeScript project with Akamai Functions template`

### Phase 2: PostgreSQL CRUD Endpoints

Implement `src/pg/handler.ts`:

- **Schema**: A `products` table with `id` (UUID), `name` (text), `price` (float)
- **createProduct**: Parse JSON body → validate → generate UUID → `Postgres.open(connStr).execute(INSERT, [...])` → 201
- **listProducts**: `Postgres.open(connStr).query(SELECT_ALL, [])` → map rows → 200
- **getProduct**: Validate UUID format → `query(SELECT_BY_ID, [id])` → 200 or 404
- **updateProduct**: Validate UUID + body → `execute(UPDATE, [...])` → check affected rows → 200 or 404
- **deleteProduct**: Validate UUID → `execute(DELETE, [id])` → 204 or 404

Route mount: `/pg/*` → pg handler

**Commit**: `feat: PostgreSQL CRUD endpoints for products table`

### Phase 3: KV Store Endpoints

Implement `src/kv/handler.ts`:

- **kvSet** (`POST /kv/:key`): Parse body → `store.setJson(key, body)` → 200
- **kvGet** (`GET /kv/:key`): `store.exists(key)` → if false: 404; else: `store.getJson(key)` → 200
- **kvDelete** (`DELETE /kv/:key`): `store.delete(key)` → 200

Demonstrate: the store survives restarts (local `.spin/sqlite_key_value.db`), and on Akamai Functions it's globally replicated.

**Commit**: `feat: KV store get/set/delete endpoints`

### Phase 4: Outbound Redis Endpoints (Optional / Minimal)

Implement `src/redis/handler.ts`:

- **redisPing** (`GET /redis/ping`): `Redis.open(addr).execute("PING", [])` → verify response
- **redisSet** (`POST /redis/:key`): `Redis.open(addr).set(key, body)` → 200
- **redisGet** (`GET /redis/:key`): `Redis.open(addr).get(key)` → 200 or 404

Note: Requires a running Redis instance. For local dev, use `redis://localhost:6379`. On Akamai, point to your own Redis instance.

**Commit**: `feat: Outbound Redis connectivity demo`

### Phase 5: Integration & Router

Implement `src/index.ts`:

- Use `itty-router` `AutoRouter` to compose all sub-handlers
- Read `pg_connection_string` and `redis_connection_string` from Spin variables
- Wire `/pg/*`, `/kv/*`, `/redis/*` prefixes to respective handlers
- Add a root `GET /` health-check that returns available endpoints

**Commit**: `feat: main router and health-check endpoint`

---

## API Contract

### Health

```
GET /
→ 200 { "status": "ok", "endpoints": ["/pg", "/kv", "/redis"] }
```

### PostgreSQL — Products CRUD

```
POST /pg/products
  Body: { "name": "Plain Hoodie", "price": 42.99 }
  → 201 { "id": "<uuid>", "name": "...", "price": 42.99 }
  Errors: 400 (invalid body)

GET /pg/products
  → 200 [{ "id": "...", "name": "...", "price": 42.99 }, ...]

GET /pg/products/:id
  → 200 { "id": "...", "name": "...", "price": 42.99 }
  → 404 (not found) | 400 (malformed UUID)

PUT /pg/products/:id
  Body: { "name": "Updated Name", "price": 29.99 }
  → 200 { "id": "...", "name": "Updated Name", "price": 29.99 }
  → 404 | 400

DELETE /pg/products/:id
  → 204 (no content)
  → 404 | 400
```

### KV Store

```
POST /kv/:key
  Body: any valid JSON
  → 200 { "status": "stored", "key": ":key" }

GET /kv/:key
  → 200 <stored JSON>
  → 404 { "error": "Key not found" }

DELETE /kv/:key
  → 200 { "status": "deleted", "key": ":key" }
```

### Outbound Redis

```
GET /redis/ping
  → 200 { "redis": "PONG" }

POST /redis/:key
  Body: any string
  → 200 { "status": "set", "key": ":key" }

GET /redis/:key
  → 200 { "key": ":key", "value": "..." }
  → 404 { "error": "Key not found" }
```

---

## Development Workflow

```bash
# 1. Scaffold
spin new -E akamai-functions -t http-ts -a quay-prototype

# 2. Install deps
cd quay-prototype
npm install @spinframework/spin-postgres @spinframework/spin-variables \
            @spinframework/spin-kv itty-router uuid
npm install -D @types/uuid

# 3. Local dev with PostgreSQL
# Start a local Postgres (Docker):
docker run --name spin-pg -e POSTGRES_PASSWORD=spin -e POSTGRES_DB=spin_dev -p 5432:5432 -d postgres:16
# Create table:
docker exec spin-pg psql -U postgres -d spin_dev -c "
  CREATE TABLE products (
    id VARCHAR(36) PRIMARY KEY,
    name TEXT NOT NULL,
    price DOUBLE PRECISION NOT NULL
  );
"

# 4. Run locally
SPIN_VARIABLE_PG_CONNECTION_STRING="host=localhost user=postgres dbname=spin_dev password=spin" \
  spin up --build

# 5. Test
curl http://localhost:3000/
curl -X POST http://localhost:3000/pg/products -H 'Content-Type: application/json' -d '{"name":"Test","price":9.99}'
curl http://localhost:3000/pg/products
curl -X POST http://localhost:3000/kv/hello -H 'Content-Type: application/json' -d '{"msg":"world"}'
curl http://localhost:3000/kv/hello
```

---

## Deployment to Akamai Functions

```bash
# Login (first time)
spin aka login

# Deploy with connection string variable
spin aka deploy --variable pg_connection_string="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/db?sslmode=require"

# The CLI outputs the public URL: https://<uuid>.aka.fermyon.tech
# Test the deployed endpoints
curl https://<uuid>.aka.fermyon.tech/pg/products
```

### Production Notes

- **Tighten `allowed_outbound_hosts`**: Replace `*:*` wildcards with specific host:port for production
- **Connection string is a sensitive variable**: Pass via `--variable` at deploy time, never commit to source
- **KV store persists across deploys**: Data survives application updates
- **Cold starts**: Spin Wasm cold-starts in single-digit milliseconds — no connection pooling needed

---

## References

- [Spin Framework v2 Docs](https://spinframework.dev/v2/index)
- [Spin JS SDK Reference (v2.3)](https://fermyon.github.io/spin-js-sdk/v2.3/)
- [Spin PostgreSQL Example](https://github.com/spinframework/spin-js-sdk/tree/sdk-v2/examples/spin-host-apis/spin-postgres)
- [Spin Redis Example](https://github.com/spinframework/spin-js-sdk/tree/sdk-v2/examples/spin-host-apis/spin-redis)
- [Akamai Functions: Query PostgreSQL](https://techdocs.akamai.com/akamai-functions/docs/query-relational-databases-postgresql)
- [Akamai Functions: Use Key-Value Store](https://techdocs.akamai.com/akamai-functions/docs/use-the-key-value-store)
- [Akamai Functions: Supabase Cache Proxy](https://techdocs.akamai.com/akamai-functions/docs/build-a-supabase-cache-proxy)
- [Akamai Functions: Quotas and Limits](https://techdocs.akamai.com/akamai-functions/docs/quotas-and-limits)
- [Akamai Functions Samples](https://github.com/akamai-developers/akamai-functions-samples)
- [Serverless URL Shortener (Akamai + Spin)](https://github.com/akamai-developers/serverless-url-shortener)
