import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { Paths } from 'expo-file-system';

const STORAGE_KEY = 'date_image_map';

// Store directory path after initialization
let IMAGES_DIR: string | null = null;

/**
 * Initialize images directory (Call this early in your app)
 */
export const initImagesDirectory = async (): Promise<string> => {
  if (IMAGES_DIR) return IMAGES_DIR;

  const documentDir = Paths.document;

  if (!documentDir) {
    throw new Error('Document directory is not available on this platform');
  }

  IMAGES_DIR = `${documentDir}note_images/`;

  // Ensure directory exists
  const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }

  return IMAGES_DIR;
};

/**
 * Get images directory (must call init first)
 */
const getImagesDir = (): string => {
  if (!IMAGES_DIR) {
    throw new Error('Images directory not initialized. Call initImagesDirectory() first.');
  }
  return IMAGES_DIR;
};

// Helper: load existing mapping
async function getImageMap(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

export const getAllDatesWithImages = async (): Promise<string[]> => {
  const map = await getImageMap();
  return Object.keys(map);
};

// Save image from picked URI to local app directory
export const saveImageForDate = async (date: string, imageUri: string): Promise<string> => {
  await initImagesDirectory(); // Ensure directory is ready

  const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const newUri = `${getImagesDir()}${date}.${extension}`;

  // Copy image to permanent location
  await FileSystem.copyAsync({ from: imageUri, to: newUri });

  // Update mapping
  const map = await getImageMap();
  map[date] = newUri;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));

  return newUri;
};

// Get image URI for a date
export const getImageForDate = async (date: string): Promise<string | null> => {
  const map = await getImageMap();
  const uri = map[date];

  if (uri) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      return uri;
    }
  }
  return null;
};

// Delete image for a date
export const deleteImageForDate = async (date: string): Promise<void> => {
  const map = await getImageMap();
  const uri = map[date];

  if (uri) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
    }
    delete map[date];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }
};