const STORAGE_KEY = 'saving-goals-data';

const state = { goals: [] };
const getDb = () => window.firebaseDb;
const getAuth = () => window.firebaseAuth;

function isFirebaseEnabled() {
  return getDb() && getAuth();
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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

    function renderEntries() {
      entriesList.innerHTML = '';
      (goal.entries || []).forEach((entry) => {
        const li = document.createElement('li');
        li.className = `entry-item ${entry.is_active ? '' : 'inactive'}`;
        const amount = Number(entry.amount) || 0;
        const typeLabel = entry.type === 'credit' ? 'Credit' : 'Debit';
        li.innerHTML = `
          <div class="entry-view">
            <span class="entry-type-badge ${entry.type}">${typeLabel}</span>
            <span class="entry-amount ${entry.type}">${entry.type === 'credit' ? '+' : '-'}${formatCurrency(amount)}</span>
            <div class="entry-actions">
              <button type="button" class="toggle-active ${entry.is_active ? 'active' : ''}">${entry.is_active ? 'Active' : 'Inactive'}</button>
              <button type="button" class="btn-edit-entry">Edit</button>
              <button type="button" class="btn-remove-entry" aria-label="Remove entry">&times;</button>
            </div>
          </div>
          <div class="entry-edit">
            <select class="edit-entry-type">
              <option value="credit" ${entry.type === 'credit' ? 'selected' : ''}>Credit</option>
              <option value="debit" ${entry.type === 'debit' ? 'selected' : ''}>Debit</option>
            </select>
            <input type="number" class="entry-edit-amount" value="${amount}" min="0" step="0.01" />
            <button type="button" class="btn-save-entry">Save</button>
            <button type="button" class="btn-cancel-edit">Cancel</button>
          </div>
        `;
        const toggleBtn = li.querySelector('.toggle-active');
        const editBtn = li.querySelector('.btn-edit-entry');
        const removeBtn = li.querySelector('.btn-remove-entry');
        const saveBtn = li.querySelector('.btn-save-entry');
        const cancelBtn = li.querySelector('.btn-cancel-edit');
        const editTypeSelect = li.querySelector('.edit-entry-type');
        const editAmountInput = li.querySelector('.entry-edit-amount');

        toggleBtn.addEventListener('click', () => {
          entry.is_active = !entry.is_active;
          saveGoals(state.goals);
          renderGoals(state.goals);
        });
        editBtn.addEventListener('click', () => {
          li.classList.add('editing');
          editAmountInput.value = entry.amount;
          editTypeSelect.value = entry.type;
          editAmountInput.focus();
        });
        cancelBtn.addEventListener('click', () => {
          li.classList.remove('editing');
        });
        saveBtn.addEventListener('click', () => {
          const newAmount = parseFloat(editAmountInput.value);
          const newType = editTypeSelect.value;
          if (Number.isFinite(newAmount) && newAmount >= 0) {
            entry.amount = newAmount;
            entry.type = newType;
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

    entryForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const amount = parseFloat(entryAmountInput.value);
      if (!Number.isFinite(amount) || amount <= 0) return;
      const type = entryTypeSelect.value;
      goal.entries = goal.entries || [];
      goal.entries.push({
        id: generateId(),
        type,
        amount,
        date: new Date().toISOString().slice(0, 10),
        is_active: true,
      });
      entryAmountInput.value = '';
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
      btnEditGoal.addEventListener('click', () => {
        goalEditName.value = goal.name || '';
        goalEditAmount.value = goal.amount ?? '';
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
        const amount = parseFloat(goalEditAmount.value);
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

function initUI() {
  document.getElementById('goal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('goal-name').value.trim();
    const amount = parseFloat(document.getElementById('goal-amount').value);
    const endDate = document.getElementById('goal-end-date').value;
    if (!name || !Number.isFinite(amount) || amount < 0 || !endDate) return;

    state.goals.push({
      id: generateId(),
      name,
      amount,
      endDate,
      entries: [],
    });
    saveGoals(state.goals);
    document.getElementById('goal-form').reset();
    renderGoals(state.goals);
  });
}

function showApp(show) {
  const main = document.getElementById('main-app');
  const authSection = document.getElementById('auth-section');
  const signOutBtn = document.getElementById('btn-sign-out');
  if (main) main.style.display = show ? 'block' : 'none';
  if (authSection) authSection.style.display = show ? 'none' : 'block';
  if (signOutBtn) signOutBtn.style.display = show ? 'inline-block' : 'none';
}

function startWithFirebase() {
  const authSection = document.getElementById('auth-section');
  const authForm = document.getElementById('auth-form');
  const btnCreate = document.getElementById('btn-create-account');
  const btnSignOut = document.getElementById('btn-sign-out');

  const firebaseAuth = getAuth();
  if (!firebaseAuth || typeof firebaseAuth.onAuthStateChanged !== 'function') {
    console.error('Firebase Auth not available');
    startWithLocalStorage();
    return;
  }

  firebaseAuth.onAuthStateChanged((user) => {
    if (user) {
      showApp(true);
      showMessage('');
      const uid = user.uid;
      getDb()
        .collection('users')
        .doc(uid)
        .onSnapshot(
          (snap) => {
            const data = snap.data();
            state.goals = (data && data.goals) || [];
            renderGoals(state.goals);
          },
          (err) => {
            console.error('Firestore error:', err);
            showMessage('Could not load goals.');
          }
        );
    } else {
      state.goals = [];
      renderGoals(state.goals);
      showApp(false);
    }
  });

  authForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;
    if (!email || !password) return;
    showMessage('');
    firebaseAuth
      .signInWithEmailAndPassword(email, password)
      .then(() => {})
      .catch((err) => {
        showMessage(err.message || 'Sign in failed');
      });
  });

  if (btnCreate) {
    btnCreate.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const emailInput = document.getElementById('auth-email');
      const passwordInput = document.getElementById('auth-password');
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';
      if (!email || !password) {
        showMessage('Enter email and password (min 6 characters)');
        return;
      }
      if (password.length < 6) {
        showMessage('Password must be at least 6 characters');
        return;
      }
      showMessage('');
      btnCreate.disabled = true;
      btnCreate.textContent = 'Creating…';
      firebaseAuth
        .createUserWithEmailAndPassword(email, password)
        .then(() => {})
        .catch((err) => {
          showMessage(err.message || 'Create account failed');
          btnCreate.disabled = false;
          btnCreate.textContent = 'Create an account';
        })
        .finally(() => {
          btnCreate.disabled = false;
          btnCreate.textContent = 'Create an account';
        });
    });
  }

  btnSignOut.addEventListener('click', () => {
    firebaseAuth.signOut();
  });

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
