// Authentication Routes
import express from 'express';
import * as authController from '../controllers/authController.js';
import { body } from 'express-validator';

const router = express.Router();

router.post('/login', [
  body('email').trim().notEmpty().withMessage('Email/Phone is required'),
  body('password').notEmpty().withMessage('Password is required')
], authController.login);

router.post('/register', [
  body('full_name').trim().escape().notEmpty().withMessage('Full name is required'),
  body('email').trim().notEmpty().withMessage('Email/Phone is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
], authController.register);

router.post('/logout', authController.logout);
router.get('/logout', authController.logout);
router.post('/refresh-token', authController.refreshToken);

export default router;
