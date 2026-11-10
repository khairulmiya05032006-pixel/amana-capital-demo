import app from './app.js';
import jwt from 'jsonwebtoken';

async function runDirectTest() {
  const server = app.listen(8089, async () => {
    console.log('Test server listening on 8089');
    const fetch = (await import('node-fetch')).default;
    const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';
    
    const adminToken = jwt.sign({ id: 1, role: 'ADMIN', email: 'admin@microfinance.com' }, secret);
    const customerToken = jwt.sign({ id: 9, role: 'CUSTOMER', email: 'test@gmail.com' }, secret);

    const adminHeaders = { cookie: `token=${adminToken}` };
    const customerHeaders = { cookie: `token=${customerToken}` };

    let passed = 0;
    let failed = 0;

    async function check(url, options, expectedStatus, name) {
      try {
        const res = await fetch('http://localhost:8089' + url, { redirect: 'manual', ...options });
        if (res.status === expectedStatus) {
          console.log(`[PASS] ${name} (${res.status})`);
          passed++;
        } else {
          console.error(`[FAIL] ${name} (Expected ${expectedStatus}, got ${res.status})`);
          failed++;
        }
      } catch (err) {
        console.error(`[ERROR] ${name}: ${err.message}`);
        failed++;
      }
    }

    await check('/auth/login', {}, 200, '1. GET /auth/login');
    await check('/admin/dashboard', { headers: adminHeaders }, 200, '3. GET /admin/dashboard');
    await check('/admin/applications', { headers: adminHeaders }, 200, '4. GET /admin/applications');
    await check('/admin/customers', { headers: adminHeaders }, 200, '8. GET /admin/customers');
    await check('/admin/overdue', { headers: adminHeaders }, 200, '9. GET /admin/overdue');
    await check('/admin/repayments', { headers: adminHeaders }, 200, '10. GET /admin/repayments');
    await check('/admin/reports', { headers: adminHeaders }, 200, '12. GET /admin/reports');
    await check('/admin/reports/export/csv/collections', { headers: adminHeaders }, 200, '13. GET /admin/reports/export/csv/collections');
    await check('/admin/account', { headers: adminHeaders }, 200, '14. GET /admin/account');
    await check('/auth/logout', { method: 'POST', headers: adminHeaders }, 302, '16. POST /auth/logout');
    await check('/customer/dashboard', { headers: customerHeaders }, 200, '17. GET /customer/dashboard');
    await check('/admin/dashboard', { headers: customerHeaders }, 403, '18. GET /admin/dashboard (as customer -> 403)');

    console.log(`\n=== FINAL ROUTE TEST RESULT: ${passed} PASSED, ${failed} FAILED ===`);
    server.close();
    process.exit(0);
  });
}

runDirectTest();
