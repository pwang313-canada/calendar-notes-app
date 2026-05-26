import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

const STORAGE_KEY = 'date_image_map';
let IMAGES_DIR: string | null = null;

export const initImagesDirectory = async (): Promise<string> => {
  if (IMAGES_DIR) return IMAGES_DIR;

  const documentDir = FileSystem.documentDirectory;
  if (!documentDir) throw new Error('Document directory not available');

  IMAGES_DIR = `${documentDir}note_images/`;

  const dirInfo = await FileSystem.getInfoAsync(IMAGES_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(IMAGES_DIR, { intermediates: true });
  }
  return IMAGES_DIR;
};

const getImagesDir = (): string => {
  if (!IMAGES_DIR) throw new Error('Call initImagesDirectory() first');
  return IMAGES_DIR;
};

async function getImageMap(): Promise<Record<string, string[]>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

export const getAllDatesWithImages = async (): Promise<string[]> => {
  const map = await getImageMap();
  return Object.keys(map).filter(date => map[date].length > 0);
};

export const getImagesForDate = async (date: string): Promise<string[]> => {
  const map = await getImageMap();
  const uris = map[date] || [];
  
  // Filter out deleted files
  const existing = [];
  for (const uri of uris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) existing.push(uri);
  }
  return existing;
};

export const saveImageForDate = async (date: string, imageUri: string): Promise<string> => {
  await initImagesDirectory();
  const extension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const newUri = `${getImagesDir()}${date}_${timestamp}.${extension}`;

  await FileSystem.copyAsync({ from: imageUri, to: newUri });

  const map = await getImageMap();
  if (!map[date]) map[date] = [];
  map[date].push(newUri);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));

  return newUri;
};

export const deleteImage = async (date: string, imageUri: string) => {
  const map = await getImageMap();
  const uris = map[date] || [];
  
  await FileSystem.deleteAsync(imageUri, { idempotent: true });
  
  map[date] = uris.filter(uri => uri !== imageUri);
  if (map[date].length === 0) delete map[date];
  
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};

export const deleteAllImagesForDate = async (date: string) => {
  const map = await getImageMap();
  const uris = map[date] || [];
  
  for (const uri of uris) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
  
  delete map[date];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(map));
};