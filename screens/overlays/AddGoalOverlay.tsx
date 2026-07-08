import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, Button, TextInput, IconButton } from 'react-native-paper';
import { useAppStore } from '../../store/appStore';
import { GoalRepository } from '../../db/repositories';
import { ThemeColors } from '../../styles/theme';
import { getCurrencySymbol } from '../../services/utils';

import { useRouter } from 'expo-router';

export default function AddGoalOverlay() {
  const router = useRouter();
  const { theme, refreshGoals, currency } = useAppStore();
  const activeColors = ThemeColors[theme];

  // Forms states
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [startingVal, setStartingVal] = useState('');
  const [icon, setIcon] = useState('trophy-outline');

  const ICONS = ['trophy-outline', 'home-outline', 'car-outline', 'airplane-takeoff', 'school-outline', 'heart-outline'];

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a goal name.');
      return;
    }

    const numTarget = parseFloat(target);
    if (isNaN(numTarget) || numTarget <= 0) {
      Alert.alert('Validation Error', 'Please enter a valid target amount.');
      return;
    }

    const currentSaved = parseFloat(startingVal) || 0;

    try {
      await GoalRepository.insert({
        id: 'gol_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        name: name.trim(),
        type: 'SAVINGS',
        targetAmount: numTarget,
        currentAmount: currentSaved,
        icon,
        color: '#10B981', // Emerald theme default
      });

      await refreshGoals();
      router.back();
    } catch (e: any) {
      Alert.alert('Error', `Failed to create goal: ${e.message}`);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <IconButton icon="close" size={24} iconColor={activeColors.text} onPress={() => router.back()} />
        <Text style={[styles.title, { color: activeColors.text }]}>Add Financial Goal</Text>
        <IconButton icon="check" size={24} iconColor={activeColors.primary} onPress={handleSave} />
      </View>

      <ScrollView contentContainerStyle={styles.formContent}>
        <TextInput
          label="Goal Name (e.g. Dream House, Vacation)"
          value={name}
          onChangeText={setName}
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
        />

        <TextInput
          label="Target Amount"
          value={target}
          onChangeText={setTarget}
          keyboardType="numeric"
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
          left={<TextInput.Affix text={`${getCurrencySymbol(currency)} `} />}
        />

        <TextInput
          label="Starting Saved Amount (Optional)"
          value={startingVal}
          onChangeText={setStartingVal}
          keyboardType="numeric"
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
          left={<TextInput.Affix text={`${getCurrencySymbol(currency)} `} />}
        />

        {/* Icon selector */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Choose Goal Icon</Text>
        <View style={styles.iconRow}>
          {ICONS.map((i) => (
            <IconButton
              key={i}
              icon={i}
              size={32}
              style={[
                styles.iconBtn,
                icon === i 
                  ? { backgroundColor: activeColors.primary } 
                  : { backgroundColor: activeColors.surface }
              ]}
              iconColor={icon === i ? activeColors.background : activeColors.text}
              onPress={() => setIcon(i)}
            />
          ))}
        </View>

        <Button
          mode="contained"
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: activeColors.primary }]}
          labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
        >
          Create Goal
        </Button>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 50,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    paddingBottom: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  formContent: {
    padding: 20,
    paddingBottom: 60,
  },
  input: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 12,
  },
  iconRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  iconBtn: {
    borderRadius: 12,
  },
  saveBtn: {
    height: 48,
    justifyContent: 'center',
    borderRadius: 12,
  },
});
