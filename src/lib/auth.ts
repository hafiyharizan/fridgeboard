const SESSION_PIN_KEY = "fridgeboard-pin";

export function getSessionPin(): string | null {
  if (typeof window === "undefined") return null;
  const pin = sessionStorage.getItem(SESSION_PIN_KEY);
  return pin && /^\d{4}$/.test(pin) ? pin : null;
}

export function setSessionPin(pin: string): void {
  sessionStorage.setItem(SESSION_PIN_KEY, pin);
}

export function clearSessionPin(): void {
  sessionStorage.removeItem(SESSION_PIN_KEY);
}
