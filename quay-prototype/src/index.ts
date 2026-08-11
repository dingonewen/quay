// @ts-ignore — Spin Wasm host bindings, no types
import * as Postgres from "@spinframework/spin-postgres";
// @ts-ignore
import * as Variables from "@spinframework/spin-variables";
// @ts-ignore
import * as Kv from "@spinframework/spin-kv";
// @ts-ignore
import * as Redis from "@spinframework/spin-redis";
import { AutoRouter } from "itty-router";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const SQL_CREATE =
  "INSERT INTO Products (Id, Name, Price) VALUES ($1, $2, $3)";
const SQL_READ_ALL =
  "SELECT Id, Name, Price FROM Products ORDER BY Name";
const SQL_READ_BY_ID =
  "SELECT Id, Name, Price FROM Products WHERE Id = $1";
const SQL_UPDATE_BY_ID =
  "UPDATE Products SET Name = $1, Price = $2 WHERE Id = $3";
const SQL_DELETE_BY_ID =
  "DELETE FROM Products WHERE Id = $1";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const HEADERS_JSON = { "content-type": "application/json" };
const decoder = new TextDecoder();

/** Always return a Response — never a plain object — to avoid itty-router's
 *  auto-format handler calling JSON.stringify on a non-plain value. */
function ok(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: HEADERS_JSON,
  });
}

function badRequest(msg: string): Response {
  return ok({ error: msg }, 400);
}

function notFound(msg: string): Response {
  return ok({ error: msg }, 404);
}

function serverError(msg: string): Response {
  return ok({ error: msg }, 500);
}

/** Extract a readable message from a Spin error (has .payload, not .message) */
function errMsg(e: any): string {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e.payload) return typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload);
  if (e.message) return e.message;
  return String(e);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = AutoRouter();

// --- HOME ------------------------------------------------------------------
router.get("/", () => ok({
  service: "quay-prototype — Spin PostgreSQL + KV + Redis API",
  endpoints: {
    postgres: [
      "GET  /products",
      "GET  /products/:id",
      "POST /products",
      "PUT  /products/:id",
      "DELETE /products/:id",
    ],
    kv: [
      "GET  /kv",
      "GET  /kv/:key",
      "POST /kv/:key",
      "DELETE /kv/:key",
    ],
    redis: [
      "GET  /redis/ping",
      "GET  /redis/:key",
      "POST /redis/:key",
      "DELETE /redis/:key",
      "POST /redis/:key/incr",
      "POST /redis/:key/setex",
      "POST /redis/pub/:channel",
    ],
  },
}));

