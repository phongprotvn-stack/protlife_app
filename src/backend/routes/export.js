import { Router } from 'express';
import { getDb } from '../firebase-admin.js';
import { requireRole, ROLES } from '../middleware/auth.js';
import { generateReport, listFormats } from '../report-generator/index.js';

const router = Router();
const db = getDb();

// Helper: load user data from all collections
async function loadAllUserData(uid, options = {}) {
  const collections = options.collections || ['people', 'events', 'memories', 'places'];
  const result = {};

  for (const coll of collections) {
    if (!['people', 'events', 'memories', 'places'].includes(coll)) continue;
    let query = db.collection('users').doc(uid).collection(coll);
    // Apply date range filter if present
    if (options.dateFrom && (coll === 'events' || coll === 'memories')) {
      query = query.where('date', '>=', options.dateFrom);
    }
    if (options.dateTo && (coll === 'events' || coll === 'memories')) {
      query = query.where('date', '<=', options.dateTo);
    }
    const snap = await query.get();
    result[coll] = snap.docs.map(d => ({ ...d.data(), id: d.id }));
  }

  // Load tags
  try {
    const tagsSnap = await db.collection('users').doc(uid).collection('settings').doc('tags').get();
    result.tags = tagsSnap.exists ? tagsSnap.data().list || [] : [];
  } catch {
    result.tags = [];
  }

  return result;
}

// List available export formats
router.get('/formats', (req, res) => {
  res.json({ formats: listFormats() });
});

// Export all user data as JSON
router.get('/json', async (req, res, next) => {
  try {
    const data = await loadAllUserData(req.user.uid);
    data.exportedAt = new Date().toISOString();
    data.version = '2.0.0';
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=protlife_export_${new Date().toISOString().split('T')[0]}.json`);
    res.json(data);
  } catch (err) { next(err); }
});

// Generate report in specified format
router.post('/report', requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const {
      format = 'pdf',
      collections = ['people', 'events', 'memories', 'places'],
      title = 'ProtSphere Report',
      dateRange = '',
      includeStats = true,
    } = req.body;

    if (!format) return res.status(400).json({ error: 'Missing format' });

    const data = await loadAllUserData(req.user.uid, { collections });

    const { buffer, headers, filename } = await generateReport(format, data, {
      title, dateRange, includeStats, collections,
    }, req.user.uid);

    // Set response headers
    for (const [key, val] of Object.entries(headers)) {
      res.setHeader(key, val);
    }
    res.send(buffer);
  } catch (err) { next(err); }
});

// Google Drive save (for Google Sheets/Docs)
router.post('/save-to-drive', requireRole(ROLES.VIEWER), async (req, res, next) => {
  try {
    const { format, collections, title } = req.body;
    const data = await loadAllUserData(req.user.uid, { collections });
    const result = await generateReport(format, data, { title }, req.user.uid);
    res.json(result);
  } catch (err) { next(err); }
});

// Export filtered collection
router.get('/:collection', async (req, res, next) => {
  try {
    const { collection } = req.params;
    const valid = ['people', 'events', 'memories', 'places'];
    if (!valid.includes(collection)) return res.status(400).json({ error: 'Invalid collection' });

    const snap = await db.collection('users').doc(req.user.uid).collection(collection).get();
    const items = snap.docs.map(d => ({ ...d.data(), id: d.id }));
    res.json({ data: items, count: items.length, collection });
  } catch (err) { next(err); }
});

export default router;
