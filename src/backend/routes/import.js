import { Router } from 'express';
import { getDb } from '../firebase-admin.js';
import { requireRole, ROLES } from '../middleware/auth.js';

const router = Router();

/**
 * POST /api/import — one-time batch import from JSON body
 * Requires admin role. Body: { people: [...], events: [...] }
 */
router.post('/', requireRole(ROLES.ADMIN), async (req, res, next) => {
  try {
    const db = getDb();
    const { people, events } = req.body;
    const uid = req.user.uid;
    let imported = 0;

    // Batch write people
    if (Array.isArray(people)) {
      for (const person of people) {
        const { id, ...data } = person;
        if (!id) continue;
        await db.collection('users').doc(uid).collection('people').doc(id).set(data);
        imported++;
      }
    }

    // Batch write events
    if (Array.isArray(events)) {
      for (const event of events) {
        const { id, ...data } = event;
        if (!id) continue;
        await db.collection('users').doc(uid).collection('events').doc(id).set(data);
        imported++;
      }
    }

    res.json({ success: true, imported, collections: { people: people?.length || 0, events: events?.length || 0 } });
  } catch (err) { next(err); }
});

export default router;
