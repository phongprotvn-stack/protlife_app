#!/usr/bin/env node
/**
 * Import data via Firebase Auth REST API + Firestore REST API.
 * Creates auth user if needed, then batch writes data.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'AIzaSyAOHECF4A8UIgS8M4GFy_Bnt2sk1xFhKpo';
const PROJECT_ID = 'protlife-3dd56';
const DATA_FILE = path.join(__dirname, 'protlife_import_data.json');
const ADMIN_EMAIL = 'phongprot.vn@gmail.com';
const ADMIN_PASSWORD = 'ProtLife2026!';

// Helper: HTTPS request with JSON body
function apiRequest(host, path, method, body, token) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const opts = { hostname: host, path, method, headers, rejectUnauthorized: true };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400) {
            reject(new Error(`${res.statusCode}: ${json.error?.message || data}`));
          } else {
            resolve(json);
          }
        } catch (e) {
          reject(new Error(`${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  console.log('📖 Reading import data...');
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);
  console.log(`   People: ${data.people?.length}, Events: ${data.events?.length}`);

  // Step 1: Try to sign in with email/password
  console.log('\n🔐 Signing in as', ADMIN_EMAIL);
  let idToken, localId;
  try {
    const authRes = await apiRequest(
      'identitytoolkit.googleapis.com',
      `/v1/accounts:signInWithPassword?key=${API_KEY}`,
      'POST',
      { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }
    );
    idToken = authRes.idToken;
    localId = authRes.localId;
    console.log('   ✅ Signed in successfully! UID:', localId);
  } catch (e) {
    console.log('   ⚠️  Login failed:', e.message);
    console.log('   Trying to sign up...');
    
    try {
      const signUpRes = await apiRequest(
        'identitytoolkit.googleapis.com',
        `/v1/accounts:signUp?key=${API_KEY}`,
        'POST',
        { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, returnSecureToken: true }
      );
      idToken = signUpRes.idToken;
      localId = signUpRes.localId;
      console.log('   ✅ Created account! UID:', localId);
    } catch (e2) {
      console.error('   ❌ Sign up also failed:', e2.message);
      console.error('\n💡 Please enable Email/Password sign-in in Firebase Console:');
      console.error('   https://console.firebase.google.com/project/protlife-3dd56/authentication/providers');
      process.exit(1);
    }
  }

  // Step 2: Verify the UID
  console.log('\n📋 User UID:', localId);

  // Step 3: Import people via Firestore REST API
  if (!Array.isArray(data.people) || data.people.length === 0) {
    console.log('❌ No people data to import');
    process.exit(1);
  }

  console.log(`\n📝 Importing ${data.people.length} people...`);
  let imported = 0;
  for (const person of data.people) {
    const { id, ...fields } = person;
    try {
      await apiRequest(
        'firestore.googleapis.com',
        `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${localId}/people/${id}?key=${API_KEY}`,
        'PATCH',
        { fields: toFirestoreValue(fields) },
        idToken
      );
      imported++;
      if (imported % 20 === 0) process.stdout.write(`   ${imported}/${data.people.length}\n`);
    } catch (e) {
      console.error(`   ❌ Failed to import ${person.name}: ${e.message}`);
    }
  }
  console.log(`   ✅ Imported ${imported} people`);

  // Step 4: Import events
  if (Array.isArray(data.events) && data.events.length > 0) {
    console.log(`\n📝 Importing ${data.events.length} events...`);
    let importedEvents = 0;
    for (const event of data.events) {
      const { id, ...fields } = event;
      try {
        await apiRequest(
          'firestore.googleapis.com',
          `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${localId}/events/${id}?key=${API_KEY}`,
          'PATCH',
          { fields: toFirestoreValue(fields) },
          idToken
        );
        importedEvents++;
      } catch (e) {
        console.error(`   ❌ Failed to import event ${event.title}: ${e.message}`);
      }
    }
    console.log(`   ✅ Imported ${importedEvents} events`);
  }

  console.log(`\n🎉 Import complete!`);
  console.log(`   UID: ${localId}`);
  console.log(`   Email: ${ADMIN_EMAIL}`);
  console.log(`\n⚠️  IMPORTANT: To set admin role, run this in Firebase console CLI:`);
  console.log(`   firebase auth:set-custom-user-claims ${localId} '{"role":"admin","admin":true}'`);
}

// Convert JS object to Firestore Value format
function toFirestoreValue(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) continue;
    fields[key] = toFirestoreField(value);
  }
  return fields;
}

function toFirestoreField(value) {
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: value.toString() } : { doubleValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(v => toFirestoreField(v)) } };
  if (typeof value === 'object') return { mapValue: { fields: toFirestoreValue(value) } };
  return { stringValue: String(value) };
}

main().catch(e => {
  console.error('\n❌ Fatal:', e.message);
  process.exit(1);
});
