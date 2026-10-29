require('dotenv').config();

const NODE_ENV = process.env.NODE_ENV || 'development';
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? '' : 'roadlifter-local-development-secret');
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const FIREBASE_SERVICE_ACCOUNT_JSON = process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
let FIREBASE_SERVICE_ACCOUNT = null;
const configuredOrigins = process.env.ALLOWED_ORIGINS
  ?.split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const ALLOWED_ORIGINS = configuredOrigins?.length
  ? configuredOrigins
  : NODE_ENV === 'production'
    ? [CLIENT_URL]
    : [CLIENT_URL, 'http://localhost:3000', 'http://127.0.0.1:3000'];

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  if (NODE_ENV !== 'production') {
    try {
      const url = new URL(origin);
      const host = url.hostname;
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.endsWith('.ngrok-free.dev') ||
        host.endsWith('.ngrok-free.app') ||
        host.endsWith('.ngrok.io') ||
        host.endsWith('.loca.lt')
      ) {
        return true;
      }
    } catch {
      return false;
    }
  }
  return false;
};

const trustProxyValue = process.env.TRUST_PROXY;
const TRUST_PROXY = trustProxyValue === 'true'
  ? 1
  : trustProxyValue === 'false' || !trustProxyValue
    ? false
    : Number(trustProxyValue);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

if (NODE_ENV === 'production' && JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}

if (NODE_ENV === 'production' && ADMIN_API_KEY.length < 32) {
  throw new Error('ADMIN_API_KEY must be set to at least 32 characters in production');
}

if (NODE_ENV === 'production' && !ADMIN_EMAIL) {
  throw new Error('ADMIN_EMAIL is required in production');
}

if (NODE_ENV === 'production' && !ADMIN_PASSWORD) {
  throw new Error('ADMIN_PASSWORD is required in production');
}

if (NODE_ENV === 'production' && !FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required in production');
}

if (FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    FIREBASE_SERVICE_ACCOUNT = JSON.parse(FIREBASE_SERVICE_ACCOUNT_JSON);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON');
  }
  if (typeof FIREBASE_SERVICE_ACCOUNT.project_id !== 'string' ||
      typeof FIREBASE_SERVICE_ACCOUNT.client_email !== 'string' ||
      typeof FIREBASE_SERVICE_ACCOUNT.private_key !== 'string' ||
      !FIREBASE_SERVICE_ACCOUNT.project_id ||
      !FIREBASE_SERVICE_ACCOUNT.client_email ||
      !FIREBASE_SERVICE_ACCOUNT.private_key) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is missing required service-account fields');
  }
}

if (!Number.isInteger(TRUST_PROXY) && TRUST_PROXY !== false) {
  throw new Error('TRUST_PROXY must be true, false, or an integer hop count');
}

module.exports = {
  PORT: Number(process.env.PORT || 5000),
  NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET,
  ADMIN_API_KEY,
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  FIREBASE_SERVICE_ACCOUNT,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',
  CLIENT_URL,
  ALLOWED_ORIGINS,
  TRUST_PROXY,
  isOriginAllowed,
};
