const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const authRoutes = require('./routes/authRoutes');
const timesheetRoutes = require('./routes/timesheetRoutes');
const adminRoutes = require('./routes/adminRoutes');
const exportRoutes = require('./routes/exportRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Inizializza l'admin se il database è nuovo
db.initAdmin();

// Rotte API
app.use('/api/auth', authRoutes);
app.use('/api/timesheets', timesheetRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);

// Servizio file statici Frontend
const publicPath = path.join(__dirname, '..', 'public');
app.use(express.static(publicPath));

// Fallback SPA per frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Avvio Server
app.listen(PORT, '0.0.0.0', () => {
  console.log('====================================================');
  console.log(`🚀 Applicazione GF REPORT attiva con successo!`);
  console.log(`🌐 Accedi dal browser su: http://localhost:${PORT}`);
  console.log(`👤 Admin predefinito: admin@azienda.it | password: admin2026`);
  console.log('====================================================');
});
