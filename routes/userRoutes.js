import express from "express";
import {
  renderUsersList,
  renderUserDetail,
  getUsers,
  getUserById,
  getUserByCode,
  getSampleUserData,
} from "../controllers/userController.js";

const router = express.Router();

// HTML/EJS Views
router.get("/view", renderUsersList);
router.get("/view/:id", renderUserDetail);

// JSON API Endpoints
// Sample user data endpoint
router.get("/sample", getSampleUserData);

// Get all users
router.get("/", getUsers);

// Get user by ID
router.get("/id/:id", getUserById);

// Get user by code
router.get("/code/:userCode", getUserByCode);

export default router;
