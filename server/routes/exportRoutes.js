const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../auth');
const { generateEmployeeExcel, generateCompanyExcel } = require('../services/excelService');
const { generateEmployeePdf } = require('../services/pdfService');

// Esporta Excel per singolo dipendente
router.get('/excel/employee', authenticateToken, async (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);
    const targetUserId = req.query.userId || req.user.id;

    if (targetUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permesso negato.' });
    }

    const user = db.findUserById(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'Dipendente non trovato.' });
    }

    const timesheet = db.getTimesheet(targetUserId, year, month);
    const workbook = await generateEmployeeExcel(user, timesheet, year, month);

    const filename = `Foglio_Presenze_${user.surname}_${month}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Errore esportazione Excel dipendente:', err);
    res.status(500).json({ error: 'Errore durante la generazione del file Excel.' });
  }
});

// Esporta Excel riepilogo aziendale (solo Admin)
router.get('/excel/company', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);

    const employees = db.getAllUsers().filter(u => u.role !== 'admin');
    const timesheets = db.getAllTimesheetsForMonth(year, month);
    const timesheetMap = {};
    timesheets.forEach(ts => {
      timesheetMap[ts.userId] = ts;
    });

    const workbook = await generateCompanyExcel(employees, timesheetMap, year, month);

    const filename = `Riepilogo_Aziendale_${month}_${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Errore esportazione Excel aziendale:', err);
    res.status(500).json({ error: 'Errore durante la generazione dell\'Excel aziendale.' });
  }
});

// Esporta PDF per singolo dipendente
router.get('/pdf/employee', authenticateToken, (req, res) => {
  try {
    const year = parseInt(req.query.year);
    const month = parseInt(req.query.month);
    const targetUserId = req.query.userId || req.user.id;

    if (targetUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Permesso negato.' });
    }

    const user = db.findUserById(targetUserId);
    if (!user) {
      return res.status(404).json({ error: 'Dipendente non trovato.' });
    }

    const timesheet = db.getTimesheet(targetUserId, year, month);
    const filename = `Foglio_Presenze_${user.surname}_${month}_${year}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    generateEmployeePdf(user, timesheet, year, month, res);
  } catch (err) {
    console.error('Errore esportazione PDF dipendente:', err);
    res.status(500).json({ error: 'Errore durante la generazione del PDF.' });
  }
});

module.exports = router;
