import { describe, it } from "node:test";
import { expect } from "../test-expect";
import {
  buildDailyBrief,
  describeWeatherCode,
  prettyDate,
  todayISO,
  weatherUnavailable,
} from './proactive';

describe('todayISO', () => {
  it('returns YYYY-MM-DD for a fixed date', () => {
    expect(todayISO(new Date(2026, 10, 23))).toBe('2026-11-23');
  });

  it('never throws on an invalid date', () => {
    expect(typeof todayISO(new Date('nope'))).toBe('string');
  });
});

describe('prettyDate', () => {
  it('formats like Monday, 23 November 2026', () => {
    expect(prettyDate(new Date(2026, 10, 23))).toBe('Monday, 23 November 2026');
  });
});

describe('describeWeatherCode', () => {
  it('maps known codes', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky');
    expect(describeWeatherCode(61)).toBe('Slight rain');
  });

  it('falls back for unknown codes', () => {
    expect(describeWeatherCode(1234)).toBe('Unknown conditions');
    expect(describeWeatherCode(undefined)).toBe('Unknown conditions');
  });
});

describe('weatherUnavailable', () => {
  it('marks source as unavailable', () => {
    expect(weatherUnavailable('Abu Dhabi')).toEqual({
      city: 'Abu Dhabi',
      summary: 'Weather unavailable',
      source: 'unavailable',
    });
  });
});

describe('buildDailyBrief', () => {
  it('builds greeting, city, and pending tasks (skipping done)', () => {
    const brief = buildDailyBrief({
      profile: { name: 'Ali', city: 'Karachi', work: 'freelancing' },
      pendingTasks: [
        { label: 'Finish CV' },
        { label: 'Call client', done: true },
        { label: 'Pay bill' },
      ],
      now: new Date(2026, 10, 23, 9, 0, 0),
    });
    expect(brief.name).toBe('Ali');
    expect(brief.greeting).toBe('Good morning, Ali');
    expect(brief.city).toBe('Karachi');
    expect(brief.dateISO).toBe('2026-11-23');
    expect(brief.pendingTasks).toEqual(['Finish CV', 'Pay bill']);
    expect(brief.suggestions.length).toBe(3);
    expect(brief.weather.source).toBe('unavailable');
  });

  it('caps pending tasks at 8', () => {
    const tasks = Array.from({ length: 12 }, (_, i) => ({ label: `Task ${i + 1}` }));
    const brief = buildDailyBrief({ profile: {}, pendingTasks: tasks });
    expect(brief.pendingTasks.length).toBe(8);
  });

  it('afternoon and evening greetings', () => {
    expect(buildDailyBrief({ profile: {}, now: new Date(2026, 10, 23, 14) }).greeting).toBe('Good afternoon');
    expect(buildDailyBrief({ profile: {}, now: new Date(2026, 10, 23, 20) }).greeting).toBe('Good evening');
  });

  it('handles malformed input without throwing', () => {
    // @ts-expect-error deliberately invalid input
    const brief = buildDailyBrief(null);
    expect(brief.city).toBe('Abu Dhabi');
    expect(brief.pendingTasks).toEqual([]);
  });
});
