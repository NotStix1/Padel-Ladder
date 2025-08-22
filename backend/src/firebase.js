import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

// Service account JSON or base64 string can be provided via env
let serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

let app;
let enabled = false;

export function initFirebaseAdmin() {
  if (app) return app;
  try {
    let credential;
    if (serviceAccountJson) {
      credential = admin.credential.cert(JSON.parse(serviceAccountJson));
      app = admin.initializeApp({ credential });
      enabled = true;
    } else if (serviceAccountB64) {
      const json = Buffer.from(serviceAccountB64, 'base64').toString('utf8');
      credential = admin.credential.cert(JSON.parse(json));
      app = admin.initializeApp({ credential });
      enabled = true;
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      credential = admin.credential.applicationDefault();
      app = admin.initializeApp({ credential });
      enabled = true;
    } else {
      // Fallback: try file-based credentials inside repo/container
      const explicitPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
      const candidateFiles = [
        explicitPath,
        path.join(process.cwd(), 'backend', 'firebase-service-account.json'),
        path.join(process.cwd(), 'firebase-service-account.json'),
      ].filter(Boolean);
      let loaded = false;
      for (const file of candidateFiles) {
        try {
          if (file && fs.existsSync(file)) {
            const json = JSON.parse(fs.readFileSync(file, 'utf8'));
            const credential = admin.credential.cert(json);
            app = admin.initializeApp({ credential });
            enabled = true;
            loaded = true;
            break;
          }
        } catch (_) {
          // try next
        }
      }
      if (!loaded) {
        // Attempt ADC without explicit credential; may succeed in some environments
        app = admin.initializeApp();
        enabled = true;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('[firebase] Admin not configured:', e?.message);
    app = undefined;
    enabled = false;
  }
  return app;
}

export function isFirebaseEnabled() {
  return enabled;
}

export function getAuth() {
  if (!enabled) {
    throw new Error('Firebase Admin not configured');
  }
  return admin.auth();
}

export const firebaseWebConfig = {
  apiKey: process.env.FIREBASE_API_KEY || 'AIzaSyAMEvgPWC1ShVMtO4iab2icy9uF9I4nAdU',
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'padel-ladder-9412b.firebaseapp.com',
  projectId: process.env.FIREBASE_PROJECT_ID || 'padel-ladder-9412b',
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'padel-ladder-9412b.firebasestorage.app',
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '913394931696',
  appId: process.env.FIREBASE_APP_ID || '1:913394931696:web:d27deacb6913d4262cef35',
  measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-WJF7HY1LH1'
};


