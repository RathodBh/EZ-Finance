import React from 'react';
import { Tabs } from 'expo-router';
import { ThemeColors } from '../../styles/theme';
import { useAppStore } from '../../store/appStore';
import { MaterialCommunityIcons } from '@expo/vector-icons';

export default function TabLayout() {
  const { theme } = useAppStore();
  const activeColors = ThemeColors[theme];

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: activeColors.surface,
          borderTopColor: activeColors.border,
          height: 72,
          paddingBottom: 10,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: activeColors.primary,
        tabBarInactiveTintColor: activeColors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: 'bold',
        },
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="view-dashboard-outline" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: 'History',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="swap-horizontal" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Analytics',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="chart-arc" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: 'Planning',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="calendar-range" size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="cog-outline" size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
