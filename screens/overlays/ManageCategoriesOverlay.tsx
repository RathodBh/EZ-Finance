import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, IconButton, List, Surface, SegmentedButtons } from 'react-native-paper';
import { useAppStore } from '../../store/appStore';
import { CategoryRepository } from '../../db/repositories';
import { ThemeColors } from '../../styles/theme';
import { useRouter } from 'expo-router';
import SlideUpModal from '../../components/SlideUpModal';

const AVAILABLE_ICONS = [
  // Finance & Money
  'cash-multiple', 'bank', 'piggy-bank', 'wallet', 'coin', 'credit-card', 'trending-up', 'tag-outline',
  // Food & Drink
  'food', 'coffee', 'silverware-fork-knife',
  // Shopping & Life
  'cart', 'shopping', 'tshirt-crew', 'gift',
  // Transport & Travel
  'car', 'airplane', 'gas-station', 'subway',
  // Entertainment & Hobby
  'movie', 'gamepad-variant', 'music', 'ticket', 'dumbbell',
  // Home & Bills
  'home', 'lightning-bolt', 'water', 'phone', 'wifi',
  // Healthcare & Education
  'medical-bag', 'school', 'book-open-variant',
  // Miscellaneous
  'cog', 'shield-check', 'star', 'help-circle'
];

const CURATED_COLORS = [
  '#EF4444', // Ruby Red
  '#F59E0B', // Amber
  '#10B981', // Emerald Green
  '#3B82F6', // Blue
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#E2B85C', // Gold
  '#4B5563', // Slate Gray
];

