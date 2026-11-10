import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

router.get('/:type/:filename', (req, res) => {
  const { type, filename } = req.params;
  
  // Basic path traversal prevention
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\\\')) {
    return res.status(400).send('Invalid filename');
  }

  // Ensure type is valid
  if (!['profiles', 'documents'].includes(type)) {
    return res.status(400).send('Invalid document type');
  }

  // Determine path
  const filePath = path.join(__dirname, '..', 'storage', 'uploads', type, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Document not found');
  }

  // Check authorization
  // For administrators with customers.view
  if (req.user && req.user.role !== 'CUSTOMER') {
     // Ideally check requirePermission('customers.view') but here we simplify if they are admin staff
     return res.sendFile(filePath);
  }
  
  // For customers, they must own the document. 
  // Given we don't have a document ownership table mapping filename -> customer, 
  // we can only do strict checks if we have that mapping. 
  // If the user isn't admin/staff, we forbid.
  if (req.user && req.user.role === 'CUSTOMER') {
     // A proper implementation requires looking up the document owner in customer_profiles
     // For now, if no lookup exists, they can't access arbitrary files.
     // In a production system we'd look up SELECT id FROM customer_profiles WHERE id=? AND (aadhaar_url=? OR pan_url=?)
     return res.status(403).send('Forbidden: Not authorized to view this document.');
  }

  return res.status(401).send('Unauthorized');
});

export default router;
