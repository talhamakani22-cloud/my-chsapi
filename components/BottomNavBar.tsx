import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const NAV_COLORS = {
  cardBg: '#122c41',
  primaryIce: '#58aee6',
  secondaryIce: '#9fd7f5',
  iconMuted: 'rgba(182, 214, 236, 0.72)',
};

interface BottomNavBarProps {
  activeTab: 'dashboard' | 'forms' | 'settings';
  onTabChange: (tab: 'dashboard' | 'forms' | 'settings') => void;
}

const BottomNavBar: React.FC<BottomNavBarProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: 'grid' as const },
    { id: 'forms', label: 'Forms', icon: 'document-text' as const },
    { id: 'settings', label: 'Settings', icon: 'settings' as const },
  ];

  return (
    <LinearGradient
      colors={['rgba(11, 33, 50, 0.96)', 'rgba(20, 53, 78, 0.9)']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {tabs.map((tab) => (
        <TouchableOpacity
          key={tab.id}
          style={[styles.tab, activeTab === tab.id && styles.activeTab]}
          onPress={() => onTabChange(tab.id as 'dashboard' | 'forms' | 'settings')}
          activeOpacity={0.8}
        >
          {activeTab === tab.id ? (
            <LinearGradient
              colors={[NAV_COLORS.primaryIce, NAV_COLORS.secondaryIce]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.activeIconWrap}
            >
              <Ionicons name={tab.icon} size={18} color="#fff" />
            </LinearGradient>
          ) : (
            <Ionicons name={tab.icon} size={20} color={NAV_COLORS.iconMuted} />
          )}
          <Text
            style={[
              styles.label,
              activeTab === tab.id && styles.activeLabel,
            ]}
          >
            {tab.label}
          </Text>
        </TouchableOpacity>
      ))}
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: NAV_COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(132, 182, 220, 0.45)',
    paddingTop: 4,
    paddingBottom: Platform.OS === 'ios' ? 12 : 6,
    justifyContent: 'space-around',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#6baed6',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.16,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  tab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 4,
  },
  activeTab: {
    opacity: 1,
  },
  activeIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: NAV_COLORS.primaryIce,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  label: {
    fontSize: 10,
    color: NAV_COLORS.iconMuted,
    marginTop: 3,
    fontWeight: '500',
  },
  activeLabel: {
    color: NAV_COLORS.secondaryIce,
    fontWeight: '600',
  },
});

export default BottomNavBar;
