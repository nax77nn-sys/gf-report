// GF REPORT - Logica Client-Side (SPA)

const API_BASE = '/api';

const MONTH_NAMES = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre'
];

const DAY_NAMES = [
  'Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'
];

// Stato Applicazione
let state = {
  token: localStorage.getItem('ts_token') || null,
  user: null,
  selectedYear: new Date().getFullYear(),
  selectedMonth: new Date().getMonth() + 1, // 1-12
  currentView: 'timesheet', // 'admin' o 'timesheet'
  inspectionUserId: null,   // se l'admin sta guardando un dipendente
  inspectionUser: null,
  timesheetData: null,
  isEffectivelyLocked: false,
  canEdit: true,
  editingExpenseDay: null
};

// Inizializzazione al caricamento
document.addEventListener('DOMContentLoaded', async () => {
  initDateSelectors();
  if (state.token) {
    await checkCurrentUser();
  } else {
    showAuthView();
  }
  lucide.createIcons();
});

// Toast Notifiche
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  
  let bg = 'bg-slate-800 text-white';
  let icon = 'info';
  if (type === 'success') {
    bg = 'bg-emerald-600 text-white';
    icon = 'check-circle';
  } else if (type === 'error') {
    bg = 'bg-rose-600 text-white';
    icon = 'alert-triangle';
  }

  toast.className = `${bg} px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2.5 transition-all transform translate-y-2 opacity-0 pointer-events-auto`;
  toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 flex-shrink-0"></i><span>${message}</span>`;

  container.appendChild(toast);
  lucide.createIcons({ root: toast });

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Inizializza i menu a tendina delle date
function initDateSelectors() {
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

  const adminMonthSel = document.getElementById('admin-month-select');
  const adminYearSel = document.getElementById('admin-year-select');
  const tsMonthSel = document.getElementById('timesheet-month-select');
  const tsYearSel = document.getElementById('timesheet-year-select');

  const populateSelects = (mSel, ySel) => {
    mSel.innerHTML = MONTH_NAMES.map((m, idx) => `<option value="${idx + 1}" ${idx + 1 === state.selectedMonth ? 'selected' : ''}>${m}</option>`).join('');
    ySel.innerHTML = yearOptions.map(y => `<option value="${y}" ${y === state.selectedYear ? 'selected' : ''}>${y}</option>`).join('');
  };

  populateSelects(adminMonthSel, adminYearSel);
  populateSelects(tsMonthSel, tsYearSel);
}

// Verifica token utente
async function checkCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (res.ok) {
      const data = await res.json();
      state.user = data.user;
      renderAppView();
    } else {
      logout();
    }
  } catch (err) {
    console.error('Errore verifica sessione:', err);
    logout();
  }
}

// Gestione Schermate
function showAuthView() {
  document.getElementById('auth-view').classList.remove('hidden');
  document.getElementById('app-view').classList.add('hidden');
  renderNavbar();
}

function renderAppView() {
  document.getElementById('auth-view').classList.add('hidden');
  document.getElementById('app-view').classList.remove('hidden');
  renderNavbar();

  if (state.user.role === 'admin') {
    document.getElementById('admin-view-switcher').classList.remove('hidden');
    if (!state.inspectionUserId && !state.hasManuallySwitchedView) {
      switchMainView('admin');
    } else {
      switchMainView(state.currentView);
    }
  } else {
    document.getElementById('admin-view-switcher').classList.add('hidden');
    switchMainView('timesheet');
  }
}

function renderNavbar() {
  const area = document.getElementById('nav-user-area');
  if (!state.user) {
    area.innerHTML = '';
    return;
  }

  const roleBadge = state.user.role === 'admin'
    ? '<span class="bg-amber-100 text-amber-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-amber-200">Admin</span>'
    : '<span class="bg-blue-100 text-blue-800 text-xs font-semibold px-2 py-0.5 rounded-full border border-blue-200">Dipendente</span>';

  area.innerHTML = `
    <div class="flex items-center gap-2 text-sm text-slate-700">
      <div class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs">
        ${state.user.name.charAt(0)}${state.user.surname.charAt(0)}
      </div>
      <div class="hidden sm:block text-left">
        <p class="font-semibold text-xs text-slate-900 leading-tight">${state.user.name} ${state.user.surname}</p>
        <p class="text-[11px] text-slate-500">${state.user.email}</p>
      </div>
      ${roleBadge}
    </div>
    <button onclick="logout()" class="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition" title="Disconnettiti">
      <i data-lucide="log-out" class="w-5 h-5"></i>
    </button>
  `;
  lucide.createIcons({ root: area });
}

