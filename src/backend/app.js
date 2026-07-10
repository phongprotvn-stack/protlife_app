import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import peopleRoutes from './routes/people.js';
import eventsRoutes from './routes/events.js';
import memoriesRoutes from './routes/memories.js';
import placesRoutes from './routes/places.js';
import groupsRoutes from './routes/groups.js';
import importRoutes from './routes/import.js';
import doImportRoutes from './routes/do-import.js';
import exportRoutes from './routes/export.js';
import { verifyToken } from './middleware/auth.js';

const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', version: '2.0.0' }));

// Public routes
app.use('/api/auth', authRoutes);

// Protected routes (require Firebase auth)
app.use('/api/people', verifyToken, peopleRoutes);
app.use('/api/events', verifyToken, eventsRoutes);
app.use('/api/memories', verifyToken, memoriesRoutes);
app.use('/api/places', verifyToken, placesRoutes);
app.use('/api/groups', verifyToken, groupsRoutes);
app.use('/api/import', verifyToken, importRoutes);
app.use('/api/do-import', doImportRoutes);
app.use('/api/export', verifyToken, exportRoutes);

// Error handler
app.use((err, req, res, next) => {
  console.error('API Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    code: err.code || 'UNKNOWN',
  });
});

export default app;
