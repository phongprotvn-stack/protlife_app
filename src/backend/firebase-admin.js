import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let adminApp;

/**
 * Parse service account JSON, handling Vercel's potential format issues:
 * - Literal newlines inside string values (especially private_key)
 * - Escaped \\n stored as literal backslash-n
 */
function parseServiceAccount(raw) {
  // 1) Try direct parse
  try {
    return JSON.parse(raw);
  } catch {
    // 2) Vercel stored raw newlines in the JSON string values (private_key)
    //    JSON doesn't allow literal newlines in strings — must be \n escapes
    let inString = false, prev = '';
    const chars = [];
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '"' && prev !== '\\') { inString = !inString; }
      if (ch === '\n' || ch === '\r') {
        if (inString) {
          // Replace literal newline inside string with \n escape (JSON-valid)
          chars.push('\\n');
        } else {
          // Remove newlines outside strings (just whitespace)
          chars.push(' ');
        }
      } else {
        chars.push(ch);
      }
      prev = ch;
    }
    const cleaned = chars.join('');
    return JSON.parse(cleaned);
  }
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
  const serviceAccountB64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  let creds = null;

  try {
    if (serviceAccountB64) {
      creds = JSON.parse(Buffer.from(serviceAccountB64, 'base64').toString('utf8'));
    } else if (serviceAccount) {
      creds = parseServiceAccount(serviceAccount);
    }
  } catch (e) {
    console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT:', e.message);
    creds = null;
  }

  if (creds) {
    // Ensure private_key has actual newlines (not \n literal or escaped)
    if (creds.private_key && typeof creds.private_key === 'string') {
      creds.private_key = creds.private_key.replace(/\\n/g, '\n');
    }
    adminApp = initializeApp({ credential: cert(creds) });
  } else {
    console.warn('No valid FIREBASE_SERVICE_ACCOUNT, using default credentials');
    adminApp = initializeApp({ projectId: 'protlife-3dd56' });
  }
  return adminApp;
}

export function getDb() {
  const app = getAdminApp();
  return getFirestore(app);
}

export function getAdminAuth() {
  const app = getAdminApp();
  return getAuth(app);
}

export default { getDb, getAdminAuth };
