import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Text, IconButton, Surface, Button } from 'react-native-paper';

interface DateTimePickerModalProps {
  visible: boolean;
  initialDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
  activeColors: any;
}

export default function DateTimePickerModal({
  visible,
  initialDate,
  onConfirm,
  onCancel,
  activeColors,
}: DateTimePickerModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(() => initialDate || new Date());
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = initialDate || new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  // Time state (12-hour format)
  const [hours12, setHours12] = useState(() => {
    const d = initialDate || new Date();
    const h = d.getHours();
    return h % 12 === 0 ? 12 : h % 12;
  });
  const [minutes, setMinutes] = useState(() => {
    const d = initialDate || new Date();
    return d.getMinutes();
  });
  const [period, setPeriod] = useState<'AM' | 'PM'>(() => {
    const d = initialDate || new Date();
    return d.getHours() >= 12 ? 'PM' : 'AM';
  });

  useEffect(() => {
    if (visible) {
      const d = initialDate || new Date();
      setSelectedDate(new Date(d.getTime()));
      setViewMonth(new Date(d.getFullYear(), d.getMonth(), 1));
      const h = d.getHours();
      setHours12(h % 12 === 0 ? 12 : h % 12);
      setMinutes(d.getMinutes());
      setPeriod(h >= 12 ? 'PM' : 'AM');
    }
  }, [visible, initialDate]);

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();

  const handlePrevMonth = () => {
    setViewMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth(new Date(year, month + 1, 1));
  };

  const handleSelectDay = (day: number) => {
    const newD = new Date(selectedDate);
    newD.setFullYear(year, month, day);
    setSelectedDate(newD);
  };

  const handleQuickPreset = (type: 'today' | 'yesterday') => {
    const now = new Date();
    if (type === 'yesterday') {
      now.setDate(now.getDate() - 1);
    }
    const newD = new Date(selectedDate);
    newD.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    setSelectedDate(newD);
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleSetNow = () => {
    const now = new Date();
    const h = now.getHours();
    setHours12(h % 12 === 0 ? 12 : h % 12);
    setMinutes(now.getMinutes());
    setPeriod(h >= 12 ? 'PM' : 'AM');
  };

  const changeHour = (delta: number) => {
    setHours12(prev => {
      let next = prev + delta;
      if (next > 12) next = 1;
      if (next < 1) next = 12;
      return next;
    });
  };

  const changeMinute = (delta: number) => {
    setMinutes(prev => {
      let next = prev + delta;
      if (next >= 60) next = 0;
      if (next < 0) next = 55;
      return next;
    });
  };

  const handleDone = () => {
    let finalHour = hours12 % 12;
    if (period === 'PM') {
      finalHour += 12;
    }
    const result = new Date(selectedDate);
    result.setHours(finalHour, minutes, 0, 0);
    onConfirm(result);
  };

  const days = [];
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(i);
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <Surface style={[styles.dialogCard, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View>
              <Text style={[styles.modalTitle, { color: activeColors.text }]}>Transaction Date & Time</Text>
              <Text style={[styles.modalSubtitle, { color: activeColors.primary }]}>
                {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })} • {String(hours12).padStart(2, '0')}:{String(minutes).padStart(2, '0')} {period}
              </Text>
            </View>
            <IconButton icon="close" size={22} iconColor={activeColors.textSecondary} onPress={onCancel} style={{ margin: 0 }} />
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.bodyScroll}>
            {/* Quick date presets */}
            <View style={styles.quickPresetsRow}>
              <TouchableOpacity
                style={[styles.presetChip, { borderColor: activeColors.border }]}
                onPress={() => handleQuickPreset('today')}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: activeColors.text }}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetChip, { borderColor: activeColors.border }]}
                onPress={() => handleQuickPreset('yesterday')}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: activeColors.text }}>Yesterday</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.presetChip, { borderColor: activeColors.border }]}
                onPress={handleSetNow}
              >
                <Text style={{ fontSize: 12, fontWeight: '600', color: activeColors.primary }}>Set Current Time</Text>
              </TouchableOpacity>
            </View>

            {/* Calendar Month Navigation */}
            <View style={styles.monthNav}>
              <IconButton icon="chevron-left" size={20} iconColor={activeColors.text} onPress={handlePrevMonth} style={{ margin: 0 }} />
              <Text style={[styles.monthLabel, { color: activeColors.text }]}>
                {monthNames[month]} {year}
              </Text>
              <IconButton icon="chevron-right" size={20} iconColor={activeColors.text} onPress={handleNextMonth} style={{ margin: 0 }} />
            </View>

            {/* Weekday headers */}
            <View style={styles.weekdaysRow}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w, idx) => (
                <Text key={idx} style={[styles.weekdayText, { color: activeColors.textSecondary }]}>{w}</Text>
              ))}
            </View>

            {/* Days grid */}
            <View style={styles.daysGrid}>
              {days.map((day, idx) => {
                if (day === null) {
                  return <View key={idx} style={styles.dayCell} />;
                }
                const isSelected =
                  selectedDate.getFullYear() === year &&
                  selectedDate.getMonth() === month &&
                  selectedDate.getDate() === day;

                const isToday =
                  new Date().getFullYear() === year &&
                  new Date().getMonth() === month &&
                  new Date().getDate() === day;

                return (
                  <TouchableOpacity
                    key={idx}
                    style={[
                      styles.dayCell,
                      isSelected && { backgroundColor: activeColors.primary, borderRadius: 18 },
                      !isSelected && isToday && { borderWidth: 1, borderColor: activeColors.primary, borderRadius: 18 },
                    ]}
                    onPress={() => handleSelectDay(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        { color: isSelected ? activeColors.background : activeColors.text },
                        isSelected && { fontWeight: 'bold' },
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Time Selector */}
            <View style={[styles.timeSection, { borderTopColor: activeColors.border }]}>
              <Text style={[styles.sectionTitle, { color: activeColors.textSecondary }]}>TIME</Text>
              <View style={styles.timeControlsRow}>
                {/* Hours Stepper */}
                <View style={[styles.stepperContainer, { backgroundColor: activeColors.background, borderColor: activeColors.border }]}>
                  <IconButton icon="plus" size={16} iconColor={activeColors.primary} onPress={() => changeHour(1)} style={styles.stepBtn} />
                  <Text style={[styles.timeDigit, { color: activeColors.text }]}>{String(hours12).padStart(2, '0')}</Text>
                  <IconButton icon="minus" size={16} iconColor={activeColors.primary} onPress={() => changeHour(-1)} style={styles.stepBtn} />
                </View>

                <Text style={[styles.colonText, { color: activeColors.text }]}>:</Text>

                {/* Minutes Stepper */}
                <View style={[styles.stepperContainer, { backgroundColor: activeColors.background, borderColor: activeColors.border }]}>
                  <IconButton icon="plus" size={16} iconColor={activeColors.primary} onPress={() => changeMinute(5)} style={styles.stepBtn} />
                  <Text style={[styles.timeDigit, { color: activeColors.text }]}>{String(minutes).padStart(2, '0')}</Text>
                  <IconButton icon="minus" size={16} iconColor={activeColors.primary} onPress={() => changeMinute(-5)} style={styles.stepBtn} />
                </View>

                {/* AM / PM Segment */}
                <View style={styles.amPmContainer}>
                  <TouchableOpacity
                    style={[
                      styles.amPmBtn,
                      period === 'AM'
                        ? { backgroundColor: activeColors.primary }
                        : { backgroundColor: activeColors.background, borderColor: activeColors.border, borderWidth: 1 }
                    ]}
                    onPress={() => setPeriod('AM')}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 12, color: period === 'AM' ? activeColors.background : activeColors.textSecondary }}>AM</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.amPmBtn,
                      period === 'PM'
                        ? { backgroundColor: activeColors.primary }
                        : { backgroundColor: activeColors.background, borderColor: activeColors.border, borderWidth: 1 }
                    ]}
                    onPress={() => setPeriod('PM')}
                  >
                    <Text style={{ fontWeight: '700', fontSize: 12, color: period === 'PM' ? activeColors.background : activeColors.textSecondary }}>PM</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={[styles.actionRow, { borderTopColor: activeColors.border }]}>
            <Button mode="outlined" onPress={onCancel} style={{ flex: 1, marginRight: 8, borderColor: activeColors.border }} textColor={activeColors.textSecondary}>
              Cancel
            </Button>
            <Button mode="contained" onPress={handleDone} style={{ flex: 1.5, backgroundColor: activeColors.primary }} labelStyle={{ fontWeight: 'bold', color: activeColors.background }}>
              Apply
            </Button>
          </View>
        </Surface>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '90%',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  bodyScroll: {
    paddingHorizontal: 16,
  },
  quickPresetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  monthNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  weekdaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  weekdayText: {
    width: '14.28%',
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    marginBottom: 12,
  },
  dayCell: {
    width: '14.28%',
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  dayText: {
    fontSize: 13,
  },
  timeSection: {
    borderTopWidth: 1,
    paddingTop: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  timeControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  stepperContainer: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  stepBtn: {
    margin: 0,
    width: 28,
    height: 28,
  },
  timeDigit: {
    fontSize: 20,
    fontWeight: 'bold',
    paddingVertical: 2,
    minWidth: 28,
    textAlign: 'center',
  },
  colonText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  amPmContainer: {
    flexDirection: 'column',
    gap: 6,
    marginLeft: 6,
  },
  amPmBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
  },
});
