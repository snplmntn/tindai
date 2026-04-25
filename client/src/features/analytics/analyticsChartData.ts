import type { AnalyticsChartPoint } from './buildAnalyticsViewModel';

export type VictoryChartDatum = {
  label: string;
  value: number;
  displayValue: string;
};

const FORECAST_FALLBACK_VALUES = [32, 54, 46, 72];

export function buildVictoryChartData(points: AnalyticsChartPoint[]): VictoryChartDatum[] {
  return points.map((point) => ({
    label: point.label,
    value: point.value,
    displayValue: point.displayValue,
  }));
}

export function buildForecastChartData(points: AnalyticsChartPoint[]): VictoryChartDatum[] {
  const trimmedPoints = points.slice(-4);

  if (trimmedPoints.length === 0) {
    return FORECAST_FALLBACK_VALUES.map((value, index) => ({
      label: `${index + 1}`,
      value,
      displayValue: '',
    }));
  }

  return buildVictoryChartData(trimmedPoints);
}

export function getVictoryChartMax(data: VictoryChartDatum[], minimum = 1) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  if (maxValue <= 0) {
    return minimum;
  }

  return Math.max(minimum, Math.ceil(maxValue * 1.15));
}