// Navigazione tra Dashboard Admin e Timesheet
function switchMainView(view) {
  state.currentView = view;
  const btnAdmin = document.getElementById('btn-view-admin');
  const btnTs = document.getElementById('btn-view-timesheet');
  const adminContainer = document.getElementById('admin-dashboard-container');
  const tsContainer = document.getElementById('timesheet-view-container');

  if (view === 'admin') {
    btnAdmin.className = 'flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-brand-700 flex items-center justify-center gap-2 transition';
    btnTs.className = 'flex-1 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center gap-2 transition';
    adminContainer.classList.remove('hidden');
    tsContainer.classList.add('hidden');
    loadAdminOverview();
  } else {
    btnTs.className = 'flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow-sm text-brand-700 flex items-center justify-center gap-2 transition';
    btnAdmin.className = 'flex-1 py-2 text-sm font-medium rounded-lg text-slate-600 hover:text-slate-900 flex items-center justify-center gap-2 transition';
    adminContainer.classList.add('hidden');
    tsContainer.classList.remove('hidden');
    loadTimesheetData();
  }
  lucide.createIcons();
}

// Gestione Tab Login / Register
let currentAuthTab = 'login';
function switchAuthTab(tab) {
  currentAuthTab = tab;
  const btnLogin = document.getElementById('tab-login');
  const btnReg = document.getElementById('tab-register');
  const nameFields = document.getElementById('field-name-container');
  const authTitle = document.getElementById('auth-title');
  const authSub = document.getElementById('auth-subtitle');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (tab === 'login') {
    btnLogin.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 flex items-center justify-center gap-2';
    btnReg.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2';
    nameFields.classList.add('hidden');
    nameFields.classList.remove('grid');
    authTitle.textContent = 'Accedi a GF REPORT';
    authSub.textContent = 'Inserisci le tue credenziali per compilare le tue ore';
    submitBtn.innerHTML = `<span>Accedi</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
  } else {
    btnReg.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-brand-600 text-brand-600 flex items-center justify-center gap-2';
    btnLogin.className = 'flex-1 pb-3 text-sm font-semibold border-b-2 border-transparent text-slate-500 hover:text-slate-700 flex items-center justify-center gap-2';
    nameFields.classList.remove('hidden');
    nameFields.classList.add('grid');
    authTitle.textContent = 'Crea nuovo account Dipendente';
    authSub.textContent = 'Registrati inserendo i tuoi dati aziendali';
    submitBtn.innerHTML = `<span>Crea Account</span><i data-lucide="arrow-right" class="w-4 h-4"></i>`;
  }
  lucide.createIcons();
}

function fillAdminCredentials() {
  switchAuthTab('login');
  document.getElementById('auth-email').value = 'admin@azienda.it';
  document.getElementById('auth-password').value = 'admin2026';
  showToast('Credenziali Admin precompilate! Clicca "Accedi".', 'info');
}

async function handleAuthSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;

  const endpoint = currentAuthTab === 'login' ? '/auth/login' : '/auth/register';
  const payload = { email, password };

  if (currentAuthTab === 'register') {
    payload.name = document.getElementById('auth-name').value.trim();
    payload.surname = document.getElementById('auth-surname').value.trim();
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || 'Errore durante l\'autenticazione.', 'error');
      return;
    }

    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('ts_token', data.token);

    showToast(`Benvenuto in GF REPORT, ${state.user.name}!`, 'success');
    renderAppView();
  } catch (err) {
    showToast('Impossibile contattare il server.', 'error');
  }
}

function logout() {
  state.token = null;
  state.user = null;
  state.inspectionUserId = null;
  state.inspectionUser = null;
  localStorage.removeItem('ts_token');
  showAuthView();
  showToast('Disconnessione effettuata.', 'info');
}

// ==========================================
// LOGICA DASHBOARD AMMINISTRATORE
// ==========================================

async function loadAdminOverview() {
  const m = parseInt(document.getElementById('admin-month-select').value);
  const y = parseInt(document.getElementById('admin-year-select').value);

  try {
    const res = await fetch(`${API_BASE}/admin/overview/${y}/${m}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) {
      throw new Error('Errore caricamento panoramica admin');
    }

    const data = await res.json();
    renderAdminOverview(data);
  } catch (err) {
    showToast('Errore durante il recupero dei dati aziendali.', 'error');
  }
}

