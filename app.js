// App Core - No network binding or environment variable loading here
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import ejsMate from "ejs-mate";
import { loadPermissions } from "./middleware/rbacMiddleware.js";
import { requirePermission } from "./middleware/permissionMiddleware.js";
import cookieParser from "cookie-parser";
import db from "./config/db.js";
import apiRoutes from "./routes/index.js";
import * as dashboardController from "./controllers/dashboardController.js";
import * as adminCustomerController from "./controllers/adminCustomerController.js";
import * as reportController from "./controllers/reportController.js";
import * as paymentController from "./controllers/paymentController.js";
import * as accountController from "./controllers/accountController.js";
import * as settingsController from "./controllers/settingsController.js";
import * as adminManagementController from "./controllers/adminManagementController.js";
import { authorizeAdministratorAccess } from "./middleware/rbacMiddleware.js";
import { resolveUserPermissionsToLocals } from "./middleware/permissionMiddleware.js";
import schemeRoutes from "./routes/schemeRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import documentRoutes from "./routes/documentRoutes.js";
import "./jobs/penaltyJob.js";


import helmet from "helmet";
import compression from "compression";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.set("view engine", "ejs");
app.engine("ejs", ejsMate);
app.set("views", path.join(__dirname, "/views"));

// Enable EJS view template caching in production
if (process.env.NODE_ENV === "production") {
  app.set("view cache", true);
}

// HTTP Response Compression (Gzip / Deflate)
app.use(
  compression({
    filter: (req, res) => {
      if (req.headers["x-no-compression"]) return false;
      return compression.filter(req, res);
    },
    level: 6,
    threshold: 1024, // Only compress responses larger than 1KB
  }),
);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "https://cdn.jsdelivr.net",
          "https://cdnjs.cloudflare.com",
          "'unsafe-inline'",
        ],
        styleSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.googleapis.com",
          "'unsafe-inline'",
        ],
        fontSrc: [
          "'self'",
          "https://cdnjs.cloudflare.com",
          "https://fonts.gstatic.com",
        ],
        imgSrc: ["'self'", "data:", "blob:"],
      },
    },
  }),
);

import rateLimit from "express-rate-limit";

// Logging middleware in dev/test
if (process.env.NODE_ENV !== "production") {
  app.use((req, res, next) => {
    console.log("Incoming Request:", req.method, req.url);
    next();
  });
}

// Static asset caching options for production grade efficiency
const staticOptions = {
  maxAge: process.env.NODE_ENV === "production" ? "7d" : "1h",
  etag: true,
  lastModified: true,
};

// Health Check Endpoint (cPanel / Uptime Monitor)
app.get("/health", async (req, res) => {
  try {
    const start = Date.now();
    await db.query("SELECT 1");
    const dbLatency = Date.now() - start;
    res.status(200).json({
      status: "UP",
      timestamp: new Date().toISOString(),
      uptime: `${Math.round(process.uptime())}s`,
      dbLatency: `${dbLatency}ms`,
      memory: {
        rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      },
    });
  } catch (err) {
    res.status(503).json({
      status: "DOWN",
      error: "Database connectivity check failed",
      timestamp: new Date().toISOString(),
    });
  }
});

const globalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10), // 15 minutes by default
  max: 1000,
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(globalLimiter);

// Special auth limiter for login and register
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
  max: parseInt(process.env.RATE_LIMIT_AUTH_MAX || "10", 10),
  message: "Too many authentication attempts, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply authLimiter to UI routes (if we added POST here) and API auth routes proxy
