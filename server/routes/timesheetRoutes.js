const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../auth');

function isMonthExpired(year, month) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed

  if (year < currentYear) return true;
  if (year === currentYear && month < currentMonth) return true;
  return false;
}

// Recupera il foglio mensile (per se stesso o per un dipendente se admin)
router.get('/:year/:month', authenticateToken, (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const targetUserId = req.query.userId || req.user.id;

    // Solo l'admin può vedere i fogli degli altri
    if (targetUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non hai i permessi per visualizzare questo foglio presenze.' });
    }

    const timesheet = db.getTimesheet(targetUserId, year, month) || {
      userId: targetUserId,
      year,
      month,
      days: {},
      onCallWeeks: [],
      notes: '',
      isLocked: false
    };

    const expired = isMonthExpired(year, month);
    // Un mese è bloccato se è stato esplicitamente bloccato OPPURE se il mese è scaduto e non è stato sbloccato dall'admin
    const effectiveLocked = timesheet.isLocked || (expired && timesheet.unlockedByAdmin !== true);

    res.json({
      timesheet,
      isExpired: expired,
      isEffectivelyLocked: effectiveLocked,
      canEdit: req.user.role === 'admin' || !effectiveLocked
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Salva le modifiche al foglio mensile
router.post('/:year/:month', authenticateToken, (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const targetUserId = req.body.userId || req.user.id;

    if (targetUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Non hai i permessi per modificare questo foglio presenze.' });
    }

    const currentTimesheet = db.getTimesheet(targetUserId, year, month);
    const expired = isMonthExpired(year, month);
    const isLocked = currentTimesheet && currentTimesheet.isLocked;

    // Controllo permessi di modifica per dipendenti normali
    if (req.user.role !== 'admin') {
      if (isLocked) {
        return res.status(400).json({ error: 'Questo mese è già stato inviato e bloccato. Contatta l\'amministratore per richiedere modifiche.' });
      }
      if (expired && (!currentTimesheet || currentTimesheet.unlockedByAdmin !== true)) {
        return res.status(400).json({ error: 'Il termine per la compilazione di questo mese è scaduto. Contatta l\'amministratore per sbloccare il foglio.' });
      }
    }

    const saved = db.saveTimesheet(targetUserId, year, month, {
      days: req.body.days || {},
      onCallWeeks: req.body.onCallWeeks || [],
      notes: req.body.notes || '',
      isLocked: req.body.isLocked !== undefined ? req.body.isLocked : (currentTimesheet ? currentTimesheet.isLocked : false)
    });

    res.json({
      message: 'Foglio presenze salvato con successo!',
      timesheet: saved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Invia e blocca definitivamente il foglio mensile
router.post('/:year/:month/lock', authenticateToken, (req, res) => {
  try {
    const year = parseInt(req.params.year);
    const month = parseInt(req.params.month);
    const targetUserId = req.body.userId || req.user.id;

    if (targetUserId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Operazione non consentita.' });
    }

    const updated = db.setTimesheetLock(targetUserId, year, month, true);
    res.json({
      message: 'Foglio presenze inviato e bloccato correttamente.',
      timesheet: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