function renderAdminOverview(data) {
  // Aggiorna KPI con Ferie e Malattia
  document.getElementById('kpi-admin-employees').textContent = data.stats.totalEmployees;
  document.getElementById('kpi-admin-ord').textContent = `${data.stats.totalCompanyOrdinary.toFixed(1)} h`;
  document.getElementById('kpi-admin-str').textContent = `${data.stats.totalCompanyOvertime.toFixed(1)} h`;
  document.getElementById('kpi-admin-viag').textContent = `${data.stats.totalCompanyTravel.toFixed(1)} h`;
  document.getElementById('kpi-admin-ferie').textContent = `${data.stats.totalCompanyFerie.toFixed(1)} h`;
  document.getElementById('kpi-admin-mal').textContent = `${data.stats.totalCompanyMalattia.toFixed(1)} h`;
  document.getElementById('kpi-admin-spese').textContent = `€ ${data.stats.totalCompanyExpenses.toFixed(2)}`;

  const tbody = document.getElementById('admin-employees-tbody');
  if (data.employees.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="text-center py-8 text-slate-400">Nessun dipendente registrato nell'applicazione.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.employees.map(item => {
    const { user, totals, isLocked } = item;
    const statusBadge = isLocked
      ? `<span class="bg-emerald-100 text-emerald-800 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-200 flex items-center justify-center gap-1 w-fit mx-auto"><i data-lucide="lock" class="w-3 h-3"></i> Confermato</span>`
      : `<span class="bg-amber-100 text-amber-800 text-xs px-2.5 py-1 rounded-full font-semibold border border-amber-200 flex items-center justify-center gap-1 w-fit mx-auto"><i data-lucide="edit-3" class="w-3 h-3"></i> In compilazione</span>`;

    const isUserActive = user.isActive !== false;
    const activeStatusBadge = isUserActive
      ? ''
      : `<span class="bg-rose-100 text-rose-700 text-[10px] px-1.5 py-0.5 rounded font-semibold border border-rose-200">Ex dipendente</span>`;

    const lockActionBtn = isLocked
      ? `<button onclick="toggleEmployeeLock('${user.id}', false)" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium flex items-center gap-1" title="Sblocca per modifiche"><i data-lucide="unlock" class="w-3.5 h-3.5 text-amber-600"></i> Sblocca</button>`
      : `<button onclick="toggleEmployeeLock('${user.id}', true)" class="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg border border-slate-300 font-medium flex items-center gap-1" title="Blocca mese"><i data-lucide="lock" class="w-3.5 h-3.5 text-slate-600"></i> Blocca</button>`;

    return `
      <tr class="hover:bg-slate-50 transition-colors ${!isUserActive ? 'opacity-60 bg-slate-50/50' : ''}">
        <td class="py-3 px-4 cursor-pointer group" onclick="inspectEmployeeSheet('${user.id}', '${user.name} ${user.surname}')" title="Clicca sul nome per aprire il foglio presenze">
          <div class="flex items-center gap-1.5">
            <p class="font-bold text-slate-900 group-hover:text-brand-600 transition flex items-center gap-1 underline-offset-2 group-hover:underline">
              ${user.surname} ${user.name}
              <i data-lucide="calendar" class="w-3.5 h-3.5 text-brand-500 opacity-70 group-hover:opacity-100"></i>
            </p>
            ${activeStatusBadge}
          </div>
          <p class="text-xs text-slate-500">${user.email}</p>
        </td>
        <td class="py-3 px-3 text-right font-semibold text-slate-800">${totals.ordinaryHours > 0 ? totals.ordinaryHours.toFixed(1) : '-'}</td>
        <td class="py-3 px-3 text-right font-semibold text-amber-600">${totals.overtimeHours > 0 ? totals.overtimeHours.toFixed(1) : '-'}</td>
        <td class="py-3 px-3 text-right font-semibold text-indigo-600">${totals.travelHours > 0 ? totals.travelHours.toFixed(1) : '-'}</td>
        <td class="py-3 px-3 text-right font-semibold text-teal-700">${totals.ferieHours > 0 ? totals.ferieHours.toFixed(1) : '-'}</td>
        <td class="py-3 px-3 text-right font-semibold text-rose-700">${totals.malattiaHours > 0 ? totals.malattiaHours.toFixed(1) : '-'}</td>
        <td class="py-3 px-3 text-center text-xs font-medium text-violet-700">${totals.onCallDays > 0 ? `${totals.onCallDays} gg` : '-'}</td>
        <td class="py-3 px-3 text-right font-bold text-emerald-700">${totals.expenses > 0 ? `€ ${totals.expenses.toFixed(2)}` : '-'}</td>
        <td class="py-3 px-3 text-center">${statusBadge}</td>
        <td class="py-3 px-4">
          <div class="flex items-center justify-center gap-1.5">
            <button onclick="inspectEmployeeSheet('${user.id}', '${user.name} ${user.surname}')" class="text-xs bg-brand-600 hover:bg-brand-700 text-white font-semibold px-3 py-1.5 rounded-lg shadow-sm flex items-center gap-1.5 transition" title="Apri e compila/visualizza il foglio presenze dettagliato">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> Apri Foglio
            </button>
            ${lockActionBtn}
            <button onclick="downloadEmployeeExport('${user.id}', 'excel')" class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Scarica Excel">
              <i data-lucide="file-spreadsheet" class="w-3.5 h-3.5 text-emerald-600"></i>
            </button>
            <button onclick="downloadEmployeeExport('${user.id}', 'pdf')" class="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100" title="Scarica PDF">
              <i data-lucide="file-text" class="w-3.5 h-3.5 text-rose-600"></i>
            </button>
            <button onclick="toggleEmployeeActive('${user.id}', ${!isUserActive})" class="p-1.5 rounded-lg border border-slate-200 ${isUserActive ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}" title="${isUserActive ? 'Disattiva account (es. dipendente licenziato)' : 'Riattiva account'}">
              <i data-lucide="${isUserActive ? 'user-x' : 'user-check'}" class="w-3.5 h-3.5"></i>
            </button>
            <button onclick="deleteEmployee('${user.id}', '${user.name} ${user.surname}')" class="p-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50" title="Elimina definitivamente">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  lucide.createIcons({ root: tbody });
}

function scrollToEmployeesTable() {
  const el = document.getElementById('admin-employees-section');
  if (el) {
    el.scrollIntoView({ behavior: 'smooth' });
    el.classList.add('ring-2', 'ring-brand-500');
    setTimeout(() => el.classList.remove('ring-2', 'ring-brand-500'), 1500);
  }
}

async function toggleEmployeeActive(userId, newActiveState) {
  const actionText = newActiveState ? 'riattivare' : 'disattivare';
  const confirmMsg = confirm(`Sei sicuro di voler ${actionText} questo dipendente?\n\n${newActiveState ? 'Il dipendente potrà accedere nuovamente.' : 'Il dipendente non potrà più effettuare il login, ma lo storico dei suoi mesi precedenti rimarrà conservato.'}`);
  if (!confirmMsg) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}/toggle-active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ isActive: newActiveState })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      loadAdminOverview();
    } else {
      showToast(data.error || 'Errore operazione.', 'error');
    }
  } catch (err) {
    showToast('Errore durante la modifica dello stato utente.', 'error');
  }
}

async function deleteEmployee(userId, userName) {
  const confirmMsg = confirm(
    `⚠️ ATTENZIONE: ELIMINAZIONE DEFINITIVA\n\n` +
    `Sei sicuro di voler cancellare definitivamente ${userName}?\n\n` +
    `Questa azione è irreversibile ed eliminerà sia l'account che tutti i fogli presenze associati.`
  );
  if (!confirmMsg) return;

  try {
    const res = await fetch(`${API_BASE}/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      loadAdminOverview();
    } else {
      showToast(data.error || 'Errore eliminazione.', 'error');
    }
  } catch (err) {
    showToast('Impossibile eliminare il dipendente.', 'error');
  }
}

// Gestione Modale Aggiunta Dipendente (Admin)
function openAddEmployeeModal() {
  document.getElementById('new-emp-name').value = '';
  document.getElementById('new-emp-surname').value = '';
  document.getElementById('new-emp-email').value = '';
  document.getElementById('new-emp-password').value = 'password123';
  const modal = document.getElementById('add-employee-modal');
  modal.showModal();
  lucide.createIcons({ root: modal });
}

function closeAddEmployeeModal() {
  document.getElementById('add-employee-modal').close();
}

async function handleCreateEmployee(e) {
  e.preventDefault();
  const name = document.getElementById('new-emp-name').value.trim();
  const surname = document.getElementById('new-emp-surname').value.trim();
  const email = document.getElementById('new-emp-email').value.trim();
  const password = document.getElementById('new-emp-password').value;

  try {
    const res = await fetch(`${API_BASE}/admin/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ name, surname, email, password })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      closeAddEmployeeModal();
      loadAdminOverview();
    } else {
      showToast(data.error || 'Errore creazione dipendente.', 'error');
    }
  } catch (err) {
    showToast('Impossibile contattare il server.', 'error');
  }
}