app.use("/auth/login", authLimiter);
app.use("/auth/register", authLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

app.use(express.static(path.join(__dirname, "/public"), staticOptions));
app.use(cookieParser());
app.use(resolveUserPermissionsToLocals);

app.use(
  "/vendor/bootstrap",
  express.static(path.join(__dirname, "node_modules/bootstrap/dist"), staticOptions),
);
app.use(
  "/vendor/fontawesome",
  express.static(
    path.join(__dirname, "node_modules/@fortawesome/fontawesome-free"),
    staticOptions,
  ),
);
app.use(
  "/vendor/chartjs",
  express.static(path.join(__dirname, "node_modules/chart.js/dist"), staticOptions),
);
app.use(
  "/vendor/html2pdf",
  express.static(path.join(__dirname, "node_modules/html2pdf.js/dist"), staticOptions),
);
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
import authRoutes from "./routes/authRoutes.js";

app.use("/api", apiRoutes);
app.use("/api/auth", authRoutes);
app.use("/admin/documents", documentRoutes);
// ----------------Loggers------------------

// --------------middleware-----------------
import jwt from "jsonwebtoken";


app.use(async (req, res, next) => {
  res.locals.currentPath = req.path;
  res.locals.currentUrl = req.originalUrl;
  res.locals.success = req.query.success || null;
  res.locals.error = req.query.error || null;
  res.locals.warning = req.query.warning || null;
  res.locals.info = req.query.info || null;
  if (req.cookies && req.cookies.token) {
    try {
      const decoded = jwt.verify(req.cookies.token, process.env.JWT_SECRET);

      // Query current status to catch mid-session deactivations
      const [users] = await db.query(
        "SELECT account_status, force_password_change FROM users WHERE id = ?",
        [decoded.id],
      );

      if (users.length > 0) {
        if (users[0].account_status === "INACTIVE") {
          res.clearCookie("token");
          // If it's an API route, return JSON. Otherwise redirect.
          if (req.path.startsWith("/api/")) {
            return res
              .status(403)
              .json({
                success: false,
                message: "Your account has been deactivated.",
              });
          }
          return res.redirect("/auth/login");
        }

        // Intercept all routes if forced password change (except logout and the change page itself)
        if (
          users[0].force_password_change &&
          !req.path.startsWith("/auth/change-password") &&
          !req.path.startsWith("/auth/logout")
        ) {
          return res.redirect("/auth/change-password");
        }

        req.user = decoded;
        res.locals.user = decoded;
        const [freshUser] = await db.query("SELECT role FROM users WHERE id = ?", [decoded.id]);
        if (freshUser.length > 0) {
          res.locals.user.role = freshUser[0].role;
        }
        res.locals.user.permissions = []; // Replaced hallucinated admin_permissions table query
      } else {
        res.locals.user = null;
      }
    } catch (err) {
      console.error('JWT Auth Middleware Error:', err);
      res.locals.user = null;
    }
  } else {
    res.locals.user = null;
  }
  next();
});

// Resolve role-based permissions into res.locals for EJS templates
app.use(resolveUserPermissionsToLocals);
// ----------------Routes--------------------
app.get("/", (req, res) => {
  res.render("home", { title: "Home" });
});

// UI Routes
app.get("/auth/login", (req, res) =>
  res.render("auth/login", { title: "Login" }),
);
app.get("/auth/register", (req, res) =>
  res.redirect("/auth/login?error=" + encodeURIComponent("Customer registration is managed by Amanah Capital administrators. Please contact the office to create your account."))
);
app.all("/auth/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production"
  });
  res.redirect("/auth/login");
});

// Proxy POST requests for UI forms to the Auth Service
import { createProxyMiddleware } from "http-proxy-middleware";

const uiProxyOptions = {
  target: "http://localhost:8081",
  changeOrigin: true,
  pathRewrite: { "^/auth": "/api/auth" },
  on: {
    proxyReq: (proxyReq, req, res) => {
      // Forward body for POST
      if (req.body && Object.keys(req.body).length > 0) {
        const bodyData = new URLSearchParams(req.body).toString();
        proxyReq.setHeader("Content-Type", "application/x-www-form-urlencoded");
        proxyReq.setHeader("Content-Length", Buffer.byteLength(bodyData));
        proxyReq.write(bodyData);
      }
    },
  },
};
import * as authController from "./controllers/authController.js";

app.post("/auth/login", authController.login);
app.post("/auth/register", authController.register);

// Change Password Routes (requires auth)
const requireAuth = (req, res, next) => {
  if (!res.locals.user) return res.redirect("/auth/login");
  next();
};

app.get("/auth/change-password", requireAuth, (req, res) => {
  res.render("auth/change-password", { title: "Change Default Password" });
});

app.post("/auth/change-password", requireAuth, async (req, res, next) => {
  const { new_password, confirm_password } = req.body;

  if (new_password !== confirm_password) {
    return res.status(400).render("auth/change-password", {
      title: "Change Default Password",
      error: "Passwords do not match.",
    });
  }

  const hasNumber = /\d/;
  if (new_password.length < 8 || !hasNumber.test(new_password)) {
    return res.status(400).render("auth/change-password", {
      title: "Change Default Password",
      error: "Password must be at least 8 characters with at least one number.",
    });
  }

  try {
    const userId = res.locals.user.id;
    const bcrypt = await import("bcrypt");
    const db = (await import("./config/db.js")).default;

    const password_hash = await bcrypt.hash(new_password, 10);

    await db.query(
      `UPDATE users SET password_hash = ?, force_password_change = FALSE WHERE id = ?`,
      [password_hash, userId],
    );

    if (res.locals.user.role === "ADMIN") {
      res.redirect("/admin/dashboard");
    } else {
      res.redirect("/customer/dashboard");
    }
  } catch (err) {
    next(err);
  }
});

app.get(
  "/customer/dashboard",
  requireAuth,
  dashboardController.getCustomerDashboard,
);
app.get("/customer/apply", requireAuth, async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    const [profiles] = await db.query("SELECT * FROM customer_profiles WHERE user_id = ?", [userId]);
    const profile = profiles.length > 0 ? profiles[0] : {};
    res.render("customer/apply", { title: "Apply for Loan", profile, user: res.locals.user });
  } catch (err) {
    next(err);
  }
});

const requireAdmin = (req, res, next) => {
  if (!res.locals.user) {
    return res.redirect("/auth/login");
  }
  const adminRoles = ['ADMIN', 'SUPER_ADMIN', 'LOAN_OFFICER', 'COLLECTION_OFFICER', 'ACCOUNT_OFFICER', 'AUDITOR', 'VIEWER'];
  if (!adminRoles.includes(res.locals.user.role)) {
    return res.status(403).send("Access Denied: Admin Privileges Required");
  }
  next();
};

