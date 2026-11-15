
import { initializeApp } from
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

/* =============== CONFIGURATION =============== */

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyA-gf_fB9JJGv4Zi6AKCFWZBT3cWAWIUhk',
  authDomain: 'cinps-student-corner.firebaseapp.com',
  projectId: 'cinps-student-corner',
  storageBucket: 'cinps-student-corner.firebasestorage.app',
  messagingSenderId: '678888220602',
  appId: '1:678888220602:web:567b074c3e148221f5df83'
};

const API_URL =
  'https://script.google.com/macros/s/AKfycbx0ZFra4iKhajyckBrhAo4M00RThXzbPOYD9tnNlcuCG83V6ISlC6mmECnldRRm6IrWag/exec';

const API_CHANNEL = 'CINPS_CRM_API';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: 'select_account'
});

/* =============== ELEMENTS =============== */

const $ = id => document.getElementById(id);

const loginPanel = $('loginPanel');
const checkingPanel = $('checkingPanel');
const dashboardPanel = $('dashboardPanel');
const errorBox = $('errorBox');
const loginButton = $('googleSignIn');
const leadForm = $('leadForm');
const leadList = $('leadList');

let currentUser = null;
let currentProfile = null;

/* =============== UI HELPERS =============== */

function showPanel(panel) {
  [loginPanel, checkingPanel, dashboardPanel]
    .forEach(element => element.classList.add('hidden'));

  panel.classList.remove('hidden');
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

function clearError() {
  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function showLeadMessage(message) {
  const element = $('leadMessage');
  element.textContent = message;
  element.classList.remove('hidden');
}

/* =============== SECURE API BRIDGE =============== */

function callAPI(action, data = {}) {
  return new Promise((resolve, reject) => {
    if (!currentUser) {
      reject(new Error('Please sign in again.'));
      return;
    }

    const requestId = crypto.randomUUID
      ? crypto.randomUUID()
      : 'req-' + Date.now();

    const iframe = document.createElement('iframe');
    const form = document.createElement('form');
    const frameName = 'cinps_api_' + requestId;

    iframe.name = frameName;
    iframe.style.display = 'none';

    form.method = 'POST';
    form.action = API_URL;
    form.target = frameName;
    form.style.display = 'none';

    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = 'payload';

    let finished = false;

    function cleanup() {
      window.removeEventListener('message', onMessage);
      iframe.remove();
      form.remove();
      clearTimeout(timeout);
    }

    function finish(callback, value) {
      if (finished) return;
      finished = true;
      cleanup();
      callback(value);
    }

    function onMessage(event) {
      if (event.source !== iframe.contentWindow) return;

      const message = event.data;

      if (
        !message ||
        message.channel !== API_CHANNEL ||
        message.requestId !== requestId
      ) return;

      finish(resolve, message.result);
    }

    const timeout = setTimeout(() => {
      finish(
        reject,
        new Error('API timeout. Please refresh and try again.')
      );
    }, 30000);

    window.addEventListener('message', onMessage);

    document.body.append(iframe, form);

    currentUser.getIdToken()
      .then(token => {
        input.value = JSON.stringify({
          requestId,
          idToken: token,
          action,
          data
        });

        form.appendChild(input);
        form.submit();
      })
      .catch(error => finish(reject, error));
  });
}

/* =============== GOOGLE SIGN-IN =============== */

loginButton.addEventListener('click', async () => {
  clearError();
  loginButton.disabled = true;

  try {
    await signInWithRedirect(auth, provider);
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    showError(error.message || 'Google sign-in failed.');
    loginButton.disabled = false;
  }
});

/* =============== VERIFY STAFF ACCESS =============== */

async function verifyAccess() {
  const result = await callAPI('session.verify');

  if (!result || !result.ok) {
    throw new Error(
      result?.message || 'Your account is not authorised.'
    );
  }

  currentProfile = result.profile;

  $('userName').textContent =
    currentProfile.name || 'CINPS Staff';

  $('userEmail').textContent =
    currentProfile.email || '';

  $('userRole').textContent =
    currentProfile.role.replaceAll('_', ' ');

  showPanel(dashboardPanel);
}

/* =============== LOAD LEADS =============== */

async function loadLeads() {
  leadList.textContent = 'Loading leads...';

  const result = await callAPI('leads.list');

  if (!result || !result.ok) {
    throw new Error(result?.message || 'Unable to load leads.');
  }

  renderLeads(result.leads || []);
}

function renderLeads(leads) {
  leadList.replaceChildren();

  if (!leads.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No leads found.';
    leadList.appendChild(empty);
    return;
  }

  leads.forEach(lead => {
    const card = document.createElement('article');
    card.className = 'lead-card';

    const title = document.createElement('h3');
    title.textContent = lead.name;

    const details = [
      ['Phone', lead.phone],
      ['Course', lead.course],
      ['Branch', lead.branch],
      ['Source', lead.source]
    ];

    card.appendChild(title);

    details.forEach(([label, value]) => {
      const p = document.createElement('p');
      p.textContent = label + ': ' + (value || 'Not specified');
      card.appendChild(p);
    });

    const status = document.createElement('select');

    const statuses = [
      ['NEW', 'New'],
      ['CONTACTED', 'Contacted'],
      ['FOLLOW_UP', 'Follow-up'],
      ['INTERESTED', 'Interested'],
      ['ADMITTED', 'Admitted'],
      ['NOT_INTERESTED', 'Not interested'],
      ['LOST', 'Lost']
    ];

    statuses.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      status.appendChild(option);
    });

    status.value = lead.status || 'NEW';

    status.addEventListener('change', async () => {
      status.disabled = true;

      try {
        const result = await callAPI('leads.update', {
          leadId: lead.leadId,
          status: status.value
        });

        if (!result.ok) {
          throw new Error(result.message);
        }

        lead.status = status.value;
        showLeadMessage('Lead status updated.');

      } catch (error) {
        showError(error.message || 'Update failed.');
        status.value = lead.status || 'NEW';

      } finally {
        status.disabled = false;
      }
    });

    card.appendChild(status);
    leadList.appendChild(card);
  });
}

