import React, { useMemo, useState } from 'react';
import { View, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { Text, SegmentedButtons, Card, Chip, IconButton } from 'react-native-paper';
import { BarChart, PieChart } from 'react-native-gifted-charts';
import { useAppStore } from '../store/appStore';
import { ThemeColors } from '../styles/theme';
import DatePickerModal from '../components/DatePickerModal';

import { formatCurrency as formatCurrencyUtil } from '../services/utils';

const { width } = Dimensions.get('window');

type TimeframeType = 'DAY' | 'WEEK' | 'MONTH' | '3MONTH' | '6MONTH' | 'CUSTOM';

export default function ReportsScreen() {
  const { transactions, categories, theme, currency } = useAppStore();
  const [reportType, setReportType] = useState<'expenses' | 'cashflow'>('expenses');
  const activeColors = ThemeColors[theme];

  // Timeframe and Navigation States
  const [timeframe, setTimeframe] = useState<TimeframeType>('6MONTH');
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  
  // Custom Date range states
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Time range calculation helper
  const timeRange = useMemo(() => {
    let start = new Date();
    let end = new Date();
    let label = '';

    const ref = new Date(referenceDate);

    switch (timeframe) {
      case 'DAY': {
        start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 0, 0, 0, 0);
        end = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 23, 59, 59, 999);
        label = ref.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
        break;
      }
      case 'WEEK': {
        // Start of week (Sunday)
        const dayOfWeek = ref.getDay();
        const startDay = new Date(ref.setDate(ref.getDate() - dayOfWeek));
        start = new Date(startDay.getFullYear(), startDay.getMonth(), startDay.getDate(), 0, 0, 0, 0);
        
        const endDay = new Date(startDay);
        endDay.setDate(endDay.getDate() + 6);
        end = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate(), 23, 59, 59, 999);

        const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
        label = `Week: ${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}, ${end.getFullYear()}`;
        break;
      }
      case 'MONTH': {
        start = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
        label = ref.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        break;
      }
      case '3MONTH': {
        start = new Date(ref.getFullYear(), ref.getMonth() - 2, 1, 0, 0, 0, 0);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
        const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
        label = `3 Months: ${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
        break;
      }
      case '6MONTH': {
        start = new Date(ref.getFullYear(), ref.getMonth() - 5, 1, 0, 0, 0, 0);
        end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
        const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', year: 'numeric' };
        label = `6 Months: ${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
        break;
      }
      case 'CUSTOM': {
        if (startDate && endDate) {
          start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0);
          end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999);
          const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
          label = `Custom: ${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', formatOptions)}`;
        } else {
          start = new Date(ref.getFullYear(), ref.getMonth() - 5, 1, 0, 0, 0, 0);
          end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 23, 59, 59, 999);
          label = 'Select Custom Date Range';
        }
        break;
      }
    }

    return { start, end, label };
  }, [timeframe, referenceDate, startDate, endDate]);

  // Filter transactions within the selected timeframe
  const filteredTxs = useMemo(() => {
    const startMs = timeRange.start.getTime();
    const endMs = timeRange.end.getTime();
    
    if (timeframe === 'CUSTOM' && (!startDate || !endDate)) {
      return [];
    }

    return transactions.filter((t) => t.date >= startMs && t.date <= endMs);
  }, [transactions, timeRange, timeframe, startDate, endDate]);

  // 1. Group Expenses by Category for Pie Chart
  const categoryData = useMemo(() => {
    const expenseTxs = filteredTxs.filter((t) => t.type === 'EXPENSE');
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
  }, [filteredTxs, categories]);

  // 2. Dynamic Income vs Expense for Bar Chart
  const barData = useMemo(() => {
    let size = 6;
    let labels: string[] = [];
    let incomes: number[] = [];
    let expenses: number[] = [];

    const now = new Date(referenceDate);

    if (timeframe === 'DAY') {
      // Show selected day compared to previous 5 days (6 days total)
      size = 6;
      incomes = new Array(size).fill(0);
      expenses = new Array(size).fill(0);
      labels = new Array(size).fill('');
      
      for (let i = 5; i >= 0; i--) {
        const d = new Date(timeRange.start);
        d.setDate(d.getDate() - i);
        labels[5 - i] = d.toLocaleDateString('default', { weekday: 'short', day: 'numeric' });
        
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
        
        transactions.forEach((tx) => {
          if (tx.date >= dayStart && tx.date <= dayEnd) {
            if (tx.type === 'INCOME') incomes[5 - i] += tx.amount;
            else if (tx.type === 'EXPENSE') expenses[5 - i] += tx.amount;
          }
        });
      }
    } else if (timeframe === 'WEEK') {
      // Show daily breakdown of the selected week (7 days)
      size = 7;
      incomes = new Array(size).fill(0);
      expenses = new Array(size).fill(0);
      labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      const startOfWeek = new Date(timeRange.start);
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
        
        transactions.forEach((tx) => {
          if (tx.date >= dayStart && tx.date <= dayEnd) {
            if (tx.type === 'INCOME') incomes[i] += tx.amount;
            else if (tx.type === 'EXPENSE') expenses[i] += tx.amount;
          }
        });
      }
    } else if (timeframe === 'MONTH') {
      // Show weekly breakdown of the selected month (4 weeks)
      size = 4;
      incomes = new Array(size).fill(0);
      expenses = new Array(size).fill(0);
      labels = ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'];

      const getWeekIndex = (day: number) => {
        if (day <= 7) return 0;
        if (day <= 14) return 1;
        if (day <= 21) return 2;
        return 3;
      };

      filteredTxs.forEach((tx) => {
        const txDate = new Date(tx.date);
        const wIdx = getWeekIndex(txDate.getDate());
        if (tx.type === 'INCOME') incomes[wIdx] += tx.amount;
        else if (tx.type === 'EXPENSE') expenses[wIdx] += tx.amount;
      });
    } else if (timeframe === '3MONTH' || timeframe === '6MONTH') {
      // Show monthly breakdown of the selected period (3 or 6 months)
      size = timeframe === '3MONTH' ? 3 : 6;
      incomes = new Array(size).fill(0);
      expenses = new Array(size).fill(0);
      labels = new Array(size).fill('');
      
      const startM = timeRange.start.getMonth();
      const startY = timeRange.start.getFullYear();
      
      for (let i = 0; i < size; i++) {
        const d = new Date(startY, startM + i, 1);
        labels[i] = d.toLocaleString('default', { month: 'short' });
        
        const mStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
        const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
        
        transactions.forEach((tx) => {
          if (tx.date >= mStart && tx.date <= mEnd) {
            if (tx.type === 'INCOME') incomes[i] += tx.amount;
            else if (tx.type === 'EXPENSE') expenses[i] += tx.amount;
          }
        });
      }
    } else if (timeframe === 'CUSTOM') {
      // Dynamic grouping based on custom range size
      const diffDays = Math.ceil((timeRange.end.getTime() - timeRange.start.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 8) {
        // Daily
        size = diffDays;
        incomes = new Array(size).fill(0);
        expenses = new Array(size).fill(0);
        labels = new Array(size).fill('');
        for (let i = 0; i < size; i++) {
          const d = new Date(timeRange.start);
          d.setDate(d.getDate() + i);
          labels[i] = d.toLocaleDateString('default', { weekday: 'short', day: 'numeric' });
          
          const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).getTime();
          const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime();
          
          filteredTxs.forEach((tx) => {
            if (tx.date >= dayStart && tx.date <= dayEnd) {
              if (tx.type === 'INCOME') incomes[i] += tx.amount;
              else if (tx.type === 'EXPENSE') expenses[i] += tx.amount;
            }
          });
        }
      } else if (diffDays <= 45) {
        // Weekly
        size = Math.ceil(diffDays / 7);
        incomes = new Array(size).fill(0);
        expenses = new Array(size).fill(0);
        labels = new Array(size).fill('');
        for (let i = 0; i < size; i++) {
          labels[i] = `Wk ${i + 1}`;
          const weekStart = timeRange.start.getTime() + i * 7 * 24 * 60 * 60 * 1000;
          const weekEnd = weekStart + 7 * 24 * 60 * 60 * 1000 - 1;
          filteredTxs.forEach((tx) => {
            if (tx.date >= weekStart && tx.date <= weekEnd) {
              if (tx.type === 'INCOME') incomes[i] += tx.amount;
              else if (tx.type === 'EXPENSE') expenses[i] += tx.amount;
            }
          });
        }
      } else {
        // Monthly
        const startM = timeRange.start.getMonth();
        const startY = timeRange.start.getFullYear();
        const endM = timeRange.end.getMonth();
        const endY = timeRange.end.getFullYear();
        const totalMonths = (endY - startY) * 12 + (endM - startM) + 1;
        
        size = Math.min(totalMonths, 12); // Cap at 12 months
        incomes = new Array(size).fill(0);
        expenses = new Array(size).fill(0);
        labels = new Array(size).fill('');
        for (let i = 0; i < size; i++) {
          const d = new Date(startY, startM + i, 1);
          labels[i] = d.toLocaleString('default', { month: 'short' });
          
          const mStart = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0).getTime();
          const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
          
          filteredTxs.forEach((tx) => {
            if (tx.date >= mStart && tx.date <= mEnd) {
              if (tx.type === 'INCOME') incomes[i] += tx.amount;
              else if (tx.type === 'EXPENSE') expenses[i] += tx.amount;
            }
          });
        }
      }
    }

    const data: any[] = [];
    for (let i = 0; i < size; i++) {
      data.push({
        value: incomes[i] || 0,
        label: labels[i] || '',
        spacing: 2,
        labelWidth: 32,
        frontColor: '#10B981', // Emerald Green (Income)
      });
      data.push({
        value: expenses[i] || 0,
        frontColor: '#EF4444', // Ruby Red (Expense)
      });
    }

    return data;
  }, [transactions, filteredTxs, timeframe, referenceDate, timeRange, startDate, endDate]);

  const handlePrevRange = () => {
    setReferenceDate((prev) => {
      const d = new Date(prev);
      switch (timeframe) {
        case 'DAY':
          d.setDate(d.getDate() - 1);
          break;
        case 'WEEK':
          d.setDate(d.getDate() - 7);
          break;
        case 'MONTH':
          d.setMonth(d.getMonth() - 1);
          break;
        case '3MONTH':
          d.setMonth(d.getMonth() - 3);
          break;
        case '6MONTH':
          d.setMonth(d.getMonth() - 6);
          break;
      }
      return d;
    });
  };

  const handleNextRange = () => {
    setReferenceDate((prev) => {
      const d = new Date(prev);
      switch (timeframe) {
        case 'DAY':
          d.setDate(d.getDate() + 1);
          break;
        case 'WEEK':
          d.setDate(d.getDate() + 7);
          break;
        case 'MONTH':
          d.setMonth(d.getMonth() + 1);
          break;
        case '3MONTH':
          d.setMonth(d.getMonth() + 3);
          break;
        case '6MONTH':
          d.setMonth(d.getMonth() + 6);
          break;
      }
      return d;
    });
  };

  const formatCurrency = (val: number) => {
    return formatCurrencyUtil(val, currency);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: activeColors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: activeColors.text }]}>Analytics</Text>

      {/* Timeframe selector (horizontal chips) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.timeframeScroll}>
        {([
          { value: 'DAY', label: 'Day' },
          { value: 'WEEK', label: 'Week' },
          { value: 'MONTH', label: 'Month' },
          { value: '3MONTH', label: '3 Months' },
          { value: '6MONTH', label: '6 Months' },
          { value: 'CUSTOM', label: 'Custom' },
        ] as const).map((item) => (
          <Chip
            key={item.value}
            selected={timeframe === item.value}
            onPress={() => setTimeframe(item.value)}
            style={[
              styles.chip,
              timeframe === item.value
                ? { backgroundColor: activeColors.primary }
                : { backgroundColor: activeColors.surface }
            ]}
            selectedColor={timeframe === item.value ? activeColors.background : activeColors.text}
            showSelectedOverlay
          >
            {item.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Range Navigation Controls / Date Selectors */}
      {timeframe === 'CUSTOM' ? (
        <View style={styles.customDateContainer}>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
            onPress={() => setShowDatePicker(true)}
          >
            <IconButton icon="calendar-month" size={18} iconColor={activeColors.primary} style={{ margin: 0 }} />
            <Text style={{ color: (startDate || endDate) ? activeColors.text : activeColors.textSecondary, fontSize: 13, fontWeight: '500', marginLeft: 4 }}>
              {startDate && endDate 
                ? `${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                : startDate
                  ? `From: ${startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
                  : 'Select Date Range'
              }
            </Text>
          </TouchableOpacity>
          {(startDate || endDate) && (
            <IconButton
              icon="close-circle"
              iconColor={activeColors.error}
              size={22}
              onPress={() => {
                setStartDate(null);
                setEndDate(null);
              }}
              style={{ margin: 0 }}
            />
          )}
        </View>
      ) : (
        <View style={[styles.navigationContainer, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          <IconButton icon="chevron-left" iconColor={activeColors.text} size={20} onPress={handlePrevRange} style={{ margin: 0 }} />
          <Text style={[styles.rangeLabel, { color: activeColors.text }]}>{timeRange.label}</Text>
          <IconButton icon="chevron-right" iconColor={activeColors.text} size={20} onPress={handleNextRange} style={{ margin: 0 }} />
          <IconButton icon="refresh" iconColor={activeColors.primary} size={18} onPress={() => setReferenceDate(new Date())} style={{ margin: 0, marginLeft: 4 }} />
        </View>
      )}

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
            <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={[styles.chartTitle, { color: activeColors.text }]}>Category Breakdown</Text>
              {timeframe === 'CUSTOM' && (startDate && endDate) && (
                <Text style={{ color: activeColors.textSecondary, fontSize: 11 }}>{timeRange.label}</Text>
              )}
            </View>
            
            {categoryData.length === 0 ? (
              <Text style={[styles.emptyText, { color: activeColors.textSecondary }]}>
                {timeframe === 'CUSTOM' && (!startDate || !endDate)
                  ? 'Please select a date range.'
                  : 'No expense transactions recorded in this range.'}
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
            <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <Text style={[styles.chartTitle, { color: activeColors.text }]}>Income vs Expenses</Text>
              {timeframe === 'CUSTOM' && (startDate && endDate) && (
                <Text style={{ color: activeColors.textSecondary, fontSize: 11 }}>{timeRange.label}</Text>
              )}
            </View>
            
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

            {timeframe === 'CUSTOM' && (!startDate || !endDate) ? (
              <Text style={[styles.emptyText, { color: activeColors.textSecondary }]}>
                Please select a date range.
              </Text>
            ) : barData.length === 0 ? (
              <Text style={[styles.emptyText, { color: activeColors.textSecondary }]}>
                No data available.
              </Text>
            ) : (
              <View style={{ marginTop: 20, alignSelf: 'center', width: '100%' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
                  <View style={{ alignSelf: 'center', minWidth: width - 80, paddingLeft: 10 }}>
                    <BarChart
                      data={barData}
                      barWidth={barData.length > 12 ? 8 : 12}
                      spacing={barData.length > 12 ? 8 : 14}
                      roundedTop
                      hideRules
                      xAxisThickness={0}
                      yAxisThickness={0}
                      yAxisTextStyle={{ color: activeColors.textSecondary, fontSize: 10 }}
                      noOfSections={4}
                      backgroundColor="transparent"
                    />
                  </View>
                </ScrollView>
              </View>
            )}
          </Card.Content>
        </Card>
      )}

      {/* Date Picker Modal for Custom Timeframe */}
      <DatePickerModal
        visible={showDatePicker}
        startDate={startDate}
        endDate={endDate}
        onSelectRange={(start, end) => {
          setStartDate(start);
          setEndDate(end);
        }}
        onClose={() => setShowDatePicker(false)}
        title="Select Date Range"
        activeColors={activeColors}
      />
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
    marginBottom: 16,
  },
  timeframeScroll: {
    gap: 8,
    paddingVertical: 4,
    marginBottom: 14,
  },
  chip: {
    borderRadius: 8,
  },
  customDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
  },
  navigationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 18,
  },
  rangeLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    flex: 1,
    textAlign: 'center',
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
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 60,
    fontSize: 14,
  },
  pieContainer: {
    alignItems: 'center',
    width: '100%',
    marginTop: 15,
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