async function toggleEmployeeLock(userId, lockState) {
  const m = parseInt(document.getElementById('admin-month-select').value);
  const y = parseInt(document.getElementById('admin-year-select').value);

  try {
    const res = await fetch(`${API_BASE}/admin/toggle-lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ userId, year: y, month: m, isLocked: lockState })
    });

    const data = await res.json();
    if (res.ok) {
      showToast(data.message, 'success');
      loadAdminOverview();
    } else {
      showToast(data.error, 'error');
    }
  } catch (err) {
    showToast('Errore durante il cambio di stato del mese.', 'error');
  }
}

function inspectEmployeeSheet(userId, userName) {
  state.inspectionUserId = userId;
  state.inspectionUser = userName;

  const m = parseInt(document.getElementById('admin-month-select').value);
  const y = parseInt(document.getElementById('admin-year-select').value);

  state.selectedMonth = m;
  state.selectedYear = y;

  document.getElementById('timesheet-month-select').value = m;
  document.getElementById('timesheet-year-select').value = y;

  document.getElementById('inspection-banner').classList.remove('hidden');
  document.getElementById('inspection-user-name').textContent = userName;

  switchMainView('timesheet');
}

function exitInspectionMode() {
  state.inspectionUserId = null;
  state.inspectionUser = null;
  document.getElementById('inspection-banner').classList.add('hidden');
  switchMainView('admin');
}

// ==========================================
// LOGICA COMPILAZIONE FOGLIO ORE (TIMESHEET)
// ==========================================

function changeMonth(delta) {
  let m = state.selectedMonth + delta;
  let y = state.selectedYear;

  if (m < 1) {
    m = 12;
    y -= 1;
  } else if (m > 12) {
    m = 1;
    y += 1;
  }

  state.selectedMonth = m;
  state.selectedYear = y;

  document.getElementById('timesheet-month-select').value = m;
  document.getElementById('timesheet-year-select').value = y;

  loadTimesheetData();
}

function onTimesheetDateChange() {
  state.selectedMonth = parseInt(document.getElementById('timesheet-month-select').value);
  state.selectedYear = parseInt(document.getElementById('timesheet-year-select').value);
  loadTimesheetData();
}

async function loadTimesheetData() {
  const targetUserParam = state.inspectionUserId ? `?userId=${state.inspectionUserId}` : '';

  try {
    const res = await fetch(`${API_BASE}/timesheets/${state.selectedYear}/${state.selectedMonth}${targetUserParam}`, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) {
      throw new Error('Errore recupero foglio ore');
    }

    const data = await res.json();
    state.timesheetData = data.timesheet;
    state.isEffectivelyLocked = data.isEffectivelyLocked;
    state.canEdit = data.canEdit;

    renderTimesheetStatusBadge(data);
    renderTimesheetGrid();
    renderOnCallWeeks();
    calculateAndRenderTotals();
  } catch (err) {
    showToast('Errore durante il caricamento del foglio presenze.', 'error');
  }
}

function renderTimesheetStatusBadge(data) {
  const badge = document.getElementById('timesheet-status-badge');
  const btnSave = document.getElementById('btn-save-draft');
  const btnLock = document.getElementById('btn-lock-month');
  const helperActions = document.getElementById('ts-helper-actions');
  const btnAddOnCall = document.getElementById('btn-add-oncall');

  if (data.canEdit) {
    badge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200';
    badge.innerHTML = `<i data-lucide="check-circle" class="w-3.5 h-3.5 text-emerald-600"></i> Aperto alle modifiche (fino a fine mese)`;
    btnSave.classList.remove('hidden');
    btnLock.classList.remove('hidden');
    helperActions.classList.remove('hidden');
    btnAddOnCall.classList.remove('hidden');
  } else {
    badge.className = 'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-800 border border-slate-300';
    badge.innerHTML = `<i data-lucide="lock" class="w-3.5 h-3.5 text-slate-600"></i> Mese Concluso / Bloccato`;
    btnSave.classList.add('hidden');
    btnLock.classList.add('hidden');
    helperActions.classList.add('hidden');
    btnAddOnCall.classList.add('hidden');
  }

  lucide.createIcons({ root: badge });
}

function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function renderTimesheetGrid() {
  const tbody = document.getElementById('timesheet-days-tbody');
  const numDays = getDaysInMonth(state.selectedYear, state.selectedMonth);
  const daysData = state.timesheetData.days || {};
  const disabledAttr = state.canEdit ? '' : 'disabled';

  let html = '';

  for (let d = 1; d <= numDays; d++) {
    const curDate = new Date(state.selectedYear, state.selectedMonth - 1, d);
    const dayOfWeek = curDate.getDay();
    const dayName = DAY_NAMES[dayOfWeek];
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const dayInfo = daysData[d] || {};
    const ord = dayInfo.ordinaryHours !== undefined ? dayInfo.ordinaryHours : '';
    const str = dayInfo.overtimeHours !== undefined ? dayInfo.overtimeHours : '';
    const viag = dayInfo.travelHours !== undefined ? dayInfo.travelHours : '';
    const ferie = dayInfo.ferieHours !== undefined ? dayInfo.ferieHours : '';
    const mal = dayInfo.malattiaHours !== undefined ? dayInfo.malattiaHours : '';
    const onCall = Boolean(dayInfo.onCall);
    const notes = dayInfo.notes || '';

    // Calcolo spesa totale del giorno
    let dayExpenseAmount = 0;
    if (Array.isArray(dayInfo.expenses)) {
      dayInfo.expenses.forEach(e => {
        dayExpenseAmount += parseFloat(e.amount) || 0;
      });
    } else if (dayInfo.expenseAmount) {
      dayExpenseAmount = parseFloat(dayInfo.expenseAmount) || 0;
    }

    const weekendClass = isWeekend ? 'weekend-row bg-slate-50/70' : 'bg-white';
    const dayBadgeClass = isWeekend ? 'text-slate-400 font-medium' : 'text-slate-900 font-bold';

    html += `
      <tr class="${weekendClass} hover:bg-brand-50/30 transition-colors" data-day="${d}">
        
        <!-- Colonna Giorno -->
        <td class="py-2.5 px-2 text-center border-r border-slate-100">
          <span class="${dayBadgeClass} text-sm">${d}</span>
          <span class="block text-[11px] text-slate-400 uppercase font-semibold">${dayName}</span>
        </td>

        <!-- Ore Ordinarie -->
        <td class="py-2 px-1.5 text-center">
          <input type="number" step="0.5" min="0" max="24" value="${ord}" ${disabledAttr}
            onchange="onDayInputChange(${d}, 'ordinaryHours', this.value)"
            class="w-16 px-1.5 py-1.5 text-center text-sm font-semibold rounded-lg border border-slate-300 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="0">
        </td>

        <!-- Ore Straordinarie -->
        <td class="py-2 px-1.5 text-center">
          <input type="number" step="0.5" min="0" max="24" value="${str}" ${disabledAttr}
            onchange="onDayInputChange(${d}, 'overtimeHours', this.value)"
            class="w-16 px-1.5 py-1.5 text-center text-sm font-semibold text-amber-700 rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="0">
        </td>

        <!-- Ore Viaggio -->
        <td class="py-2 px-1.5 text-center">
          <input type="number" step="0.5" min="0" max="24" value="${viag}" ${disabledAttr}
            onchange="onDayInputChange(${d}, 'travelHours', this.value)"
            class="w-16 px-1.5 py-1.5 text-center text-sm font-semibold text-indigo-700 rounded-lg border border-slate-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="0">
        </td>

        <!-- Ore Ferie -->
        <td class="py-2 px-1.5 text-center">
          <input type="number" step="0.5" min="0" max="24" value="${ferie}" ${disabledAttr}
            onchange="onDayInputChange(${d}, 'ferieHours', this.value)"
            class="w-16 px-1.5 py-1.5 text-center text-sm font-semibold text-teal-700 rounded-lg border border-slate-300 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="0">
        </td>

        <!-- Ore Malattia -->
        <td class="py-2 px-1.5 text-center">
          <input type="number" step="0.5" min="0" max="24" value="${mal}" ${disabledAttr}
            onchange="onDayInputChange(${d}, 'malattiaHours', this.value)"
            class="w-16 px-1.5 py-1.5 text-center text-sm font-semibold text-rose-700 rounded-lg border border-slate-300 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
            placeholder="0">
        </td>

        <!-- Reperibilità Checkbox -->
        <td class="py-2 px-1.5 text-center">
          <label class="inline-flex items-center cursor-pointer">
            <input type="checkbox" ${onCall ? 'checked' : ''} ${disabledAttr}
              onchange="onDayInputChange(${d}, 'onCall', this.checked)"
              class="w-4 h-4 text-violet-600 rounded border-slate-300 focus:ring-violet-500 disabled:opacity-50">
          </label>
        </td>

        <!-- Rimborsi Spese -->
        <td class="py-2 px-1.5 text-center">
          <button onclick="openExpenseModal(${d})" type="button" class="w-full text-xs font-semibold px-2 py-1.5 rounded-lg border transition flex items-center justify-between gap-1 ${dayExpenseAmount > 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'}">
            <span>${dayExpenseAmount > 0 ? `€ ${dayExpenseAmount.toFixed(2)}` : '+ Spesa'}</span>
            <i data-lucide="receipt" class="w-3 h-3"></i>
          </button>
        </td>

        <!-- Note / Commessa / Cantiere -->
        <td class="py-2 px-2">
          <input type="text" value="${notes}" ${disabledAttr}
            onchange="onDayInputChange(${d}, 'notes', this.value)"
            class="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-slate-700 disabled:bg-slate-100 disabled:text-slate-400"
            placeholder="Cantiere, cliente o note...">
        </td>

      </tr>
    `;
  }

  tbody.innerHTML = html;
  lucide.createIcons({ root: tbody });
}

function onDayInputChange(day, field, value) {
  if (!state.timesheetData.days) {
    state.timesheetData.days = {};
  }
  if (!state.timesheetData.days[day]) {
    state.timesheetData.days[day] = {};
  }

  if (field === 'onCall') {
    state.timesheetData.days[day].onCall = Boolean(value);
  } else if (field === 'notes') {
    state.timesheetData.days[day].notes = value;
  } else {
    const num = parseFloat(value);
    state.timesheetData.days[day][field] = isNaN(num) ? '' : num;
  }

  calculateAndRenderTotals();
}

function calculateAndRenderTotals() {
  const daysData = state.timesheetData.days || {};
  let totOrd = 0;
  let totStr = 0;
  let totViag = 0;
  let totFerie = 0;
  let totMal = 0;
  let totRep = 0;
  let totSpese = 0;

  Object.values(daysData).forEach(d => {
    totOrd += parseFloat(d.ordinaryHours) || 0;
    totStr += parseFloat(d.overtimeHours) || 0;
    totViag += parseFloat(d.travelHours) || 0;
    totFerie += parseFloat(d.ferieHours) || 0;
    totMal += parseFloat(d.malattiaHours) || 0;
    if (d.onCall) totRep++;

    if (Array.isArray(d.expenses)) {
      d.expenses.forEach(e => {
        totSpese += parseFloat(e.amount) || 0;
      });
    } else if (d.expenseAmount) {
      totSpese += parseFloat(d.expenseAmount) || 0;
    }
  });

  document.getElementById('kpi-ts-ord').textContent = `${totOrd.toFixed(1)} h`;
  document.getElementById('kpi-ts-str').textContent = `${totStr.toFixed(1)} h`;
  document.getElementById('kpi-ts-viag').textContent = `${totViag.toFixed(1)} h`;
  document.getElementById('kpi-ts-ferie').textContent = `${totFerie.toFixed(1)} h`;
  document.getElementById('kpi-ts-mal').textContent = `${totMal.toFixed(1)} h`;
  document.getElementById('kpi-ts-rep').textContent = `${totRep} gg`;
  document.getElementById('kpi-ts-spese').textContent = `€ ${totSpese.toFixed(2)}`;
}

// Precompilazione automatica 8h per i giorni feriali (Lun-Ven)
function autofillStandardWorkdays() {
  if (!state.canEdit) return;
  const numDays = getDaysInMonth(state.selectedYear, state.selectedMonth);

  if (!state.timesheetData.days) {
    state.timesheetData.days = {};
  }

  for (let d = 1; d <= numDays; d++) {
    const curDate = new Date(state.selectedYear, state.selectedMonth - 1, d);
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      if (!state.timesheetData.days[d]) {
        state.timesheetData.days[d] = {};
      }
      if (!state.timesheetData.days[d].ordinaryHours && !state.timesheetData.days[d].ferieHours && !state.timesheetData.days[d].malattiaHours) {
        state.timesheetData.days[d].ordinaryHours = 8;
      }
    }
  }

  renderTimesheetGrid();
  calculateAndRenderTotals();
  showToast('Impostate 8 ore per tutti i giorni feriali!', 'info');
}

// ==========================================
// GESTIONE MODALE RIMBORSI SPESE
// ==========================================

function openExpenseModal(day) {
  state.editingExpenseDay = day;
  document.getElementById('modal-expense-day').textContent = `${day}/${state.selectedMonth}/${state.selectedYear}`;

  const dayInfo = (state.timesheetData.days && state.timesheetData.days[day]) || {};
  let amount = '';
  let desc = '';

  if (Array.isArray(dayInfo.expenses) && dayInfo.expenses.length > 0) {
    amount = dayInfo.expenses[0].amount || '';
    desc = dayInfo.expenses[0].description || '';
  } else if (dayInfo.expenseAmount) {
    amount = dayInfo.expenseAmount;
    desc = dayInfo.expenseDescription || '';
  }

  document.getElementById('modal-expense-amount').value = amount;
  document.getElementById('modal-expense-desc').value = desc;

  document.getElementById('modal-expense-amount').disabled = !state.canEdit;
  document.getElementById('modal-expense-desc').disabled = !state.canEdit;

  const modal = document.getElementById('expense-modal');
  modal.showModal();
  lucide.createIcons({ root: modal });
}

function closeExpenseModal() {
  document.getElementById('expense-modal').close();
  state.editingExpenseDay = null;
}

function saveExpenseModal() {
  if (!state.canEdit) return closeExpenseModal();

  const day = state.editingExpenseDay;
  const amount = parseFloat(document.getElementById('modal-expense-amount').value) || 0;
  const desc = document.getElementById('modal-expense-desc').value.trim();

  if (!state.timesheetData.days) state.timesheetData.days = {};
  if (!state.timesheetData.days[day]) state.timesheetData.days[day] = {};

  if (amount > 0) {
    state.timesheetData.days[day].expenses = [{ amount, description: desc }];
    state.timesheetData.days[day].expenseAmount = amount;
    state.timesheetData.days[day].expenseDescription = desc;
  } else {
    delete state.timesheetData.days[day].expenses;
    delete state.timesheetData.days[day].expenseAmount;
    delete state.timesheetData.days[day].expenseDescription;
  }

  renderTimesheetGrid();
  calculateAndRenderTotals();
  closeExpenseModal();
  showToast(`Spese salvate per il giorno ${day}!`, 'success');
}

// ==========================================
// GESTIONE SETTIMANE DI REPERIBILITÀ
// ==========================================

function openAddOnCallModal() {
  document.getElementById('modal-oncall-start').value = '';
  document.getElementById('modal-oncall-end').value = '';
  document.getElementById('modal-oncall-notes').value = '';
  const modal = document.getElementById('oncall-modal');
  modal.showModal();
  lucide.createIcons({ root: modal });
}

function closeOnCallModal() {
  document.getElementById('oncall-modal').close();
}

function saveOnCallPeriod() {
  const startDate = document.getElementById('modal-oncall-start').value;
  const endDate = document.getElementById('modal-oncall-end').value;
  const notes = document.getElementById('modal-oncall-notes').value.trim();

  if (!startDate || !endDate) {
    showToast('Inserisci sia la data di inizio che di fine.', 'error');
    return;
  }

  if (!state.timesheetData.onCallWeeks) {
    state.timesheetData.onCallWeeks = [];
  }

  state.timesheetData.onCallWeeks.push({
    id: 'oc_' + Date.now(),
    startDate,
    endDate,
    notes
  });

  renderOnCallWeeks();
  closeOnCallModal();
  showToast('Settimana di reperibilità aggiunta!', 'success');
}

function removeOnCallWeek(index) {
  if (!state.canEdit) return;
  state.timesheetData.onCallWeeks.splice(index, 1);
  renderOnCallWeeks();
  showToast('Periodo di reperibilità rimosso.', 'info');
}

function renderOnCallWeeks() {
  const container = document.getElementById('oncall-weeks-list');
  const weeks = state.timesheetData.onCallWeeks || [];

  if (weeks.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">Nessun periodo di reperibilità inserito per questo mese.</p>`;
    return;
  }

  container.innerHTML = weeks.map((w, idx) => `
    <div class="inline-flex items-center gap-2 bg-violet-50 border border-violet-200 text-violet-800 text-xs px-3 py-1.5 rounded-xl font-medium">
      <i data-lucide="calendar" class="w-3.5 h-3.5 text-violet-600"></i>
      <span>Dal <strong>${w.startDate}</strong> al <strong>${w.endDate}</strong> ${w.notes ? `(${w.notes})` : ''}</span>
      ${state.canEdit ? `<button onclick="removeOnCallWeek(${idx})" class="text-violet-400 hover:text-rose-600 transition ml-1" title="Rimuovi"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>` : ''}
    </div>
  `).join('');

  lucide.createIcons({ root: container });
}

// ==========================================
// SALVATAGGIO BOZZE E BLOCCO MESE
// ==========================================

async function saveTimesheetDraft() {
  const targetUser = state.inspectionUserId || state.user.id;

  try {
    const res = await fetch(`${API_BASE}/timesheets/${state.selectedYear}/${state.selectedMonth}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({
        userId: targetUser,
        days: state.timesheetData.days || {},
        onCallWeeks: state.timesheetData.onCallWeeks || [],
        notes: state.timesheetData.notes || ''
      })
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Foglio presenze salvato con successo!', 'success');
    } else {
      showToast(data.error || 'Errore salvataggio.', 'error');
    }
  } catch (err) {
    showToast('Impossibile salvare il foglio presenze.', 'error');
  }
}

async function lockTimesheetMonth() {
  const confirmMsg = confirm(
    'Sei sicuro di voler bloccare e confermare il foglio di questo mese?\n\n' +
    'Una volta confermato, non potrai più apportare modifiche a meno che l\'amministratore non lo sblocchi.'
  );

  if (!confirmMsg) return;

  await saveTimesheetDraft();

  const targetUser = state.inspectionUserId || state.user.id;

  try {
    const res = await fetch(`${API_BASE}/timesheets/${state.selectedYear}/${state.selectedMonth}/lock`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${state.token}`
      },
      body: JSON.stringify({ userId: targetUser })
    });

    const data = await res.json();
    if (res.ok) {
      showToast('Mese bloccato e confermato con successo!', 'success');
      loadTimesheetData();
    } else {
      showToast(data.error || 'Errore blocco mese.', 'error');
    }
  } catch (err) {
    showToast('Impossibile bloccare il mese.', 'error');
  }
}

