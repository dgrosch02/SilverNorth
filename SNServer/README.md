# SNServer

Node.js (Express) middleware for SilverNorth. It connects to a local MySQL
database via Prisma and provides a phone-number authentication flow backed by
the Twilio Verify API.

## Prerequisites

- **Node.js** `20.19+` or `22.12+` (the project pins Prisma `5.x`, which also
  runs on Node 21). Check with `node -v`.
- **MySQL** running locally (default port `3306`) with a database/schema created
  for the app (e.g. `SilverNorth`).
- A **Twilio** account with a **Verify Service** created in the
  [Twilio Console](https://console.twilio.com/) (Verify → Services).

## 1. Install dependencies

```bash
cd SNServer
npm install
```

## 2. Configure environment variables

The server reads configuration from a `.env` file in the `SNServer` directory.
Create one (or edit the existing file) with the following values:

```bash
# Local MySQL database
LOCAL_DB_HOST='localhost'
LOCAL_DB_PORT=3306
LOCAL_DB_USER='root'
LOCAL_DB_PASSWORD='your_mysql_password'
LOCAL_DB_SCHEMA='SilverNorth'
NODE_ENV='development'

# Prisma reads this single connection string (built from the values above)
DATABASE_URL="mysql://${LOCAL_DB_USER}:${LOCAL_DB_PASSWORD}@${LOCAL_DB_HOST}:${LOCAL_DB_PORT}/${LOCAL_DB_SCHEMA}"

# Twilio credentials (from the Twilio Console)
TWILIO_ACCOUNT_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_twilio_auth_token"
TWILIO_VERIFY_SERVICE_SID="VAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

# Server port
PORT=3005
```

> Note: `.env` contains secrets — do not commit it to source control.

## 3. Set up the database (Prisma)

Generate the Prisma client and create the `users` table from
[`prisma/schema.prisma`](prisma/schema.prisma):

```bash
npx prisma generate
npx prisma db push
```

- `prisma generate` builds the type-safe client used by the server.
- `prisma db push` syncs the schema to your MySQL database (creates the
  `users` table). Use `npx prisma migrate dev` instead if you prefer tracked
  migration files.

You can browse the data anytime with:

```bash
npx prisma studio
```

## 4. Start the server

```bash
npm start
```

For auto-reload during development:

```bash
npm run dev
```

On success you'll see:

```
SNServer is running on port 3005
```

## API Endpoints

Base URL: `http://localhost:3005`

### `POST /api/auth/send-code`

Sends an SMS verification code to a phone number.

```json
{ "phoneNumber": "+15550100199" }
```

### `POST /api/auth/verify-code`

Verifies the code. On approval, finds the user by phone number or creates a new
one. Optional profile fields (`name`, `username`, `email`, `pictureKey`, `bio`,
`color`) are saved when a new user is created.

```json
{ "phoneNumber": "+15550100199", "code": "123456", "name": "J. Rico" }
```

Response:

```json
{
  "success": true,
  "message": "Phone number verified successfully",
  "isNewUser": true,
  "user": { "id": 1, "phoneNumber": "+15550100199", "name": "J. Rico" }
}
```

## How it connects to the frontend

The `map-viewer` Vite dev server proxies `/api` requests to this server
(`http://127.0.0.1:3005`), so the React app can call `/api/auth/...` directly
without CORS or mixed-content issues. Make sure SNServer is running before
signing in from the map viewer.

## Troubleshooting

- **`Twilio is not configured properly on the server.`** — One of the
  `TWILIO_*` variables is missing or invalid in `.env`.
- **Prisma `P1001` / connection errors** — MySQL isn't running, or
  `DATABASE_URL` credentials/schema name are wrong.
- **`EPERM` during `prisma generate`** — Re-run it in a normal (non-sandboxed)
  terminal so Prisma can write to its engine cache.
- **Prisma engine / Node version errors** — Confirm your Node version is
  compatible (see Prerequisites).
