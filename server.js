import "dotenv/config";
import db from "./config/db.js";
import app from "./app.js";

const PORT = process.env.PORT || 8080;
let serverInstance = null;

// Validate critical environment variables in production
if (process.env.NODE_ENV === "production") {
  const insecurePlaceholders = [
    "your-secret-key",
    "your-jwt-secret-key",
    "super_secret_jwt_key_12345",
    "replace_with_strong_random_jwt_secret_minimum_32_characters",
  ];
  if (!process.env.JWT_SECRET || insecurePlaceholders.includes(process.env.JWT_SECRET)) {
    console.error("❌ CRITICAL SECURITY ERROR: JWT_SECRET must be set to a strong custom secret in production.");
    process.exit(1);
  }
  if (!process.env.DB_PASSWORD) {
    console.error("❌ CRITICAL SECURITY ERROR: DB_PASSWORD must be configured in production.");
    process.exit(1);
  }
}

async function startServer() {
  try {
    // Validate database connection before opening network port
    const connection = await db.getConnection();
    console.log("✅ Database connection established successfully.");
    connection.release();

    serverInstance = app.listen(PORT, () => {
      console.log(`🚀 App is listening on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
    });
  } catch (err) {
    console.error("❌ Failed to connect to the database. Server shutting down.", err);
    process.exit(1);
  }
}

// Graceful shutdown handling for cPanel / Phusion Passenger / PM2 lifecycle
const handleGracefulShutdown = async (signal) => {
  console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
  if (serverInstance) {
    serverInstance.close(async () => {
      console.log("🔒 HTTP server connections drained and closed.");
      try {
        await db.end();
        console.log("🔌 MySQL connection pool cleanly closed.");
        process.exit(0);
      } catch (dbErr) {
        console.error("Error closing database pool:", dbErr);
        process.exit(1);
      }
    });

    // Force exit if graceful shutdown takes longer than 10 seconds
    setTimeout(() => {
      console.error("⚠️ Forcing process shutdown after timeout.");
      process.exit(1);
    }, 10000).unref();
  } else {
    process.exit(0);
  }
};

process.on("SIGTERM", () => handleGracefulShutdown("SIGTERM"));
process.on("SIGINT", () => handleGracefulShutdown("SIGINT"));

// Production safety boundaries
process.on("unhandledRejection", (reason, promise) => {
  console.error("🚨 Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("🚨 Uncaught Exception thrown:", error);
  process.exit(1);
});

startServer();
