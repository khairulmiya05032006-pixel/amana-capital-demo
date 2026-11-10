import CustomerExportService from '../services/customerExportService.js';
import db from '../config/db.js';

class CustomerExportController {
  
  static async exportExcel(req, res, next) {
    try {
      const filters = {
        frequency: req.query.frequency || 'ALL',
        searchQuery: req.query.q || ''
      };
      
      const dateStr = new Date().toISOString().split('T')[0];
      let prefix = 'amanah-capital-';
      if (filters.frequency !== 'ALL') prefix += `${filters.frequency.toLowerCase()}-`;
      const filename = `${prefix}customers-${dateStr}.xlsx`;

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const totalExported = await CustomerExportService.generateExcelStream(filters, res);
      
      await CustomerExportController.logExport(req, 'XLSX', filters, totalExported);
      
    } catch (err) {
      console.error('Excel Export Error:', err);
      // If we already started piping, we can't do much but close the stream, but if not, we can redirect or show error
      if (!res.headersSent) {
        res.status(500).send('Unable to generate the export. Please try again or contact an administrator.');
      } else {
        res.end();
      }
    }
  }

  static async exportCsv(req, res, next) {
    try {
      const filters = {
        frequency: req.query.frequency || 'ALL',
        searchQuery: req.query.q || ''
      };
      
      const dateStr = new Date().toISOString().split('T')[0];
      let prefix = 'amanah-capital-';
      if (filters.frequency !== 'ALL') prefix += `${filters.frequency.toLowerCase()}-`;
      const filename = `${prefix}customers-${dateStr}.zip`;

      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

      const totalExported = await CustomerExportService.generateCsvZipStream(filters, res);
      
      await CustomerExportController.logExport(req, 'CSV', filters, totalExported);
      
    } catch (err) {
      console.error('CSV Export Error:', err);
      if (!res.headersSent) {
        res.status(500).send('Unable to generate the export. Please try again or contact an administrator.');
      } else {
        res.end();
      }
    }
  }

  static async logExport(req, format, filters, recordCount) {
    const userId = (req.user && req.user.id) || (res.locals.user && res.locals.user.id) || 1;
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
    
    try {
      await db.query(`
        INSERT INTO audit_logs (
          user_id, module_name, entity_name, action, description, ip_address, created_at, new_values
        ) VALUES (?, 'CUSTOMERS', 'export', 'EXPORT', 'Exported customer data', ?, NOW(), ?)
      `, [
        userId, 
        ipAddress, 
        JSON.stringify({ format, filters, records: recordCount })
      ]);
    } catch (e) {
      console.error('Audit Log Error:', e);
    }
  }
}

export default CustomerExportController;
