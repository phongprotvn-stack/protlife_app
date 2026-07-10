#!/usr/bin/env node
/**
 * Import data from protlife_import_data.json into Firestore.
 * Uses Firebase Admin SDK with just project ID (no service account).
 * Falls back if credentials are needed.
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'protlife_import_data.json');
const ADMIN_EMAIL = 'phongprot.vn@gmail.com';

async function main() {
  console.log('📖 Reading import data...');
  const raw = fs.readFileSync(DATA_FILE, 'utf-8');
  const data = JSON.parse(raw);

  console.log(`   People: ${data.people?.length}`);
  console.log(`   Events: ${data.events?.length}`);

  // Try to initialize firebase-admin without service account
  // If it fails, we'll try with GOOGLE_APPLICATION_CREDENTIALS
  try {
    if (admin.apps.length === 0) {
      admin.initializeApp({
        projectId: 'protlife-3dd56',
        // Without credential, Admin SDK can only read public data
        // But let's try anyway
      });
    }
  } catch (e) {
    console.error('❌ Failed to initialize:', e.message);
    process.exit(1);
  }

  const db = admin.firestore();
  // Use a generic UID for the admin user - we'll need the actual Firebase Auth UID
  // The user needs to log in first to create their UID
  // For now, let's write to a temp location
  
  const uid = 'admin-import'; // placeholder - will map after login
  
  try {
    // Test write
    const testRef = db.collection('_import_test').doc('test');
    await testRef.set({ timestamp: new Date().toISOString(), status: 'ok' });
    console.log('✅ Firestore write test PASSED');
    await testRef.delete();
  } catch (e) {
    console.error('❌ Firestore write test FAILED:', e.message);
    console.log('\n⚠️  Need service account credentials to write to Firestore.');
    console.log('   Two options:');
    console.log('   1. Set GOOGLE_APPLICATION_CREDENTIALS env var');
    console.log('   2. Run this on Vercel as a serverless function');
    process.exit(0);
  }

  // If we get here, Firestore writes work
  // Write people
  const batch = db.batch();
  let count = 0;

  if (Array.isArray(data.people)) {
    for (const person of data.people) {
      const { id, ...fields } = person;
      const ref = db.collection('users').doc(uid).collection('people').doc(id);
      batch.set(ref, fields);
      count++;
      if (count % 400 === 0) {
        await batch.commit();
        console.log(`   Committed ${count} people...`);
      }
    }
  }
  await batch.commit();
  console.log(`✅ Imported ${count} people`);

  // Write events
  if (Array.isArray(data.events)) {
    const batch2 = db.batch();
    count = 0;
    for (const event of data.events) {
      const { id, ...fields } = event;
      const ref = db.collection('users').doc(uid).collection('events').doc(id);
      batch2.set(ref, fields);
      count++;
    }
    await batch2.commit();
    console.log(`✅ Imported ${count} events`);
  }

  console.log('\n🎉 Import complete!');
  console.log(`   Data is at: users/${uid}/people and users/${uid}/events`);
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
