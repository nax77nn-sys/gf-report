const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Assicura che la cartella data esista
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Struttura iniziale database
const initialData = {
  users: [],
  timesheets: [],
  companySettings: {
    name: 'GF REPORT',
    ordinaryHoursPerDay: 8
  }
};

function readDb() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      saveDb(initialData);
      return initialData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Errore lettura database:', err);
    return initialData;
  }
}

function saveDb(data) {
  try {
    const tempPath = DB_FILE + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempPath, DB_FILE);
  } catch (err) {
    console.error('Errore salvataggio database:', err);
  }
}

// Inizializza l'utente Amministratore predefinito se non esistono utenti
function initAdmin() {
  const db = readDb();
  const adminExists = db.users.some(u => u.role === 'admin');
  if (!adminExists) {
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync('admin2026', salt);
    const defaultAdmin = {
      id: 'usr_admin_1',
      email: 'admin@azienda.it',
      name: 'Amministratore',
      surname: 'Aziendale',
      passwordHash: passwordHash,
      role: 'admin',
      createdAt: new Date().toISOString()
    };
    db.users.push(defaultAdmin);
    saveDb(db);
    console.log('✅ Amministratore predefinito creato: admin@azienda.it / admin2026');
  }
}

// Metodi Utenti
function findUserByEmail(email) {
  const db = readDb();
  return db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

function findUserById(id) {
  const db = readDb();
  return db.users.find(u => u.id === id);
}

function createUser({ email, name, surname, password, role = 'employee' }) {
  const db = readDb();
  if (db.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Un utente con questa email esiste già.');
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const newUser = {
    id: 'usr_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    email: email.trim().toLowerCase(),
    name: name.trim(),
    surname: surname.trim(),
    passwordHash,
    role: role === 'admin' ? 'admin' : 'employee',
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDb(db);
  return {
    id: newUser.id,
    email: newUser.email,
    name: newUser.name,
    surname: newUser.surname,
    role: newUser.role
  };
}

function getAllUsers() {
  const db = readDb();
  return db.users.map(({ id, email, name, surname, role, isActive, createdAt }) => ({
    id,
    email,
    name,
    surname,
    role,
    isActive: isActive !== false,
    createdAt
  }));
}

function deleteUser(userId) {
  const db = readDb();
  const index = db.users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('Utente non trovato.');
  }
  const user = db.users[index];
  if (user.role === 'admin') {
    throw new Error('Non è possibile eliminare l\'amministratore principale.');
  }

  db.users.splice(index, 1);
  // Elimina anche i relativi fogli presenze
  db.timesheets = db.timesheets.filter(t => t.userId !== userId);
  saveDb(db);
  return user;
}

function toggleUserActive(userId, isActive) {
  const db = readDb();
  const user = db.users.find(u => u.id === userId);
  if (!user) throw new Error('Utente non trovato.');
  if (user.role === 'admin') throw new Error('Non puoi disattivare l\'amministratore.');

  user.isActive = Boolean(isActive);
  saveDb(db);
  return user;
}

// Metodi Timesheets
function getTimesheet(userId, year, month) {
  const db = readDb();
  return db.timesheets.find(t => t.userId === userId && t.year === parseInt(year) && t.month === parseInt(month));
}

function saveTimesheet(userId, year, month, timesheetData) {
  const db = readDb();
  const y = parseInt(year);
  const m = parseInt(month);

  let recordIndex = db.timesheets.findIndex(t => t.userId === userId && t.year === y && t.month === m);
  
  const updatedRecord = {
    id: recordIndex >= 0 ? db.timesheets[recordIndex].id : 'ts_' + Date.now(),
    userId,
    year: y,
    month: m,
    days: timesheetData.days || {},
    onCallWeeks: timesheetData.onCallWeeks || [],
    notes: timesheetData.notes || '',
    isLocked: timesheetData.isLocked !== undefined ? timesheetData.isLocked : (recordIndex >= 0 ? db.timesheets[recordIndex].isLocked : false),
    submittedAt: timesheetData.isLocked ? new Date().toISOString() : (recordIndex >= 0 ? db.timesheets[recordIndex].submittedAt : null),
    updatedAt: new Date().toISOString()
  };

  if (recordIndex >= 0) {
    db.timesheets[recordIndex] = updatedRecord;
  } else {
    db.timesheets.push(updatedRecord);
  }

  saveDb(db);
  return updatedRecord;
}

function setTimesheetLock(userId, year, month, isLocked) {
  const db = readDb();
  const y = parseInt(year);
  const m = parseInt(month);
  const recordIndex = db.timesheets.findIndex(t => t.userId === userId && t.year === y && t.month === m);

  if (recordIndex >= 0) {
    db.timesheets[recordIndex].isLocked = isLocked;
    db.timesheets[recordIndex].updatedAt = new Date().toISOString();
    saveDb(db);
    return db.timesheets[recordIndex];
  } else {
    // Crea record vuoto bloccato/sbloccato
    const newRecord = {
      id: 'ts_' + Date.now(),
      userId,
      year: y,
      month: m,
      days: {},
      onCallWeeks: [],
      notes: '',
      isLocked,
      submittedAt: isLocked ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString()
    };
    db.timesheets.push(newRecord);
    saveDb(db);
    return newRecord;
  }
}

function getAllTimesheetsForMonth(year, month) {
  const db = readDb();
  const y = parseInt(year);
  const m = parseInt(month);
  return db.timesheets.filter(t => t.year === y && t.month === m);
}

module.exports = {
  initAdmin,
  findUserByEmail,
  findUserById,
  createUser,
  getAllUsers,
  deleteUser,
  toggleUserActive,
  getTimesheet,
  saveTimesheet,
  setTimesheetLock,
  getAllTimesheetsForMonth
};
