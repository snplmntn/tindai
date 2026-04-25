import { describe, expect, it } from 'vitest';

import type { AnalyticsChartPoint } from './buildAnalyticsViewModel';
import { buildForecastChartData, buildVictoryChartData } from './analyticsChartData';

describe('analyticsChartData', () => {
  it('maps analytics chart points into Victory-ready data without changing order', () => {
    const points: AnalyticsChartPoint[] = [
      { label: 'Sun', value: 40, displayValue: 'P40' },
      { label: 'Mon', value: 0, displayValue: 'P0' },
      { label: 'Tue', value: 60, displayValue: 'P60' },
    ];

    expect(buildVictoryChartData(points)).toEqual([
      { label: 'Sun', value: 40, displayValue: 'P40' },
      { label: 'Mon', value: 0, displayValue: 'P0' },
      { label: 'Tue', value: 60, displayValue: 'P60' },
    ]);
  });

  it('builds the forecast chart from the latest four points and falls back when empty', () => {
    const points: AnalyticsChartPoint[] = [
      { label: 'Mon', value: 4, displayValue: '4' },
      { label: 'Tue', value: 12, displayValue: '12' },
      { label: 'Wed', value: 8, displayValue: '8' },
      { label: 'Thu', value: 14, displayValue: '14' },
      { label: 'Fri', value: 10, displayValue: '10' },
    ];

    expect(buildForecastChartData(points)).toEqual([
      { label: 'Tue', value: 12, displayValue: '12' },
      { label: 'Wed', value: 8, displayValue: '8' },
      { label: 'Thu', value: 14, displayValue: '14' },
      { label: 'Fri', value: 10, displayValue: '10' },
    ]);

    expect(buildForecastChartData([])).toEqual([
      { label: '1', value: 32, displayValue: '' },
      { label: '2', value: 54, displayValue: '' },
      { label: '3', value: 46, displayValue: '' },
      { label: '4', value: 72, displayValue: '' },
    ]);
  });
});
