// JWT Utility
import jwt from 'jsonwebtoken';
import { APP_CONFIG } from '../config/constants.js';

export const generateToken = (payload, expiresIn = APP_CONFIG.JWT_EXPIRY) => {
  try {
    const token = jwt.sign(payload, APP_CONFIG.JWT_SECRET, { expiresIn });
    return token;
  } catch (error) {
    throw new Error(`Error generating token: ${error.message}`);
  }
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, APP_CONFIG.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error(`Error verifying token: ${error.message}`);
  }
};

export const decodeToken = (token) => {
  try {
    const decoded = jwt.decode(token);
    return decoded;
  } catch (error) {
    throw new Error(`Error decoding token: ${error.message}`);
  }
};
