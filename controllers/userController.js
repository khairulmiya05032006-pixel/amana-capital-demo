import logger from '../utils/logger.js';
import db from "../config/db.js";
import {
  getAllMockUsers,
  getMockUserById,
  getMockUserByCode,
} from "../utils/mockData.js";

// Render users list page (EJS)
export const renderUsersList = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, user_code, email, role, account_status, last_login, created_at, updated_at FROM users"
    );

    res.render("users/users-list", {
      title: "Users",
      users: users || [],
      isLive: true,
    });
  } catch (error) {
    logger.error("Error fetching users from database:", error.message);
    logger.info("Using mock data instead...");
    
    // Fall back to mock data
    const mockUsers = getAllMockUsers();
    res.render("users/users-list", {
      title: "Users",
      users: mockUsers,
      isLive: false,
      notice: "⚠️ Using sample data. Database tables not yet created.",
    });
  }
};

// Render user detail page (EJS)
export const renderUserDetail = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).render("error", {
        message: "Invalid user ID",
      });
    }

    const [users] = await db.query(
      "SELECT id, user_code, email, role, account_status, last_login, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).render("error", {
        message: `User with ID ${id} not found`,
      });
    }

    res.render("users/user-detail", {
      title: "User Details",
      user: users[0],
      isLive: true,
    });
  } catch (error) {
    logger.error("Error fetching user from database:", error.message);
    logger.info("Using mock data instead...");
    
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).render("error", {
        message: "Invalid user ID",
      });
    }

    // Fall back to mock data
    const user = getMockUserById(id);
    if (!user) {
      return res.status(404).render("error", {
        message: `User with ID ${id} not found`,
      });
    }

    res.render("users/user-detail", {
      title: "User Details",
      user: user,
      isLive: false,
      notice: "⚠️ Using sample data. Database tables not yet created.",
    });
  }
};

// Get all users (JSON API)
export const getUsers = async (req, res) => {
  try {
    const [users] = await db.query(
      "SELECT id, user_code, email, role, account_status, last_login, created_at, updated_at FROM users"
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No users found",
        data: [],
      });
    }

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      count: users.length,
      data: users,
      isLive: true,
    });
  } catch (error) {
    logger.error("Error fetching users from database:", error.message);
    logger.info("Using mock data instead for API...");
    
    // Fall back to mock data
    const mockUsers = getAllMockUsers();
    res.status(200).json({
      success: true,
      message: "Users retrieved successfully (using sample data)",
      count: mockUsers.length,
      data: mockUsers,
      isLive: false,
      notice: "Using sample data. Database tables not yet created.",
    });
  }
};

// Get single user by ID (JSON API)
export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    const [users] = await db.query(
      "SELECT id, user_code, email, role, account_status, last_login, created_at, updated_at FROM users WHERE id = ?",
      [id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${id} not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: users[0],
      isLive: true,
    });
  } catch (error) {
    logger.error("Error fetching user from database:", error.message);
    logger.info("Using mock data instead for API...");

    const { id } = req.params;

    if (!id || isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID",
      });
    }

    // Fall back to mock data
    const user = getMockUserById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with ID ${id} not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully (using sample data)",
      data: user,
      isLive: false,
      notice: "Using sample data. Database tables not yet created.",
    });
  }
};

// Get user by code (JSON API)
export const getUserByCode = async (req, res) => {
  try {
    const { userCode } = req.params;

    if (!userCode) {
      return res.status(400).json({
        success: false,
        message: "User code is required",
      });
    }

    const [users] = await db.query(
      "SELECT id, user_code, email, role, account_status, last_login, created_at, updated_at FROM users WHERE user_code = ?",
      [userCode]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: `User with code ${userCode} not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully",
      data: users[0],
      isLive: true,
    });
  } catch (error) {
    logger.error("Error fetching user from database:", error.message);
    logger.info("Using mock data instead for API...");

    const { userCode } = req.params;

    if (!userCode) {
      return res.status(400).json({
        success: false,
        message: "User code is required",
      });
    }

    // Fall back to mock data
    const user = getMockUserByCode(userCode);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User with code ${userCode} not found`,
      });
    }

    res.status(200).json({
      success: true,
      message: "User retrieved successfully (using sample data)",
      data: user,
      isLive: false,
      notice: "Using sample data. Database tables not yet created.",
    });
  }
};

// Sample user data (for reference/documentation)
export const getSampleUserData = (req, res) => {
  const sampleUsers = getAllMockUsers();

  res.status(200).json({
    success: true,
    message: "Sample user data",
    data: sampleUsers,
  });
};