app.use('/admin', requireAdmin, loadPermissions);
app.locals.isActiveNav = function(currentPath, targetNav) {
  if (!currentPath) return targetNav === '/admin/dashboard' || targetNav === '/admin';
  const cleanPath = currentPath.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  
  const ROUTE_MAP = {
    '/admin/dashboard': ['/admin/dashboard', '/admin'],
    '/admin/account': ['/admin/account'],
    '/admin/applications': ['/admin/applications'],
    '/admin/customers': ['/admin/customers'],
    '/admin/loans': ['/admin/loans'],
    '/admin/overdue': ['/admin/overdue'],
    '/admin/repayments': ['/admin/repayments'],
    '/admin/reports': ['/admin/reports'],
    '/admin/settings': ['/admin/settings']
  };

  const patterns = ROUTE_MAP[targetNav] || [targetNav];

  return patterns.some(pattern => {
    if (cleanPath === pattern) return true;
    if (pattern !== '/admin' && pattern !== '/admin/dashboard' && cleanPath.startsWith(pattern + '/')) return true;
    return false;
  });
};

app.get("/admin/dashboard", requirePermission('dashboard.view'), async (req, res, next) => {
  try {
    // Bypass vw_dashboard view to avoid MySQL DEFINER access denied issues on remote hosting
    const [[{ total_customers }]] = await db.query("SELECT COUNT(*) AS total_customers FROM users WHERE role = 'CUSTOMER'");
    const [[{ active_loans }]] = await db.query("SELECT COUNT(*) AS active_loans FROM loans WHERE loan_status = 'ACTIVE'");
    const [[{ total_money_lent }]] = await db.query("SELECT COALESCE(SUM(principal_amount), 0) AS total_money_lent FROM loans WHERE loan_status IN ('ACTIVE', 'CLOSED', 'COMPLETED', 'DEFAULTED')");
    const [[{ approved_loans }]] = await db.query("SELECT COUNT(*) AS approved_loans FROM loan_applications WHERE application_status = 'APPROVED'");
    const [[{ todays_collections }]] = await db.query("SELECT COALESCE(SUM(payment_amount), 0) AS todays_collections FROM payments WHERE DATE(payment_date) = CURDATE() AND payment_status = 'SUCCESS'");
    const [[{ total_repayments_received }]] = await db.query("SELECT COALESCE(SUM(payment_amount), 0) AS total_repayments_received FROM payments WHERE payment_status = 'SUCCESS'");
    const [[{ outstanding_balance }]] = await db.query("SELECT COALESCE(SUM(outstanding_balance), 0) AS outstanding_balance FROM loans WHERE loan_status = 'ACTIVE'");
    // overdue amount from installments
    const [[{ overdue_amount }]] = await db.query("SELECT COALESCE(SUM(total_amount + penalty_amount - paid_amount), 0) AS overdue_amount FROM loan_installments WHERE installment_status = 'OVERDUE'");
    const [[{ closed_loans }]] = await db.query("SELECT COUNT(*) AS closed_loans FROM loans WHERE loan_status = 'CLOSED'");

    const [acc] = await db.query("SELECT balance FROM admin_account LIMIT 1");
    const account_balance = acc.length > 0 ? parseFloat(acc[0].balance) : 0.00;

    const kpis = {
      total_customers,
      active_loans,
      total_money_lent,
      approved_loans,
      todays_collections,
      total_repayments_received,
      outstanding_balance,
      overdue_amount,
      closed_loans,
      account_balance
    };

    const [applications] = await db.query(`
        SELECT a.*, c.full_name as applicant_name, c.phone as applicant_phone, c.customer_code 
        FROM loan_applications a 
        JOIN customer_profiles c ON a.customer_id = c.id 
        WHERE a.application_status = 'PENDING' 
        ORDER BY a.created_at ASC 
        LIMIT 5
      `);

    const [overdueLoans] = await db.query(`
        SELECT 
          l.id as loan_id, 
          l.loan_number, 
          c.full_name as customer_name, 
          c.phone as customer_phone, 
          COUNT(li.id) as installment_count, 
          MIN(li.due_date) as due_date, 
          SUM(li.total_amount) as installment_amount, 
          SUM(li.penalty_amount) as penalty_amount, 
          SUM(li.total_amount + li.penalty_amount - li.paid_amount) as amount_due, 
          MAX(DATEDIFF(CURRENT_DATE(), li.due_date)) as days_overdue 
        FROM loan_installments li
        JOIN loans l ON li.loan_id = l.id
        JOIN customer_profiles c ON l.customer_id = c.id
        WHERE li.installment_status = 'OVERDUE'
        GROUP BY l.id, l.loan_number, c.full_name, c.phone 
        ORDER BY due_date ASC 
        LIMIT 5
      `);

    const [settings] = await db.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'penalty_rate'`,
    );
    const penaltyRate =
      settings.length > 0 ? parseFloat(settings[0].setting_value) : 2.0;

    const formatINR = (value) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value || 0);

    res.render("admin/dashboard", {
      title: "Admin Dashboard",
      kpis,
      applications,
      overdueLoans,
      penaltyRate,
      formatINR,
    });
  } catch (err) {
    next(err);
  }
});

import { body } from "express-validator";


const customerValidationRules = [
  body("full_name")
    .trim()
    .escape()
    .notEmpty()
    .withMessage("Full Name is required"),
  body("email")
    .trim()
    .isEmail()
    .normalizeEmail()
    .withMessage("Valid email is required"),
  body("phone")
    .trim()
    .matches(/^[6-9]\d{9}$/)
    .withMessage("Valid 10-digit Indian mobile number is required"),
  body("aadhaar_number")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^\d{12}$/)
    .withMessage("Aadhaar must be a valid 12-digit number"),
  body("pan_number")
    .optional({ checkFalsy: true })
    .trim()
    .matches(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/i)
    .withMessage("PAN must be in valid format (e.g. ABCDE1234F)"),
  body("monthly_income")
    .optional({ checkFalsy: true })
    .isFloat({ min: 0 })
    .withMessage("Monthly income must be a positive number"),
];

import customerExportController from './controllers/customerExportController.js';

app.get(
  "/admin/customers",
  requireAdmin,
  requirePermission('customers.view'),
  adminCustomerController.listCustomers,
);
app.get(
  "/admin/customers/export/excel",
  requireAdmin,
  requirePermission('customers.export'),
  customerExportController.exportExcel
);
app.get(
  "/admin/customers/export/csv",
  requireAdmin,
  requirePermission('customers.export'),
  customerExportController.exportCsv
);
app.get(
  "/admin/customers/new",
  requireAdmin,
  requirePermission('customers.create'),
  adminCustomerController.showCreateForm,
);
app.post(
  "/admin/customers",
  requireAdmin,
  requirePermission('customers.create'),
  customerValidationRules,
  adminCustomerController.createCustomer,
);
app.get(
  "/admin/customers/:id",
  requireAdmin,
  requirePermission('customers.view'),
  adminCustomerController.showCustomerDetails,
);
app.get(
  "/admin/customers/:id/edit",
  requireAdmin,
  requirePermission('customers.edit'),
  adminCustomerController.showEditForm,
);
app.post(
  "/admin/customers/:id/update",
  requireAdmin,
  requirePermission('customers.edit'),
  customerValidationRules,
  adminCustomerController.updateCustomer,
);
app.post(
  "/admin/customers/:id/delete",
  requireAdmin,
  requirePermission('customers.delete'),
  adminCustomerController.deleteCustomer,
);
app.post(
  "/admin/customers/:id/deactivate",
  requireAdmin,
  requirePermission('customers.edit'),
  adminCustomerController.deactivateCustomer,
);
app.post(
  "/admin/customers/:id/reactivate",
  requireAdmin,
  requirePermission('customers.edit'),
  adminCustomerController.reactivateCustomer,
);

app.get(
  "/admin/customers/:id/applications/new",
  requireAdmin,
  requirePermission('applications.create'),
  adminCustomerController.showCreateApplicationForm
);

app.post(
  "/admin/customers/:id/applications",
  requireAdmin,
  adminCustomerController.createApplication
);

app.get("/admin/applications", requirePermission('applications.view'), async (req, res, next) => {
  try {
    const [applications] = await db.query(`
      SELECT la.*, lt.loan_name AS loan_type_name,
             cp.full_name AS applicant_name,
             cp.phone AS applicant_phone,
             u.email AS applicant_email
      FROM loan_applications la
      LEFT JOIN loan_types lt ON la.loan_type_id = lt.id
      LEFT JOIN customer_profiles cp ON la.customer_id = cp.id
      LEFT JOIN users u ON cp.user_id = u.id
      ORDER BY la.created_at DESC
    `);

    res.render("admin/applications", {
      title: "Loan Applications",
      applications,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/admin/overdue", requirePermission('loans.view'), async (req, res, next) => {
  try {
    const [overdueLoans] = await db.query(`
      SELECT 
        l.id as loan_id, 
        l.loan_number, 
        c.full_name as customer_name, 
        c.phone as customer_phone, 
        COUNT(li.id) as installment_count, 
        MIN(li.due_date) as due_date, 
        SUM(li.total_amount) as installment_amount, 
        SUM(li.penalty_amount) as penalty_amount, 
        SUM(li.total_amount + li.penalty_amount - li.paid_amount) as amount_due, 
        DATEDIFF(CURRENT_DATE(), MIN(li.due_date)) as days_overdue 
      FROM loan_installments li
      JOIN loans l ON li.loan_id = l.id
      JOIN customer_profiles c ON l.customer_id = c.id
      WHERE li.installment_status = 'OVERDUE'
      GROUP BY l.id, l.loan_number, c.full_name, c.phone 
      ORDER BY due_date ASC 
      LIMIT 100
    `);
    const totalOverdueCount = overdueLoans.length;
    const totalOverdueAmount = overdueLoans.reduce((sum, item) => sum + parseFloat(item.amount_due || 0), 0);

    res.render("admin/overdue", {
      title: "Overdue Installments",
      overdueLoans,
      totalOverdueCount,
      totalOverdueAmount,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/admin/repayments", requirePermission('repayments.view'), paymentController.showRepaymentPage);
app.get("/admin/repayments/search", requirePermission('repayments.view'), paymentController.searchLoan);
app.get("/admin/repayments/:loanId", requirePermission('repayments.view'), paymentController.getLoanDetails);
app.post('/admin/repayments', requirePermission('repayments.record'), paymentController.recordPayment);
app.post('/admin/repayments/record', requirePermission('repayments.record'), paymentController.recordPayment);

import LoanSchemeAssignmentService from "./services/loanSchemeAssignmentService.js";


import DisbursementService from "./services/disbursementService.js";


const handleDisburse = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const adminId = res.locals.user.id;
    
    await DisbursementService.disburseApplication(applicationId, adminId);
    
    if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
      return res.json({ success: true, message: "Loan disbursed successfully" });
    }
    res.redirect("/admin/loans?success=Loan disbursed successfully");
  } catch (err) {
    if (err.message && (err.message.includes("Insufficient funds") || err.message.includes("missing approved terms"))) {
      const msg = err.message.includes("Insufficient funds") 
        ? "Insufficient Account Balance" 
        : "Cannot disburse: Application is missing approved terms (scheme or amount).";
      if (req.xhr || (req.headers.accept && req.headers.accept.includes('json'))) {
        return res.status(400).json({ success: false, message: msg });
      }
      return res.redirect(`/admin/loans?error=${encodeURIComponent(msg)}`);
    }
    next(err);
  }
};

const handleRejectDisbursement = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const adminId = res.locals.user.id;
    
    await db.query(
      `UPDATE loan_applications 
       SET application_status = 'REJECTED', 
           admin_remarks = CONCAT(IFNULL(admin_remarks, ''), '\\nDisbursement rejected by Admin.'),
           reviewed_by = ?,
           reviewed_at = NOW()
       WHERE id = ? AND application_status = 'APPROVED'`,
      [adminId, applicationId]
    );
    
    res.redirect("/admin/loans?success=Disbursement rejected successfully");
  } catch (err) {
    next(err);
  }
};



app.post("/admin/loans/:id/disburse", requirePermission('loans.disburse'), handleDisburse);
app.post("/admin/loans/:id/reject-disbursement", requirePermission('applications.reject'), handleRejectDisbursement);

app.get("/admin/account/transactions/export", requirePermission('account.view'), accountController.exportTransactionsCSV);
app.get("/admin/account/transactions", requirePermission('account.view'), accountController.getTransactions);
app.get("/admin/account", requirePermission('account.view'), accountController.showAccount);
app.post('/admin/account/add-funds', requirePermission('account.manage'), accountController.addFunds);
app.post('/admin/account/credit', requirePermission('account.manage'), accountController.addFunds);



app.get("/admin/reports", requirePermission('reports.view'), async (req, res, next) => {
  try {
    const [monthlyCollections] = await db.query(`
      SELECT 
        DATE_FORMAT(payment_date, '%b %Y') AS collection_month,
        COALESCE(SUM(payment_amount), 0) AS total_collected,
        COUNT(id) AS number_of_payments
      FROM payments
      WHERE payment_status = 'SUCCESS'
      GROUP BY DATE_FORMAT(payment_date, '%b %Y'), DATE_FORMAT(payment_date, '%Y-%m')
      ORDER BY DATE_FORMAT(payment_date, '%Y-%m') DESC
      LIMIT 12
    `);
    const [overdueLoans] = await db.query(`
      SELECT 
        l.id as loan_id, 
        l.loan_number, 
        c.full_name as customer_name, 
        c.phone as customer_phone, 
        COUNT(li.id) as installment_count, 
        MIN(li.due_date) as due_date, 
        SUM(li.total_amount) as installment_amount, 
        SUM(li.penalty_amount) as penalty_amount, 
        SUM(li.total_amount + li.penalty_amount - li.paid_amount) as amount_due, 
        DATEDIFF(CURRENT_DATE(), MIN(li.due_date)) as days_overdue 
      FROM loan_installments li
      JOIN loans l ON li.loan_id = l.id
      JOIN customer_profiles c ON l.customer_id = c.id
      WHERE li.installment_status = 'OVERDUE'
      GROUP BY l.id, l.loan_number, c.full_name, c.phone 
      ORDER BY due_date ASC 
      LIMIT 100
    `);
    const [auditLogs] = await db.query(`
      SELECT a.*, u.email as admin_email 
      FROM audit_logs a
      LEFT JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC 
      LIMIT 20
    `);

    const formatINR = (value) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(value || 0);

    const formatDate = (dateString) =>
      new Date(dateString).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    res.render("admin/reports", {
      title: "Admin Reports",
      monthlyCollections,
      overdueLoans,
      auditLogs,
      formatINR,
      formatDate,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/admin/reports/export/csv/collections", requirePermission('reports.export'), reportController.exportCollectionsCSV);
app.get("/admin/reports/export/csv/overdue", requirePermission('reports.export'), reportController.exportOverdueCSV);

app.get("/admin/applications/:id", requirePermission('applications.view'), async (req, res, next) => {
  try {
    const appId = req.params.id;
    const [applications] = await db.query(
      `
      SELECT a.*, c.full_name as applicant_name, c.phone as applicant_phone, c.pan_number as applicant_pan, c.occupation as applicant_occupation, c.address as applicant_address, c.customer_code 
      FROM loan_applications a 
      JOIN customer_profiles c ON a.customer_id = c.id 
      WHERE a.id = ?
    `,
      [appId],
    );

    if (applications.length === 0)
      return res.status(404).send("Application not found");

    const [activeSchemes] = await db.query("SELECT * FROM loan_schemes WHERE status = 'ACTIVE' ORDER BY scheme_name ASC");

    res.render("admin/application-details", {
      title: `Review App #${applications[0].application_number}`,
      app: applications[0],
      activeSchemes
    });
  } catch (err) {
    next(err);
  }
});

