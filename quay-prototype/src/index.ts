import { AutoRouter } from "itty-router";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";

// Spin PostgreSQL and Variables — these are Wasm host bindings
// with no TypeScript types; use require-style runtime imports.
// @ts-ignore
import * as Variables from "@spinframework/spin-variables";
// @ts-ignore
import * as Postgres from "@spinframework/spin-postgres";

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

const DEFAULT_HEADERS = { "content-type": "application/json" };
const decoder = new TextDecoder();

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: DEFAULT_HEADERS,
  });
}

function badRequest(message: string): Response {
  return json({ message }, 400);
}

function notFound(message: string): Response {
  return json({ message }, 404);
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = AutoRouter();

// --- CREATE ----------------------------------------------------------------
router.post("/products", async (request, extra) => {
  const connStr = (extra as any).connectionString as string;
  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing request body");

  let payload: any;
  try {
    payload = JSON.parse(decoder.decode(body));
  } catch {
    return badRequest("Invalid JSON");
  }
  if (!payload.name || typeof payload.price !== "number") {
    return badRequest(
      'Invalid payload. Expected {"name": "…", "price": 9.99}',
    );
  }

  const product = { id: uuidv4(), name: payload.name, price: payload.price };
  const conn = Postgres.open(connStr);
  conn.execute(SQL_CREATE, [product.id, product.name, product.price]);

  return new Response(JSON.stringify(product), {
    status: 201,
    headers: {
      ...DEFAULT_HEADERS,
      Location: `/products/${product.id}`,
    },
  });
});

// --- READ ALL --------------------------------------------------------------
router.get("/products", async (_, extra) => {
  const connStr = (extra as any).connectionString as string;
  const conn = Postgres.open(connStr);
  const result = conn.query(SQL_READ_ALL, []);

  const items = result.rows.map((row: any) => ({
    id: row["id"],
    name: row["name"],
    price: row["price"],
  }));
  return json(items);
});

// --- READ BY ID ------------------------------------------------------------
router.get("/products/:id", async (request, extra) => {
  const connStr = (extra as any).connectionString as string;
  const { id } = request.params;
  if (!id || !uuidValidate(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }

  const conn = Postgres.open(connStr);
  const result = conn.query(SQL_READ_BY_ID, [id]);
  if (result.rows.length === 0) return notFound("Product not found");

  const row = result.rows[0];
  return json({ id: row["id"], name: row["name"], price: row["price"] });
});

// --- UPDATE ----------------------------------------------------------------
router.put("/products/:id", async (request, extra) => {
  const connStr = (extra as any).connectionString as string;
  const { id } = request.params;
  if (!id || !uuidValidate(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }

  const body = await request.arrayBuffer();
  let payload: any;
  try {
    payload = JSON.parse(decoder.decode(body));
  } catch {
    return badRequest("Invalid JSON");
  }
  if (!payload.name || typeof payload.price !== "number") {
    return badRequest(
      'Invalid payload. Expected {"name": "…", "price": 9.99}',
    );
  }

  const conn = Postgres.open(connStr);
  const updatedRows = conn.execute(SQL_UPDATE_BY_ID, [
    payload.name,
    payload.price,
    id,
  ]);
  if (updatedRows === 0) return notFound("Product not found");

  return json({ id, name: payload.name, price: payload.price });
});

// --- DELETE ----------------------------------------------------------------
router.delete("/products/:id", async (request, extra) => {
  const connStr = (extra as any).connectionString as string;
  const { id } = request.params;
  if (!id || !uuidValidate(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }

  const conn = Postgres.open(connStr);
  const deletedRows = conn.execute(SQL_DELETE_BY_ID, [id]);
  if (deletedRows === 0) return notFound("Product not found");

  return new Response(null, { status: 204 });
});

// 404 for unmatched routes
router.all("*", () => notFound("Endpoint not found"));

// ---------------------------------------------------------------------------
// Spin entry-point
// ---------------------------------------------------------------------------

// @ts-ignore — Spin FetchEvent
addEventListener("fetch", (event: FetchEvent) => {
  const connectionString = Variables.get("pg_connection_string");
  if (!connectionString) {
    return event.respondWith(
      new Response(
        JSON.stringify({ message: "Connection string not configured" }),
        { status: 500, headers: DEFAULT_HEADERS },
      ),
    );
  }
  event.respondWith(
    router.fetch(event.request, { connectionString }),
  );
});
