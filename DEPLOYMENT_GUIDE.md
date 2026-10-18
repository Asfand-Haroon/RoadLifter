# RoadLifter Deployment Guide

RoadLifter runs as two Node.js services: the Next.js client and the Express/Socket.IO API. Docker is optional. Provision PostgreSQL separately; migrations run when the API starts.

## Runtime Requirements

- Node.js 20.9 or newer
- npm
- A PostgreSQL database reachable over TLS from the API service
- HTTPS domains for the client and API, with WebSocket upgrades enabled

## Deploy the API

Create a Node service with its root/build directory set to `server`.

- Install command: `npm ci`
- Start command: `npm start`

Set these environment variables in the hosting provider's secret/configuration panel:

```env
NODE_ENV=production
PORT=<provider-assigned-port>
DATABASE_URL=<TLS-enabled-postgresql-url>
JWT_SECRET=<unique-random-secret-at-least-32-characters>
ADMIN_API_KEY=<different-random-secret-at-least-32-characters>
CLIENT_URL=https://app.example.com
ALLOWED_ORIGINS=https://app.example.com
TRUST_PROXY=1
FIREBASE_SERVICE_ACCOUNT_JSON=<Firebase service-account JSON stored as a secret>
```

Use the provider's actual proxy hop count for `TRUST_PROXY`. If the frontend uses more than one origin, list each exact origin comma-separated. Do not use `*` for production origins. Keep the Firebase service-account JSON private and configure it only on the API service.

`npm start` applies migrations before starting the API. **Migration 007 permanently deletes all existing users and their related shipments, ratings, trucks, and driver locations. Back up the database and confirm this reset is intended before deploying it.**

The API exposes `GET /health`. The host/proxy must forward HTTP and Socket.IO WebSocket traffic to the same service and port.

## Deploy the Client

Create a Node service with its root/build directory set to `client`.

- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm start`

Set the public build-time variables:

```env
NEXT_PUBLIC_API_URL=https://api.example.com
NEXT_PUBLIC_WS_URL=https://api.example.com
NEXT_PUBLIC_APP_URL=https://app.example.com
NEXT_PUBLIC_FIREBASE_API_KEY=<Firebase Web app API key>
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=<Firebase project auth domain>
NEXT_PUBLIC_FIREBASE_PROJECT_ID=<Firebase project ID>
NEXT_PUBLIC_FIREBASE_APP_ID=<Firebase Web app ID>
```

Enable Google in Firebase Authentication and authorize the deployed client domain. The API and Socket.IO URLs should use HTTPS; Socket.IO will negotiate secure WebSockets. Rebuild the client when these public variables change.

## Operator Console

Open `/admin/login` on the deployed client and sign in with the configured `ADMIN_EMAIL` and `ADMIN_PASSWORD`. The protected operator console provides user counts, active-driver counts, shipment status totals, paginated shipper/driver directories, driver verification details, truck records, latest driver locations, shipment records, and shipment ratings. Google authentication is used for user accounts; admin login remains separately managed.

The console contains personal information, driver identity/license details, and recent location data. Give access only to trusted operators, use HTTPS, and follow applicable privacy, retention, and data-access requirements. The dashboard's authenticated API endpoints are admin-only; never put admin credentials or `ADMIN_API_KEY` in a `NEXT_PUBLIC_*` variable.

Driver applications are not approved automatically. Trusted operators can verify or reject an application from the console's Driver applications tab.

## Pre-Launch Checks

1. Configure HTTPS, DNS, CORS origins, health checks, and WebSocket support.
2. Verify secrets are set in the hosting provider and are not committed to the repository.
3. Run `npm ci`, `npm run lint`, and `npm run build` in `client`.
4. Run `npm ci` and `npm audit --omit=dev` in `server`.
5. Test Google sign-in, new-account role selection, driver onboarding, shipment creation/acceptance, status updates, and ratings against staging PostgreSQL.
6. Verify backup and restore procedures before applying migrations to production.

## Product Limitations

RoadLifter only introduces shipment participants and shares their contact details after acceptance. Communication, agreements, and all payments happen outside the platform; there is no in-app chat and no payment collection or processing. Object storage for delivery evidence must be configured before public launch. Establish privacy/terms notices, a secure identity-document review and retention process, and the legal, insurance, and freight-compliance requirements for each operating jurisdiction before accepting real users.
