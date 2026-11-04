// The signed-in session ({ token, user, clinics, tenant }) kept in the browser so a refresh does not sign you out.
const SESSION_KEY = "morlyiq_client_session";

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveSession(session) {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage unavailable */
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    /* storage unavailable */
  }
}