export default function ManageCategoriesOverlay() {
  const router = useRouter();
  const { categories, theme, refreshCategories, showToast } = useAppStore();
  const activeColors = ThemeColors[theme];

  // List filter: Expense vs Income
  const [listType, setListType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Modal control
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');
  const [icon, setIcon] = useState('tag-outline');
  const [color, setColor] = useState('#EF4444');

  const filteredCategories = categories.filter(c => c.type === listType);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setName('');
    setType(listType); // preselect current active tab type
    setIcon(listType === 'EXPENSE' ? 'tag-outline' : 'cash-multiple');
    setColor(listType === 'EXPENSE' ? '#EF4444' : '#10B981');
    setShowModal(true);
  };

  const handleOpenEdit = (category: any) => {
    setEditingCategory(category);
    setName(category.name);
    setType(category.type);
    setIcon(category.icon || (category.type === 'EXPENSE' ? 'tag-outline' : 'cash-multiple'));
    setColor(category.color || (category.type === 'EXPENSE' ? '#EF4444' : '#10B981'));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast('Please enter a category name.', 'error');
      return;
    }

    try {
      if (editingCategory) {
        // Update existing category
        await CategoryRepository.update(editingCategory.id, {
          name: name.trim(),
          type,
          icon,
          color,
        });
      } else {
        // Insert new category
        await CategoryRepository.insert({
          id: 'cat_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
          name: name.trim(),
          type,
          icon,
          color,
          sortOrder: categories.length,
          isHidden: false,
          isArchived: false,
        });
      }

      await refreshCategories();
      showToast('Category saved successfully.', 'success');
      setShowModal(false);
      setName('');
    } catch (e: any) {
      showToast(`Failed to save category: ${e.message}`, 'error');
    }
  };

  const handleDelete = async (id: string) => {
    Alert.alert(
      'Delete Category',
      'Are you sure you want to delete this category?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await CategoryRepository.delete(id);
              await refreshCategories();
              showToast('Category deleted successfully.', 'success');
              setShowModal(false);
              setEditingCategory(null);
            } catch (e: any) {
              showToast(`Failed to delete category: ${e.message}`, 'error');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: activeColors.background }]}>
      {/* Header bar */}
      <View style={styles.header}>
        <IconButton icon="close" size={24} iconColor={activeColors.text} onPress={() => router.back()} />
        <Text style={[styles.title, { color: activeColors.text }]}>Manage Categories</Text>
        <IconButton icon="plus" size={24} iconColor={activeColors.primary} onPress={handleOpenAdd} />
      </View>

      {/* Tab selection */}
      <View style={styles.tabContainer}>
        <SegmentedButtons
          value={listType}
          onValueChange={(val) => setListType(val as any)}
          buttons={[
            { value: 'EXPENSE', label: 'Expenses' },
            { value: 'INCOME', label: 'Income' },
          ]}
          theme={{ colors: { secondaryContainer: activeColors.primary } }}
        />
      </View>

      <ScrollView contentContainerStyle={styles.listContent}>
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>
          {listType === 'EXPENSE' ? 'Expense Categories' : 'Income Categories'}
        </Text>
        
        {filteredCategories.length === 0 ? (
          <Surface style={[styles.emptyContainer, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]} elevation={1}>
            <Text style={{ color: activeColors.textSecondary, textAlign: 'center' }}>
              No categories found. Tap '+' to create one.
            </Text>
          </Surface>
        ) : (
          <View style={styles.listContainer}>
            {filteredCategories.map((cat) => (
              <List.Item
                key={cat.id}
                title={cat.name}
                left={(props) => (
                  <IconButton 
                    icon={cat.icon || 'tag'} 
                    iconColor={cat.color || activeColors.primary} 
                    style={{ backgroundColor: `${cat.color || activeColors.primary}15`, margin: 0 }}
                  />
                )}
                onPress={() => handleOpenEdit(cat)}
                right={(props) => <List.Icon {...props} icon="pencil-outline" color={activeColors.textSecondary} />}
                style={[styles.catItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
                titleStyle={{ color: activeColors.text, fontWeight: 'bold' }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bottom Floating Add Button */}
      <View style={[styles.bottomBar, { backgroundColor: activeColors.background }]}>
        <Button
          mode="contained"
          icon="plus"
          onPress={handleOpenAdd}
          style={[styles.addBtn, { backgroundColor: activeColors.primary }]}
          labelStyle={{ color: activeColors.background, fontWeight: 'bold', fontSize: 15 }}
        >
          Add New Category
        </Button>
      </View>

      {/* ─────────────────────────────────────────────────────────────────────────────
          ADD / EDIT CATEGORY MODAL
          ───────────────────────────────────────────────────────────────────────────── */}
      {/* ADD / EDIT CATEGORY SlideUpModal */}
      <SlideUpModal
        visible={showModal}
        onClose={() => setShowModal(false)}
        backgroundColor={activeColors.surface}
        indicatorColor={activeColors.border}
      >
        <View style={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>
              {editingCategory ? 'Edit Category' : 'Create Category'}
            </Text>
            <IconButton icon="close" size={20} iconColor={activeColors.text} onPress={() => setShowModal(false)} />
          </View>
          
          <TextInput
            label="Category Name"
            value={name}
            onChangeText={setName}
            mode="outlined"
            activeOutlineColor={activeColors.primary}
            textColor={activeColors.text}
            style={[styles.input, { backgroundColor: activeColors.surface }]}
          />

          {/* Type Select */}
          <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>Category Type</Text>
          <SegmentedButtons
            value={type}
            onValueChange={(val) => {
              const selectedVal = val as 'EXPENSE' | 'INCOME';
              setType(selectedVal);
              // Update default colors and icons if not customized
              if (!editingCategory) {
                setIcon(selectedVal === 'EXPENSE' ? 'tag-outline' : 'cash-multiple');
                setColor(selectedVal === 'EXPENSE' ? '#EF4444' : '#10B981');
              }
            }}
            buttons={[
              { value: 'EXPENSE', label: 'Expense' },
              { value: 'INCOME', label: 'Income' },
            ]}
            style={{ marginBottom: 16 }}
            theme={{ colors: { secondaryContainer: activeColors.primary } }}
          />

          {/* Color Select */}
          <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>Category Color</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.colorRow}>
            {CURATED_COLORS.map(c => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c, borderColor: activeColors.text },
                  color === c && styles.selectedColorSwatch
                ]}
                onPress={() => setColor(c)}
              />
            ))}
          </ScrollView>

          {/* Icon Select */}
          <Text style={[styles.fieldLabel, { color: activeColors.textSecondary }]}>Category Icon</Text>
          <ScrollView style={styles.iconGridScroll}>
            <View style={styles.iconGrid}>
              {AVAILABLE_ICONS.map(i => (
                <TouchableOpacity
                  key={i}
                  style={[
                    styles.iconCell,
                    { borderColor: activeColors.border },
                    icon === i && { backgroundColor: `${color}20`, borderColor: color, borderWidth: 2 }
                  ]}
                  onPress={() => setIcon(i)}
                >
                  <IconButton icon={i} iconColor={icon === i ? color : activeColors.textSecondary} size={22} style={{ margin: 0 }} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.modalActions}>
            <Button
              mode="contained"
              onPress={handleSave}
              style={[styles.modalSaveBtn, { backgroundColor: activeColors.primary }]}
              labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
            >
              {editingCategory ? 'Save Changes' : 'Create Category'}
            </Button>
            
            {editingCategory && (
              <Button
                mode="outlined"
                onPress={() => handleDelete(editingCategory.id)}
                style={[styles.modalDeleteBtn, { borderColor: activeColors.error }]}
                labelStyle={{ color: activeColors.error, fontWeight: 'bold' }}
              >
                Delete Category
              </Button>
            )}
          </View>
        </View>
      </SlideUpModal>
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
  tabContainer: {
    paddingHorizontal: 20,
    marginTop: 15,
    marginBottom: 5,
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  emptyContainer: {
    padding: 30,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    gap: 8,
  },
  catItem: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 2,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addBtn: {
    height: 48,
    justifyContent: 'center',
    borderRadius: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 8,
  },
  input: {
    marginBottom: 10,
  },
  colorRow: {
    gap: 12,
    paddingVertical: 6,
    marginBottom: 12,
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 0,
  },
  selectedColorSwatch: {
    borderWidth: 3,
  },
  iconGridScroll: {
    maxHeight: 300,
    marginBottom: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 4,
  },
  iconCell: {
    width: '18%', // ~5 columns
    aspectRatio: 1,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalActions: {
    flexDirection: 'column',
    gap: 10,
    marginTop: 10,
  },
  modalSaveBtn: {
    height: 46,
    justifyContent: 'center',
    borderRadius: 12,
  },
  modalDeleteBtn: {
    height: 46,
    justifyContent: 'center',
    borderRadius: 12,
  },
});
