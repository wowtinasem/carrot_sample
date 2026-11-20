const SESSION_TOKEN_KEY = 'iconcafe_customer_session_v1';

export function getStoredSessionToken(): string | null {
  try {
    return window.localStorage.getItem(SESSION_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredSessionToken(token: string): void {
  try {
    window.localStorage.setItem(SESSION_TOKEN_KEY, token);
  } catch {
    // Ignore storage errors in private mode
  }
}

export function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

export function formatKstDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '-';
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

export function formatPriceKRW(price: number | null | undefined): string | null {
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  return `${new Intl.NumberFormat('ko-KR').format(price)}원`;
}

export function toKstDateTimeLocalInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(' ', 'T');
  return parts;
}

export function kstInputToIso(localInput: string): string {
  const trimmed = localInput.trim();
  if (!trimmed) return '';
  // Treat YYYY-MM-DDTHH:mm entered by Korean staff as KST (+09:00)
  const hasOffset = /[zZ]|[+-]\d{2}:\d{2}$/.test(trimmed);
  const normalized = hasOffset ? trimmed : `${trimmed}:00+09:00`;
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString();
}
