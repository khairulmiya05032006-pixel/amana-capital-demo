import mysql from "mysql2/promise";
import dotenv from "dotenv/config";

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 16510,
    user: process.env.DB_USER,
    database: process.env.DB_NAME || 'defaultdb',
    password: process.env.DB_PASSWORD,
  });

  await connection.query(`
    INSERT IGNORE INTO loan_types (id, loan_type_code, loan_name, minimum_amount, maximum_amount, minimum_interest_rate, maximum_interest_rate, minimum_duration_months, maximum_duration_months) 
    VALUES 
    (1, 'LT001', 'Personal Loan', 100, 10000, 5, 25, 6, 60), 
    (2, 'LT002', 'Business Loan', 1000, 50000, 5, 25, 6, 60), 
    (3, 'LT003', 'Education Loan', 500, 20000, 5, 25, 6, 60)
  `);
  console.log("Loan types seeded!");
  process.exit(0);
}
main();
