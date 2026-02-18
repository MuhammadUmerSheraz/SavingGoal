const STORAGE_KEY = 'saving-goals-data';
const CURRENCY_STORAGE_KEY = 'saving-goal-currency';

const state = { goals: [], currency: 'USD' };
const getDb = () => window.firebaseDb;
const getAuth = () => window.firebaseAuth;

function isFirebaseEnabled() {
  return getDb() && getAuth();
}

function getCurrency() {
  return state.currency || 'USD';
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatCurrency(amount) {
  const currency = getCurrency();
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatAmountInput(value) {
  const raw = String(value).replace(/,/g, '').trim();
  if (raw === '' || raw === '.') return '';
  const n = parseFloat(raw);
  if (!Number.isFinite(n) || n < 0) return '';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function parseAmountInput(value) {
  if (value == null || value === '') return NaN;
  return parseFloat(String(value).replace(/,/g, '')) || NaN;
}

function entrySortKey(entry) {
  if (entry.createdAt) return entry.createdAt;
  if (entry.date) return new Date(entry.date).getTime();
  return 0;
}

function sortEntries(entries, sortBy) {
  const list = [...(entries || [])];
  const key = sortBy || 'date_desc';
  list.sort((a, b) => {
    if (key === 'date_desc') return entrySortKey(b) - entrySortKey(a);
    if (key === 'date_asc') return entrySortKey(a) - entrySortKey(b);
    if (key === 'amount_desc') return (Number(b.amount) || 0) - (Number(a.amount) || 0);
    if (key === 'amount_asc') return (Number(a.amount) || 0) - (Number(b.amount) || 0);
    if (key === 'active_first') return (b.is_active ? 1 : 0) - (a.is_active ? 1 : 0);
    if (key === 'inactive_first') return (a.is_active ? 1 : 0) - (b.is_active ? 1 : 0);
    return 0;
  });
  return list;
}

function formatAmountDisplay(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n < 0) return '0';
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

function allowOnlyNumbersAndFormat(inputEl) {
  if (!inputEl) return;
  inputEl.addEventListener('input', function () {
    let v = this.value.replace(/,/g, '');
    const endsWithDot = v.endsWith('.');
    const hasDecimal = /\./.test(v);
    v = v.replace(/[^\d.]/g, '');
    if (hasDecimal) {
      const parts = v.split('.');
      if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
      if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
    }
    let out = formatAmountInput(v || '');
    if (endsWithDot && v && !out.endsWith('.')) out += '.';
    this.value = out;
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatEntryDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getProgress(goal) {
  const target = Number(goal.amount) || 0;
  let activeTotal = 0;
  let inactiveTotal = 0;

  (goal.entries || []).forEach((entry) => {
    const amount = Number(entry.amount) || 0;
    const value = entry.type === 'credit' ? amount : -amount;
    if (entry.is_active) {
      activeTotal += value;
    } else {
      inactiveTotal += value;
    }
  });

  const activePercent = target > 0 ? Math.min(100, (activeTotal / target) * 100) : 0;
  const inactivePercent =
    target > 0 ? Math.min(Math.max(0, 100 - activePercent), (inactiveTotal / target) * 100) : 0;

  return {
    activeTotal,
    inactiveTotal,
    total: activeTotal + inactiveTotal,
    target,
    activePercent,
    inactivePercent,
    activeLabel: `${formatCurrency(activeTotal)} active · ${formatCurrency(inactiveTotal)} inactive`,
  };
}

const CIRCLE_R = 52;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

function updateProgressCircle(section, progress) {
  const activeLen = (progress.activePercent / 100) * CIRCLE_CIRCUMFERENCE;
  const inactiveLen = (progress.inactivePercent / 100) * CIRCLE_CIRCUMFERENCE;
  const activeCircle = section.querySelector('.progress-circle-active');
  const inactiveCircle = section.querySelector('.progress-circle-inactive');
  if (activeCircle) {
    activeCircle.style.strokeDasharray = `${activeLen} ${CIRCLE_CIRCUMFERENCE}`;
    activeCircle.style.strokeDashoffset = '0';
  }
  if (inactiveCircle) {
    inactiveCircle.style.strokeDasharray = `${inactiveLen} ${CIRCLE_CIRCUMFERENCE}`;
    inactiveCircle.style.strokeDashoffset = `${-activeLen}`;
  }
  const centerPercent = section.querySelector('.progress-circle-percent');
  if (centerPercent) centerPercent.textContent = progress.activePercent.toFixed(0) + '%';
  const centerVal = section.querySelector('.progress-circle-value');
  if (centerVal) centerVal.textContent = formatCurrency(progress.target);
  const detail = section.querySelector('.progress-detail');
  if (detail) detail.textContent = progress.activeLabel;
  const activePercentEl = section.querySelector('.legend-active-percent');
  const inactivePercentEl = section.querySelector('.legend-inactive-percent');
  if (activePercentEl) activePercentEl.textContent = progress.activePercent.toFixed(1) + '%';
  if (inactivePercentEl) inactivePercentEl.textContent = progress.inactivePercent.toFixed(1) + '%';
}

function saveGoals(goals) {
  if (isFirebaseEnabled() && getAuth().currentUser) {
    const uid = getAuth().currentUser.uid;
    getDb().collection('users').doc(uid).set({ goals: goals || state.goals }).catch((err) => {
      console.error('Firebase save failed:', err);
      showMessage('Could not save. Check console.');
    });
  } else {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(goals || state.goals));
    } catch (e) {
      console.error('localStorage save failed:', e);
    }
  }
}

function renderGoals(goals) {
  const container = document.getElementById('goals-container');
  if (!container) return;

  const list = goals || state.goals;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-goals card">
        <p>No goals yet. Create your first saving goal above.</p>
      </div>
    `;
    return;
  }

  const template = document.getElementById('goal-card-template');
  if (!template) return;

  container.innerHTML = '';

  list.forEach((goal) => {
    const card = template.content.cloneNode(true);
    const article = card.querySelector('.goal-card');
    article.dataset.goalId = goal.id;

    article.querySelector('.goal-name').textContent = goal.name || 'Unnamed goal';
    article.querySelector('.goal-meta').textContent = `Target ${formatCurrency(goal.amount)} by ${formatDate(goal.endDate)}`;

    const progress = getProgress(goal);
    const progressSection = article.querySelector('.progress-section');
    updateProgressCircle(progressSection, progress);

    const entryForm = article.querySelector('.entry-form');
    const entriesList = article.querySelector('.entries-list');
    const entryTypeSelect = article.querySelector('.entry-type');
    const entryAmountInput = article.querySelector('.entry-amount');
    const entryNoteInput = article.querySelector('.entry-note-input');
    const sortSelect = article.querySelector('.entries-sort');

    goal.entrySort = goal.entrySort || 'date_desc';
    if (sortSelect) {
      sortSelect.value = goal.entrySort;
      sortSelect.addEventListener('change', () => {
        goal.entrySort = sortSelect.value;
        saveGoals(state.goals);
        renderEntries();
      });
    }

    function renderEntries() {
      entriesList.innerHTML = '';
      const sorted = sortEntries(goal.entries, goal.entrySort);
      sorted.forEach((entry) => {
        const li = document.createElement('li');
        li.className = `entry-item ${entry.is_active ? '' : 'inactive'}`;
        const amount = Number(entry.amount) || 0;
        const typeLabel = entry.type === 'credit' ? 'Credit' : 'Debit';
        const amountFormatted = (entry.type === 'credit' ? '+' : '') + formatCurrency(entry.type === 'debit' ? -amount : amount);
        const entryDateStr = entry.date ? formatEntryDate(entry.date) : (entry.createdAt ? formatEntryDate(new Date(entry.createdAt).toISOString().slice(0, 10)) : '');
        li.innerHTML = `
          <div class="entry-view">
            <div class="entry-view-row">
              <span class="entry-type-badge ${entry.type}">${typeLabel}</span>
              <span class="entry-amount ${entry.type}">${amountFormatted}</span>
              <span class="entry-date ${entryDateStr ? '' : 'entry-date-empty'}">${entryDateStr}</span>
              <div class="entry-actions">
                <button type="button" class="toggle-active ${entry.is_active ? 'active' : ''}">${entry.is_active ? 'Active' : 'Inactive'}</button>
                <button type="button" class="btn-edit-entry">Edit</button>
                <button type="button" class="btn-remove-entry" aria-label="Remove entry">&times;</button>
              </div>
            </div>
            <p class="entry-note"></p>
          </div>
          <div class="entry-edit">
            <div class="entry-edit-row entry-edit-row-main">
              <select class="edit-entry-type">
                <option value="credit" ${entry.type === 'credit' ? 'selected' : ''}>Credit</option>
                <option value="debit" ${entry.type === 'debit' ? 'selected' : ''}>Debit</option>
              </select>
              <input type="text" class="entry-edit-amount" inputmode="decimal" value="${formatAmountDisplay(amount)}" />
            </div>
            <div class="entry-edit-row entry-edit-row-note">
              <input type="text" class="edit-entry-note" placeholder="Note (optional)" maxlength="200" />
            </div>
            <div class="entry-edit-row entry-edit-row-actions">
              <button type="button" class="btn-save-entry">Save</button>
              <button type="button" class="btn-cancel-edit">Cancel</button>
            </div>
          </div>
        `;
        const noteEl = li.querySelector('.entry-note');
        if (noteEl) {
          noteEl.textContent = entry.note || '';
          noteEl.style.display = (entry.note || '').trim() ? '' : 'none';
        }

        const toggleBtn = li.querySelector('.toggle-active');
        const editBtn = li.querySelector('.btn-edit-entry');
        const removeBtn = li.querySelector('.btn-remove-entry');
        const saveBtn = li.querySelector('.btn-save-entry');
        const cancelBtn = li.querySelector('.btn-cancel-edit');
        const editTypeSelect = li.querySelector('.edit-entry-type');
        const editAmountInput = li.querySelector('.entry-edit-amount');
        const editNoteInput = li.querySelector('.edit-entry-note');
        if (editAmountInput) allowOnlyNumbersAndFormat(editAmountInput);

        toggleBtn.addEventListener('click', () => {
          entry.is_active = !entry.is_active;
          saveGoals(state.goals);
          renderGoals(state.goals);
        });
        editBtn.addEventListener('click', () => {
          li.classList.add('editing');
          editAmountInput.value = formatAmountDisplay(entry.amount);
          editTypeSelect.value = entry.type;
          editNoteInput.value = entry.note || '';
          editAmountInput.focus();
        });
        cancelBtn.addEventListener('click', () => {
          li.classList.remove('editing');
        });
        saveBtn.addEventListener('click', () => {
          const newAmount = parseAmountInput(editAmountInput.value);
          const newType = editTypeSelect.value;
          const newNote = (editNoteInput.value || '').trim();
          if (Number.isFinite(newAmount) && newAmount >= 0) {
            entry.amount = newAmount;
            entry.type = newType;
            entry.note = newNote;
            saveGoals(state.goals);
            renderGoals(state.goals);
          }
        });
        removeBtn.addEventListener('click', () => {
          goal.entries = (goal.entries || []).filter((e) => e.id !== entry.id);
          saveGoals(state.goals);
          renderGoals(state.goals);
        });
        entriesList.appendChild(li);
      });
    }

    renderEntries();

    if (entryAmountInput) allowOnlyNumbersAndFormat(entryAmountInput);

    entryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = parseAmountInput(entryAmountInput.value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const type = entryTypeSelect.value;
      const note = (entryNoteInput && entryNoteInput.value) ? entryNoteInput.value.trim() : '';
      goal.entries = goal.entries || [];
      goal.entries.unshift({
        id: generateId(),
        type,
        amount,
        date: new Date().toISOString().slice(0, 10),
        createdAt: Date.now(),
        is_active: true,
        note: note || '',
      });
      entryAmountInput.value = '';
      if (entryNoteInput) entryNoteInput.value = '';
      saveGoals(state.goals);
      renderGoals(state.goals);
    });

    const btnEditGoal = article.querySelector('.btn-edit-goal');
    const goalEdit = article.querySelector('.goal-edit');
    const goalInfo = article.querySelector('.goal-info');
    const goalEditName = article.querySelector('.goal-edit-name');
    const goalEditAmount = article.querySelector('.goal-edit-amount');
    const goalEditEnddate = article.querySelector('.goal-edit-enddate');
    const btnSaveGoal = article.querySelector('.btn-save-goal');
    const btnCancelGoal = article.querySelector('.btn-cancel-goal');

    if (btnEditGoal && goalEdit && goalInfo) {
        if (goalEditAmount) allowOnlyNumbersAndFormat(goalEditAmount);
      btnEditGoal.addEventListener('click', () => {
        goalEditName.value = goal.name || '';
        goalEditAmount.value = formatAmountInput(goal.amount ?? '');
        goalEditEnddate.value = goal.endDate || '';
        goalInfo.style.display = 'none';
        goalEdit.style.display = 'block';
        goalEditName.focus();
      });
      btnCancelGoal.addEventListener('click', () => {
        goalInfo.style.display = '';
        goalEdit.style.display = 'none';
      });
      btnSaveGoal.addEventListener('click', () => {
        const name = goalEditName.value.trim();
        const amount = parseAmountInput(goalEditAmount.value);
        const endDate = goalEditEnddate.value;
        if (!name) return;
        if (!Number.isFinite(amount) || amount < 0) return;
        if (!endDate) return;
        goal.name = name;
        goal.amount = amount;
        goal.endDate = endDate;
        saveGoals(state.goals);
        renderGoals(state.goals);
      });
    }

    article.querySelector('.btn-delete').addEventListener('click', () => {
      if (confirm('Delete this goal and all its entries?')) {
        const idx = state.goals.findIndex((g) => g.id === goal.id);
        if (idx !== -1) {
          state.goals.splice(idx, 1);
          saveGoals(state.goals);
          renderGoals(state.goals);
        }
      }
    });

    container.appendChild(card);
  });
}

function showMessage(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg || '';
}

function showMainError(msg) {
  const el = document.getElementById('main-app-error');
  if (!el) return;
  el.textContent = msg || '';
  el.style.display = msg ? 'block' : 'none';
}

function getAuthErrorMessage(code, defaultMsg) {
  const messages = {
    'auth/invalid-credential': 'Wrong email or password. Try again or create a new account.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/user-not-found': 'No account with this email. You can create one by clicking Continue.',
    'auth/wrong-password': 'Wrong password. Try again.',
    'auth/email-already-in-use': 'This email is already in use. Sign in instead.',
    'auth/weak-password': 'Password should be at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
  };
  return messages[code] || defaultMsg || 'Something went wrong. Please try again.';
}

function initUI() {
  const goalAmountInput = document.getElementById('goal-amount');
  if (goalAmountInput) {
    allowOnlyNumbersAndFormat(goalAmountInput);
  }

  document.getElementById('goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim();
    const amount = parseAmountInput(document.getElementById('goal-amount').value);
    const endDate = document.getElementById('goal-end-date').value;
    if (!name || !Number.isFinite(amount) || amount < 0 || !endDate) return;

    state.goals.push({
      id: generateId(),
      name,
      amount,
      endDate,
      entries: [],
      entrySort: 'date_desc',
    });
    saveGoals(state.goals);
    document.getElementById('goal-form').reset();
    renderGoals(state.goals);
  });
}

function showApp(show) {
  const main = document.getElementById('main-app');
  const authSection = document.getElementById('auth-section');
  const headerActions = document.getElementById('header-actions');
  if (main) main.style.display = show ? 'block' : 'none';
  if (authSection) authSection.style.display = show ? 'none' : 'block';
  if (headerActions) headerActions.style.display = show ? 'flex' : 'none';
}

function clearAuthForm() {
  const emailEl = document.getElementById('auth-email');
  const passwordEl = document.getElementById('auth-password');
  const btnAuth = document.getElementById('btn-auth');
  if (emailEl) emailEl.value = '';
  if (passwordEl) passwordEl.value = '';
  if (btnAuth) {
    btnAuth.disabled = false;
    btnAuth.textContent = 'Continue';
  }
  showMessage('');
}

function startWithFirebase() {
  const authSection = document.getElementById('auth-section');
  const authForm = document.getElementById('auth-form');
  const btnAuth = document.getElementById('btn-auth');
  const btnSignOut = document.getElementById('btn-sign-out');

  const firebaseAuth = getAuth();
  if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
    console.error('Firebase Auth not available');
    startWithLocalStorage();
    return;
  }

  let unsubscribeGoals = null;

  firebaseAuth.onAuthStateChanged((user) => {
    const emailEl = document.getElementById('manage-trigger-email');
    if (emailEl) emailEl.textContent = user ? (user.email || 'Signed in') : '';
    if (user) {
      if (unsubscribeGoals) unsubscribeGoals();
      unsubscribeGoals = null;
      showApp(true);
      showMessage('');
      showMainError('');
      const uid = user.uid;
      unsubscribeGoals = getDb()
        .collection('users')
        .doc(uid)
        .onSnapshot(
          (snap) => {
            showMainError('');
            const data = snap.data();
            state.goals = (data && data.goals) || [];
            renderGoals(state.goals);
          },
          (err) => {
            if (!getAuth().currentUser) return;
            console.error('Firestore error:', err);
            const msg = 'Could not load goals. In Firebase Console → Firestore → Rules, publish the rules from firestore.rules (see README).';
            showMessage(msg);
            showMainError(msg);
          }
        );
    } else {
      if (unsubscribeGoals) {
        unsubscribeGoals();
        unsubscribeGoals = null;
      }
      state.goals = [];
      renderGoals(state.goals);
      clearAuthForm();
      showMainError('');
      showApp(false);
    }
  });

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) {
      showMessage('Enter email and password (min 6 characters)');
      return;
    }
    if (password.length < 6) {
      showMessage('Password must be at least 6 characters');
      return;
    }
    showMessage('');
    if (btnAuth) {
      btnAuth.disabled = true;
      btnAuth.textContent = 'Please wait…';
    }
    function tryCreateAccount() {
      firebaseAuth
        .createUserWithEmailAndPassword(email, password)
        .then(() => {})
        .catch((createErr) => {
          if (createErr.code === 'auth/email-already-in-use') {
            showMessage('Wrong email or password. Try again.');
          } else {
            showMessage(getAuthErrorMessage(createErr.code, createErr.message));
          }
          if (btnAuth) {
            btnAuth.disabled = false;
            btnAuth.textContent = 'Continue';
          }
        });
    }

    firebaseAuth
      .signInWithEmailAndPassword(email, password)
      .then(() => {})
      .catch((err) => {
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          tryCreateAccount();
        } else {
          showMessage(getAuthErrorMessage(err.code, err.message));
          if (btnAuth) {
            btnAuth.disabled = false;
            btnAuth.textContent = 'Continue';
          }
        }
      });
  });

  const btnManage = document.getElementById('btn-manage');
  const manageMenu = document.getElementById('manage-menu');
  if (btnManage && manageMenu) {
    manageMenu.addEventListener('click', (e) => e.stopPropagation());
    btnManage.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = !manageMenu.hidden;
      manageMenu.hidden = isOpen;
      btnManage.setAttribute('aria-expanded', !isOpen);
      if (!isOpen) {
        document.addEventListener('click', closeManageMenuOnce);
      } else {
        document.removeEventListener('click', closeManageMenuOnce);
      }
    });
    function closeManageMenuOnce() {
      manageMenu.hidden = true;
      btnManage.setAttribute('aria-expanded', 'false');
      document.removeEventListener('click', closeManageMenuOnce);
    }
  }

  if (btnSignOut) {
    btnSignOut.addEventListener('click', () => {
      if (manageMenu) manageMenu.hidden = true;
      if (btnManage) btnManage.setAttribute('aria-expanded', 'false');
      firebaseAuth.signOut();
    });
  }

  const btnDeleteAccount = document.getElementById('btn-delete-account');
  if (btnDeleteAccount) {
    btnDeleteAccount.addEventListener('click', () => {
      const msg = 'Permanently delete your account and all your goals? This cannot be undone.';
      if (!confirm(msg)) return;
      const user = firebaseAuth.currentUser;
      if (!user) return;
      const uid = user.uid;
      btnDeleteAccount.disabled = true;
      btnDeleteAccount.textContent = 'Deleting…';
      getDb()
        .collection('users')
        .doc(uid)
        .delete()
        .catch(() => {})
        .then(() => user.delete())
        .then(() => {
          firebaseAuth.signOut();
          showApp(false);
        })
        .catch((err) => {
          if (err.code === 'auth/requires-recent-login') {
            alert('For security, please sign out, sign in again, then try Delete account.');
          } else {
            alert(err.message || 'Could not delete account.');
          }
        })
        .finally(() => {
          btnDeleteAccount.disabled = false;
          btnDeleteAccount.textContent = 'Delete account';
        });
    });
  }

  initUI();
}

function startWithLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    state.goals = raw ? JSON.parse(raw) : [];
  } catch {
    state.goals = [];
  }
  showApp(true);
  var authEl = document.getElementById('auth-section');
  if (authEl) {
    authEl.style.display = 'block';
    authEl.innerHTML = '<p class="auth-hint">Firebase not configured. Goals are saved in this browser only. Add your config in <code>firebase-config.js</code> to sync across devices.</p>';
  }
  renderGoals(state.goals);
  initUI();
}

function init() {
  try {
    const saved = localStorage.getItem(CURRENCY_STORAGE_KEY);
    if (saved) state.currency = saved;
  } catch (e) {}

  const currencySelect = document.getElementById('currency-select');
  if (currencySelect) {
    currencySelect.value = getCurrency();
    currencySelect.addEventListener('change', () => {
      state.currency = currencySelect.value;
      try {
        localStorage.setItem(CURRENCY_STORAGE_KEY, state.currency);
      } catch (e) {}
      renderGoals(state.goals);
    });
  }

  if (isFirebaseEnabled()) {
    startWithFirebase();
  } else {
    startWithLocalStorage();
  }
}

function setFooterYear() {
  const el = document.getElementById('footer-year');
  if (el) el.textContent = new Date().getFullYear();
}

init();
setFooterYear();
