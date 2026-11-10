import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { verifyToken } from '../middleware/authMiddleware.js';
import db from '../config/db.js';

const router = express.Router();

// Common proxy options to forward headers
const proxyOptions = (target) => ({
  target,
  changeOrigin: true,
  on: {
    proxyReq: (proxyReq, req, res) => {
      if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-role', req.user.role);
      }
      
      // Fix body-parser for POST requests
      if (req.body && Object.keys(req.body).length > 0) {
        let bodyData;
        if (req.headers['content-type'] && req.headers['content-type'].includes('application/json')) {
          bodyData = JSON.stringify(req.body);
        } else if (req.headers['content-type'] && req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
          bodyData = new URLSearchParams(req.body).toString();
        }
        
        if (bodyData) {
          proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
          proxyReq.write(bodyData);
        }
      }
    },
    error: (err, req, res) => {
      console.warn(`Proxy to ${target} failed: ${err.message}`);
      if (res && !res.headersSent) {
        res.status(503).json({ success: false, message: 'Service temporarily unavailable' });
      }
    }
  }
});

import authRoutes from './authRoutes.js';
router.use('/auth', authRoutes);
router.use('/users', verifyToken, createProxyMiddleware({ ...proxyOptions('http://localhost:8081'), pathRewrite: { '^/': '/api/users/' } }));
router.use('/customers', verifyToken, createProxyMiddleware({ ...proxyOptions('http://localhost:8081'), pathRewrite: { '^/': '/api/customers/' } }));

import loanApplicationRoutes from './loanApplicationRoutes.js';
router.use('/applications', verifyToken, loanApplicationRoutes);
router.use('/loans', verifyToken, createProxyMiddleware({ ...proxyOptions('http://localhost:8082'), pathRewrite: { '^/': '/api/loans/' } }));

// Payment Service (Port 8083)
router.use('/payments', verifyToken, createProxyMiddleware({ ...proxyOptions('http://localhost:8083'), pathRewrite: { '^/': '/api/payments/' } }));

// Admin Service (Port 8084)
router.use('/admin', verifyToken, createProxyMiddleware({ ...proxyOptions('http://localhost:8084'), pathRewrite: { '^/': '/api/admin/' } }));
router.use('/reports', verifyToken, createProxyMiddleware({ ...proxyOptions('http://localhost:8084'), pathRewrite: { '^/': '/api/reports/' } }));

router.use('/dashboard', verifyToken, createProxyMiddleware({ ...proxyOptions('http://localhost:8081'), pathRewrite: { '^/': '/api/dashboard/' } }));

// Liveness check (process is running)
router.get('/live', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

// Readiness & Health check (dependencies are reachable)
router.get(['/health', '/ready'], async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.status(200).json({
      success: true,
      status: 'OK',
      message: 'API Gateway is ready',
      database: 'Connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      status: 'Service Unavailable',
      database: 'Disconnected',
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
