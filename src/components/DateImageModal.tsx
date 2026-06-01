import { ResizeMode, Video } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
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
import {
  deleteAllImagesForDate,
  deleteAllVideosForDate,
  deleteImage,
  deleteVideo,
  getImagesForDate,
  getVideosForDate,
  saveImageForDate,
  saveVideoForDate,
} from '../utils/imageStorage';

interface Props {
  visible: boolean;
  date: string;
  onClose: () => void;
  onImageChange?: () => void;
}

export default function DateImageModal({ visible, date, onClose, onImageChange }: Props) {
  const [images, setImages] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [pendingUri, setPendingUri] = useState<string | null>(null);
  const [pendingType, setPendingType] = useState<'image' | 'video'>('image');
  const [loading, setLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<'image' | 'video'>('image');

  const loadMedia = useCallback(async () => {
    if (!date) return;
    setLoading(true);
    try {
      const [imageUris, videoUris] = await Promise.all([
        getImagesForDate(date),
        getVideosForDate(date),
      ]);
      setImages(imageUris);
      setVideos(videoUris);
    } catch (error) {
      console.error('Failed to load media:', error);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    if (visible && date) {
      loadMedia();
      setPendingUri(null);
    }
  }, [visible, date, loadMedia]);

  // ----- Pick / Record helpers -----
  const checkDuration = (durationMillis?: number | null): boolean => {
    if (durationMillis == null) return true;
    const durationSec = durationMillis / 1000;
    if (durationSec > 20) { // Changed from 10 to 20
      Alert.alert('Video too long', 'Please select a video shorter than 20 seconds.');
      return false;
    }
    return true;
  };

  const pickImage = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setPendingUri(result.assets[0].uri);
          setPendingType('image');
        } else {
          Alert.alert('Camera', 'No image captured.');
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery access is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setPendingUri(result.assets[0].uri);
          setPendingType('image');
        }
      }
    } catch (error: any) {
      console.error('Pick error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const pickVideo = async (useCamera: boolean) => {
    try {
      if (useCamera) {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Camera access is required.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          videoMaxDuration: 20, // Changed from 10 to 20
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]?.uri) {
          setPendingUri(result.assets[0].uri);
          setPendingType('video');
        } else {
          Alert.alert('Camera', 'No video captured.');
        }
      } else {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission needed', 'Gallery access is required.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          quality: 0.8,
        });
        if (!result.canceled && result.assets?.[0]) {
          const asset = result.assets[0];
          if (!checkDuration(asset.duration)) return;
          if (asset.uri) {
            setPendingUri(asset.uri);
            setPendingType('video');
          }
        }
      }
    } catch (error: any) {
      console.error('Pick video error:', error);
      Alert.alert('Error', error.message);
    }
  };

  const confirmSave = async () => {
    if (!pendingUri) return;
    try {
      setLoading(true);
      if (pendingType === 'image') {
        await saveImageForDate(date, pendingUri);
      } else {
        await saveVideoForDate(date, pendingUri);
      }
      if (pendingUri.includes(FileSystem.cacheDirectory || '')) {
        await FileSystem.deleteAsync(pendingUri, { idempotent: true });
      }
      setPendingUri(null);
      await loadMedia();
      onImageChange?.();
      Alert.alert('✅ Saved!', `${pendingType === 'image' ? 'Picture' : 'Video'} added to this date.`);
    } catch (error: any) {
      console.error('Save error:', error);
      Alert.alert('Error', `Failed to save: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // ----- Delete handlers -----
  const handleDeleteImage = (uri: string) => {
    Alert.alert('Delete Picture', 'Remove this picture?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteImage(date, uri);
            await loadMedia();
            onImageChange?.();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleDeleteVideo = (uri: string) => {
    Alert.alert('Delete Video', 'Remove this video?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVideo(date, uri);
            await loadMedia();
            onImageChange?.();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleDeleteAllImages = () => {
    if (images.length === 0) return;
    Alert.alert('Delete All Pictures', `Remove all ${images.length} pictures?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAllImagesForDate(date);
            await loadMedia();
            onImageChange?.();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  const handleDeleteAllVideos = () => {
    if (videos.length === 0) return;
    Alert.alert('Delete All Videos', `Remove all ${videos.length} videos?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete All',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAllVideosForDate(date);
            await loadMedia();
            onImageChange?.();
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  // ----- Full‑screen viewer -----
  const openViewer = (uri: string, type: 'image' | 'video') => {
    setViewerUri(uri);
    setViewerType(type);
    setViewerVisible(true);
  };

  // ----- Preview Modal (for newly picked media) -----
  if (pendingUri) {
    return (
      <Modal visible={visible} animationType="slide" transparent onRequestClose={() => setPendingUri(null)}>
        <View style={styles.overlay}>
          <View style={styles.content}>
            <Text style={styles.title}>Preview</Text>
            {pendingType === 'image' ? (
              <Image source={{ uri: pendingUri }} style={styles.previewImage} resizeMode="contain" />
            ) : (
              <Video
                source={{ uri: pendingUri }}
                style={styles.previewVideo}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                isLooping
              />
            )}
            <Text style={styles.previewText}>Save this {pendingType} for {date}?</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.retakeBtn]} onPress={() => setPendingUri(null)}>
                <Text style={styles.actionText}>🔄 Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.saveBtn]} onPress={confirmSave} disabled={loading}>
                <Text style={styles.actionText}>{loading ? 'Saving...' : '💾 Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  }

  // ----- Main Modal (list of images and videos) -----
  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.overlay}>
          <View style={styles.content}>
            <Text style={styles.title}>📷 Media for {date}</Text>

            {/* Images section */}
            <Text style={styles.sectionTitle}>📸 Pictures ({images.length})</Text>
            {loading && <Text style={styles.loading}>Loading...</Text>}
            <FlatList
              data={images}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageList}
              renderItem={({ item }) => (
                <View style={styles.mediaWrapper}>
                  <TouchableOpacity onPress={() => openViewer(item, 'image')}>
                    <Image source={{ uri: item }} style={styles.thumbnail} resizeMode="cover" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteIcon} onPress={() => handleDeleteImage(item)}>
                    <Text style={styles.deleteIconText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No pictures saved</Text>}
            />
            {images.length > 0 && (
              <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAllImages}>
                <Text style={styles.deleteAllText}>🗑️ Delete All Pictures</Text>
              </TouchableOpacity>
            )}

            {/* Videos section */}
            <Text style={[styles.sectionTitle, { marginTop: 16 }]}>🎥 Videos ({videos.length})</Text>
            <FlatList
              data={videos}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.imageList}
              renderItem={({ item }) => (
                <View style={styles.mediaWrapper}>
                  <TouchableOpacity onPress={() => openViewer(item, 'video')}>
                    <Video
                      source={{ uri: item }}
                      style={styles.thumbnail}
                      useNativeControls={false}
                      resizeMode={ResizeMode.COVER}
                      isLooping
                      shouldPlay={false}
                    />
                    <View style={styles.playIconOverlay}>
                      <Text style={styles.playIcon}>▶️</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.deleteIcon} onPress={() => handleDeleteVideo(item)}>
                    <Text style={styles.deleteIconText}>✕</Text>
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={<Text style={styles.emptyText}>No videos saved</Text>}
            />
            {videos.length > 0 && (
              <TouchableOpacity style={styles.deleteAllBtn} onPress={handleDeleteAllVideos}>
                <Text style={styles.deleteAllText}>🗑️ Delete All Videos</Text>
              </TouchableOpacity>
            )}

            {/* Action buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.galleryBtn]} onPress={() => pickImage(false)}>
                <Text style={styles.actionText}>🖼️ Gallery (Image)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.cameraBtn]} onPress={() => pickImage(true)}>
                <Text style={styles.actionText}>📸 Camera (Image)</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.actionBtn, styles.galleryBtn]} onPress={() => pickVideo(false)}>
                <Text style={styles.actionText}>🎥 Gallery (≤20s)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.cameraBtn]} onPress={() => pickVideo(true)}>
                <Text style={styles.actionText}>🎬 Camera (≤20s)</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Full‑screen viewer modal */}
      <Modal visible={viewerVisible} transparent animationType="fade" onRequestClose={() => setViewerVisible(false)}>
        <View style={styles.fullscreenOverlay}>
          <TouchableOpacity style={styles.fullscreenClose} onPress={() => setViewerVisible(false)}>
            <Text style={styles.fullscreenCloseText}>✕</Text>
          </TouchableOpacity>
          {viewerType === 'image' && viewerUri && (
            <Image source={{ uri: viewerUri }} style={styles.fullscreenImage} resizeMode="contain" />
          )}
          {viewerType === 'video' && viewerUri && (
            <Video
              source={{ uri: viewerUri }}
              style={styles.fullscreenVideo}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
              isLooping={false}
            />
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  content: { backgroundColor: '#fff', borderRadius: 20, padding: 20, width: '100%', maxHeight: '90%' },
  title: { fontSize: 20, fontWeight: 'bold', color: '#2d3748', textAlign: 'center', marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#2d3748', marginVertical: 8 },
  imageList: { maxHeight: 140, marginBottom: 4 },
  mediaWrapper: { position: 'relative', marginRight: 8 },
  thumbnail: { width: 120, height: 120, borderRadius: 8, backgroundColor: '#f7fafc' },
  deleteIcon: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.6)', width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  deleteIconText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  playIconOverlay: { position: 'absolute', top: '50%', left: '50%', marginTop: -12, marginLeft: -12, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: 4 },
  playIcon: { fontSize: 16 },
  loading: { fontSize: 14, color: '#718096', textAlign: 'center', marginVertical: 10 },
  emptyText: { fontSize: 14, color: '#a0aec0', textAlign: 'center', paddingVertical: 20 },
  previewImage: { width: '100%', height: 280, borderRadius: 12, marginBottom: 16 },
  previewVideo: { width: '100%', height: 280, borderRadius: 12, marginBottom: 16 },
  previewText: { fontSize: 16, color: '#4a5568', marginBottom: 16, textAlign: 'center' },
  deleteAllBtn: { backgroundColor: '#fed7d7', paddingVertical: 6, borderRadius: 8, alignItems: 'center', marginBottom: 8 },
  deleteAllText: { color: '#c53030', fontWeight: '600', fontSize: 12 },
  actionRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  galleryBtn: { backgroundColor: '#4299e1' },
  cameraBtn: { backgroundColor: '#48bb78' },
  retakeBtn: { backgroundColor: '#a0aec0' },
  saveBtn: { backgroundColor: '#48bb78' },
  actionText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
  closeBtn: { width: '100%', paddingVertical: 12, borderRadius: 12, backgroundColor: '#edf2f7', alignItems: 'center' },
  closeText: { color: '#4a5568', fontWeight: '600', fontSize: 14 },

  // Full‑screen viewer styles
  fullscreenOverlay: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  fullscreenClose: { position: 'absolute', top: 40, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  fullscreenCloseText: { color: '#fff', fontSize: 20, fontWeight: 'bold' },
  fullscreenImage: { width: '100%', height: '100%' },
  fullscreenVideo: { width: '100%', height: '100%' },
});