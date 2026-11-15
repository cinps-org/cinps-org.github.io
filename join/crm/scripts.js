
import { initializeApp } from
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';

import {
  getAuth,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut
} from
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

/* =====================================================
   1. CONFIGURATION
===================================================== */

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
const API_TIMEOUT = 30000;

/* =====================================================
   2. FIREBASE INITIALISATION
===================================================== */

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);

const provider = new GoogleAuthProvider();

provider.setCustomParameters({
  prompt: 'select_account'
});

/* =====================================================
   3. DOM ELEMENTS
===================================================== */

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
let authListenerStarted = false;

/* =====================================================
   4. UI HELPERS
===================================================== */

function showPanel(panel) {
  [loginPanel, checkingPanel, dashboardPanel]
    .forEach(element => {
      if (element) element.classList.add('hidden');
    });

  if (panel) panel.classList.remove('hidden');
}

function showError(message) {
  if (!errorBox) return;

  errorBox.textContent =
    message || 'An unexpected error occurred.';

  errorBox.classList.remove('hidden');
}

function clearError() {
  if (!errorBox) return;

  errorBox.textContent = '';
  errorBox.classList.add('hidden');
}

function showLeadMessage(message) {
  const element = $('leadMessage');

  if (!element) return;

  element.textContent = message;
  element.classList.remove('hidden');
}

function getErrorMessage(error, fallback) {
  return error && error.message
    ? error.message
    : fallback;
}

/* =====================================================
   5. SECURE APPS SCRIPT API BRIDGE
===================================================== */

function callAPI(action, data = {}) {

  return new Promise((resolve, reject) => {

    if (!currentUser) {
      reject(new Error('Please sign in again.'));
      return;
    }

    const requestId =
      window.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : 'cinps-' + Date.now() + '-' +
          Math.random().toString(36).slice(2);

    const iframe = document.createElement('iframe');
    const form = document.createElement('form');

    const frameName = 'cinps_api_' + requestId;

    iframe.name = frameName;
    iframe.style.display = 'none';
    iframe.setAttribute('aria-hidden', 'true');

    form.method = 'POST';
    form.action = API_URL;
    form.target = frameName;
    form.style.display = 'none';

    const input = document.createElement('input');

    input.type = 'hidden';
    input.name = 'payload';

    let finished = false;
    let timeout;

    function cleanup() {
      window.removeEventListener('message', onMessage);

      if (iframe.parentNode) iframe.remove();
      if (form.parentNode) form.remove();

      if (timeout) clearTimeout(timeout);
    }

    function finish(callback, value) {
      if (finished) return;

      finished = true;
      cleanup();
      callback(value);
    }

    /* Validate the actual response origin. */
    function isTrustedGoogleOrigin(origin) {
      try {
        const parsed = new URL(origin);

        return (
          parsed.protocol === 'https:' &&
          (
            parsed.hostname === 'googleusercontent.com' ||
            parsed.hostname.endsWith('.googleusercontent.com')
          )
        );

      } catch (error) {
        return false;
      }
    }

    /* Receive Apps Script response. */
    function onMessage(event) {

      console.log('CINPS API RESPONSE:', {
        origin: event.origin,
        data: event.data,
        expectedRequestId: requestId
      });

      if (!isTrustedGoogleOrigin(event.origin)) {
        console.warn(
          'CINPS rejected untrusted API origin:',
          event.origin
        );
        return;
      }

      const message = event.data;

      if (
        !message ||
        message.channel !== API_CHANNEL ||
        message.requestId !== requestId
      ) {
        console.warn(
          'CINPS API response did not match the request.'
        );
        return;
      }

      console.log(
        'CINPS API response accepted:',
        message.result
      );

      finish(resolve, message.result);
    }

    timeout = setTimeout(() => {
      finish(
        reject,
        new Error(
          'API timeout. Please refresh and try again.'
        )
      );
    }, API_TIMEOUT);

    window.addEventListener('message', onMessage);

    document.body.append(iframe, form);

    currentUser.getIdToken()
      .then(token => {

        input.value = JSON.stringify({
          requestId: requestId,
          idToken: token,
          action: action,
          data: data
        });

        form.appendChild(input);
        form.submit();

      })
      .catch(error => {
        finish(reject, error);
      });

  });
}

/* =====================================================
   6. GOOGLE SIGN-IN
===================================================== */

if (loginButton) {

  loginButton.addEventListener('click', async () => {

    clearError();
    loginButton.disabled = true;

    try {

      await signInWithRedirect(auth, provider);

    } catch (error) {

      console.error('CINPS LOGIN ERROR:', error);

      showError(
        getErrorMessage(
          error,
          'Google sign-in failed.'
        )
      );

      loginButton.disabled = false;
    }

  });

}

/* =====================================================
   7. VERIFY STAFF AUTHORISATION
===================================================== */

async function verifyAccess() {

  const result = await callAPI('session.verify');

  if (!result || !result.ok || !result.profile) {

    throw new Error(
      result?.message ||
      'Your account is not authorised for CINPS CRM.'
    );
  }

  currentProfile = result.profile;

  $('userName').textContent =
    currentProfile.name || 'CINPS Staff';

  $('userEmail').textContent =
    currentProfile.email || '';

  $('userRole').textContent =
    String(currentProfile.role || '')
      .replaceAll('_', ' ');

}

/* =====================================================
   8. LOAD LEADS
===================================================== */

async function loadLeads() {

  if (!leadList) return;

  leadList.textContent = 'Loading leads...';

  const result = await callAPI('leads.list');

  if (!result || !result.ok) {

    throw new Error(
      result?.message || 'Unable to load leads.'
    );
  }

  renderLeads(result.leads || []);
}

