const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../auth');

// Tutti gli endpoint qui richiedono il ruolo Admin
router.use(authenticateToken);
router.use(requireAdmin);

// Panoramica mensile di tutti i dipendenti
router.get('/overview/:year/:month', (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);

    const users = db.getAllUsers().filter(u => u.role !== 'admin');
    const timesheets = db.getAllTimesheetsForMonth(year, month);

    const timesheetMap = {};
    timesheets.forEach(ts => {
      timesheetMap[ts.userId] = ts;
    });

    let totalCompanyOrdinary = 0;
    let totalCompanyOvertime = 0;
    let totalCompanyTravel = 0;
    let totalCompanyFerie = 0;
    let totalCompanyMalattia = 0;
    let totalCompanyExpenses = 0;
    let totalCompanyOnCallDays = 0;

    const employeeSummaries = users.map(user => {
      const ts = timesheetMap[user.id];
      let ord = 0;
      let str = 0;
      let viag = 0;
      let ferie = 0;
      let mal = 0;
      let expenses = 0;
      let onCallDays = 0;

      if (ts && ts.days) {
        Object.values(ts.days).forEach(d => {
          ord += parseFloat(d.ordinaryHours) || 0;
          str += parseFloat(d.overtimeHours) || 0;
          viag += parseFloat(d.travelHours) || 0;
          ferie += parseFloat(d.ferieHours) || 0;
          mal += parseFloat(d.malattiaHours) || 0;
          if (d.onCall) onCallDays++;

          if (Array.isArray(d.expenses)) {
            d.expenses.forEach(e => {
              expenses += parseFloat(e.amount) || 0;
            });
          } else if (d.expenseAmount) {
            expenses += parseFloat(d.expenseAmount) || 0;
          }
        });
      }

      totalCompanyOrdinary += ord;
      totalCompanyOvertime += str;
      totalCompanyTravel += viag;
      totalCompanyFerie += ferie;
      totalCompanyMalattia += mal;
      totalCompanyExpenses += expenses;
      totalCompanyOnCallDays += onCallDays;

      return {
        user,
        totals: {
          ordinaryHours: ord,
          overtimeHours: str,
          travelHours: viag,
          ferieHours: ferie,
          malattiaHours: mal,
          expenses: expenses,
          onCallDays: onCallDays,
          onCallWeeksCount: (ts && ts.onCallWeeks) ? ts.onCallWeeks.length : 0
        },
        timesheet: ts || null,
        isLocked: ts ? ts.isLocked : false,
        updatedAt: ts ? ts.updatedAt : null
      };
    });

    res.json({
      year,
      month,
      stats: {
        totalEmployees: users.length,
        totalCompanyOrdinary,
        totalCompanyOvertime,
        totalCompanyTravel,
        totalCompanyFerie,
        totalCompanyMalattia,
        totalCompanyExpenses,
        totalCompanyOnCallDays
      },
      employees: employeeSummaries
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Sblocca / Blocca il mese per un dipendente specifico
router.post('/toggle-lock', (req, res) => {
  try {
    const { userId, year, month, isLocked } = req.body;

    if (!userId || !year || !month) {
      return res.status(400).json({ error: 'Dati mancanti (userId, year, month).' });
    }

    const updated = db.setTimesheetLock(userId, parseInt(year), parseInt(month), Boolean(isLocked));
    // Se viene sbloccato dall'admin, impostiamo anche il flag unlockedByAdmin
    if (!isLocked) {
      const timesheet = db.getTimesheet(userId, parseInt(year), parseInt(month));
      if (timesheet) {
        timesheet.unlockedByAdmin = true;
      }
    }

    res.json({
      message: isLocked ? 'Mese bloccato correttamente.' : 'Mese sbloccato con successo per il dipendente.',
      timesheet: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Attiva / Disattiva account dipendente (es. dipendente dimesso)
router.post('/users/:userId/toggle-active', (req, res) => {
  try {
    const { isActive } = req.body;
    const user = db.toggleUserActive(req.params.userId, isActive);
    res.json({
      message: isActive ? 'Account dipendente riattivato.' : 'Account dipendente disattivato (non potrà più accedere).',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        isActive: user.isActive
      }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Crea nuovo dipendente direttamente dall'Admin
router.post('/users', (req, res) => {
  try {
    const { name, surname, email, password } = req.body;
    if (!name || !surname || !email || !password) {
      return res.status(400).json({ error: 'Tutti i campi (Nome, Cognome, Email, Password) sono obbligatori.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'La password deve contenere almeno 6 caratteri.' });
    }
    const newUser = db.createUser({
      name,
      surname,
      email,
      password,
      role: 'employee'
    });
    res.status(201).json({
      message: `Dipendente ${newUser.name} ${newUser.surname} creato con successo!`,
      user: newUser
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Elimina definitivamente un dipendente e i suoi dati
router.delete('/users/:userId', (req, res) => {
  try {
    const user = db.deleteUser(req.params.userId);
    res.json({
      message: `Dipendente ${user.name} ${user.surname} eliminato definitivamente con successo.`,
      user: { id: user.id, email: user.email }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
