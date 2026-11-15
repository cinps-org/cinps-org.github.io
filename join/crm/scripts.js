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
  apiKey: 'YOUR_EXISTING_FIREBASE_API_KEY',
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
      console.error('CINPS API BLOCKED: no authenticated Firebase user.', {
        action: action
      });
      reject(new Error('Please sign in again.'));
      return;
    }

    console.log('CINPS API REQUEST:', {
      action: action,
      user: currentUser.email
    });

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
        new Error('API timeout. Please refresh and try again.')
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
