# RoadLifter Production Checklist

## Infrastructure

- [ ] Deploy the client and API as separate Node.js 20.9+ services.
- [ ] Provision production PostgreSQL with TLS, restricted network access, backups, and tested restore procedures.
- [ ] Configure HTTPS domains for the client and API.
- [ ] Allow Socket.IO WebSocket upgrades through the API host and reverse proxy.
- [ ] Set the client origin in `CLIENT_URL` and `ALLOWED_ORIGINS`.

## Secrets and Runtime

- [ ] Set `NODE_ENV=production`.
- [ ] Generate a unique `JWT_SECRET` with at least 32 random characters.
- [ ] Generate a separate `ADMIN_API_KEY` with at least 32 random characters.
- [ ] Set `DATABASE_URL` in the API service only.
- [ ] Set `FIREBASE_SERVICE_ACCOUNT_JSON` in the API service only.
- [ ] Set `TRUST_PROXY` to the actual trusted proxy hop count.
- [ ] Set client build-time values: API/WS/app URLs and the four `NEXT_PUBLIC_FIREBASE_*` values.
- [ ] Enable Google Authentication and authorize the production frontend domain in Firebase.
- [ ] Confirm no `.env` files or secrets are committed.

## Build and Migration

- [ ] Run `npm ci`, `npm run lint`, and `npm run build` in `client`.
- [ ] Run `npm ci` and `npm audit --omit=dev` in `server`.
- [ ] Exercise all migrations against a staging database and take a production backup before applying schema changes.
- [ ] Confirm migration 007's permanent deletion of existing accounts, shipments, trucks, ratings, and driver locations before production.
- [ ] Verify API `GET /health` and the frontend deployment after release.

## Product Operations

- [ ] Test Google sign-in, role selection, driver application review, shipment posting/acceptance, delivery status, ratings, and live map updates in staging.
- [ ] Review pending driver applications only from a trusted operator environment using `ADMIN_API_KEY`.
- [ ] Establish a secure identity-document review and retention policy.
- [ ] Review OpenStreetMap Nominatim usage limits and attribution for pickup-address geocoding; use a production geocoder or shared cache if traffic exceeds its public-service policy.
- [ ] Provide privacy/terms notices and Google account sign-in before public user onboarding.
- [ ] Complete legal, insurance, payment, and freight-compliance review for every launch jurisdiction.

Communication, agreements, and payments happen outside RoadLifter. The platform has no in-app chat and does not collect or process payments. Admin login remains independent from Google user authentication.
