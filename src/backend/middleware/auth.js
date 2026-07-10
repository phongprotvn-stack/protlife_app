import { getAdminAuth } from '../firebase-admin.js';

// RBAC levels
export const ROLES = {
  PUBLIC: 'public',
  VIEWER: 'viewer',
  CONTRIBUTOR: 'contributor',
  EDITOR: 'editor',
  ADMIN: 'admin',
};

const ADMIN_UID = process.env.ADMIN_UID || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'phongprot.vn@gmail.com';
const ROLE_HIERARCHY = [ROLES.PUBLIC, ROLES.VIEWER, ROLES.CONTRIBUTOR, ROLES.EDITOR, ROLES.ADMIN];

function roleIndex(role) {
  return ROLE_HIERARCHY.indexOf(role);
}

/**
 * Verify Firebase ID token and attach user to request.
 * Reads token from Authorization: Bearer <token> header.
 */
export async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' });
  }
  const idToken = authHeader.split('Bearer ')[1];
  try {
    const auth = getAdminAuth();
    const decoded = await auth.verifyIdToken(idToken);
    req.user = {
      uid: decoded.uid,
      email: decoded.email || '',
      name: decoded.name || decoded.email?.split('@')[0] || 'User',
      role: decoded.uid === ADMIN_UID || decoded.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? ROLES.ADMIN : ROLES.VIEWER,
    };
    next();
  } catch (err) {
    console.warn('Token verification failed:', err.message);
    return res.status(401).json({ error: 'Invalid token', code: 'UNAUTHORIZED' });
  }
}

/**
 * Require minimum role level for a route.
 * Usage: requireRole('editor') — only editor and above
 */
export function requireRole(minRole) {
  return (req, res, next) => {
    const userRole = req.user?.role || ROLES.PUBLIC;
    if (roleIndex(userRole) < roleIndex(minRole)) {
      return res.status(403).json({ error: 'Insufficient permissions', code: 'FORBIDDEN', required: minRole, current: userRole });
    }
    next();
  };
}

/**
 * Check if user is admin (Prot).
 */
export function isAdmin(uid, email = '') {
  return uid === ADMIN_UID || email === ADMIN_EMAIL;
}
