// Quick UI permission verification script for Approve/Reject buttons
// Run with: node scripts/verify_ui_permissions.js
import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';
import db from '../config/db.js'; // just to get a sample application ID if needed

const secret = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';

async function createLoanOfficer() {
  const superToken = jwt.sign({ id: 1, role: 'SUPER_ADMIN', email: 'admin@microfinance.com' }, secret);
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'cookie': `token=${superToken}`,
  };
  const loEmail = `loanofficer_${Date.now()}@microfinance.com`;
  const loPayload = {
    full_name: 'Test Officer',
    email: loEmail,
    phone: '+911234567890',
    username: `LO${Date.now().toString().slice(-4)}`,
    password: 'LoanOfficerPass123!',
    role: 'LOAN_OFFICER',
    status: 'ACTIVE',
    permissions: [] // optional, not used in our flow
  };
  const res = await fetch('http://localhost:8080/admin/settings/administrators', {
    method: 'POST',
    headers,
    body: JSON.stringify(loPayload),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Failed to create LO: ' + JSON.stringify(json));
  console.log('Created LO ID', json.data.adminId);
  return { email: loEmail, password: loPayload.password };
}

async function login(email, password) {
  const res = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Login failed: ' + JSON.stringify(json));
  return json.token; // assuming response includes token field
}

async function getFirstApplicationId() {
  // Use API to list applications (requires authentication). Use SUPER_ADMIN token.
  const superToken = jwt.sign({ id: 1, role: 'SUPER_ADMIN', email: 'admin@microfinance.com' }, secret);
  const res = await fetch('http://localhost:8080/api/applications', {
    headers: { 'cookie': `token=${superToken}`, 'Accept': 'application/json' },
  });
  const json = await res.json();
  if (!res.ok) throw new Error('Failed to fetch applications: ' + JSON.stringify(json));
  const apps = json.data || json.apps || json; // be flexible
  if (!Array.isArray(apps) || apps.length === 0) throw new Error('No applications found');
  return apps[0].id;
}

async function checkUI(token, appId) {
  const res = await fetch(`http://localhost:8080/admin/applications/${appId}`, {
    headers: { 'cookie': `token=${token}` },
  });
  const html = await res.text();
  const hasApprove = html.includes('name="interestRate"') && html.includes('Approve Loan');
  const hasReject = html.includes('name="remarks"') && html.includes('Reject Loan');
  console.log('UI check for app', appId, ': approve?', hasApprove, 'reject?', hasReject);
  return { hasApprove, hasReject };
}

(async () => {
  try {
    const loCreds = await createLoanOfficer();
    const loToken = await login(loCreds.email, loCreds.password);
    const appId = await getFirstApplicationId();
    console.log('Testing as LOAN_OFFICER (should see approve/reject)');
    await checkUI(loToken, appId);
    // Now test as VIEWER role (no permissions)
    const viewerToken = jwt.sign({ id: 9999, role: 'VIEWER', email: 'viewer@demo.com' }, secret);
    console.log('Testing as VIEWER (should see view‑only placeholder)');
    await checkUI(viewerToken, appId);
    process.exit(0);
  } catch (e) {
    console.error('Error during UI verification:', e);
    process.exit(1);
  }
})();
