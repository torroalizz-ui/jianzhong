import { isHoliday, isWorkday } from 'chinese-workday';

export type RecurrenceType = 'once' | 'daily' | 'legalWorkday' | 'legalHoliday' | 'weekdays';

export const DEFAULT_RINGTONE_SRC = 'sounds/default.wav';

export const recurrenceOptions: Array<{ value: RecurrenceType; label: string }> = [
  { value: 'once', label: '只响一次' },
  { value: 'daily', label: '每天' },
  { value: 'legalWorkday', label: '法定工作日（智能跳过节假日）' },
  { value: 'legalHoliday', label: '法定节假日（智能跳过工作日）' },
  { value: 'weekdays', label: '周一至周五' },
];

export const recurrenceLabelMap: Record<RecurrenceType, string> = {
  once: '只响一次',
  daily: '每天',
  legalWorkday: '法定工作日',
  legalHoliday: '法定节假日',
  weekdays: '周一至周五',
};

export const hourOptions = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
export const minuteOptions = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

export const toDateKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const getRecurrenceLabel = (recurrence?: RecurrenceType): string => {
  return recurrence ? recurrenceLabelMap[recurrence] || '只响一次' : '只响一次';
};

export const shouldTriggerForDate = (recurrence: RecurrenceType, now: Date): boolean => {
  const day = now.getDay();
  if (recurrence === 'daily') return true;
  if (recurrence === 'weekdays') return day >= 1 && day <= 5;
  if (recurrence === 'legalWorkday') return isWorkday(now);
  if (recurrence === 'legalHoliday') return isHoliday(now);
  // once — always allow, guarded by lastTriggeredDate elsewhere
  return true;
};

export const generateId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};
