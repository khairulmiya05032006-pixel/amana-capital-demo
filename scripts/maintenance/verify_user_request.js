import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

async function verifyUserRequest() {
  const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';
  const adminToken = jwt.sign({ id: 1, role: 'ADMIN', email: 'admin@microfinance.com' }, secret);
  const headers = { cookie: `token=${adminToken}` };

  console.log('--- VERIFYING USER REQUESTED ROUTES ON LOCALHOST:8080 ---');

  const routes = [
    { url: '/admin/account', method: 'GET', expected: 200, name: 'http://localhost:8080/admin/account' },
    { url: '/admin/applications', method: 'GET', expected: 200, name: 'http://localhost:8080/admin/applications' },
    { url: '/admin/overdue', method: 'GET', expected: 200, name: 'http://localhost:8080/admin/overdue' },
    { url: '/auth/logout', method: 'POST', expected: 302, name: 'http://localhost:8080/auth/logout (POST)' }
  ];

  for (const r of routes) {
    const res = await fetch(`http://localhost:8080${r.url}`, { method: r.method, headers, redirect: 'manual' });
    const text = await res.text();
    console.log(`[${res.status === r.expected ? 'PASS' : 'FAIL'}] ${r.name} -> HTTP ${res.status} (Length: ${text.length})`);
  }
}

verifyUserRequest();