// --- CREATE ----------------------------------------------------------------
router.post("/products", async (request, extra) => {
  const connStr = String((extra as any).connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");

  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing request body");

  let payload: any;
  try {
    payload = JSON.parse(decoder.decode(body));
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!payload.name || typeof payload.price !== "number") {
    return badRequest(
      'Expected {"name": "...", "price": 9.99}',
    );
  }

  try {
    const product = { id: uuidv4(), name: payload.name, price: payload.price };
    const conn = Postgres.open(connStr);
    conn.execute(SQL_CREATE, [product.id, product.name, product.price]);

    return new Response(JSON.stringify(product), {
      status: 201,
      headers: {
        ...HEADERS_JSON,
        Location: `/products/${product.id}`,
      },
    });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// --- READ ALL --------------------------------------------------------------
router.get("/products", async (_, extra) => {
  const connStr = String((extra as any).connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");

  try {
    const conn = Postgres.open(connStr);
    const result = conn.query(SQL_READ_ALL, []);

    const items = result.rows.map((row: any) => ({
      id: row["id"],
      name: row["name"],
      price: row["price"],
    }));
    return ok(items);
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// --- READ BY ID ------------------------------------------------------------
router.get("/products/:id", async (request, extra) => {
  const connStr = String((extra as any).connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");

  const { id } = request.params;
  if (!id || !uuidValidate(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }

  try {
    const conn = Postgres.open(connStr);
    const result = conn.query(SQL_READ_BY_ID, [id]);
    if (result.rows.length === 0) return notFound("Product not found");

    const row = result.rows[0];
    return ok({ id: row["id"], name: row["name"], price: row["price"] });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// --- UPDATE ----------------------------------------------------------------
router.put("/products/:id", async (request, extra) => {
  const connStr = String((extra as any).connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");

  const { id } = request.params;
  if (!id || !uuidValidate(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }

  const body = await request.arrayBuffer();
  let payload: any;
  try {
    payload = JSON.parse(decoder.decode(body));
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!payload.name || typeof payload.price !== "number") {
    return badRequest(
      'Expected {"name": "...", "price": 9.99}',
    );
  }

  try {
    const conn = Postgres.open(connStr);
    const updatedRows = conn.execute(SQL_UPDATE_BY_ID, [
      payload.name,
      payload.price,
      id,
    ]);
    if (updatedRows === 0n) return notFound("Product not found");

    return ok({ id, name: payload.name, price: payload.price });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// --- DELETE ----------------------------------------------------------------
router.delete("/products/:id", async (request, extra) => {
  const connStr = String((extra as any).connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");

  const { id } = request.params;
  if (!id || !uuidValidate(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }

  try {
    const conn = Postgres.open(connStr);
    const deletedRows = conn.execute(SQL_DELETE_BY_ID, [id]);
    if (deletedRows === 0n) return notFound("Product not found");

    return new Response(null, { status: 204 });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// --- KV Store ----------------------------------------------------------------

let kvStore: ReturnType<typeof Kv.openDefault> | null = null;
function getKv() {
  if (!kvStore) kvStore = Kv.openDefault();
  return kvStore;
}

// List all keys
router.get("/kv", () => {
  try {
    return ok({ keys: getKv().getKeys() });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// Get JSON value by key
router.get("/kv/:key", ({ params }) => {
  const { key } = params;
  try {
    const kv = getKv();
    if (!kv.exists(key)) return notFound(`Key "${key}" not found`);
    return ok({ key, value: kv.getJson(key) });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// Set JSON value by key
router.post("/kv/:key", async (request) => {
  const { key } = request.params;
  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing request body");

  let payload: any;
  try {
    payload = JSON.parse(decoder.decode(body));
  } catch {
    return badRequest("Invalid JSON body");
  }

  try {
    getKv().setJson(key, payload);
    return ok({ status: "stored", key });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// Delete key
router.delete("/kv/:key", ({ params }) => {
  const { key } = params;
  try {
    getKv().delete(key);
    return ok({ status: "deleted", key });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// --- Outbound Redis ----------------------------------------------------------

function getRedisConn(extra: any) {
  const addr = String(extra?.redisConnectionString ?? "redis://localhost:6379");
  return Redis.open(addr);
}

// PING — verify connectivity
router.get("/redis/ping", (_, extra) => {
  try {
    const conn = getRedisConn((extra as any));
    const result = conn.execute("PING", []);
    const msg = result[0]?.tag === "status" ? result[0].val : String(result[0]);
    return ok({ redis: msg });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// SET string value
router.post("/redis/:key", async (request, extra) => {
  const { key } = request.params;
  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing value (send as plain text)");

  try {
    const conn = getRedisConn((extra as any));
    conn.set(key, new Uint8Array(body));
    return ok({ status: "set", key });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// GET string value
router.get("/redis/:key", ({ params }, extra) => {
  const { key } = params;
  try {
    const conn = getRedisConn((extra as any));
    const val = conn.get(key);
    if (!val) return notFound(`Key "${key}" not found`);
    return ok({ key, value: decoder.decode(val) });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// DELETE key
router.delete("/redis/:key", ({ params }, extra) => {
  const { key } = params;
  try {
    const conn = getRedisConn((extra as any));
    conn.del([key]);
    return ok({ status: "deleted", key });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// ---------- Redis-only features (not available in built-in KV) ---------------

// Atomic counter — INCR. Built-in KV would need read→modify→write (not atomic).
router.post("/redis/:key/incr", ({ params }, extra) => {
  const { key } = params;
  try {
    const conn = getRedisConn((extra as any));
    const newVal = conn.incr(key);
    return ok({ key, value: Number(newVal) });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// Pub/Sub — publish a message to a channel
router.post("/redis/pub/:channel", async (request, extra) => {
  const { channel } = request.params;
  const body = await request.arrayBuffer();
  const message = body ? decoder.decode(body) : "";
  if (!message) return badRequest("Missing message body");

  try {
    const conn = getRedisConn((extra as any));
    const receivers = conn.publish(channel, new Uint8Array(new TextEncoder().encode(message)));
    return ok({ channel, message, receivers: Number(receivers) });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// SETEX — set key with TTL (automatic expiry). Built-in KV has no TTL.
router.post("/redis/:key/setex", async (request, extra) => {
  const { key } = request.params;
  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing JSON body");

  let payload: any;
  try {
    payload = JSON.parse(decoder.decode(body));
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!payload.value || typeof payload.ttl !== "number") {
    return badRequest('Expected {"value": "...", "ttl": 60}');
  }

  try {
    const conn = getRedisConn((extra as any));
    conn.execute("SETEX", [key, payload.ttl.toString(), payload.value]);
    return ok({ status: "set", key, ttl: payload.ttl });
  } catch (e: any) {
    return serverError(errMsg(e));
  }
});

// 404
router.all("*", () => notFound("Endpoint not found"));

// ---------------------------------------------------------------------------
// Spin entry-point
// ---------------------------------------------------------------------------

// @ts-ignore
addEventListener("fetch", (event: FetchEvent) => {
  // Force to plain string — Spin variables may return Wasm host objects
  const connStr = String(Variables.get("pg_connection_string") ?? "");
  const redisConnStr = String(Variables.get("redis_connection_string") ?? "redis://localhost:6379");

  event.respondWith(
    router.fetch(event.request, {
      connectionString: connStr,
      redisConnectionString: redisConnStr,
    }),
  );
});
