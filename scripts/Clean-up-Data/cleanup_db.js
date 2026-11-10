/**
 * ============================================================
 *  DATABASE CLEANUP SCRIPT — Amanah Capital Microfinance
 * ============================================================
 *  Scope:
 *   ✔  Keep ONLY: admin@microfinance.com (ID 1) + amanahcapital@gmail.com (ID 34)
 *   ✔  Remove all other users (sub-admins, test loan officers)
 *   ✔  Reset admin_account balance to ₹0
 *   ✔  Delete all audit_logs
 *   ✔  Preserve loan_types (structure kept intact)
 *   ✔  Reset system_settings back to clean defaults
 *   ✔  Keep admin_roles, roles, permissions tables intact
 * ============================================================
 */

import 'dotenv/config';
import db from '../../config/db.js';

// ── Accounts to keep ─────────────────────────────────────────
const KEEP_USER_IDS = [1, 34]; // admin@microfinance.com, amanahcapital@gmail.com

// ── Clean system_settings defaults ───────────────────────────
const SETTINGS_DEFAULTS = {
  company_name:         'Amanah Capital Microfinance Ltd.',
  company_logo:         '/brand-logo/AMANATH_CAPITAL_Logo-removebg-preview.png',
  address:              '',
  city:                 '',
  state:                '',
  country:              'India',
  postal_code:          '',
  registration_number:  '',
  gst_number:           '',
  pan_number:           '',
  email:                'admin@microfinance.com',
  mobile_number:        '',
  designation:          '',
  full_name:            'System Administrator',
  currency:             'INR (₹)',
  language:             'English (US)',
  time_zone:            'Asia/Kolkata',
  date_format:          'DD/MM/YYYY',
  penalty_rate:         '2.50',
  penalty_grace_period: '7',
  penalty_max_cap:      '15.00',
  penalty_calc_method:  'Percentage on Overdue Amount',
  auto_apply_penalty:   'ENABLED',
  email_notifications:  'ENABLED',
  sms_notifications:    'DISABLED',
  browser_notifications:'ENABLED',
  loan_alerts:          'ENABLED',
  payment_alerts:       'ENABLED',
  daily_summary:        'ENABLED',
  auto_logout:          'ENABLED',
  session_timeout:      '30 Minutes',
  default_page_size:    '25 Rows',
  default_landing_page: '/admin/dashboard',
  table_density:        'Comfortable',
  fixed_header:         'ENABLED',
  fixed_sidebar:        'ENABLED',
  backup_frequency:     'Weekly',
  file_upload_limit:    '10 MB',
};

// ─────────────────────────────────────────────────────────────

const SEP = '─'.repeat(60);

function log(msg)  { console.log(msg); }
function ok(msg)   { console.log(`  ✅  ${msg}`); }
function skip(msg) { console.log(`  ⏭   ${msg}`); }
function warn(msg) { console.log(`  ⚠️   ${msg}`); }
function section(title) {
  console.log(`\n${SEP}`);
  console.log(`  ${title}`);
  console.log(SEP);
}

