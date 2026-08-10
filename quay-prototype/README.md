# quay-prototype

Spin + TypeScript PostgreSQL CRUD API on Akamai Functions (NEON Postgres).

## Prerequisites

- Spin CLI (`spin --version` ≥ 4.0)
- Node.js ≥ 22 (via nvm or system)
- NEON PostgreSQL database with `Products` table

## Database Setup

Run this in your NEON SQL Editor:

```sql
CREATE TABLE IF NOT EXISTS Products (
    Id varchar(36) PRIMARY KEY,
    Name TEXT NOT NULL,
    Price DOUBLE PRECISION
);

INSERT INTO Products (Id, Name, Price)
SELECT 'faac630e-a645-4459-9d7e-751df4016a6e', 'V-Neck T-Shirt', 19.99
WHERE NOT EXISTS (SELECT Id FROM Products WHERE Id = 'faac630e-a645-4459-9d7e-751df4016a6e');

INSERT INTO Products (Id, Name, Price)
SELECT 'c01dce8a-3a50-4ef6-a0f1-7f9f48a238c8', 'Hoodie with Logo', 79.99
WHERE NOT EXISTS (SELECT Id FROM Products WHERE Id = 'c01dce8a-3a50-4ef6-a0f1-7f9f48a238c8');

INSERT INTO Products (Id, Name, Price)
SELECT '6f062dc2-bbf2-4c6c-8169-3511462cd54b', 'Belt', 14.99
WHERE NOT EXISTS (SELECT Id FROM Products WHERE Id = '6f062dc2-bbf2-4c6c-8169-3511462cd54b');
```

## Local Development

```bash
npm install
export SPIN_VARIABLE_PG_CONNECTION_STRING="postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require"
spin build && spin up
```

Serves at `http://127.0.0.1:3000`.

## Deploy to Akamai Functions

```bash
spin aka login
spin aka deploy --build \
  --variable pg_connection_string="postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require"
```

## API

```
GET  /                        API listing
GET  /products                List all products
GET  /products/:id            Get product by UUID
POST /products                Create product  { "name": "...", "price": 9.99 }
PUT  /products/:id            Update product  { "name": "...", "price": 9.99 }
DELETE /products/:id          Delete product
```

## Example Curl Commands

```bash
curl -s https://<app>.fwf.app/products | jq

curl -s -X POST https://<app>.fwf.app/products \
  -H "Content-Type: application/json" \
  -d '{"name":"Plain Hoodie","price":42.99}' | jq

curl -s https://<app>.fwf.app/products/c01dce8a-3a50-4ef6-a0f1-7f9f48a238c8 | jq

curl -s -X PUT https://<app>.fwf.app/products/faac630e-a645-4459-9d7e-751df4016a6e \
  -H "Content-Type: application/json" \
  -d '{"name":"V-Neck Updated","price":24.99}' | jq

curl -s -o /dev/null -w "HTTP %{http_code}\n" -X DELETE \
  https://<app>.fwf.app/products/6f062dc2-bbf2-4c6c-8169-3511462cd54b

curl -s https://<app>.fwf.app/products/not-a-uuid | jq
```
