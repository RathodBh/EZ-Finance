import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { Text, IconButton, Surface, Button } from 'react-native-paper';

interface DatePickerModalProps {
  visible: boolean;
  startDate: Date | null;
  endDate: Date | null;
  onSelectRange: (start: Date | null, end: Date | null) => void;
  onClose: () => void;
  title: string;
  activeColors: any;
}

export default function DatePickerModal({
  visible,
  startDate,
  endDate,
  onSelectRange,
  onClose,
  title,
  activeColors
}: DatePickerModalProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const reference = startDate || endDate || new Date();
    return new Date(reference.getFullYear(), reference.getMonth(), 1);
  });

  // Reset to display the correct month when visible changes
  useEffect(() => {
    if (visible) {
      const reference = startDate || endDate || new Date();
      setCurrentMonth(new Date(reference.getFullYear(), reference.getMonth(), 1));
    }
  }, [visible]);

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const days = [];
  // previous month blank spaces
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  // current month days
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handleDayPress = (day: number) => {
    const clickedDate = new Date(year, month, day);

    if (!startDate || (startDate && endDate)) {
      // Start a new selection
      onSelectRange(clickedDate, null);
    } else {
      // We have a startDate, but no endDate
      if (clickedDate < startDate) {
        // Clicked date is before start date, set as new start date
        onSelectRange(clickedDate, null);
      } else {
        // Set as end date
        onSelectRange(startDate, clickedDate);
      }
    }
  };

  const getDayDetails = (day: number | null) => {
    if (day === null) return { style: [styles.dayCell], textStyle: { color: 'transparent' }, isSelected: false };

    const checkDate = new Date(year, month, day);
    const checkMs = checkDate.getTime();
    
    const startMs = startDate ? new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime() : 0;
    const endMs = endDate ? new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate()).getTime() : 0;

    const isStart = startDate && checkMs === startMs;
    const isEnd = endDate && checkMs === endMs;
    const isInRange = startDate && endDate && checkMs > startMs && checkMs < endMs;

    if (isStart) {
      return {
        style: [styles.dayCell, { backgroundColor: activeColors.primary, borderRadius: 18 }],
        textStyle: { color: activeColors.background, fontWeight: 'bold' as const },
        isSelected: true
      };
    }
    if (isEnd) {
      return {
        style: [styles.dayCell, { backgroundColor: activeColors.primary, borderRadius: 18 }],
        textStyle: { color: activeColors.background, fontWeight: 'bold' as const },
        isSelected: true
      };
    }
    if (isInRange) {
      return {
        style: [styles.dayCell, { backgroundColor: `${activeColors.primary}25`, borderRadius: 0 }],
        textStyle: { color: activeColors.text, fontWeight: '500' as const },
        isSelected: false
      };
    }
    return {
      style: [styles.dayCell],
      textStyle: { color: activeColors.text },
      isSelected: false
    };
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={{ width: '90%', maxWidth: 350 }}>
          <Surface style={[styles.container, { backgroundColor: activeColors.surface }]} elevation={5}>
            <Text style={[styles.title, { color: activeColors.text }]}>{title}</Text>
            
            {/* Header: Month and Year navigation */}
            <View style={styles.header}>
              <IconButton icon="chevron-left" iconColor={activeColors.text} onPress={handlePrevMonth} style={{ margin: 0 }} />
              <Text style={[styles.monthYear, { color: activeColors.text }]}>
                {monthNames[month]} {year}
              </Text>
              <IconButton icon="chevron-right" iconColor={activeColors.text} onPress={handleNextMonth} style={{ margin: 0 }} />
            </View>

            {/* Week day labels */}
            <View style={styles.weekLabels}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
                <Text key={d} style={[styles.weekDayText, { color: activeColors.textSecondary }]}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Calendar grid */}
            <View style={styles.grid}>
              {days.map((day, idx) => {
                if (day === null) {
                  return <View key={`blank-${idx}`} style={styles.dayCell} />;
                }
                const details = getDayDetails(day);
                return (
                  <TouchableOpacity
                    key={`day-${day}`}
                    style={details.style}
                    onPress={() => handleDayPress(day)}
                  >
                    <Text style={[styles.dayText, details.textStyle]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Range selected text preview */}
            <View style={styles.rangePreview}>
              <Text style={{ color: activeColors.textSecondary, fontSize: 12, textAlign: 'center' }}>
                Selected: {startDate ? startDate.toLocaleDateString() : '...'} to {endDate ? endDate.toLocaleDateString() : '...'}
              </Text>
            </View>

            {/* Bottom Actions */}
            <View style={styles.actions}>
              <Button
                mode="text"
                textColor={activeColors.error}
                onPress={() => {
                  onSelectRange(null, null);
                }}
              >
                Clear
              </Button>
              <Button mode="text" textColor={activeColors.textSecondary} onPress={onClose}>
                Cancel
              </Button>
              <Button mode="text" textColor={activeColors.primary} onPress={onClose}>
                Apply
              </Button>
            </View>
          </Surface>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    borderRadius: 20,
    padding: 16,
    width: '100%',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  monthYear: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  weekLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  weekDayText: {
    width: 36,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  dayCell: {
    width: '14.28%', // 100% / 7
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    marginVertical: 2,
  },
  dayText: {
    fontSize: 13,
    fontWeight: '500',
  },
  rangePreview: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 15,
    gap: 10,
  },
});
