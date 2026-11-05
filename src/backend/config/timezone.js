process.env.TZ = 'UTC';

export const APP_TIMEZONE = 'Asia/Jakarta';
export const DB_TZ_OFFSET = '+00:00';

export const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

export const getWibYear = (date = new Date()) => {
  return new Date(new Date(date).getTime() + WIB_OFFSET_MS).getUTCFullYear();
};

export const getTokenExpiryMs = (value) => {
  if (!value) return null;
  const ymd = value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value).slice(0, 10);
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return null;
  return Date.UTC(y, m - 1, d + 1) - WIB_OFFSET_MS;
};
