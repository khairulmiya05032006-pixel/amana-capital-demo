import bcrypt from 'bcrypt';
import db from '../../config/db.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function seedAdmins() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPass = process.env.ADMIN_PASSWORD;
  const devEmail = process.env.DEV_ADMIN_EMAIL;
  const devPass = process.env.DEV_ADMIN_PASSWORD;

  if (!adminEmail || !adminPass) {
    console.warn("ADMIN_EMAIL or ADMIN_PASSWORD missing from .env. Skipping dynamic admin seeding.");
    process.exit(0);
  }

  try {
    const adminHash = await bcrypt.hash(adminPass, 10);
    
    await db.query(`
      INSERT INTO users (user_code, email, password_hash, role, account_status)
      VALUES ('ADM0001', ?, ?, 'ADMIN', 'ACTIVE')
      ON DUPLICATE KEY UPDATE 
      password_hash = VALUES(password_hash),
      account_status = VALUES(account_status)
    `, [adminEmail, adminHash]);

    console.log(`Successfully seeded/updated primary admin: ${adminEmail}`);

    if (devEmail && devPass) {
      const devHash = await bcrypt.hash(devPass, 10);
      await db.query(`
        INSERT INTO users (user_code, email, password_hash, role, account_status)
        VALUES ('DEV0001', ?, ?, 'ADMIN', 'ACTIVE')
        ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        account_status = VALUES(account_status)
      `, [devEmail, devHash]);
      
      console.log(`Successfully seeded/updated dev admin: ${devEmail}`);
    }

    process.exit(0);
  } catch (err) {
    console.error("Failed to seed admins:", err);
    process.exit(1);
  }
}

seedAdmins();
