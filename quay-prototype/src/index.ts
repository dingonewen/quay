// @ts-ignore — Spin Wasm host bindings, no types
import * as Postgres from "@spinframework/spin-postgres";
// @ts-ignore
import * as Variables from "@spinframework/spin-variables";
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

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

const router = AutoRouter();

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
    return serverError(e?.message ?? String(e));
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
    return serverError(e?.message ?? String(e));
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
    return serverError(e?.message ?? String(e));
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
    if (updatedRows === 0) return notFound("Product not found");

    return ok({ id, name: payload.name, price: payload.price });
  } catch (e: any) {
    return serverError(e?.message ?? String(e));
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
    if (deletedRows === 0) return notFound("Product not found");

    return new Response(null, { status: 204 });
  } catch (e: any) {
    return serverError(e?.message ?? String(e));
  }
});

// 404
router.all("*", () => notFound("Endpoint not found"));

// ---------------------------------------------------------------------------
// Spin entry-point
// ---------------------------------------------------------------------------

// @ts-ignore
addEventListener("fetch", (event: FetchEvent) => {
  // Force to plain string — Variables.get() might return a Wasm host object
  const connStr = String(Variables.get("pg_connection_string") ?? "");

  event.respondWith(
    router.fetch(event.request, { connectionString: connStr }),
  );
});
