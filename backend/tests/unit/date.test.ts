import {
  formatDatePKT,
  toISODate,
  nowPKT,
  startOfDay,
  endOfDay,
  addDays,
  daysBetween,
} from '@/utils/date';

describe('formatDatePKT', () => {
  it('formats a UTC date to DD-MM-YYYY in PKT', () => {
    // 2025-01-15T10:00:00Z → PKT is UTC+5 → 15:00 PKT → still Jan 15
    const date = new Date('2025-01-15T10:00:00.000Z');
    expect(formatDatePKT(date)).toBe('15-01-2025');
  });

  it('handles date string input', () => {
    expect(formatDatePKT('2025-06-01T00:00:00.000Z')).toBe('01-06-2025');
  });

  it('handles midnight UTC rolling to next day in PKT', () => {
    // 2025-01-15T20:00:00Z → PKT = 01:00 Jan 16 (next day)
    const date = new Date('2025-01-15T20:00:00.000Z');
    expect(formatDatePKT(date)).toBe('16-01-2025');
  });

  it('handles year boundary crossing', () => {
    // 2024-12-31T21:00:00Z → PKT = 02:00 Jan 1, 2025
    const date = new Date('2024-12-31T21:00:00.000Z');
    expect(formatDatePKT(date)).toBe('01-01-2025');
  });

  it('pads single-digit day and month', () => {
    const date = new Date('2025-03-05T00:00:00.000Z');
    expect(formatDatePKT(date)).toBe('05-03-2025');
  });
});

describe('toISODate', () => {
  it('converts Date to YYYY-MM-DD string', () => {
    const date = new Date('2025-06-15T14:30:00.000Z');
    expect(toISODate(date)).toBe('2025-06-15');
  });

  it('accepts string input', () => {
    expect(toISODate('2025-01-01T00:00:00.000Z')).toBe('2025-01-01');
  });
});

describe('nowPKT', () => {
  it('returns a Date offset by +5 hours from UTC', () => {
    const before = Date.now();
    const pkt = nowPKT();
    const after = Date.now();

    // PKT should be ~5 hours ahead of UTC
    const expectedMin = before + 5 * 60 * 60 * 1000;
    const expectedMax = after + 5 * 60 * 60 * 1000;

    expect(pkt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(pkt.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});

describe('startOfDay', () => {
  it('returns midnight UTC for the given date', () => {
    const result = startOfDay('2025-06-15');
    expect(result.toISOString()).toBe('2025-06-15T00:00:00.000Z');
  });

  it('sets time to 00:00:00.000', () => {
    const result = startOfDay('2025-01-01');
    expect(result.getUTCHours()).toBe(0);
    expect(result.getUTCMinutes()).toBe(0);
    expect(result.getUTCSeconds()).toBe(0);
    expect(result.getUTCMilliseconds()).toBe(0);
  });
});

describe('endOfDay', () => {
  it('returns 23:59:59.999 UTC for the given date', () => {
    const result = endOfDay('2025-06-15');
    expect(result.toISOString()).toBe('2025-06-15T23:59:59.999Z');
  });

  it('sets time to end of day', () => {
    const result = endOfDay('2025-12-31');
    expect(result.getUTCHours()).toBe(23);
    expect(result.getUTCMinutes()).toBe(59);
    expect(result.getUTCSeconds()).toBe(59);
    expect(result.getUTCMilliseconds()).toBe(999);
  });
});

describe('addDays', () => {
  it('adds positive days', () => {
    const result = addDays('2025-01-15', 10);
    expect(toISODate(result)).toBe('2025-01-25');
  });

  it('subtracts with negative days', () => {
    const result = addDays('2025-01-15', -5);
    expect(toISODate(result)).toBe('2025-01-10');
  });

  it('crosses month boundaries', () => {
    const result = addDays('2025-01-28', 5);
    expect(toISODate(result)).toBe('2025-02-02');
  });

  it('crosses year boundaries', () => {
    const result = addDays('2025-12-30', 5);
    expect(toISODate(result)).toBe('2026-01-04');
  });

  it('accepts Date object input', () => {
    const date = new Date('2025-06-01T00:00:00.000Z');
    const result = addDays(date, 1);
    expect(toISODate(result)).toBe('2025-06-02');
  });

  it('handles adding zero days', () => {
    const result = addDays('2025-06-15', 0);
    expect(toISODate(result)).toBe('2025-06-15');
  });
});

describe('daysBetween', () => {
  it('calculates days between two dates', () => {
    expect(daysBetween('2025-01-01', '2025-01-11')).toBe(10);
  });

  it('returns 0 for same date', () => {
    expect(daysBetween('2025-06-15', '2025-06-15')).toBe(0);
  });

  it('returns negative for reversed range', () => {
    expect(daysBetween('2025-01-11', '2025-01-01')).toBe(-10);
  });

  it('works across month boundaries', () => {
    expect(daysBetween('2025-01-28', '2025-02-02')).toBe(5);
  });

  it('works across year boundaries', () => {
    expect(daysBetween('2024-12-30', '2025-01-04')).toBe(5);
  });

  it('accepts Date object inputs', () => {
    const start = new Date('2025-01-01T00:00:00.000Z');
    const end = new Date('2025-01-31T00:00:00.000Z');
    expect(daysBetween(start, end)).toBe(30);
  });
});
