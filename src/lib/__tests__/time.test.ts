import {
  centralDateTimeToUtcMillis,
  formatCentralDateInputValue,
  formatCentralTimeInputValue,
  getCentralTimestamp,
} from '../time';

describe('getCentralTimestamp', () => {
  it('formats date in US Central with offset', () => {
    const date = new Date('2023-01-01T00:00:00.000Z');
    expect(getCentralTimestamp(date)).toBe('2022-12-31T18:00:00-06:00');
  });

  it('converts a winter Central schedule time to UTC milliseconds', () => {
    expect(new Date(centralDateTimeToUtcMillis('2026-01-15', '09:30')!).toISOString()).toBe(
      '2026-01-15T15:30:00.000Z'
    );
  });

  it('converts a summer Central schedule time to UTC milliseconds', () => {
    expect(new Date(centralDateTimeToUtcMillis('2026-07-15', '09:30')!).toISOString()).toBe(
      '2026-07-15T14:30:00.000Z'
    );
  });

  it('returns null for nonexistent Central clock times during spring DST', () => {
    expect(centralDateTimeToUtcMillis('2026-03-08', '02:30')).toBeNull();
  });

  it('formats Central date and time inputs', () => {
    const timestamp = Date.parse('2026-07-15T14:30:00.000Z');
    expect(formatCentralDateInputValue(timestamp)).toBe('2026-07-15');
    expect(formatCentralTimeInputValue(timestamp)).toBe('09:30');
  });
});
