;{
   // Precompiled regular expressions
   const precompile = (r) => { r.exec('a'); r.exec('\u1000'); };precompile(/\/+(\/|$)/g);
precompile(/(\/?\.?):(\w+)\+/g);
precompile(/(\/?\.?):(\w+)/g);
precompile(/\./g);
precompile(/(\/?)\*/g);
precompile(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i);}// node_modules/@spinframework/spin-postgres/dist/index.js
import * as spinPg from "spin:postgres/postgres@3.0.0";
var PostgresV3DataType;
(function(PostgresV3DataType2) {
  PostgresV3DataType2["PostgresV3Boolean"] = "boolean";
  PostgresV3DataType2["PostgresV3Int8"] = "int8";
  PostgresV3DataType2["PostgresV3Int16"] = "int16";
  PostgresV3DataType2["PostgresV3Int32"] = "int32";
  PostgresV3DataType2["PostgresV3Int64"] = "int64";
  PostgresV3DataType2["PostgresV3Floating32"] = "floating32";
  PostgresV3DataType2["PostgresV3Floating64"] = "floating64";
  PostgresV3DataType2["PostgresV3Str"] = "str";
  PostgresV3DataType2["PostgresV3Binary"] = "binary";
  PostgresV3DataType2["PostgresV3Date"] = "date";
  PostgresV3DataType2["PostgresV3Time"] = "time";
  PostgresV3DataType2["PostgresV3DateTime"] = "datetime";
  PostgresV3DataType2["PostgresV3TimeStamp"] = "timestamp";
  PostgresV3DataType2["PostgresV3Other"] = "other";
})(PostgresV3DataType || (PostgresV3DataType = {}));
function createPostgresConnection(connection) {
  return {
    query: (statement, params) => {
      let santizedParams = convertRdbmsToWitTypes(params);
      let ret = connection.query(statement, santizedParams);
      let results = {
        columns: ret.columns,
        rows: []
      };
      ret.rows.map((k, rowIndex) => {
        results.rows.push({});
        k.map((val, valIndex) => {
          switch (val.tag) {
            case "date": {
              const [year, month, day] = val.val;
              results.rows[rowIndex][results.columns[valIndex].name] = new Date(Date.UTC(year, month - 1, day));
              break;
            }
            case "time": {
              const [hour, minute, second, nanosecond] = val.val;
              const date = new Date(Date.UTC(1970, 0, 1, hour, minute, second));
              date.setMilliseconds(nanosecond / 1e6);
              results.rows[rowIndex][results.columns[valIndex].name] = date;
              break;
            }
            case "datetime": {
              const [year, month, day, hour, minute, second, nanosecond] = val.val;
              const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
              date.setMilliseconds(nanosecond / 1e6);
              results.rows[rowIndex][results.columns[valIndex].name] = date;
              break;
            }
            case "timestamp": {
              const seconds = val.val;
              results.rows[rowIndex][results.columns[valIndex].name] = new Date(seconds * 1e3);
              break;
            }
            default: {
              results.rows[rowIndex][results.columns[valIndex].name] = val.tag == "db-null" || val.tag == "unsupported" ? null : val.val;
              break;
            }
          }
        });
      });
      return results;
    },
    execute: (statement, params) => {
      let santizedParams = convertRdbmsToWitTypes(params);
      let ret = connection.execute(statement, santizedParams);
      return ret;
    }
  };
}
function open(address) {
  return createPostgresConnection(spinPg.Connection.open(address));
}
function convertRdbmsToWitTypes(parameters) {
  let sanitized = [];
  for (let k of parameters) {
    if (k === null) {
      sanitized.push({ tag: "db-null" });
      continue;
    }
    if (k instanceof Uint8Array) {
      sanitized.push({ tag: "binary", val: k });
      continue;
    }
    if (typeof k === "object") {
      sanitized.push(k);
      continue;
    }
    if (typeof k === "string") {
      sanitized.push({ tag: "str", val: k });
      continue;
    }
    if (typeof k === "boolean") {
      sanitized.push({ tag: "boolean", val: k });
      continue;
    }
    if (typeof k === "bigint") {
      sanitized.push({ tag: "int64", val: k });
      continue;
    }
    if (typeof k === "number") {
      isFloat(k) ? sanitized.push({ tag: "floating64", val: k }) : sanitized.push({ tag: "int32", val: k });
      continue;
    }
  }
  return sanitized;
}
function isFloat(number) {
  return number % 1 !== 0;
}

