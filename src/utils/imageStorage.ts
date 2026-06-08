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
  const existing = [];
  for (const uri of uris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) existing.push(uri);
  }
  return existing;
};

async function copyImageToLocalDirectory(sourceUri: string, destinationUri: string): Promise<void> {
  if (sourceUri.startsWith('file://')) {
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    return;
  }
  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export const saveImageForDate = async (date: string, imageUri: string): Promise<string> => {
  await initImagesDirectory();
  let extension = 'jpg';
  if (imageUri.includes('.')) {
    const ext = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
    if (['jpg', 'jpeg', 'png', 'heic'].includes(ext)) extension = ext;
  }
  const timestamp = Date.now();
  const newUri = `${getImagesDir()}${date}_${timestamp}.${extension}`;
  await copyImageToLocalDirectory(imageUri, newUri);
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

// ========== VIDEO STORAGE (separate key) ==========
const VIDEO_STORAGE_KEY = 'date_video_map';

async function getVideoMap(): Promise<Record<string, string[]>> {
  const raw = await AsyncStorage.getItem(VIDEO_STORAGE_KEY);
  return raw ? JSON.parse(raw) : {};
}

export const getAllDatesWithVideos = async (): Promise<string[]> => {
  const map = await getVideoMap();
  return Object.keys(map).filter(date => map[date].length > 0);
};

export const getVideosForDate = async (date: string): Promise<string[]> => {
  const map = await getVideoMap();
  const uris = map[date] || [];
  const existing = [];
  for (const uri of uris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) existing.push(uri);
  }
  return existing;
};

async function copyVideoToLocalDirectory(sourceUri: string, destinationUri: string): Promise<void> {
  // Same logic as copyImageToLocalDirectory – works for any file type
  if (sourceUri.startsWith('file://')) {
    await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
    return;
  }
  const base64 = await FileSystem.readAsStringAsync(sourceUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(destinationUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export const saveVideoForDate = async (date: string, videoUri: string): Promise<string> => {
  await initImagesDirectory(); // reuse the same directory, but you could create a separate one
  let extension = 'mp4';
  if (videoUri.includes('.')) {
    const ext = videoUri.split('.').pop()?.toLowerCase() || 'mp4';
    if (['mp4', 'mov', 'm4v'].includes(ext)) extension = ext;
  }
  const timestamp = Date.now();
  const newUri = `${getImagesDir()}${date}_video_${timestamp}.${extension}`;
  await copyVideoToLocalDirectory(videoUri, newUri);
  const map = await getVideoMap();
  if (!map[date]) map[date] = [];
  map[date].push(newUri);
  await AsyncStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(map));
  return newUri;
};

export const deleteVideo = async (date: string, videoUri: string) => {
  const map = await getVideoMap();
  const uris = map[date] || [];
  await FileSystem.deleteAsync(videoUri, { idempotent: true });
  map[date] = uris.filter(uri => uri !== videoUri);
  if (map[date].length === 0) delete map[date];
  await AsyncStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(map));
};

export const deleteAllVideosForDate = async (date: string) => {
  const map = await getVideoMap();
  const uris = map[date] || [];
  for (const uri of uris) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
  delete map[date];
  await AsyncStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(map));
};

export const getAllDatesWithMedia = async (): Promise<string[]> => {
  const imageDates = await getAllDatesWithImages();
  const videoDates = await getAllDatesWithVideos();
  // Combine and remove duplicates
  const combined = [...new Set([...imageDates, ...videoDates])];
  return combined;
};