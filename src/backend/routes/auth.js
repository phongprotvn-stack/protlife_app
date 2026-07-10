import { Router } from 'express';
import { getAdminAuth } from '../firebase-admin.js';
import { ROLES, isAdmin, verifyToken } from '../middleware/auth.js';

const router = Router();

const ADMIN_UID = process.env.ADMIN_UID || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'phongprot.vn@gmail.com';

// Shared: decode token and return role
async function decodeToken(idToken) {
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(idToken);
  const uid = decoded.uid;
  const email = decoded.email || '';
  const admin = uid === ADMIN_UID || email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  return {
    uid,
    email,
    name: decoded.name || email.split('@')[0] || 'User',
    role: admin ? ROLES.ADMIN : ROLES.VIEWER,
    isAdmin: admin,
  };
}

// Verify token from body + return user info with roles
router.post('/verify', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) return res.status(400).json({ error: 'Missing idToken' });
  try {
    const info = await decodeToken(idToken);
    res.json(info);
  } catch (err) {
    res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
  }
});

// Get current user info (read token from Authorization header)
router.get('/me', verifyToken, (req, res) => {
  // verifyToken middleware sets req.user
  res.json({
    ...req.user,
    isAdmin: isAdmin(req.user.uid, req.user.email),
  });
});

// Check if user has admin access
router.get('/check-admin', (req, res) => {
  const uid = req.query.uid || '';
  res.json({ isAdmin: isAdmin(uid) });
});

export default router;