app.get("/admin/settings/activity-logs/export", requirePermission('settings.view'), settingsController.exportActivityLogsCSV);
app.get("/admin/settings/administrators/:id", requirePermission('administrators.view'), authorizeAdministratorAccess, adminManagementController.getAdministrator);
app.get("/admin/settings/administrators", requirePermission('administrators.view'), adminManagementController.listAdministrators, settingsController.getSettingsPage);
app.post('/admin/settings/administrators', requirePermission('administrators.create'), adminManagementController.createAdministrator);
app.put('/admin/settings/administrators/:id/status', requirePermission('administrators.edit'), authorizeAdministratorAccess, adminManagementController.changeStatus);
app.put('/admin/settings/administrators/:id/password', requirePermission('administrators.edit'), authorizeAdministratorAccess, adminManagementController.resetPassword);
app.put("/admin/settings/administrators/:id", requirePermission('administrators.edit'), authorizeAdministratorAccess, adminManagementController.updateAdministrator);
app.delete("/admin/settings/administrators/:id", requirePermission('administrators.delete'), authorizeAdministratorAccess, adminManagementController.deleteAdministrator);

app.use(schemeRoutes);
app.post('/admin/settings/penalties', requirePermission('penalties.edit'), settingsController.updatePenalties);
app.get("/admin/settings/penalties/defaults", requirePermission('settings.view'), settingsController.getPenaltyDefaults);
app.get("/admin/settings", requirePermission('settings.view'), settingsController.getSettingsPage);
app.post('/admin/settings', requirePermission('settings.edit'), settingsController.updateSettings);