// ==========================================
// ESPORTAZIONI EXCEL E PDF
// ==========================================

function exportCurrentTimesheet(format) {
  const targetUser = state.inspectionUserId || state.user.id;
  const endpoint = format === 'excel'
    ? `${API_BASE}/export/excel/employee?userId=${targetUser}&year=${state.selectedYear}&month=${state.selectedMonth}`
    : `${API_BASE}/export/pdf/employee?userId=${targetUser}&year=${state.selectedYear}&month=${state.selectedMonth}`;

  downloadWithToken(endpoint);
}

function downloadEmployeeExport(userId, format) {
  const m = parseInt(document.getElementById('admin-month-select').value);
  const y = parseInt(document.getElementById('admin-year-select').value);

  const endpoint = format === 'excel'
    ? `${API_BASE}/export/excel/employee?userId=${userId}&year=${y}&month=${m}`
    : `${API_BASE}/export/pdf/employee?userId=${userId}&year=${y}&month=${m}`;

  downloadWithToken(endpoint);
}

function exportCompanyExcel() {
  const m = parseInt(document.getElementById('admin-month-select').value);
  const y = parseInt(document.getElementById('admin-year-select').value);

  const endpoint = `${API_BASE}/export/excel/company?year=${y}&month=${m}`;
  downloadWithToken(endpoint);
}

async function downloadWithToken(url) {
  try {
    showToast('Generazione del file in corso...', 'info');
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${state.token}` }
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'Errore durante la generazione del file.', 'error');
      return;
    }

    const disposition = res.headers.get('Content-Disposition');
    let filename = 'documento';
    if (disposition && disposition.indexOf('filename=') !== -1) {
      const matches = /filename="([^"]*)"/.exec(disposition);
      if (matches != null && matches[1]) filename = matches[1];
    }

    const blob = await res.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);

    showToast('File scaricato con successo!', 'success');
  } catch (err) {
    console.error(err);
    showToast('Errore durante il download.', 'error');
  }
}
