export const DAY_NAMES = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export const ACTIVE_DAYS = [
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[((dayOfWeek % 7) + 7) % 7];
}

export function dayIndex(day: string): number {
  const index = DAY_NAMES.indexOf(day as (typeof DAY_NAMES)[number]);
  return index >= 0 ? index : 1;
}

export function initials(name: string): string {
  return name
    .replace(/^(Kak|Bapak|Ibu)\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function parseTime(time: string): { hours: number; minutes: number } {
  const [h, m] = time.split(/[.:]/).map(Number);
  return { hours: Number.isFinite(h) ? h : 0, minutes: Number.isFinite(m) ? m : 0 };
}

export function timeToMinutes(time: string): number {
  const { hours, minutes } = parseTime(time);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const normalized = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}.${String(m).padStart(2, '0')}`;
}

export function addMinutesToTime(time: string, minutes: number): string {
  return minutesToTime(timeToMinutes(time) + minutes);
}

export function formatRequestedSchedule(needs: {
  days: string[];
  startTime: string;
}): string {
  const days = needs.days.join(' & ');
  return `${days}, ${needs.startTime}`;
}

export function formatShortAddress(address?: string | null): string {
  return (address ?? '').split(',')[0]?.trim() || '-';
}

export function gradeLabel(grade: string, level: string): string {
  return `Kelas ${grade} ${level}`;
}

export function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function monthEnd(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function dateAtTime(date: Date, time: string): Date {
  const { hours, minutes } = parseTime(time);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

export function nextDateForDay(dayOfWeek: number, from = new Date()): Date {
  const base = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate() + 1,
  );
  const diff = (dayOfWeek - base.getDay() + 7) % 7;
  base.setDate(base.getDate() + diff);
  return base;
}

export function overlaps(
  a: { start: string; end: string; day?: string },
  b: { start: string; end: string; day?: string },
  bufferMinutes = 0,
): boolean {
  if (a.day && b.day && a.day !== b.day) return false;
  return (
    timeToMinutes(a.start) < timeToMinutes(b.end) + bufferMinutes &&
    timeToMinutes(b.start) < timeToMinutes(a.end) + bufferMinutes
  );
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

export function monthOptions(count = 2): Date[] {
  const now = new Date();
  return Array.from(
    { length: count },
    (_, i) => new Date(now.getFullYear(), now.getMonth() - i, 1),
  );
}

export function toWhatsapp(phone?: string | null): string {
  return (phone ?? '').replace(/\D/g, '').replace(/^0/, '62');
}
