import { Router } from 'express';
import { getDb } from '../firebase-admin.js';
import { requireRole, ROLES } from '../middleware/auth.js';

const router = Router();
const db = getDb();

function userCol(uid) {
  return db.collection('users').doc(uid).collection('people');
}

// GET /api/people — list all
router.get('/', async (req, res, next) => {
  try {
    const snap = await userCol(req.user.uid).orderBy('name').get();
    const people = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    res.json({ data: people, count: people.length });
  } catch (err) { next(err); }
});

// GET /api/people/:id
router.get('/:id', async (req, res, next) => {
  try {
    const doc = await userCol(req.user.uid).doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    res.json({ ...doc.data(), id: doc.id });
  } catch (err) { next(err); }
});

// POST /api/people — create (admin/editor only)
router.post('/', requireRole(ROLES.EDITOR), async (req, res, next) => {
  try {
    const { id, name, relationship, phones, emails, dob, organization, tags, relationshipScore, note } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = {
      name, relationship: relationship || '', phones: phones || '', emails: emails || '',
      dob: dob || '', organization: organization || '', tags: tags || [],
      relationshipScore: relationshipScore || 50, note: note || '',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    await userCol(req.user.uid).doc(id).set(data);
    res.status(201).json({ id, ...data });
  } catch (err) { next(err); }
});

// PUT /api/people/:id — update (admin/editor only)
router.put('/:id', requireRole(ROLES.EDITOR), async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = { ...req.body, updatedAt: new Date().toISOString() };
    delete updates.id; // don't overwrite doc id
    await userCol(req.user.uid).doc(id).set(updates, { merge: true });
    const doc = await userCol(req.user.uid).doc(id).get();
    res.json({ ...doc.data(), id: doc.id });
  } catch (err) { next(err); }
});

// DELETE /api/people/:id — delete
router.delete('/:id', requireRole(ROLES.EDITOR), async (req, res, next) => {
  try {
    await userCol(req.user.uid).doc(req.params.id).delete();
    res.json({ success: true, id: req.params.id });
  } catch (err) { next(err); }
});

export default router;
