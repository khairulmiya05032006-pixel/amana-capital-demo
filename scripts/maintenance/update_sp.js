import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from './config/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const spPath = path.join(__dirname, 'database/procedures/sp_approve_application.sql');

async function run() {
  try {
    let sql = fs.readFileSync(spPath, 'utf8');
    
    // MySQL Node driver can't run DELIMITER.
    // We need to extract the procedure body and execute CREATE PROCEDURE
    
    // Strip USE statement and DELIMITER lines
    sql = sql.replace(/USE defaultdb;/g, '');
    sql = sql.replace(/DELIMITER \$\$/g, '');
    sql = sql.replace(/DELIMITER ;/g, '');
    
    // Split into DROP and CREATE
    const parts = sql.split('$$');
    
    for (const part of parts) {
      const q = part.trim();
      if (q) {
        console.log('Executing:', q.substring(0, 50) + '...');
        await db.query(q);
      }
    }
    
    console.log('Stored procedure updated successfully.');
    process.exit(0);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

run();
