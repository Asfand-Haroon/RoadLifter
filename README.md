# RoadLifter

RoadLifter is a Next.js freight marketplace client with an Express and Socket.IO API. PostgreSQL is provisioned separately; Docker is optional.

## Requirements

- Node.js 20.9 or newer
- npm
- A PostgreSQL database reachable by the API

## Run Locally

Copy `server/.env.example` to `server/.env` and set `DATABASE_URL`, `JWT_SECRET`, `ADMIN_API_KEY`, and `FIREBASE_SERVICE_ACCOUNT_JSON`. Copy `client/.env.local.example` to `client/.env.local` and add the Firebase Web app config; the API and socket URLs use port `5000` by default. Enable Google as a sign-in provider in Firebase Authentication.

Start the API and client in separate terminals:

```powershell
cd server
npm ci
npm run dev
```

```powershell
cd client
npm ci
npm run dev
```

The API runs pending SQL migrations at startup and records successful migrations in `roadlifter_schema_migrations` so they are not reapplied on every restart. The client is available at `http://localhost:3000`; the API health check is `http://localhost:5000/health`.

**Data reset warning:** the next API startup applies migration 007, which permanently deletes all existing users and their associated shipments, trucks, ratings, and driver locations. Back up the configured database and verify it is the intended database before starting the updated API.

## Deploy

Deploy `server` and `client` as separate Node services. Use a managed PostgreSQL database with TLS and backups. Configure these server environment variables:

- `NODE_ENV=production`
- `DATABASE_URL`
- `JWT_SECRET` (at least 32 random characters)
- `ADMIN_API_KEY` (a different secret, at least 32 random characters)
- `CLIENT_URL` and `ALLOWED_ORIGINS` for the exact HTTPS frontend origins
- `TRUST_PROXY` to match the number of trusted reverse-proxy hops
- `PORT` if the hosting provider does not inject it
- `FIREBASE_SERVICE_ACCOUNT_JSON` containing the Firebase project's service-account JSON

Configure these public client values at build time:

- `NEXT_PUBLIC_API_URL=https://api.example.com`
- `NEXT_PUBLIC_WS_URL=https://api.example.com`
- `NEXT_PUBLIC_APP_URL=https://example.com`
- `NEXT_PUBLIC_FIREBASE_API_KEY`, `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`,
  `NEXT_PUBLIC_FIREBASE_PROJECT_ID`, and `NEXT_PUBLIC_FIREBASE_APP_ID`

The API uses WebSockets; the backend host and any proxy must allow Socket.IO WebSocket upgrades. Configure the deployed client domain as an authorized domain in Firebase Authentication. Never put `ADMIN_API_KEY`, `JWT_SECRET`, `DATABASE_URL`, or Firebase service-account JSON in client variables. Keep HTTPS enabled and replace every placeholder in the production examples.

RoadLifter user accounts sign in with Google through Firebase Authentication. New users choose a role after Google sign-in; drivers then complete the existing driver review process. Admin access remains separately managed by the server.

## Review Drivers

Driver submissions remain pending until an operator reviews them. Keep `ADMIN_API_KEY` in a secret manager and call the admin API only from a trusted operator environment:

```powershell
$headers = @{ 'x-admin-key' = $env:ADMIN_API_KEY }
Invoke-RestMethod -Headers $headers -Uri 'https://api.example.com/api/admin/drivers/pending'
Invoke-RestMethod -Method Patch -Headers $headers -ContentType 'application/json' -Body '{"status":"VERIFIED"}' -Uri 'https://api.example.com/api/admin/drivers/DRIVER_ID'
```

Use `REJECTED` instead of `VERIFIED` to reject an application. The browser-based operator dashboard at `/admin` signs in with admin credentials from the server environment, while the legacy `x-admin-key` API header remains supported for trusted automation. Do not expose the admin key in the browser or commit it to the repository.

## Release Gates

- Run `npm ci`, `npm run lint`, and `npm run build` in `client` for every release.
- Run `npm ci` and `npm audit --omit=dev` in `server`; exercise migrations against a staging database before production.
- Configure Google sign-in in Firebase, privacy/terms notices, and an operator process for reviewing identity documents before accepting real users.
- Review legal, insurance, and freight-compliance requirements for every operating jurisdiction.
