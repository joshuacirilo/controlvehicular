import { useSyncExternalStore } from 'react';

// Display-only state for the test login. It is not authentication: the API must authorize every request.
export type SessionUser = { id: string; username: string; name: string };

const STORAGE_KEY = 'cv-admin-user';
const CHANGE_EVENT = 'cv-admin-session';

function parseUser(raw: string | null): SessionUser | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    return typeof value?.id === 'string' && typeof value?.username === 'string' && typeof value?.name === 'string'
      ? { id: value.id, username: value.username, name: value.name } : null;
  } catch { return null; }
}

export function saveSessionUser(user: SessionUser) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function clearSessionUser() {
  sessionStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function hasSessionUser() {
  return parseUser(sessionStorage.getItem(STORAGE_KEY)) !== null;
}

function subscribe(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useSessionUser() {
  const raw = useSyncExternalStore(subscribe, () => sessionStorage.getItem(STORAGE_KEY), () => null);
  return parseUser(raw);
}