// node_modules/@spinframework/spin-variables/dist/index.js
import { get as spinGet } from "fermyon:spin/variables@2.0.0";
function get(key) {
  try {
    return spinGet(key);
  } catch (e) {
    return null;
  }
}

// node_modules/@spinframework/spin-kv/dist/index.js
import * as spinKv from "fermyon:spin/key-value@2.0.0";
var encoder = new TextEncoder();
var decoder = new TextDecoder();
function createKvStore(store) {
  let kv = {
    get: (key) => {
      return store.get(key) || null;
    },
    set: (key, value) => {
      if (!(value instanceof Uint8Array)) {
        if (typeof value === "string") {
          value = encoder.encode(value);
        } else if (typeof value === "object") {
          value = encoder.encode(JSON.stringify(value));
        }
      }
      store.set(key, value);
    },
    delete: (key) => {
      store.delete(key);
    },
    exists: (key) => {
      return store.exists(key);
    },
    getKeys: () => {
      return store.getKeys();
    },
    getJson: (key) => {
      return JSON.parse(decoder.decode(store.get(key) || new Uint8Array()));
    },
    setJson: (key, value) => {
      store.set(key, encoder.encode(JSON.stringify(value)));
    }
  };
  return kv;
}
function openDefault() {
  return createKvStore(spinKv.Store.open("default"));
}

// node_modules/@spinframework/spin-redis/dist/index.js
import * as spinRedis from "fermyon:spin/redis@2.0.0";
function open2(address) {
  return spinRedis.Connection.open(address);
}