import { getLoanHub } from './controllers/adminLoanHubController.js';


app.get("/admin/loans", requirePermission('loans.view'), getLoanHub);

app.get("/customer/loans", requireAuth, async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    const selectedLoanId = req.query.selectedLoanId || null;

    const [loans] = await db.query(
      `SELECT l.*, la.application_status FROM loans l LEFT JOIN loan_applications la ON l.application_id = la.id WHERE l.customer_id = (SELECT id FROM customer_profiles WHERE user_id = ? LIMIT 1) ORDER BY l.created_at DESC`,
      [userId],
    );

    let activeLoan = null;
    let emiSchedule = [];

    if (loans.length > 0) {
      if (selectedLoanId) {
        activeLoan = loans.find(l => String(l.id) === String(selectedLoanId)) || loans[0];
      } else {
        activeLoan = loans[0];
      }

      const [emis] = await db.query(
        `SELECT id, installment_number as installment_no, due_date as date, total_amount as amount, paid_amount, installment_status as status FROM loan_installments WHERE loan_id = ? ORDER BY due_date ASC`,
        [activeLoan.id],
      );
      emiSchedule = emis;
    }

    res.render("customer/loans", {
      title: "My Loans",
      loans,
      activeLoan,
      emiSchedule,
      user: res.locals.user,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/customer/loans/:loanId", requireAuth, async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    const loanId = req.params.loanId;

    const [loans] = await db.query(
      `
      SELECT l.*, t.loan_name,
             s.scheme_name, s.interest_type, s.duration_value, s.duration_unit
      FROM loans l 
      LEFT JOIN loan_types t ON l.loan_type_id = t.id
      LEFT JOIN loan_scheme_snapshots s ON l.id = s.loan_id
      WHERE l.id = ? AND l.customer_id = (SELECT id FROM customer_profiles WHERE user_id = ? LIMIT 1)
    `,
      [loanId, userId],
    );

    if (loans.length === 0) {
      return res
        .status(404)
        .render("error", {
          title: "Not Found",
          message: "Loan not found or unauthorized.",
          status: 404,
        });
    }

    const loan = loans[0];
    // Fallback if it's an old loan without a snapshot
    if (!loan.scheme_name) {
      loan.scheme_name = (loan.repayment_frequency || 'MONTHLY').charAt(0).toUpperCase() + (loan.repayment_frequency || 'MONTHLY').slice(1).toLowerCase() + ' Loan';
      loan.interest_type = 'REDUCING'; // Legacy assumption
      loan.duration_value = loan.tenure_months;
      loan.duration_unit = 'MONTHS';
    }

    const [installments] = await db.query(
      `SELECT i.*, 
              (SELECT COALESCE(SUM(penalty_amount), 0) FROM penalties p WHERE p.installment_id = i.id) as dynamic_penalty
       FROM loan_installments i 
       WHERE i.loan_id = ? 
       ORDER BY i.installment_number ASC`,
      [loan.id],
    );

    // Find the next payment to show in the header
    const nextPaymentRaw = installments.find(i => i.installment_status === 'PENDING' || i.installment_status === 'OVERDUE');
    loan.next_payment_amount = nextPaymentRaw ? (parseFloat(nextPaymentRaw.remaining_amount) + parseFloat(nextPaymentRaw.dynamic_penalty)) : 0;

    const [payments] = await db.query(
      `SELECT * FROM payments WHERE loan_id = ? ORDER BY payment_date DESC LIMIT 10`,
      [loan.id],
    );
    const [transactions] = await db.query(
      `SELECT * FROM loan_transactions WHERE loan_id = ? ORDER BY transaction_date DESC LIMIT 10`,
      [loan.id],
    );

    const formatINR = (v) =>
      new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 0,
      }).format(v || 0);
    const formatDate = (d) =>
      new Date(d).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

    res.render("customer/loan-details", {
      title: `Loan ${loan.loan_number}`,
      loan,
      installments,
      payments,
      transactions,
      formatINR,
      formatDate,
      user: res.locals.user,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/customer/profile", async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    const [profiles] = await db.query(
      "SELECT * FROM customer_profiles WHERE user_id = ?",
      [userId],
    );
    const profile = profiles.length > 0 ? profiles[0] : {};
    res.render("customer/profile", {
      title: "My Profile",
      profile,
      user: res.locals.user,
      sys: {
        buildNumber: '20260724.01',
        appVersion: '1.0.0',
        dbVersion: 'MySQL 8.0',
        environment: process.env.NODE_ENV || 'production',
        license: 'Enterprise',
        supportContact: 'support@amanahcapital.com'
      }
    });
  } catch (err) {
    next(err);
  }
});

