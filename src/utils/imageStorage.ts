import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

type MediaKind = 'image' | 'video';

const STORAGE_KEYS: Record<MediaKind, string> = {
  image: 'date_image_map',
  video: 'date_video_map',
};

const ALLOWED_EXTENSIONS: Record<MediaKind, string[]> = {
  image: ['jpg', 'jpeg', 'png', 'heic'],
  video: ['mp4', 'mov', 'm4v'],
};

const DEFAULT_EXTENSION: Record<MediaKind, string> = {
  image: 'jpg',
  video: 'mp4',
};

let MEDIA_DIR: string | null = null;

export const initImagesDirectory = async (): Promise<string> => {
  if (MEDIA_DIR) return MEDIA_DIR;
  const documentDir = FileSystem.documentDirectory;
  if (!documentDir) throw new Error('Document directory not available');
  // NOTE: directory name kept as note_images/ for backward compatibility
  // with media saved by earlier versions of the app.
  MEDIA_DIR = `${documentDir}note_images/`;
  const dirInfo = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  }
  return MEDIA_DIR;
};

const getMediaDir = (): string => {
  if (!MEDIA_DIR) throw new Error('Call initImagesDirectory() first');
  return MEDIA_DIR;
};

const getMediaMap = async (kind: MediaKind): Promise<Record<string, string[]>> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS[kind]);
  return raw ? JSON.parse(raw) : {};
};

const setMediaMap = async (kind: MediaKind, map: Record<string, string[]>): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS[kind], JSON.stringify(map));
};

const copyToLocalDirectory = async (sourceUri: string, destinationUri: string): Promise<void> => {
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
};

const pickExtension = (uri: string, kind: MediaKind): string => {
  const fallback = DEFAULT_EXTENSION[kind];
  if (!uri.includes('.')) return fallback;
  const ext = uri.split('.').pop()?.toLowerCase() || fallback;
  return ALLOWED_EXTENSIONS[kind].includes(ext) ? ext : fallback;
};

const getDatesWithMedia = async (kind: MediaKind): Promise<string[]> => {
  const map = await getMediaMap(kind);
  return Object.keys(map).filter(date => map[date].length > 0);
};

const getMediaForDate = async (kind: MediaKind, date: string): Promise<string[]> => {
  const map = await getMediaMap(kind);
  const uris = map[date] || [];
  const existing: string[] = [];
  for (const uri of uris) {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) existing.push(uri);
  }
  return existing;
};

const saveMediaForDate = async (
  kind: MediaKind,
  date: string,
  sourceUri: string,
): Promise<string> => {
  await initImagesDirectory();
  const extension = pickExtension(sourceUri, kind);
  const infix = kind === 'video' ? '_video_' : '_';
  const newUri = `${getMediaDir()}${date}${infix}${Date.now()}.${extension}`;
  await copyToLocalDirectory(sourceUri, newUri);
  const map = await getMediaMap(kind);
  if (!map[date]) map[date] = [];
  map[date].push(newUri);
  await setMediaMap(kind, map);
  return newUri;
};

const deleteMedia = async (kind: MediaKind, date: string, mediaUri: string): Promise<void> => {
  const map = await getMediaMap(kind);
  const uris = map[date] || [];
  await FileSystem.deleteAsync(mediaUri, { idempotent: true });
  map[date] = uris.filter(uri => uri !== mediaUri);
  if (map[date].length === 0) delete map[date];
  await setMediaMap(kind, map);
};

const deleteAllMediaForDate = async (kind: MediaKind, date: string): Promise<void> => {
  const map = await getMediaMap(kind);
  const uris = map[date] || [];
  for (const uri of uris) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
  delete map[date];
  await setMediaMap(kind, map);
};

// ========== IMAGE API ==========

export const getAllDatesWithImages = async (): Promise<string[]> => getDatesWithMedia('image');

export const getImagesForDate = async (date: string): Promise<string[]> =>
  getMediaForDate('image', date);

export const saveImageForDate = async (date: string, imageUri: string): Promise<string> =>
  saveMediaForDate('image', date, imageUri);

export const deleteImage = async (date: string, imageUri: string): Promise<void> =>
  deleteMedia('image', date, imageUri);

export const deleteAllImagesForDate = async (date: string): Promise<void> =>
  deleteAllMediaForDate('image', date);

// ========== VIDEO API ==========

export const getAllDatesWithVideos = async (): Promise<string[]> => getDatesWithMedia('video');

export const getVideosForDate = async (date: string): Promise<string[]> =>
  getMediaForDate('video', date);

export const saveVideoForDate = async (date: string, videoUri: string): Promise<string> =>
  saveMediaForDate('video', date, videoUri);

export const deleteVideo = async (date: string, videoUri: string): Promise<void> =>
  deleteMedia('video', date, videoUri);

export const deleteAllVideosForDate = async (date: string): Promise<void> =>
  deleteAllMediaForDate('video', date);

// ========== COMBINED ==========

export const getAllDatesWithMedia = async (): Promise<string[]> => {
  const imageDates = await getAllDatesWithImages();
  const videoDates = await getAllDatesWithVideos();
  // Combine and remove duplicates
  return [...new Set([...imageDates, ...videoDates])];
};
