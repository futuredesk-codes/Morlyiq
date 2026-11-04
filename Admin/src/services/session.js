const SESSION_KEY = "morlyiq_admin_session";

const parse = (value) => {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
};

export const loadAdminSession = () =>
  parse(localStorage.getItem(SESSION_KEY)) || parse(sessionStorage.getItem(SESSION_KEY));

export const saveAdminSession = (session, remember) => {
  clearAdminSession();
  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearAdminSession = () => {
  localStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SESSION_KEY);
};
