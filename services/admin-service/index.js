import logger from '../../utils/logger.js';
import express from 'express';
import cors from 'cors';

import adminRoutes from '../../routes/adminRoutes.js';
import reportRoutes from '../../routes/reportRoutes.js';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
  origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:8080'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// Middleware to mock req.user from headers passed by Gateway
app.use((req, res, next) => {
  const userId = req.headers['x-user-id'];
  const userRole = req.headers['x-user-role'];
  if (userId) {
    req.user = { id: userId, role: userRole };
  }
  next();
});

// Routes
app.use('/api/admin', adminRoutes);
app.use('/api/reports', reportRoutes);

app.use((err, req, res, next) => {
  logger.error("Admin Service Error:", err);
  res.status(err.status || 500).json({ success: false, message: err.message });
});

const PORT = 8084;
app.listen(PORT, () => logger.info(`Admin Service listening on port ${PORT}`));