app.get("/customer/status", async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    // Get all applications for this customer
    const [applications] = await db.query(
      `
      SELECT a.*, t.loan_name as loan_type_name, l.id as loan_id,
             s.scheme_name, s.duration_unit, s.duration_value
      FROM loan_applications a
      LEFT JOIN loan_types t ON a.loan_type_id = t.id
      LEFT JOIN loans l ON l.application_id = a.id
      LEFT JOIN loan_schemes s ON a.loan_scheme_id = s.id
      WHERE a.customer_id = (SELECT id FROM customer_profiles WHERE user_id = ? LIMIT 1)
      ORDER BY a.created_at DESC
    `,
      [userId],
    );

    res.render("customer/status", {
      title: "Application Status",
      applications,
      user: res.locals.user,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/customer/support", (req, res) => {
  res.render("customer/support", { title: "Help & Support" });
});

app.get("/customer/payments", async (req, res, next) => {
  try {
    const userId = res.locals.user.id;
    // Get active loan for the user
    const [loans] = await db.query(
      "SELECT id FROM loans WHERE customer_id = (SELECT id FROM customer_profiles WHERE user_id = ? LIMIT 1) AND loan_status = 'ACTIVE'",
      [userId],
    );

    let payments = [];
    let pendingEmi = null;

    if (loans.length > 0) {
      const loanId = loans[0].id;
      // Fetch payment history
      const [history] = await db.query(
        "SELECT payment_date, payment_amount as amount, payment_method, payment_status as status FROM payments WHERE loan_id = ? ORDER BY payment_date DESC",
        [loanId],
      );
      payments = history;

      // Fetch next pending EMI
      const [emis] = await db.query(
        "SELECT * FROM loan_installments WHERE loan_id = ? AND installment_status = 'PENDING' ORDER BY due_date ASC LIMIT 1",
        [loanId],
      );
      if (emis.length > 0) pendingEmi = emis[0];
    }

    res.render("customer/payment-history", {
      title: "Payments",
      payments,
      pendingEmi,
      user: res.locals.user,
    });
  } catch (err) {
    next(err);
  }
});

app.get("/customer/payments/checkout/:installmentId", requireAuth, async (req, res, next) => {
  try {
    const installmentId = req.params.installmentId;
    const userId = res.locals.user.id;

    // Fetch installment with penalty
    const [installments] = await db.query(
      `SELECT i.*, 
              (SELECT COALESCE(SUM(penalty_amount), 0) FROM penalties p WHERE p.installment_id = i.id) as dynamic_penalty,
              l.loan_number, c.full_name
       FROM loan_installments i
       JOIN loans l ON i.loan_id = l.id
       JOIN customer_profiles c ON l.customer_id = c.id
       WHERE i.id = ? AND c.user_id = ?`,
      [installmentId, userId]
    );

    if (installments.length === 0) {
      return res.redirect("/customer/payments");
    }

    const emi = installments[0];
    // Calculate total due
    emi.total_due = parseFloat(emi.remaining_amount) + parseFloat(emi.dynamic_penalty);
    
    // Calculate days overdue
    let daysOverdue = 0;
    if (emi.installment_status === 'OVERDUE') {
      const today = new Date();
      today.setHours(0,0,0,0);
      const dueDate = new Date(emi.due_date);
      dueDate.setHours(0,0,0,0);
      daysOverdue = Math.max(0, Math.floor((today - dueDate) / (1000 * 60 * 60 * 24)));
    }
    emi.days_overdue = daysOverdue;

    res.render("customer/payment-checkout", {
      title: "Checkout",
      emi,
      user: res.locals.user
    });
  } catch (err) {
    next(err);
  }
});

app.post("/customer/payments/process", async (req, res, next) => {
  try {
    // In a real scenario, this initiates payment with Razorpay/Stripe.
    // For mock, we immediately simulate a successful webhook call.
    const { installmentId, paymentMethod } = req.body;

    const fetch = (await import("node-fetch")).default || globalThis.fetch;
    const webhookUrl = `http://localhost:${process.env.PORT || 8080}/customer/payments/webhook`;

    const transactionId = `TXN${Date.now()}`;
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        installmentId,
        paymentMethod,
        transactionId,
        status: "SUCCESS",
      }),
    });

    // RACE-05: await the webhook and confirm the payment was actually recorded
    // before showing the success page to the user.
    if (!response.ok) {
      throw new Error(`Payment processing failed (webhook HTTP ${response.status}). Please try again.`);
    }

    const webhookResult = await response.json();
    if (!webhookResult.success) {
      throw new Error(webhookResult.message || "Payment could not be confirmed. Please contact support.");
    }

    res.render("customer/payment-success", {
      title: "Payment Successful",
      txnid: transactionId,
      loanId: req.body.loanId,
    });
  } catch (err) {
    next(err);
  }
});

