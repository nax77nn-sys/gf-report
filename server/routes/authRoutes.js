const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { generateToken, authenticateToken, requireAdmin } = require('../auth');

// Registrazione nuovo utente (dipendente)
router.post('/register', (req, res) => {
  try {
    const { email, name, surname, password } = req.body;

    if (!email || !name || !surname || !password) {
      return res.status(400).json({ error: 'Tutti i campi (Nome, Cognome, Email, Password) sono obbligatori.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La password deve contenere almeno 6 caratteri.' });
    }

    const newUser = db.createUser({
      email,
      name,
      surname,
      password,
      role: 'employee'
    });

    const token = generateToken(newUser);
    res.status(201).json({
      message: 'Registrazione completata con successo!',
      token,
      user: newUser
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Login
router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Inserisci sia email che password.' });
    }

    const user = db.findUserByEmail(email);
    if (!user) {
      return res.status(401).json({ error: 'Credenziali non valide. Verifica email e password.' });
    }

    const match = bcrypt.compareSync(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ error: 'Credenziali non valide. Verifica email e password.' });
    }

    if (user.isActive === false) {
      return res.status(403).json({ error: 'Questo account è stato disattivato dall\'amministratore aziendale.' });
    }

    const userPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      surname: user.surname,
      role: user.role
    };

    const token = generateToken(userPayload);
    res.json({
      message: 'Login effettuato con successo!',
      token,
      user: userPayload
    });
  } catch (err) {
    res.status(500).json({ error: 'Errore interno del server durante il login.' });
  }
});

// Verifica stato utente corrente
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// Lista di tutti gli utenti (solo Admin)
router.get('/users', authenticateToken, requireAdmin, (req, res) => {
  const users = db.getAllUsers();
  res.json({ users });
});

module.exports = router;
