import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import db from '../config/db.js';
import { validationResult } from 'express-validator';

export const login = async (req, res, next) => {
  try {
    console.log('Login attempt:', req.body.email);
    const { email, password } = req.body;
    const isJson = req.headers.accept && req.headers.accept.includes('application/json');
    
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('Validation errors:', errors.mapped());
      if (isJson) return res.status(400).json({ success: false, errors: errors.mapped() });
      return res.status(400).render('auth/login', { errors: errors.mapped(), formData: req.body });
    }

    const [users] = await db.query(`
      SELECT u.* 
      FROM users u
      LEFT JOIN customer_profiles cp ON cp.user_id = u.id
      WHERE u.email = ? OR u.user_code = ? OR cp.phone = ?
      LIMIT 1
    `, [email, email, email]);
    const GENERIC_ERROR = 'Email/phone/username or password is incorrect. Please check your details and try again.';

    if (users.length === 0) {
      console.log('User not found. Rendering error:', GENERIC_ERROR);
      if (isJson) return res.status(401).json({ success: false, message: GENERIC_ERROR });
      return res.status(401).render('auth/login', { error: GENERIC_ERROR, formData: req.body });
    }

    const user = users[0];
    if (user.account_status !== 'ACTIVE') {
      console.log('Account disabled');
      const disabledMsg = 'Your administrator account has been disabled. Please contact the Super Administrator.';
      if (isJson) return res.status(403).json({ success: false, message: disabledMsg });
      return res.status(403).render('auth/login', { error: disabledMsg, formData: req.body });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      console.log('Password mismatch');
      if (isJson) return res.status(401).json({ success: false, message: GENERIC_ERROR });
      return res.status(401).render('auth/login', { error: GENERIC_ERROR, formData: req.body });
    }

    console.log('Login successful, signing JWT');
    const token = jwt.sign(
      { id: user.id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    });

    if (isJson) {
      return res.status(200).json({
        success: true,
        message: 'Login successful',
        token,
        user: { id: user.id, email: user.email, role: user.role }
      });
    }

    if (user.force_password_change) {
      return res.redirect('/auth/change-password');
    }

    // Role-based redirect
    if (user.role !== 'CUSTOMER') {
      return res.redirect('/admin/dashboard');
    } else {
      return res.redirect('/customer/dashboard');
    }
  } catch (error) {
    next(error);
  }
};

export const register = async (req, res, next) => {
  try {
    const isJson = req.headers.accept && req.headers.accept.includes('application/json');
    const msg = 'Customer registration is managed by Amanah Capital administrators. Please contact the office to create your account.';
    
    if (isJson) {
      return res.status(401).json({ success: false, message: msg });
    }
    
    return res.redirect('/auth/login?error=' + encodeURIComponent(msg));
  } catch (error) {
    next(error);
  }
};

export const logout = async (req, res, next) => {
  try {
    res.clearCookie('token');
    const isJson = req.headers.accept && req.headers.accept.includes('application/json');
    if (isJson) {
      return res.status(200).json({ success: true, message: 'Logout successful' });
    }
    return res.redirect('/auth/login');
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req, res, next) => {
  try {
    // Placeholder implementation – actual refresh logic can be added later
    return res.status(501).json({ success: false, message: 'Refresh token not implemented' });
  } catch (error) {
    next(error);
  }
};
