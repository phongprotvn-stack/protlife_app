import { Router } from 'express';
import { getDb } from '../firebase-admin.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const SECRET = 'protlife-import-2026';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.resolve(__dirname, '../../public/import-data.json');

router.get('/', async (req, res) => {
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (!fs.existsSync(DATA_PATH)) {
      return res.status(404).json({ error: `Data file not found at ${DATA_PATH}` });
    }

    const raw = fs.readFileSync(DATA_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const db = getDb();
    const uid = 'phongprot.vn@gmail.com';
    let imported = 0;

    // Import people in batches
    const peopleList = data.people || [];
    for (let i = 0; i < peopleList.length; i += 400) {
      const batch = db.batch();
      const chunk = peopleList.slice(i, i + 400);
      for (const person of chunk) {
        const { id, ...fields } = person;
        if (!id) continue;
        batch.set(db.collection('users').doc(uid).collection('people').doc(id), {
          ...fields,
          importedFromExcel: true,
          importedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
      imported += chunk.length;
    }

    // Import events
    const eventsList = data.events || [];
    for (const event of eventsList) {
      const { id, ...fields } = event;
      if (!id) continue;
      await db.collection('users').doc(uid).collection('events').doc(id).set({
        ...fields,
        importedFromExcel: true,
        importedAt: new Date().toISOString(),
      });
      imported++;
    }

    res.json({
      success: true,
      imported,
      people: peopleList.length,
      events: eventsList.length,
      uid,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

export default router;
