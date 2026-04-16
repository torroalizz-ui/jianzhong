import { describe, it, expect } from 'vitest';
import {
  toDateKey,
  shouldTriggerForDate,
  getRecurrenceLabel,
  generateId,
  hourOptions,
  minuteOptions,
} from '../utils/alarm';

describe('toDateKey', () => {
  it('formats date as YYYY-MM-DD', () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(toDateKey(date)).toBe('2026-01-05');
  });

  it('zero-pads single digit month and day', () => {
    const date = new Date(2026, 2, 9); // Mar 9, 2026
    expect(toDateKey(date)).toBe('2026-03-09');
  });

  it('handles December 31', () => {
    const date = new Date(2026, 11, 31);
    expect(toDateKey(date)).toBe('2026-12-31');
  });
});

describe('shouldTriggerForDate', () => {
  it('once — always returns true', () => {
    const monday = new Date(2026, 3, 13); // Monday
    const sunday = new Date(2026, 3, 12); // Sunday
    expect(shouldTriggerForDate('once', monday)).toBe(true);
    expect(shouldTriggerForDate('once', sunday)).toBe(true);
  });

  it('daily — always returns true', () => {
    for (let d = 12; d <= 18; d++) {
      expect(shouldTriggerForDate('daily', new Date(2026, 3, d))).toBe(true);
    }
  });

  it('weekdays — true Mon-Fri, false Sat-Sun', () => {
    // 2026-04-13 = Monday ... 2026-04-17 = Friday
    for (let d = 13; d <= 17; d++) {
      expect(shouldTriggerForDate('weekdays', new Date(2026, 3, d))).toBe(true);
    }
    // Saturday and Sunday
    expect(shouldTriggerForDate('weekdays', new Date(2026, 3, 18))).toBe(false); // Sat
    expect(shouldTriggerForDate('weekdays', new Date(2026, 3, 19))).toBe(false); // Sun
  });
});

describe('getRecurrenceLabel', () => {
  it('returns correct label for each recurrence type', () => {
    expect(getRecurrenceLabel('once')).toBe('只响一次');
    expect(getRecurrenceLabel('daily')).toBe('每天');
    expect(getRecurrenceLabel('weekdays')).toBe('周一至周五');
    expect(getRecurrenceLabel('legalWorkday')).toBe('法定工作日');
    expect(getRecurrenceLabel('legalHoliday')).toBe('法定节假日');
  });

  it('returns default for undefined', () => {
    expect(getRecurrenceLabel(undefined)).toBe('只响一次');
  });
});

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('returns unique values on consecutive calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe('hourOptions / minuteOptions', () => {
  it('hourOptions has 24 zero-padded entries 00-23', () => {
    expect(hourOptions).toHaveLength(24);
    expect(hourOptions[0]).toBe('00');
    expect(hourOptions[23]).toBe('23');
  });

  it('minuteOptions has 60 zero-padded entries 00-59', () => {
    expect(minuteOptions).toHaveLength(60);
    expect(minuteOptions[0]).toBe('00');
    expect(minuteOptions[59]).toBe('59');
  });
});
