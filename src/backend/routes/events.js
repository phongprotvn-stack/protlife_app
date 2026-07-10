import { Router } from 'express';
import { getDb } from '../firebase-admin.js';
import { requireRole, ROLES } from '../middleware/auth.js';

const router = Router();
const db = getDb();

function col(uid) { return db.collection('users').doc(uid).collection('events'); }

router.get('/', async (req, res, next) => {
  try {
    const snap = await col(req.user.uid).orderBy('date', 'desc').get();
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    res.json({ data: items, count: items.length });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const doc = await col(req.user.uid).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    res.json({ ...doc.data(), id: doc.id });
  } catch (err) { next(err); }
});

router.post('/', requireRole(ROLES.EDITOR), async (req, res, next) => {
  try {
    const { id } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = { ...req.body, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    delete data.id;
    await col(req.user.uid).doc(id).set(data);
    res.status(201).json({ ...data, id });
  } catch (err) { next(err); }
});

router.put('/:id', requireRole(ROLES.EDITOR), async (req, res, next) => {
  try {
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id;
    await col(req.user.uid).doc(req.params.id).set(updates, { merge: true });
    const doc = await col(req.user.uid).doc(req.params.id).get();
    res.json({ ...doc.data(), id: doc.id });
  } catch (err) { next(err); }
});

router.delete('/:id', requireRole(ROLES.EDITOR), async (req, res, next) => {
  try {
    await col(req.user.uid).doc(req.params.id).delete();
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;
