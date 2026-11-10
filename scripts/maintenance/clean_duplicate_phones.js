import mysql from 'mysql2/promise';
import dotenv from 'dotenv/config';

async function cleanDuplicatePhones() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16510,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    ssl: { rejectUnauthorized: false }
  });

  const [rows] = await connection.query("SELECT id, phone FROM customer_profiles WHERE phone = '0000000000'");
  console.log(`Found ${rows.length} records with phone = '0000000000'`);

  for (let i = 0; i < rows.length; i++) {
    const newPhone = `980000${(i + 1).toString().padStart(4, '0')}`;
    await connection.query("UPDATE customer_profiles SET phone = ? WHERE id = ?", [newPhone, rows[i].id]);
    console.log(`Updated customer_profile ID ${rows[i].id} -> phone: ${newPhone}`);
  }

  console.log('Cleanup finished cleanly.');
  await connection.end();
}
cleanDuplicatePhones();
