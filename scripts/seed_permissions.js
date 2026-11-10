/**
 * ============================================================
 *  Seed Script — Granular RBAC Permissions
 * ============================================================
 *  Inserts all application-level permission keys into the
 *  `permissions` table and seeds `role_permissions` per role.
 * ============================================================
 */

import 'dotenv/config';
import db from '../config/db.js';

const SEP = '─'.repeat(60);
const ok   = (m) => console.log(`  ✅  ${m}`);
const info = (m) => console.log(`  ℹ️   ${m}`);
const sec  = (t) => { console.log(`\n${SEP}\n  ${t}\n${SEP}`); };

// All granular permission keys
const PERMISSIONS = [
  { key: 'dashboard.view',            desc: 'View the executive dashboard' },
  { key: 'applications.view',         desc: 'View loan applications list and details' },
  { key: 'applications.create',       desc: 'Submit a new loan application' },
  { key: 'applications.edit',         desc: 'Edit pending loan application details' },
  { key: 'applications.approve',      desc: 'Approve a pending loan application' },
  { key: 'applications.reject',       desc: 'Reject a pending loan application' },
  { key: 'applications.delete',       desc: 'Delete a loan application' },
  { key: 'applications.assign',       desc: 'Reassign an application to another officer' },
  { key: 'applications.disburse',     desc: 'Disburse an approved loan' },
  { key: 'customers.view',            desc: 'View customer profiles' },
  { key: 'customers.create',          desc: 'Create new customer accounts' },
  { key: 'customers.edit',            desc: 'Edit customer profile details' },
  { key: 'customers.delete',          desc: 'Delete customer accounts' },
  { key: 'loans.view',                desc: 'View active and historical loans' },
  { key: 'loans.disburse',            desc: 'Disburse approved loans' },
  { key: 'loans.edit',                desc: 'Modify loan terms after approval' },
  { key: 'loans.delete',              desc: 'Delete loan records' },
  { key: 'repayments.view',           desc: 'View repayment records' },
  { key: 'repayments.record',         desc: 'Record new repayments' },
  { key: 'reports.view',              desc: 'View financial reports' },
  { key: 'reports.export',            desc: 'Export reports to CSV/PDF' },
  { key: 'account.view',              desc: 'View admin treasury account balance' },
  { key: 'account.manage',            desc: 'Add funds to admin treasury account' },
  { key: 'settings.view',             desc: 'View system settings' },
  { key: 'settings.edit',             desc: 'Modify system settings' },
  { key: 'administrators.view',       desc: 'View administrator accounts' },
  { key: 'administrators.create',     desc: 'Create new administrator accounts' },
  { key: 'administrators.edit',       desc: 'Edit administrator accounts' },
  { key: 'administrators.delete',     desc: 'Delete administrator accounts' },
];

// Role → [permission keys]
const ROLE_PERMISSION_MAP = {
  SUPER_ADMIN: PERMISSIONS.map(p => p.key), // All permissions
  LOAN_OFFICER: [
    'dashboard.view',
    'applications.view', 'applications.approve', 'applications.reject', 'applications.edit',
    'customers.view',
    'loans.view',
  ],
  COLLECTION_OFFICER: [
    'dashboard.view',
    'applications.view',
    'customers.view',
    'loans.view',
    'repayments.view', 'repayments.record',
  ],
  ACCOUNT_OFFICER: [
    'dashboard.view',
    'applications.view',
    'account.view', 'account.manage',
    'reports.view', 'reports.export',
  ],
  AUDITOR: [
    'dashboard.view',
    'applications.view',
    'customers.view',
    'loans.view',
    'repayments.view',
    'reports.view',
  ],
  VIEWER: [
    'dashboard.view',
  ],
};

async function seed() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    console.log('\n🚀  Seeding granular RBAC permissions...\n');

    // ── 1. Insert / upsert all permission keys ────────────────
    sec('1 · Inserting permission keys');
    const permIdMap = {};
    for (const { key, desc } of PERMISSIONS) {
      await conn.query(
        'INSERT INTO permissions (permission_key, description) VALUES (?, ?) ON DUPLICATE KEY UPDATE description = VALUES(description)',
        [key, desc]
      );
      const [rows] = await conn.query('SELECT id FROM permissions WHERE permission_key = ?', [key]);
      permIdMap[key] = rows[0].id;
      ok(`${key}  (id=${rows[0].id})`);
    }

    // ── 2. Clear old role_permissions  ───────────────────────
    sec('2 · Clearing old role_permissions');
    const [before] = await conn.query('SELECT COUNT(*) as cnt FROM role_permissions');
    await conn.query('DELETE FROM role_permissions');
    ok(`Cleared ${before[0].cnt} existing role_permissions`);

    // ── 3. Seed role_permissions ─────────────────────────────
    sec('3 · Seeding role → permission mappings');
    const [roles] = await conn.query('SELECT id, role_name FROM roles');
    const roleIdMap = {};
    roles.forEach(r => { roleIdMap[r.role_name] = r.id; });

    for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSION_MAP)) {
      const roleId = roleIdMap[roleName];
      if (!roleId) {
        info(`Role '${roleName}' not found in roles table, skipping.`);
        continue;
      }
      for (const key of permKeys) {
        const permId = permIdMap[key];
        if (!permId) { info(`Permission '${key}' not found, skipping.`); continue; }
        await conn.query(
          'INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)',
          [roleId, permId]
        );
      }
      ok(`${roleName.padEnd(20)} → ${permKeys.length} permissions`);
    }

    // ── 4. Commit ─────────────────────────────────────────────
    await conn.commit();

    // ── 5. Verify ─────────────────────────────────────────────
    sec('4 · Verification');
    const [verify] = await conn.query(`
      SELECT r.role_name, COUNT(*) as cnt
      FROM role_permissions rp
      JOIN roles r ON rp.role_id = r.id
      GROUP BY r.role_name
      ORDER BY cnt DESC
    `);
    verify.forEach(v => info(`${v.role_name.padEnd(22)} ${v.cnt} permissions`));

    const [totalPerms] = await conn.query('SELECT COUNT(*) as cnt FROM permissions');
    const [totalRolePerms] = await conn.query('SELECT COUNT(*) as cnt FROM role_permissions');
    console.log(`\n  permissions table:       ${totalPerms[0].cnt} rows`);
    console.log(`  role_permissions table:  ${totalRolePerms[0].cnt} rows`);
    console.log(`\n${SEP}`);
    console.log('  🎉  Seeding completed successfully.');
    console.log(`${SEP}\n`);

  } catch (err) {
    await conn.rollback();
    console.error('\n❌  Seeding FAILED — rolled back:', err.message);
    process.exit(1);
  } finally {
    conn.release();
    process.exit(0);
  }
}

seed();
