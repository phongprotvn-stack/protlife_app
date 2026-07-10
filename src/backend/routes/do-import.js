import { Router } from 'express';
import { getDb, getAdminAuth } from '../firebase-admin.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const SECRET = 'protlife-import-2026';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(process.cwd(), 'public/import-data.json');
const ADMIN_EMAIL = 'phongprot.vn@gmail.com';

router.get('/', async (req, res) => {
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Step 1: Look up the user's Firebase Auth UID by email
    const auth = getAdminAuth();
    let uid;
    try {
      const userRecord = await auth.getUserByEmail(ADMIN_EMAIL);
      uid = userRecord.uid;
      await auth.setCustomUserClaims(uid, { role: 'admin', admin: true });
      console.log(`Found user ${ADMIN_EMAIL} -> UID: ${uid}, admin claims set`);
    } catch (lookupErr) {
      uid = ADMIN_EMAIL;
      console.warn(`User ${ADMIN_EMAIL} not found in Auth, using email as UID`);
    }

    if (!fs.existsSync(DATA_PATH)) {
      return res.status(404).json({ error: 'Data file not found', path: DATA_PATH });
    }

    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const db = getDb();
    let imported = 0;

    // Clean existing data
    const peopleCol = db.collection('users').doc(uid).collection('people');
    const eventsCol = db.collection('users').doc(uid).collection('events');
    const snapshots = await Promise.all([peopleCol.get(), eventsCol.get()]);
    for (const snap of snapshots) {
      let batch = db.batch();
      let count = 0;
      for (const doc of snap.docs) {
        batch.delete(doc.ref);
        count++;
        if (count % 400 === 0) { await batch.commit(); batch = db.batch(); }
      }
      if (count % 400 !== 0) await batch.commit();
    }

    // Import people
    const peopleList = data.people || [];
    for (let i = 0; i < peopleList.length; i += 400) {
      const batch = db.batch();
      for (const person of peopleList.slice(i, i + 400)) {
        const { id, ...fields } = person;
        if (!id) continue;
        batch.set(peopleCol.doc(id), { ...fields, importedFromExcel: true, importedAt: new Date().toISOString() });
      }
      await batch.commit();
      imported += Math.min(400, peopleList.length - i);
    }

    // Import events
    const eventsList = data.events || [];
    for (const event of eventsList) {
      const { id, ...fields } = event;
      if (!id) continue;
      await eventsCol.doc(id).set({ ...fields, importedFromExcel: true, importedAt: new Date().toISOString() });
      imported++;
    }

    res.json({ success: true, imported, people: peopleList.length, events: data.events?.length || 0, uid, adminClaimsSet: true });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export default router;
