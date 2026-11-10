import db from '../config/db.js';

async function createAdminAccountTables() {
  const connection = await db.getConnection();
  try {
    console.log("Creating admin_account and admin_account_transactions tables...");
    
    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_account (
        id INT PRIMARY KEY AUTO_INCREMENT,
        balance DECIMAL(15,2) NOT NULL DEFAULT 0.00,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS admin_account_transactions (
        id INT PRIMARY KEY AUTO_INCREMENT,
        transaction_type ENUM('CREDIT', 'DEBIT') NOT NULL,
        amount DECIMAL(15,2) NOT NULL,
        balance_after DECIMAL(15,2) NOT NULL,
        reference VARCHAR(50),
        description VARCHAR(255),
        created_by BIGINT UNSIGNED,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // Initialize with some balance so we can actually disburse, or leave at 0 so the user gets the error they asked for.
    // Wait, the user ASKED to see the error. So I will initialize it with a small balance like 1000, 
    // so it throws the error when they request 50000.
    const [rows] = await connection.query("SELECT * FROM admin_account LIMIT 1");
    if (rows.length === 0) {
      await connection.query("INSERT INTO admin_account (balance) VALUES (1000.00)");
      console.log("Initialized admin_account with 1000.00 balance.");
    } else {
      console.log("admin_account already initialized. Current balance:", rows[0].balance);
    }

    console.log("Success!");
  } catch (e) {
    console.error("Error creating tables:", e);
  } finally {
    connection.release();
    process.exit(0);
  }
}

createAdminAccountTables();
