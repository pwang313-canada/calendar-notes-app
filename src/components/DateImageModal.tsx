import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { deleteAllImagesForDate, deleteImage, getImagesForDate, saveImageForDate } from '../utils/imageStorage';

interface Props {
  visible: boolean;
  date: string;
  onClose: () => void;
  onImageChange?: () => void;
}

export default function DateImageModal({ visible, date, onClose, onImageChange }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadImages = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const uris = await getImagesForDate(date);
      setImages(uris);
    } catch (error) {
      console.error('Failed to load images:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (visible && date) {
      loadImages();
      setPendingUri(null);
    }
  }, [visible, date, loadImages]);

  const pickImage = async (useCamera: boolean) => {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Permission needed', `Please allow access to ${useCamera ? 'camera' : 'gallery'}.`);
        return;
      }

      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.8,
        allowsEditing: useCamera ? false : true,
        aspect: [4, 3],
      };

      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset?.uri) {
        Alert.alert('Error', 'No image captured.');
        return;
      }

      setPendingUri(asset.uri);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const confirmSave = async () => {
    if (!pendingUri) return;
    
    try {
      setLoading(true);
      await saveImageForDate(date, pendingUri);
      setPendingUri(null);
      await loadImages();
      onImageChange?.();
      Alert.alert('✅ Saved!', 'Picture added to this date.');
    } catch (error: any) {
      Alert.alert('Error', `Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteImage = (uri: string) => {
    Alert.alert('Delete Picture', 'Remove this picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteImage(date, uri);
            await loadImages();
            onImageChange?.();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleDeleteAll = () => {
    if (images.length === 0) return;
    Alert.alert('Delete All', `Remove all ${images.length} pictures for this date?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAllImagesForDate(date);
            setImages([]);
            onImageChange?.();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  // PREVIEW MODE
  if (pendingUri) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setPendingUri(null)}>
        <View style={styles.overlay}>
          <View style={styles.content}>
            <Text style={styles.title}>Preview</Text>
            <Image source={{ uri: pendingUri }} style={styles.previewImage} resizeMode="contain" />
            <Text style={styles.previewText}>Save this picture for {date}?</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.retakeBtn]} onPress={() => setPendingUri(null)}>
                <Text style={styles.actionText}>🔄 Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={confirmSave}>
                <Text style={styles.actionText}>💾 Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // GALLERY MODE
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>📷 Pictures for {date}</Text>
          <Text style={styles.countText}>{images.length} picture{images.length !== 1 ? 's' : ''}</Text>

          {loading && <Text style={styles.loading}>Loading...</Text>}

          <FlatList
            data={images}
            keyExtractor={(item) => item}
            horizontal={images.length > 1}
            showsHorizontalScrollIndicator={false}
            style={styles.imageList}
            contentContainerStyle={images.length <= 1 ? styles.singleImage : styles.multipleImages}
            renderItem={({ item }) => (
              <View style={styles.imageWrapper}>
                <Image source={{ uri: item }} style={images.length > 1 ? styles.thumbnail : styles.singleImageView} resizeMode="cover" />
                <TouchableOpacity style={styles.deleteIcon} onPress={() => handleDeleteImage(item)}>
                  <Text style={styles.deleteIconText}>✕</Text>
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No pictures saved yet</Text>
              </View>
            }
          />

          {images.length > 0 && (
            <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAll}>
              <Text style={styles.deleteAllText}>🗑️ Delete All Pictures</Text>
            </TouchableOpacity>
          )}

          <View style={styles.actionRow}>
            <TouchableOpacity style={[styles.actionBtn, styles.galleryBtn]} onPress={() => pickImage(false)}>
              <Text style={styles.actionText}>🖼️ Gallery</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.cameraBtn]} onPress={() => pickImage(true)}>
              <Text style={styles.actionText}>📸 Camera</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxHeight: '90%',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
    textAlign: 'center',
    marginBottom: 4,
  },
  countText: {
    fontSize: 14,
    color: '#a0aec0',
    textAlign: 'center',
    marginBottom: 12,
  },
  imageList: {
    maxHeight: 220,
    marginBottom: 12,
  },
  singleImage: {
    alignItems: 'center',
  },
  multipleImages: {
    paddingHorizontal: 4,
    gap: 8,
  },
  imageWrapper: {
    position: 'relative',
    marginRight: 8,
  },
  singleImageView: {
    width: 280,
    height: 200,
    borderRadius: 12,
    backgroundColor: '#f7fafc',
  },
  thumbnail: {
    width: 160,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#f7fafc',
  },
  deleteIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loading: {
    fontSize: 16,
    color: '#718096',
    textAlign: 'center',
    marginVertical: 20,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#a0aec0',
  },
  previewImage: {
    width: '100%',
    height: 280,
    borderRadius: 12,
    backgroundColor: '#f7fafc',
    marginBottom: 16,
  },
  previewText: {
    fontSize: 16,
    color: '#4a5568',
    marginBottom: 16,
    textAlign: 'center',
  },
  deleteAllBtn: {
    backgroundColor: '#fed7d7',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  deleteAllText: {
    color: '#c53030',
    fontWeight: '600',
    fontSize: 14,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  galleryBtn: {
    backgroundColor: '#4299e1',
  },
  cameraBtn: {
    backgroundColor: '#48bb78',
  },
  retakeBtn: {
    backgroundColor: '#a0aec0',
  },
  saveBtn: {
    backgroundColor: '#48bb78',
  },
  actionText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#edf2f7',
    alignItems: 'center',
  },
  closeText: {
    color: '#4a5568',
    fontWeight: '600',
    fontSize: 14,
  },
});