app.post("/customer/payments/webhook", async (req, res, next) => {
  try {
    const { installmentId, paymentMethod, transactionId, status } = req.body;

    if (status !== "SUCCESS") return res.json({ received: true });

    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      // 1. Fetch Installment
      const [emis] = await connection.query(
        `SELECT * FROM loan_installments WHERE id = ? FOR UPDATE`,
        [installmentId],
      );
      if (emis.length === 0 || emis[0].installment_status === "PAID") {
        await connection.rollback();
        return res.json({
          success: true,
          message: "Already paid or not found",
        });
      }
      const emi = emis[0];

      // 2. Mark PAID
      await connection.query(
        `UPDATE loan_installments SET installment_status = 'PAID', paid_date = CURDATE() WHERE id = ?`,
        [emi.id],
      );

      // 3. Insert Payment
      await connection.query(
        `
        INSERT INTO payments (loan_id, customer_id, amount, payment_date, payment_method, payment_reference, status)
        VALUES (?, (SELECT customer_id FROM loans WHERE id = ?), ?, CURDATE(), ?, ?, 'COMPLETED')
      `,
        [
          emi.loan_id,
          emi.loan_id,
          emi.total_amount,
          paymentMethod || "ONLINE",
          transactionId,
        ],
      );

      // 4. Update Outstanding Balance
      await connection.query(
        `
        UPDATE loans 
        SET outstanding_balance = outstanding_balance - ? 
        WHERE id = ?
      `,
        [emi.principal_amount, emi.loan_id],
      );

      // 5. Insert Transaction
      const [loans] = await connection.query(
        `SELECT outstanding_balance, loan_number, customer_id FROM loans WHERE id = ?`,
        [emi.loan_id],
      );
      const loan = loans[0];
      await connection.query(
        `
        INSERT INTO loan_transactions (loan_id, transaction_date, transaction_type, credit_amount, running_balance, description)
        VALUES (?, CURDATE(), 'EMI_PAYMENT', ?, ?, ?)
      `,
        [
          emi.loan_id,
          emi.total_amount,
          loan.outstanding_balance,
          `EMI Payment for Installment #${emi.installment_number}`,
        ],
      );

      // Check if loan is fully paid
      if (loan.outstanding_balance <= 0) {
        await connection.query(
          `UPDATE loans SET loan_status = 'CLOSED', closed_at = NOW() WHERE id = ?`,
          [emi.loan_id],
        );
      }

      await connection.commit();
      connection.release();

      // Trigger Notifications
      const notificationService = (
        await import("./services/notificationService.js")
      ).default;
      const [userRows] = await db.query(
        `SELECT u.id, u.email FROM customer_profiles c JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
        [loan.customer_id],
      );
      if (userRows.length > 0) {
        const user = userRows[0];
        const formatINR = (v) =>
          new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 0,
          }).format(v);
        await notificationService.sendPaymentReceipt(
          user,
          loan.loan_number,
          formatINR(emi.total_amount),
          transactionId,
        );

        if (loan.outstanding_balance <= 0) {
          await notificationService.sendLoanClosed(user, loan.loan_number);
        }
      }

      res.json({ success: true });
    } catch (dbErr) {
      await connection.rollback();
      connection.release();
      throw dbErr;
    }
  } catch (err) {
    console.error("Webhook error", err);
    res.status(500).json({ error: "Webhook failed" });
  }
});

/*------------------------Error Handling (last)--------------------- */
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  const status = err.status || 500;
  const isProd = process.env.NODE_ENV === "production";
  
  // In production, sanitize 500 internal server errors to avoid leaking database schema/internals
  const message = (isProd && status === 500)
    ? "An unexpected internal server error occurred. Please contact the system administrator if this persists."
    : (err.message || "Internal Server Error");

  if (req.path.startsWith("/api/")) {
    res.status(status).json({ success: false, message });
  } else {
    res.status(status).render("error", { title: "Error", message, status });
  }
});

// --------------------------Test DB -----------------------------------



export default app;