async function run() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    log('\n🚀  Starting database cleanup...');

    // ── 0. Preview what will be deleted ──────────────────────
    section('0 · Pre-flight check');
    const [allUsers] = await conn.query('SELECT id, email, role FROM users ORDER BY id');
    const toDelete = allUsers.filter(u => !KEEP_USER_IDS.includes(u.id));
    const toKeep   = allUsers.filter(u =>  KEEP_USER_IDS.includes(u.id));
    log('  Accounts to KEEP:');
    toKeep.forEach(u => log(`      [${u.id}] ${u.email} (${u.role})`));
    log('  Accounts to DELETE:');
    if (toDelete.length === 0) { skip('No accounts to delete.'); }
    else toDelete.forEach(u => log(`      [${u.id}] ${u.email} (${u.role})`));

    // ── 1. Delete sub-admin users ─────────────────────────────
    section('1 · Remove unwanted administrator accounts');
    if (toDelete.length > 0) {
      const deleteIds = toDelete.map(u => u.id);
      // Remove permissions first (FK safety)
      await conn.query('DELETE FROM admin_permissions WHERE admin_id IN (?)', [deleteIds]);
      ok(`Deleted admin_permissions for users: ${deleteIds.join(', ')}`);
      await conn.query('DELETE FROM users WHERE id IN (?)', [deleteIds]);
      ok(`Deleted ${deleteIds.length} user account(s): ${deleteIds.join(', ')}`);
    } else {
      skip('No users to delete.');
    }

    // ── 2. Clean admin_permissions for kept users ─────────────
    section('2 · Reset permissions for kept administrators');
    const SUPER_ADMIN_MODULES = [
      'Dashboard','Account Balance','Applications','Customers',
      'Loans & Disbursal','Repayments','Reports','Penalty Settings',
      'Settings','Administrator Management'
    ];
    for (const uid of KEEP_USER_IDS) {
      const [usr] = await conn.query('SELECT id, email, role FROM users WHERE id = ?', [uid]);
      if (usr.length === 0) { warn(`User ID ${uid} not found, skipping.`); continue; }
      await conn.query('DELETE FROM admin_permissions WHERE admin_id = ?', [uid]);
      for (const mod of SUPER_ADMIN_MODULES) {
        await conn.query(
          'INSERT INTO admin_permissions (admin_id, module_name, can_view, can_create, can_edit, can_delete) VALUES (?,?,1,1,1,1)',
          [uid, mod]
        );
      }
      ok(`Re-seeded full permissions for [${uid}] ${usr[0].email}`);
    }

    // ── 3. Reset admin account balance ───────────────────────
    section('3 · Reset admin treasury account');
    await conn.query('UPDATE admin_account SET balance = 0.00, updated_at = NOW() WHERE id = 1');
    ok('Admin account balance reset to ₹0.00');
    const [txCount] = await conn.query('SELECT COUNT(*) as cnt FROM admin_account_transactions');
    await conn.query('DELETE FROM admin_account_transactions');
    ok(`Deleted ${txCount[0].cnt} account transaction(s)`);

    // ── 4. Clear audit_logs ───────────────────────────────────
    section('4 · Clear audit logs');
    const [auditCount] = await conn.query('SELECT COUNT(*) as cnt FROM audit_logs');
    await conn.query('DELETE FROM audit_logs');
    ok(`Deleted ${auditCount[0].cnt} audit log entries`);

    // ── 5. Clear empty/unused tables ─────────────────────────
    section('5 · Clear transactional tables (already empty — confirming)');
    const txTables = [
      'loan_applications','loans','loan_installments','loan_transactions',
      'loan_status_history','application_status_history','customer_profiles',
      'payments','notifications_log','user_permissions','role_permissions'
    ];
    for (const tbl of txTables) {
      const [cnt] = await conn.query(`SELECT COUNT(*) as c FROM \`${tbl}\``);
      if (cnt[0].c > 0) {
        await conn.query(`DELETE FROM \`${tbl}\``);
        ok(`Cleared ${cnt[0].c} rows from ${tbl}`);
      } else {
        skip(`${tbl} — already empty`);
      }
    }

    // ── 6. Reset system_settings ──────────────────────────────
    section('6 · Reset system_settings to defaults');
    for (const [key, val] of Object.entries(SETTINGS_DEFAULTS)) {
      await conn.query(
        'INSERT INTO system_settings (setting_key, setting_value) VALUES (?,?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)',
        [key, val]
      );
    }
    ok(`Upserted ${Object.keys(SETTINGS_DEFAULTS).length} system setting(s)`);

    // ── 7. Commit ─────────────────────────────────────────────
    await conn.commit();

    // ── 8. Final verification ─────────────────────────────────
    section('8 · Post-cleanup verification');
    const [tables] = await conn.query('SHOW TABLES');
    const tNames = tables.map(t => Object.values(t)[0]);
    for (const t of tNames) {
      if (t.startsWith('vw_')) { skip(`${t} (view, skipped)`); continue; }
      try {
        const [r] = await conn.query(`SELECT COUNT(*) as cnt FROM \`${t}\``);
        log(`  ${t.padEnd(38)} ${r[0].cnt} rows`);
      } catch(e) { warn(`${t}: ${e.message}`); }
    }

    const [finalUsers] = await conn.query('SELECT id, email, role, account_status FROM users');
    log('\n  Final user accounts:');
    finalUsers.forEach(u => log(`      [${u.id}] ${u.email} — ${u.role} (${u.account_status})`));

    const [finalBal] = await conn.query('SELECT balance FROM admin_account WHERE id = 1');
    log(`\n  Treasury balance: ₹${finalBal[0]?.balance || '0.00'}`);

    log('\n' + SEP);
    log('  🎉  Database cleanup completed successfully.');
    log(SEP + '\n');

  } catch (err) {
    await conn.rollback();
    console.error('\n❌  Cleanup FAILED — transaction rolled back.');
    console.error(err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

run();