// node_modules/itty-router/index.mjs
var t = ({ base: e = "", routes: t2 = [], ...o2 } = {}) => ({ __proto__: new Proxy({}, { get: (o3, r2, a2, s2) => (o4, ...n2) => t2.push([r2.toUpperCase?.(), RegExp(`^${(s2 = (e + o4).replace(/\/+(\/|$)/g, "$1")).replace(/(\/?\.?):(\w+)\+/g, "($1(?<$2>[^]+))").replace(/(\/?\.?):(\w+)/g, "($1(?<$2>[^$1/]+?))").replace(/\./g, "\\.").replace(/(\/?)\*/g, "($1.*)?")}/*$`), n2, s2]) && a2 }), routes: t2, ...o2, async fetch(e2, ...r2) {
  let a2, s2, n2 = new URL(e2.url), c2 = e2.query = { __proto__: null };
  for (let [e3, t3] of n2.searchParams) c2[e3] = c2[e3] ? [].concat(c2[e3], t3) : t3;
  e: try {
    for (let t3 of o2.before || []) if (null != (a2 = await t3(e2.proxy ?? e2, ...r2))) break e;
    t: for (let [o3, c3, l, i] of t2) if ((o3 == e2.method || "ALL" == o3) && (s2 = n2.pathname.match(c3))) {
      e2.params = s2.groups || {}, e2.route = i;
      for (let t3 of l) if (null != (a2 = await t3(e2.proxy ?? e2, ...r2))) break t;
    }
  } catch (t3) {
    if (!o2.catch) throw t3;
    a2 = await o2.catch(t3, e2.proxy ?? e2, ...r2);
  }
  try {
    for (let t3 of o2.finally || []) a2 = await t3(a2, e2.proxy ?? e2, ...r2) ?? a2;
  } catch (t3) {
    if (!o2.catch) throw t3;
    a2 = await o2.catch(t3, e2.proxy ?? e2, ...r2);
  }
  return a2;
} });
var o = (e = "text/plain; charset=utf-8", t2) => (o2, r2 = {}) => {
  if (void 0 === o2 || o2 instanceof Response) return o2;
  const a2 = new Response(t2?.(o2) ?? o2, r2.url ? void 0 : r2);
  return a2.headers.set("content-type", e), a2;
};
var r = o("application/json; charset=utf-8", JSON.stringify);
var a = (e) => ({ 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden", 404: "Not Found", 500: "Internal Server Error" })[e] || "Unknown Error";
var s = (e = 500, t2) => {
  if (e instanceof Error) {
    const { message: o2, ...r2 } = e;
    e = e.status || 500, t2 = { error: o2 || a(e), ...r2 };
  }
  return t2 = { status: e, ..."object" == typeof t2 ? t2 : { error: t2 || a(e) } }, r(t2, { status: e });
};
var n = (e) => {
  e.proxy = new Proxy(e.proxy ?? e, { get: (t2, o2) => t2[o2]?.bind?.(e) ?? t2[o2] ?? t2?.params?.[o2] });
};
var c = ({ format: e = r, missing: o2 = (() => s(404)), finally: a2 = [], before: c2 = [], ...l } = {}) => t({ before: [n, ...c2], catch: s, finally: [(e2, ...t2) => e2 ?? o2(...t2), e, ...a2], ...l });
var p = o("text/plain; charset=utf-8", String);
var f = o("text/html");
var u = o("image/jpeg");
var h = o("image/png");
var g = o("image/webp");

// node_modules/uuid/dist/regex.js
var regex_default = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$/i;

// node_modules/uuid/dist/validate.js
function validate(uuid) {
  return typeof uuid === "string" && regex_default.test(uuid);
}
var validate_default = validate;

// node_modules/uuid/dist/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist/rng.js
var rnds8 = new Uint8Array(16);
function rng() {
  return crypto.getRandomValues(rnds8);
}

// node_modules/uuid/dist/v4.js
function v4(options, buf, offset) {
  if (!buf && !options && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return _v4(options, buf, offset);
}
function _v4(options, buf, offset) {
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
var v4_default = v4;

// src/index.ts
var SQL_CREATE = "INSERT INTO Products (Id, Name, Price) VALUES ($1, $2, $3)";
var SQL_READ_ALL = "SELECT Id, Name, Price FROM Products ORDER BY Name";
var SQL_READ_BY_ID = "SELECT Id, Name, Price FROM Products WHERE Id = $1";
var SQL_UPDATE_BY_ID = "UPDATE Products SET Name = $1, Price = $2 WHERE Id = $3";
var SQL_DELETE_BY_ID = "DELETE FROM Products WHERE Id = $1";
var HEADERS_JSON = { "content-type": "application/json" };
var decoder2 = new TextDecoder();
function ok(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: HEADERS_JSON
  });
}
function badRequest(msg) {
  return ok({ error: msg }, 400);
}
function notFound(msg) {
  return ok({ error: msg }, 404);
}
function serverError(msg) {
  return ok({ error: msg }, 500);
}
function errMsg(e) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (e.payload) return typeof e.payload === "string" ? e.payload : JSON.stringify(e.payload);
  if (e.message) return e.message;
  return String(e);
}
var router = c();
router.get("/", () => ok({
  service: "quay-prototype \u2014 Spin PostgreSQL + KV + Redis API",
  endpoints: {
    postgres: [
      "GET  /products",
      "GET  /products/:id",
      "POST /products",
      "PUT  /products/:id",
      "DELETE /products/:id"
    ],
    kv: [
      "GET  /kv",
      "GET  /kv/:key",
      "POST /kv/:key",
      "DELETE /kv/:key"
    ],
    redis: [
      "GET  /redis/ping",
      "GET  /redis/:key",
      "POST /redis/:key",
      "DELETE /redis/:key"
    ]
  }
}));
router.post("/products", async (request, extra) => {
  const connStr = String(extra.connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");
  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing request body");
  let payload;
  try {
    payload = JSON.parse(decoder2.decode(body));
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!payload.name || typeof payload.price !== "number") {
    return badRequest(
      'Expected {"name": "...", "price": 9.99}'
    );
  }
  try {
    const product = { id: v4_default(), name: payload.name, price: payload.price };
    const conn = open(connStr);
    conn.execute(SQL_CREATE, [product.id, product.name, product.price]);
    return new Response(JSON.stringify(product), {
      status: 201,
      headers: {
        ...HEADERS_JSON,
        Location: `/products/${product.id}`
      }
    });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.get("/products", async (_, extra) => {
  const connStr = String(extra.connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");
  try {
    const conn = open(connStr);
    const result = conn.query(SQL_READ_ALL, []);
    const items = result.rows.map((row) => ({
      id: row["id"],
      name: row["name"],
      price: row["price"]
    }));
    return ok(items);
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.get("/products/:id", async (request, extra) => {
  const connStr = String(extra.connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");
  const { id } = request.params;
  if (!id || !validate_default(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }
  try {
    const conn = open(connStr);
    const result = conn.query(SQL_READ_BY_ID, [id]);
    if (result.rows.length === 0) return notFound("Product not found");
    const row = result.rows[0];
    return ok({ id: row["id"], name: row["name"], price: row["price"] });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.put("/products/:id", async (request, extra) => {
  const connStr = String(extra.connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");
  const { id } = request.params;
  if (!id || !validate_default(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }
  const body = await request.arrayBuffer();
  let payload;
  try {
    payload = JSON.parse(decoder2.decode(body));
  } catch {
    return badRequest("Invalid JSON body");
  }
  if (!payload.name || typeof payload.price !== "number") {
    return badRequest(
      'Expected {"name": "...", "price": 9.99}'
    );
  }
  try {
    const conn = open(connStr);
    const updatedRows = conn.execute(SQL_UPDATE_BY_ID, [
      payload.name,
      payload.price,
      id
    ]);
    if (updatedRows === 0n) return notFound("Product not found");
    return ok({ id, name: payload.name, price: payload.price });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.delete("/products/:id", async (request, extra) => {
  const connStr = String(extra.connectionString ?? "");
  if (!connStr) return serverError("Missing connection string");
  const { id } = request.params;
  if (!id || !validate_default(id)) {
    return badRequest("Invalid product ID (must be a UUID)");
  }
  try {
    const conn = open(connStr);
    const deletedRows = conn.execute(SQL_DELETE_BY_ID, [id]);
    if (deletedRows === 0n) return notFound("Product not found");
    return new Response(null, { status: 204 });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
var kvStore = null;
function getKv() {
  if (!kvStore) kvStore = openDefault();
  return kvStore;
}
router.get("/kv", () => {
  try {
    return ok({ keys: getKv().getKeys() });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.get("/kv/:key", ({ params }) => {
  const { key } = params;
  try {
    const kv = getKv();
    if (!kv.exists(key)) return notFound(`Key "${key}" not found`);
    return ok({ key, value: kv.getJson(key) });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.post("/kv/:key", async (request) => {
  const { key } = request.params;
  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing request body");
  let payload;
  try {
    payload = JSON.parse(decoder2.decode(body));
  } catch {
    return badRequest("Invalid JSON body");
  }
  try {
    getKv().setJson(key, payload);
    return ok({ status: "stored", key });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.delete("/kv/:key", ({ params }) => {
  const { key } = params;
  try {
    getKv().delete(key);
    return ok({ status: "deleted", key });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
function getRedisConn(extra) {
  const addr = String(extra?.redisConnectionString ?? "redis://localhost:6379");
  return open2(addr);
}
router.get("/redis/ping", (_, extra) => {
  try {
    const conn = getRedisConn(extra);
    const result = conn.execute("PING", []);
    const msg = result[0]?.tag === "status" ? result[0].val : String(result[0]);
    return ok({ redis: msg });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.post("/redis/:key", async (request, extra) => {
  const { key } = request.params;
  const body = await request.arrayBuffer();
  if (!body) return badRequest("Missing value (send as plain text)");
  try {
    const conn = getRedisConn(extra);
    conn.set(key, new Uint8Array(body));
    return ok({ status: "set", key });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.get("/redis/:key", ({ params }, extra) => {
  const { key } = params;
  try {
    const conn = getRedisConn(extra);
    const val = conn.get(key);
    if (!val) return notFound(`Key "${key}" not found`);
    return ok({ key, value: decoder2.decode(val) });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.delete("/redis/:key", ({ params }, extra) => {
  const { key } = params;
  try {
    const conn = getRedisConn(extra);
    conn.del([key]);
    return ok({ status: "deleted", key });
  } catch (e) {
    return serverError(errMsg(e));
  }
});
router.all("*", () => notFound("Endpoint not found"));
addEventListener("fetch", (event) => {
  const connStr = String(get("pg_connection_string") ?? "");
  const redisConnStr = String(get("redis_connection_string") ?? "redis://localhost:6379");
  event.respondWith(
    router.fetch(event.request, {
      connectionString: connStr,
      redisConnectionString: redisConnStr
    })
  );
});


//# sourceMappingURL=precompiled-source.js.map
