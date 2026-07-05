import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert, Modal, TouchableOpacity } from 'react-native';
import { Text, Button, TextInput, IconButton, List, Surface } from 'react-native-paper';
import { useAppStore } from '../../store/appStore';
import { CategoryRepository } from '../../db/repositories';
import { ThemeColors } from '../../styles/theme';

import { useRouter } from 'expo-router';

export default function ManageCategoriesOverlay() {
  const router = useRouter();
  const { categories, theme, refreshCategories } = useAppStore();
  const activeColors = ThemeColors[theme];

  // Create form states
  const [name, setName] = useState('');
  const [type, setType] = useState<'EXPENSE' | 'INCOME'>('EXPENSE');

  // Edit states
  const [editingCategory, setEditingCategory] = useState<any | null>(null);
  const [editName, setEditName] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation Error', 'Please enter a category name.');
      return;
    }

    try {
      await CategoryRepository.insert({
        id: 'cat_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36),
        name: name.trim(),
        type,
        icon: type === 'EXPENSE' ? 'tag-outline' : 'cash-multiple',
        color: type === 'EXPENSE' ? '#EF4444' : '#10B981',
        sortOrder: categories.length,
        isHidden: false,
        isArchived: false,
      });

      await refreshCategories();
      setName('');
    } catch (e: any) {
      Alert.alert('Error', `Failed to create category: ${e.message}`);
    }
  };

  const handleOpenEdit = (category: any) => {
    setEditingCategory(category);
    setEditName(category.name);
    setShowEditModal(true);
  };

  const handleUpdate = async () => {
    if (!editName.trim()) {
      Alert.alert('Validation Error', 'Please enter a name.');
      return;
    }

    try {
      await CategoryRepository.update(editingCategory.id, {
        name: editName.trim(),
      });
      await refreshCategories();
      setShowEditModal(false);
      setEditingCategory(null);
    } catch (e: any) {
      Alert.alert('Error', `Failed to update category: ${e.message}`);
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
              setShowEditModal(false);
              setEditingCategory(null);
            } catch (e: any) {
              Alert.alert('Error', `Failed to delete category: ${e.message}`);
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
        <IconButton icon="plus" size={24} iconColor={activeColors.primary} onPress={handleSave} style={{ opacity: 0 }} />
      </View>

      <ScrollView contentContainerStyle={styles.formContent}>
        {/* Categories list */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Existing Categories (Tap to Edit/Delete)</Text>
        
        <View style={styles.listContainer}>
          {categories.map((cat) => (
            <List.Item
              key={cat.id}
              title={cat.name}
              description={cat.type}
              left={(props) => <List.Icon {...props} icon={cat.icon || 'tag'} color={cat.color || activeColors.primary} />}
              onPress={() => handleOpenEdit(cat)}
              right={(props) => <List.Icon {...props} icon="pencil-outline" color={activeColors.textSecondary} />}
              style={[styles.catItem, { backgroundColor: activeColors.surface, borderColor: activeColors.border }]}
              titleStyle={{ color: activeColors.text, fontWeight: 'bold' }}
              descriptionStyle={{ color: activeColors.textSecondary }}
            />
          ))}
        </View>

        <View style={{ height: 1, backgroundColor: activeColors.border, marginVertical: 20 }} />

        {/* Add new Category */}
        <Text style={[styles.sectionLabel, { color: activeColors.textSecondary }]}>Create New Category</Text>

        <TextInput
          label="Category Name"
          value={name}
          onChangeText={setName}
          mode="outlined"
          activeOutlineColor={activeColors.primary}
          textColor={activeColors.text}
          style={[styles.input, { backgroundColor: activeColors.surface }]}
        />

        <View style={styles.btnRow}>
          <Button
            mode={type === 'EXPENSE' ? 'contained' : 'outlined'}
            onPress={() => setType('EXPENSE')}
            style={styles.flexBtn}
            theme={{ colors: { primary: activeColors.primary } }}
          >
            Expense
          </Button>
          <Button
            mode={type === 'INCOME' ? 'contained' : 'outlined'}
            onPress={() => setType('INCOME')}
            style={styles.flexBtn}
            theme={{ colors: { primary: activeColors.primary } }}
          >
            Income
          </Button>
        </View>

        <Button
          mode="contained"
          onPress={handleSave}
          style={[styles.saveBtn, { backgroundColor: activeColors.primary }]}
          labelStyle={{ color: activeColors.background, fontWeight: 'bold' }}
        >
          Add Category
        </Button>
      </ScrollView>

      {/* ─────────────────────────────────────────────────────────────────────────────
          EDIT / DELETE CATEGORY MODAL
          ───────────────────────────────────────────────────────────────────────────── */}
      <Modal visible={showEditModal} transparent animationType="slide">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowEditModal(false)}>
          <Surface style={[styles.modalContent, { backgroundColor: activeColors.surface }]} elevation={5}>
            <Text style={[styles.modalTitle, { color: activeColors.text }]}>Edit Category</Text>
            
            <TextInput
              label="Category Name"
              value={editName}
              onChangeText={setEditName}
              mode="outlined"
              activeOutlineColor={activeColors.primary}
              textColor={activeColors.text}
              style={[styles.input, { backgroundColor: activeColors.background }]}
            />

            <View style={styles.modalActions}>
              <Button
                mode="contained"
                onPress={handleUpdate}
                style={[styles.modalBtn, { backgroundColor: activeColors.primary }]}
                labelStyle={{ color: activeColors.background }}
              >
                Save Changes
              </Button>
              
              <Button
                mode="outlined"
                onPress={() => handleDelete(editingCategory.id)}
                style={[styles.modalBtn, { borderColor: activeColors.error }]}
                labelStyle={{ color: activeColors.error }}
              >
                Delete Category
              </Button>
            </View>
          </Surface>
        </TouchableOpacity>
      </Modal>
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
  sectionLabel: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listContainer: {
    gap: 8,
  },
  catItem: {
    borderRadius: 10,
    borderWidth: 1,
  },
  input: {
    marginBottom: 16,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  flexBtn: {
    flex: 1,
    borderRadius: 8,
  },
  saveBtn: {
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  modalActions: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 10,
  },
  modalBtn: {
    height: 48,
    justifyContent: 'center',
    borderRadius: 12,
  },
});