/* =============== CREATE LEAD =============== */

leadForm.addEventListener('submit', async event => {
  event.preventDefault();
  clearError();

  const button = leadForm.querySelector(
    'button[type="submit"]'
  );

  button.disabled = true;

  const data = {
    name: $('leadName').value.trim(),
    phone: $('leadPhone').value.trim(),
    email: $('leadEmail').value.trim(),
    course: $('leadCourse').value.trim(),
    branch: $('leadBranch').value.trim(),
    source: $('leadSource').value,
    notes: $('leadNotes').value.trim()
  };

  try {
    const result = await callAPI('leads.create', data);

    if (!result || !result.ok) {
      throw new Error(result?.message || 'Unable to save lead.');
    }

    leadForm.reset();
    showLeadMessage('Lead saved successfully.');
    await loadLeads();

  } catch (error) {
    showError(error.message || 'Unable to save lead.');

  } finally {
    button.disabled = false;
  }
});

/* =============== REFRESH =============== */

$('refreshLeads').addEventListener('click', async () => {
  try {
    await loadLeads();
    showLeadMessage('Lead list refreshed.');
  } catch (error) {
    showError(error.message);
  }
});

/* =============== SIGN OUT =============== */

$('signOut').addEventListener('click', async () => {
  await signOut(auth);
});

/* =============== APPLICATION START =============== */

async function startApplication() {
  try {
    await getRedirectResult(auth);
  } catch (error) {
    console.error('REDIRECT ERROR:', error);
    showError(error.message || 'Sign-in could not be completed.');
  }

  onAuthStateChanged(auth, async user => {
    clearError();
    currentUser = user;
    currentProfile = null;

    if (!user) {
      showPanel(loginPanel);
      loginButton.disabled = false;
      return;
    }

    showPanel(checkingPanel);

    try {
      await verifyAccess();
      await loadLeads();

    } catch (error) {
      console.error('CRM ACCESS ERROR:', error);

      await signOut(auth);
      showPanel(loginPanel);
      showError(error.message || 'CRM access verification failed.');
    }
  });
}

$('year').textContent = new Date().getFullYear();

startApplication();
