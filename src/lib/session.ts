export function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeSession(key: string, value: string): void {
  try {
    sessionStorage.setItem(key, value);
  } catch {
    /* Private browsing can block session storage. The app still works. */
  }
}
