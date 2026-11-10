import db from './config/db.js';

async function setupSettingsSchema() {
  console.log('=== SETTING UP SYSTEM SETTINGS TABLE ===');

  try {
    // 1. Create system_settings table if it doesn't exist
    await db.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT NULL,
        updated_by BIGINT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('[SCHEMA] Created or verified `system_settings` table.');

    // 2. Insert default settings if empty
    const defaultSettings = [
      ['time_zone', 'Asia/Kolkata'],
      ['date_format', 'DD/MM/YYYY'],
      ['currency', 'INR (₹)'],
      ['language', 'English (US)'],
      ['company_name', 'Amanah Capital Microfinance Ltd.'],
      ['registration_number', 'U65923MH2021PLC356123'],
      ['gst_number', '27AABCA1234F1ZB'],
      ['pan_number', 'AABCA1234F'],
      ['address', 'Suite 402, Financial District, Bandra Kurla Complex'],
      ['city', 'Mumbai'],
      ['state', 'Maharashtra'],
      ['country', 'India'],
      ['postal_code', '400051'],
      ['company_logo', '/brand-logo/AMANATH_CAPITAL_Logo-removebg-preview.png'],
      ['email_notifications', 'ENABLED'],
      ['sms_notifications', 'ENABLED'],
      ['browser_notifications', 'ENABLED'],
      ['payment_alerts', 'ENABLED'],
      ['loan_alerts', 'ENABLED'],
      ['daily_summary', 'ENABLED'],
      ['session_timeout', '30 Minutes'],
      ['auto_logout', 'ENABLED'],
      ['default_page_size', '25 Rows'],
      ['file_upload_limit', '10 MB'],
      ['backup_frequency', 'Daily'],
      ['penalty_rate', '2.00']
    ];

    for (const [key, val] of defaultSettings) {
      await db.query(`
        INSERT INTO system_settings (setting_key, setting_value, updated_by, updated_at)
        VALUES (?, ?, 1, NOW())
        ON DUPLICATE KEY UPDATE setting_value = COALESCE(setting_value, VALUES(setting_value));
      `, [key, val]);
    }

    console.log('[SCHEMA] Populated default system settings rows.');
    console.log('=== SETTINGS SCHEMA SETUP COMPLETE ===');
    process.exit(0);
  } catch (error) {
    console.error('[SCHEMA FAIL]', error.message);
    process.exit(1);
  }
}

setupSettingsSchema();
