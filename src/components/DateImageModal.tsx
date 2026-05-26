import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { deleteImageForDate, getImageForDate, saveImageForDate } from '../utils/imageStorage';

interface Props {
  visible: boolean;
  date: string;
  onClose: () => void;
  onImageChange?: () => void;   // callback to refresh calendar dots
}

export default function DateImageModal({ visible, date, onClose, onImageChange }: Props) {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && date) {
      loadImage();
    }
  }, [visible, date]);

  const loadImage = async () => {
    setLoading(true);
    const uri = await getImageForDate(date);
    setImageUri(uri);
    setLoading(false);
  };

  const pickImage = async (useCamera: boolean) => {
    const permission = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permission needed', `Please allow access to ${useCamera ? 'camera' : 'gallery'} to save pictures.`);
      return;
    }

    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.8 });

    if (!result.canceled) {
      const newUri = result.assets[0].uri;
      await saveImageForDate(date, newUri);
      await loadImage();
      if (onImageChange) onImageChange();   // ✅ refresh calendar
      Alert.alert('Success', 'Picture saved for this date!');
    }
  };

  const handleDelete = async () => {
    Alert.alert('Delete picture', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteImageForDate(date);
          setImageUri(null);
          if (onImageChange) onImageChange();   // ✅ refresh calendar
          Alert.alert('Deleted', 'Picture removed for this date.');
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>Picture for {date}</Text>

        {loading && <Text>Loading...</Text>}

        {!loading && imageUri && (
          <View style={styles.imageContainer}>
            <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
            <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
              <Text style={styles.buttonText}>Delete Picture</Text>
            </TouchableOpacity>
          </View>
        )}

        {!loading && !imageUri && (
          <Text style={styles.noImage}>No picture saved yet for this date.</Text>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={() => pickImage(false)}>
            <Text style={styles.buttonText}>Choose from Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => pickImage(true)}>
            <Text style={styles.buttonText}>Take a Picture</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.button, styles.closeButton]} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  imageContainer: { alignItems: 'center', marginBottom: 20 },
  image: { width: 300, height: 300, borderRadius: 10, marginBottom: 10 },
  deleteButton: { backgroundColor: '#ff4444', padding: 10, borderRadius: 8, marginTop: 5 },
  noImage: { textAlign: 'center', marginBottom: 20, fontSize: 16, color: '#666' },
  buttonRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  button: { backgroundColor: '#2196F3', padding: 12, borderRadius: 8, minWidth: 120, alignItems: 'center' },
  closeButton: { backgroundColor: '#ccc', marginTop: 10 },
  buttonText: { color: '#fff', fontWeight: 'bold' },
});