/* =====================================================
   9. DISPLAY LEADS
===================================================== */

function renderLeads(leads) {

  if (!leadList) return;

  leadList.replaceChildren();

  if (!leads.length) {

    const empty = document.createElement('p');

    empty.className = 'empty-state';
    empty.textContent = 'No leads found.';

    leadList.appendChild(empty);
    return;
  }

  const statuses = [
    ['NEW', 'New'],
    ['CONTACTED', 'Contacted'],
    ['FOLLOW_UP', 'Follow-up'],
    ['INTERESTED', 'Interested'],
    ['ADMITTED', 'Admitted'],
    ['NOT_INTERESTED', 'Not interested'],
    ['LOST', 'Lost']
  ];

  leads.forEach(lead => {

    const card = document.createElement('article');
    card.className = 'lead-card';

    const title = document.createElement('h3');
    title.textContent = lead.name || 'Unnamed lead';

    card.appendChild(title);

    const details = [
      ['Phone', lead.phone],
      ['Email', lead.email],
      ['Course', lead.course],
      ['Branch', lead.branch],
      ['Source', lead.source]
    ];

    details.forEach(([label, value]) => {

      const p = document.createElement('p');

      p.textContent =
        label + ': ' + (value || 'Not specified');

      card.appendChild(p);
    });

    const statusLabel = document.createElement('p');
    statusLabel.textContent = 'Lead status';

    const status = document.createElement('select');

    statuses.forEach(([value, label]) => {

      const option = document.createElement('option');

      option.value = value;
      option.textContent = label;

      status.appendChild(option);
    });

    const originalStatus = lead.status || 'NEW';

    status.value = originalStatus;

    status.addEventListener('change', async () => {

      const previousStatus = lead.status || 'NEW';

      status.disabled = true;
      clearError();

      try {

        const result = await callAPI('leads.update', {
          leadId: lead.leadId,
          status: status.value
        });

        if (!result || !result.ok) {
          throw new Error(
            result?.message || 'Lead update failed.'
          );
        }

        lead.status = status.value;

        showLeadMessage('Lead status updated successfully.');

      } catch (error) {

        status.value = previousStatus;

        showError(
          getErrorMessage(error, 'Lead update failed.')
        );

      } finally {

        status.disabled = false;
      }

    });

    card.appendChild(statusLabel);
    card.appendChild(status);

    leadList.appendChild(card);

  });
}

/* =====================================================
   10. CREATE NEW LEAD
===================================================== */

if (leadForm) {

  leadForm.addEventListener('submit', async event => {

    event.preventDefault();
    clearError();

    const button = leadForm.querySelector(
      'button[type="submit"]'
    );

    if (button) button.disabled = true;

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

        throw new Error(
          result?.message || 'Unable to save lead.'
        );
      }

      leadForm.reset();

      showLeadMessage('Lead saved successfully.');

      await loadLeads();

    } catch (error) {

      showError(
        getErrorMessage(error, 'Unable to save lead.')
      );

    } finally {

      if (button) button.disabled = false;
    }

  });

}

/* =====================================================
   11. REFRESH LEADS
===================================================== */

const refreshButton = $('refreshLeads');

if (refreshButton) {

  refreshButton.addEventListener('click', async () => {

    refreshButton.disabled = true;
    clearError();

    try {

      await loadLeads();

      showLeadMessage('Lead list refreshed.');

    } catch (error) {

      showError(
        getErrorMessage(error, 'Unable to refresh leads.')
      );

    } finally {

      refreshButton.disabled = false;
    }

  });

}

/* =====================================================
   12. SIGN OUT
===================================================== */

const signOutButton = $('signOut');

if (signOutButton) {

  signOutButton.addEventListener('click', async () => {

    signOutButton.disabled = true;

    try {

      await signOut(auth);

      currentUser = null;
      currentProfile = null;

      showPanel(loginPanel);

    } catch (error) {

      showError(
        getErrorMessage(error, 'Sign-out failed.')
      );

      signOutButton.disabled = false;
    }

  });

}

/* =====================================================
   13. APPLICATION START
===================================================== */

async function startApplication() {

  $('year').textContent = new Date().getFullYear();

  /* Process Google redirect result. */
  try {

    const redirectResult = await getRedirectResult(auth);

    if (redirectResult && redirectResult.user) {

      console.log(
        'CINPS Google redirect completed:',
        redirectResult.user.email
      );

    }

  } catch (error) {

    console.error(
      'CINPS REDIRECT ERROR:',
      error
    );

    showError(
      getErrorMessage(
        error,
        'Google sign-in could not be completed.'
      )
    );
  }

  if (authListenerStarted) return;
  authListenerStarted = true;

  onAuthStateChanged(auth, async user => {

    clearError();

    currentUser = user;
    currentProfile = null;

    if (!user) {

      showPanel(loginPanel);

      if (loginButton) {
        loginButton.disabled = false;
      }

      return;
    }

    showPanel(checkingPanel);

    try {

      console.log(
        'CINPS authenticated user:',
        user.email
      );

      await verifyAccess();

      showPanel(dashboardPanel);

      await loadLeads();

    } catch (error) {

      console.error(
        'CINPS CRM ACCESS ERROR:',
        error
      );

      await signOut(auth);

      currentUser = null;
      currentProfile = null;

      showPanel(loginPanel);

      showError(
        getErrorMessage(
          error,
          'CRM access verification failed.'
        )
      );

    }

  });

}

/* =====================================================
   14. INITIALISE
===================================================== */

startApplication();
