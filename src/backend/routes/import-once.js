import { Router } from 'express';
import { getDb } from '../firebase-admin.js';

const router = Router();
const SECRET = 'protlife-import-2026';

/**
 * GET /api/import-once?secret=... — one-time bulk import from JSON on disk.
 * This is a temporary endpoint — remove after running once.
 */
router.get('/', async (req, res) => {
  if (req.query.secret !== SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const fs = await import('fs');
    const path = await import('path');
    const dataFile = path.resolve(process.cwd(), 'scripts', 'protlife_import_data.json');
    
    if (!fs.existsSync(dataFile)) {
      return res.status(404).json({ error: 'Data file not found', path: dataFile });
    }

    const raw = fs.readFileSync(dataFile, 'utf-8');
    const data = JSON.parse(raw);
    const db = getDb();
    
    // Use the admin email as UID path since we know it
    const uid = 'phongprot.vn@gmail.com';
    let imported = 0;

    // Import people
    if (Array.isArray(data.people)) {
      const batch = db.batch();
      let count = 0;
      for (const person of data.people) {
        const { id, ...fields } = person;
        if (!id) continue;
        const ref = db.collection('users').doc(uid).collection('people').doc(id);
        batch.set(ref, { ...fields, importedFromExcel: true });
        count++;
        if (count % 400 === 0) {
          await batch.commit();
          imported += count;
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
        imported += count;
      }
    }

    // Import events
    if (Array.isArray(data.events)) {
      for (const event of data.events) {
        const { id, ...fields } = event;
        if (!id) continue;
        await db.collection('users').doc(uid).collection('events').doc(id).set({
          ...fields, importedFromExcel: true
        });
        imported++;
      }
    }

    res.json({
      success: true,
      imported,
      people: data.people?.length || 0,
      events: data.events?.length || 0,
      uid,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
