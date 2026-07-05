import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Text, SegmentedButtons, Card } from 'react-native-paper';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';

const { width } = Dimensions.get('window');

export default function ReportsScreen() {
  const { transactions, categories, theme } = useAppStore();
  const [reportType, setReportType] = useState<'expenses' | 'cashflow'>('expenses');
  const activeColors = ThemeColors[theme];

  // 1. Group Expenses by Category for Pie Chart
  const categoryData = useMemo(() => {
    const expenseTxs = transactions.filter((t) => t.type === 'EXPENSE');
    const categoryTotals = new Map<string, number>();

    expenseTxs.forEach((tx) => {
      const cat = categories.find((c) => c.id === tx.categoryId);
      const catName = cat?.name || 'Other';
      categoryTotals.set(catName, (categoryTotals.get(catName) || 0) + tx.amount);
    });

    const colors = ['#E2B85C', '#10B981', '#EF4444', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#6B7280'];
    let colorIndex = 0;

    const data: any[] = [];
    categoryTotals.forEach((total, name) => {
      data.push({
        value: total,
        color: colors[colorIndex % colors.length],
        text: name,
        label: name,
      });
      colorIndex++;
    });

    return data.sort((a, b) => b.value - a.value);
  }, [transactions, categories]);

  // 2. Monthly Income vs Expense for Bar Chart
  const barData = useMemo(() => {
    const monthlyIncomeArr = new Array(6).fill(0);
    const monthlyExpenseArr = new Array(6).fill(0);
    const monthsLabel = new Array(6).fill('');

    const now = new Date();
    
    // Setup labels for last 6 months
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      monthsLabel[5 - i] = d.toLocaleString('default', { month: 'short' });
    }

    transactions.forEach((tx) => {
      const txDate = new Date(tx.date);
      const monthDiff = (now.getFullYear() - txDate.getFullYear()) * 12 + now.getMonth() - txDate.getMonth();
      
      if (monthDiff >= 0 && monthDiff < 6) {
        const index = 5 - monthDiff;
        if (tx.type === 'INCOME') {
          monthlyIncomeArr[index] += tx.amount;
        } else if (tx.type === 'EXPENSE') {
          monthlyExpenseArr[index] += tx.amount;
        }
      }
    });

    const data: any[] = [];
    for (let i = 0; i < 6; i++) {
      // Grouped bars: Income (green) and Expense (red)
      data.push({
        value: monthlyIncomeArr[i],
        label: monthsLabel[i],
        spacing: 2,
        labelWidth: 30,
        frontColor: '#10B981', // Emerald
      });
      data.push({
        value: monthlyExpenseArr[i],
        frontColor: '#EF4444', // Red
      });
    }

    return data;
  }, [transactions]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: activeColors.text }]}>Analytics</Text>

      {/* Report Toggle Button */}
      <SegmentedButtons
        value={reportType}
        onValueChange={(val) => setReportType(val as any)}
        buttons={[
          { value: 'expenses', label: 'Expenses Category' },
          { value: 'cashflow', label: 'Cash Flow' },
        ]}
        style={styles.segmentedButtons}
        theme={{ colors: { secondaryContainer: activeColors.primary } }}
      />

      {reportType === 'expenses' ? (
        <Card style={[styles.chartCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          <Card.Content style={styles.chartCardContent}>
            <Text style={[styles.chartTitle, { color: activeColors.text }]}>Category Breakdown</Text>
            
            {categoryData.length === 0 ? (
              <Text style={[styles.emptyText, { color: activeColors.textSecondary }]}>
                Add expense transactions to generate category analysis.
              </Text>
            ) : (
              <View style={styles.pieContainer}>
                <PieChart
                  data={categoryData}
                  donut
                  sectionAutoFocus
                  radius={90}
                  innerRadius={60}
                  innerCircleColor={activeColors.surface}
                  centerLabelComponent={() => {
                    const total = categoryData.reduce((acc, curr) => acc + curr.value, 0);
                    return (
                      <View style={{ justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, color: activeColors.textSecondary }}>Total</Text>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: activeColors.text }}>
                          {formatCurrency(total)}
                        </Text>
                      </View>
                    );
                  }}
                />

                {/* Legend list */}
                <View style={styles.legendContainer}>
                  {categoryData.slice(0, 5).map((item, idx) => (
                    <View key={idx} style={styles.legendItem}>
                      <View style={[styles.legendIndicator, { backgroundColor: item.color }]} />
                      <Text style={[styles.legendLabel, { color: activeColors.text }]} numberOfLines={1}>
                        {item.text}: <Text style={{ fontWeight: 'bold' }}>{formatCurrency(item.value)}</Text>
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </Card.Content>
        </Card>
      ) : (
        <Card style={[styles.chartCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          <Card.Content>
            <Text style={[styles.chartTitle, { color: activeColors.text }]}>Income vs Expenses (Last 6 Months)</Text>
            
            <View style={styles.barLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#10B981' }]} />
                <Text style={{ color: activeColors.text, fontSize: 12 }}>Income</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendIndicator, { backgroundColor: '#EF4444' }]} />
                <Text style={{ color: activeColors.text, fontSize: 12 }}>Expenses</Text>
              </View>
            </View>

            <View style={{ marginTop: 20, alignSelf: 'center' }}>
              <BarChart
                data={barData}
                barWidth={10}
                spacing={15}
                roundedTop
                hideRules
                xAxisThickness={0}
                yAxisThickness={0}
                yAxisTextStyle={{ color: activeColors.textSecondary, fontSize: 10 }}
                noOfSections={4}
                backgroundColor="transparent"
              />
            </View>
          </Card.Content>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 100,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  segmentedButtons: {
    marginBottom: 20,
  },
  chartCard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 10,
  },
  chartCardContent: {
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 20,
    alignSelf: 'flex-start',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 40,
    fontSize: 14,
  },
  pieContainer: {
    alignItems: 'center',
    width: '100%',
  },
  legendContainer: {
    width: '100%',
    marginTop: 25,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: 13,
  },
  barLegend: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 8,
  },
});
