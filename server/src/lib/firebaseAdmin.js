const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const env = require('../config/env');

const getFirebaseAuth = () => {
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is not configured');
  }

  const existingApp = getApps().find((app) => app.name === 'roadlifter-auth');
  if (existingApp) return getAuth(existingApp);

  const app = initializeApp({
    credential: cert(env.FIREBASE_SERVICE_ACCOUNT),
  }, 'roadlifter-auth');

  return getAuth(app);
};

module.exports = { getFirebaseAuth };
