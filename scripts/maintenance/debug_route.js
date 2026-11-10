import fetch from 'node-fetch';
import jwt from 'jsonwebtoken';

async function debugRoute() {
  const token = jwt.sign({ id: 1, role: 'ADMIN', email: 'admin@microfinance.com' }, 'super_secret_jwt_key_12345');
  const res = await fetch('http://localhost:8080/admin/applications', {
    headers: { cookie: `token=${token}` }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response body:', text.slice(0, 300));
}
debugRoute();
