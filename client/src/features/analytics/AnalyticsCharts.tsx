import { StyleSheet, Text, View } from 'react-native';

import { Bar, CartesianChart, Line } from 'victory-native';

import { colors } from '@/navigation/colors';

import type { AnalyticsChartPoint } from './buildAnalyticsViewModel';
import { buildForecastChartData, buildVictoryChartData, getVictoryChartMax } from './analyticsChartData';

type TrendChartProps = {
  points: AnalyticsChartPoint[];
};

export function SalesTrendBarChart({ points }: TrendChartProps) {
  const data = buildVictoryChartData(points);

  if (data.length === 0) {
    return <Text style={styles.emptyText}>No chart data yet.</Text>;
  }

  return (
    <View style={styles.chartWrap}>
      <View style={styles.chartFrame}>
        <CartesianChart
          data={data}
          domain={{ y: [0, getVictoryChartMax(data)] }}
          padding={{ bottom: 8, left: 12, right: 12, top: 16 }}
          xKey="label"
          yKeys={['value']}
        >
          {({ chartBounds, points: chartPoints }) => (
            <Bar
              barWidth={18}
              chartBounds={chartBounds}
              color={colors.primary}
              points={chartPoints.value}
              roundedCorners={{ topLeft: 8, topRight: 8 }}
            />
          )}
        </CartesianChart>
      </View>

      <View style={styles.labelRow}>
        {data.map((point) => (
          <View key={`${point.label}-${point.displayValue}`} style={styles.labelColumn}>
            <Text style={styles.valueLabel}>{point.displayValue}</Text>
            <Text style={styles.axisLabel}>{point.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function InsightsTrendLineChart({ points }: TrendChartProps) {
  const data = buildVictoryChartData(points);

  if (data.length === 0) {
    return <Text style={styles.emptyText}>No chart data yet.</Text>;
  }

  return (
    <View style={styles.chartWrap}>
      <View style={styles.lineChartFrame}>
        <View style={styles.lineGrid} />
        <CartesianChart
          data={data}
          domain={{ y: [0, getVictoryChartMax(data)] }}
          padding={{ bottom: 12, left: 12, right: 12, top: 18 }}
          xKey="label"
          yKeys={['value']}
        >
          {({ points: chartPoints }) => <Line color={colors.primary} points={chartPoints.value} strokeWidth={4} />}
        </CartesianChart>
      </View>

      <View style={styles.labelRow}>
        {data.map((point) => (
          <View key={`${point.label}-${point.displayValue}`} style={styles.labelColumn}>
            <Text numberOfLines={1} style={styles.valueLabel}>
              {point.displayValue}
            </Text>
            <Text style={styles.axisLabel}>{point.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function ForecastSparklineChart({ points }: TrendChartProps) {
  const data = buildForecastChartData(points);

  return (
    <View style={styles.sparklineWrap}>
      <CartesianChart
        data={data}
        domain={{ y: [0, getVictoryChartMax(data)] }}
        padding={{ bottom: 2, left: 4, right: 4, top: 6 }}
        xKey="label"
        yKeys={['value']}
      >
        {({ points: chartPoints }) => <Line color="rgba(255,255,255,0.82)" points={chartPoints.value} strokeWidth={3} />}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  chartWrap: {
    gap: 12,
  },
  chartFrame: {
    height: 184,
  },
  lineChartFrame: {
    height: 208,
  },
  lineGrid: {
    ...StyleSheet.absoluteFillObject,
    top: 18,
    bottom: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(31, 122, 99, 0.08)',
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  labelColumn: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  valueLabel: {
    color: colors.primaryDeep,
    fontSize: 11,
    fontWeight: '700',
  },
  axisLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: '600',
  },
  sparklineWrap: {
    width: 104,
    height: 118,
  },
  emptyText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
});
