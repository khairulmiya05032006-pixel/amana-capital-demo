import jwt from 'jsonwebtoken';
import db from '../config/db.js';

export const verifyToken = async (req, res, next) => {
  try {
    let token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'No token provided' });
      }
      return res.redirect('/auth/login');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Verify user still exists and is active in DB
    const [users] = await db.query('SELECT id, account_status FROM users WHERE id = ?', [decoded.id]);
    if (users.length === 0 || users[0].account_status !== 'ACTIVE') {
      res.clearCookie('token');
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, message: 'Account suspended or deleted' });
      }
      return res.redirect('/auth/login?error=' + encodeURIComponent('Your account has been deactivated or deleted.'));
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (req.originalUrl.startsWith('/api/')) {
      return res.status(401).json({ success: false, message: 'Invalid token' });
    }
    res.clearCookie('token');
    return res.redirect('/auth/login');
  }
};

export const isAuthenticated = verifyToken;
