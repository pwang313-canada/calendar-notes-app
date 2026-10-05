import AsyncStorage from '@react-native-async-storage/async-storage';
import { memo, useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import mobileAds, {
  BannerAd,
  BannerAdSize,
  TestIds,
} from 'react-native-google-mobile-ads';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Calendar } from 'react-native-calendars';
import DateTimePickerModal from './src/components/DateTimePickerModal';

import DateImageModal from './src/components/DateImageModal';
import { getAllDatesWithMedia } from './src/utils/imageStorage';
import {
  cancelNotification,
  registerForNotifications,
  scheduleNotification,
  setupNotificationHandler,
} from './src/utils/notifications';

const STORAGE_KEY = 'calendar_notes_v4';

// AdMob banner: test ads in dev, real ads in release builds.
const BANNER_AD_UNIT_ID = __DEV__
  ? TestIds.BANNER
  : 'ca-app-pub-4457502267749040/2041859845';

// "YYYY-MM-DD" for the device's local today, so the calendar can mark it.
// MARKER: todayMark
const todayString = (() => {
  const d = new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
})();

// Custom Day Component
const CustomDay = memo(
  ({ date, state, onPress, notes, mediaDates }: any) => {
    const dateString = date.dateString;
    const note = notes[dateString];
    const hasNote = !!note;
    const hasMedia = mediaDates?.includes(dateString);
    const isToday = dateString === todayString;
    const icon = note?.icon || '';

    let containerStyle: ViewStyle = styles.dayContainer;
    let textStyle: TextStyle = styles.dayText;

    if (hasNote) containerStyle = { ...containerStyle, ...styles.dayWithNote };
    else if (hasMedia) containerStyle = { ...containerStyle, ...styles.dayWithMedia };
    if (isToday) containerStyle = { ...containerStyle, ...styles.todayContainer };
    if (state === 'disabled') textStyle = { ...textStyle, ...styles.disabledDayText };
    else if (isToday) textStyle = { ...textStyle, ...styles.todayText };

    return (
      <TouchableOpacity style={containerStyle} onPress={() => onPress(date)} activeOpacity={0.7}>
        <Text style={textStyle}>{date.day}</Text>
        {hasNote && <Text style={styles.dayIcon}>{icon}</Text>}
        {hasMedia && !hasNote && <Text style={styles.dayIcon}>📷</Text>}
        {hasMedia && hasNote && <View style={styles.mediaDot} />}
      </TouchableOpacity>
    );
  },
  (prevProps, nextProps) =>
    prevProps.notes[prevProps.date.dateString] === nextProps.notes[nextProps.date.dateString] &&
    prevProps.mediaDates?.includes(prevProps.date.dateString) ===
    nextProps.mediaDates?.includes(nextProps.date.dateString)
);

export default function App() {
  const [notes, setNotes] = useState<Record<string, { text: string; icon: string; alarm?: number }>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [noteText, setNoteText] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('📝');
  const [alarmDate, setAlarmDate] = useState<Date | null>(null);
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [mediaModalVisible, setMediaModalVisible] = useState(false);
  const [mediaDates, setMediaDates] = useState<string[]>([]);

  const loadMediaDates = async () => {
    try {
      const dates = await getAllDatesWithMedia();
      setMediaDates(dates);
    } catch (error) {
      console.error('Failed to load media dates:', error);
    }
  };

  // ---------- PERSISTENCE (AsyncStorage) ----------
  const saveNotes = async (newNotes: typeof notes) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(newNotes));
    } catch (error) {
      console.error('Save failed:', error);
    }
  };

  const loadNotes = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotes(parsed);
        // Re‑schedule alarms
        for (const [date, data] of Object.entries(parsed) as any[]) {
          if (data.alarm && data.alarm > Date.now()) {
            await scheduleNotification(date, data.alarm, data.text, data.icon);
          }
        }
      }
    } catch (error) {
      console.error('Load failed:', error);
    }
  };

  useEffect(() => {
    setupNotificationHandler();
    mobileAds().initialize();
    const init = async () => {
      await registerForNotifications();
      await loadNotes();
      await loadMediaDates();
    };
    init();
  }, []);


  // Always open note modal (no media‑only bypass)
  const onDayPress = (day: any) => {
    const dateString = day.dateString;
    const existing = notes[dateString];
    setSelectedDate(dateString);
    setNoteText(existing?.text || '');
    setSelectedIcon(existing?.icon || '📝');
    setAlarmDate(existing?.alarm ? new Date(existing.alarm) : null);
    setModalVisible(true);
  };

  const saveNote = async () => {
    const trimmed = noteText.trim();
    let updatedNotes = { ...notes };

    if (trimmed === '' && !alarmDate) {
      delete updatedNotes[selectedDate];
      await cancelNotification(selectedDate);
    } else {
      const alarmTimestamp = alarmDate ? alarmDate.getTime() : undefined;
      updatedNotes[selectedDate] = {
        text: trimmed || '',
        icon: selectedIcon,
        alarm: alarmTimestamp,
      };
      if (alarmTimestamp) await scheduleNotification(selectedDate, alarmTimestamp, trimmed || '', selectedIcon);
      else await cancelNotification(selectedDate);
    }

    setNotes(updatedNotes);
    await saveNotes(updatedNotes); // immediate write
    setModalVisible(false);
    resetForm();
  };

  const deleteNote = async () => {
    if (notes[selectedDate]) {
      await cancelNotification(selectedDate);
      const updatedNotes = { ...notes };
      delete updatedNotes[selectedDate];
      setNotes(updatedNotes);
      await saveNotes(updatedNotes);
      Alert.alert('Deleted', 'Note and alarm removed');
      setModalVisible(false);
      resetForm();
    } else {
      Alert.alert('Info', 'No note to delete');
    }
  };

  const resetForm = () => {
    setNoteText('');
    setSelectedIcon('📝');
    setAlarmDate(null);
    setSelectedDate('');
  };

  const iconOptions = ['📝', '🐟', '💡', '📅', '🎉', '❤️', '🏋️', '💼', '🍔', '✈️'];

  const formatDateHeader = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return new Date(Number(year), Number(month) - 1, Number(day)).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 Calendar Notes</Text>
        <Text style={styles.headerSubtitle}>Tap date → add note, icon, alarm & picture/video</Text>
      </View>

      <Calendar
        onDayPress={onDayPress}
        dayComponent={(props) => <CustomDay {...props} onPress={onDayPress} notes={notes} mediaDates={mediaDates} />}
        theme={{
          calendarBackground: '#ffffff',
          monthTextColor: '#2d3748',
          textMonthFontSize: 18,
          textMonthFontWeight: 'bold',
          arrowColor: '#4a5568',
          todayTextColor: '#e53e3e',
        }}
      />

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}><View style={[styles.legendColor, styles.legendNormal]} /><Text style={styles.legendText}>No note</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendColor, styles.legendHasNote]} /><Text style={styles.legendText}>Note + icon</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendColor, styles.legendHasMedia]} /><Text style={styles.legendText}>Picture / video only</Text></View>
        <View style={styles.legendItem}><View style={[styles.legendColor, styles.legendToday]} /><Text style={styles.legendText}>Today</Text></View>
      </View>

      {/* Note Modal */}
      <Modal animationType="slide" transparent visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write a note</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.selectedDateText}>{formatDateHeader(selectedDate)}</Text>

            <Text style={styles.label}>Select icon:</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.iconRow}>
              {iconOptions.map(icon => (
                <TouchableOpacity key={icon} style={[styles.iconButton, selectedIcon === icon && styles.iconSelected]} onPress={() => setSelectedIcon(icon)}>
                  <Text style={styles.iconText}>{icon}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TextInput style={styles.noteInput} multiline placeholder="Write something about this day..." placeholderTextColor="#a0aec0" value={noteText} onChangeText={setNoteText} textAlignVertical="top" />

            <TouchableOpacity style={styles.pictureButton} onPress={() => { setModalVisible(false); setMediaModalVisible(true); }}>
              <Text style={styles.pictureButtonText}>📷 Manage Picture / Video for this Date</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.alarmButton} onPress={() => setDatePickerVisibility(true)}>
              <Text style={styles.alarmButtonText}>{alarmDate ? `⏰ Alarm: ${alarmDate.toLocaleString()}` : '🔔 Set reminder (optional)'}</Text>
            </TouchableOpacity>
            {alarmDate && <TouchableOpacity style={styles.clearAlarmButton} onPress={() => setAlarmDate(null)}><Text style={styles.clearAlarmText}>Clear alarm</Text></TouchableOpacity>}

            <DateTimePickerModal isVisible={isDatePickerVisible} mode="datetime" onConfirm={date => { setAlarmDate(date); setDatePickerVisibility(false); }} onCancel={() => setDatePickerVisibility(false)} minimumDate={new Date()} />

            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.button, styles.deleteButton]} onPress={deleteNote}><Text style={styles.buttonText}>Delete</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.button, styles.saveButton]} onPress={saveNote}><Text style={styles.buttonText}>Save</Text></TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DateImageModal visible={mediaModalVisible} date={selectedDate} onClose={() => { setMediaModalVisible(false); setModalVisible(true); }} onImageChange={loadMediaDates} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f7fafc' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#2d3748' },
  headerSubtitle: { fontSize: 14, color: '#718096', marginTop: 4 },
  dayContainer: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent', position: 'relative' },
  dayText: { fontSize: 16, color: '#2d3748', fontWeight: '500' },
  dayWithNote: { backgroundColor: '#c6f6d5', borderRadius: 22 },
  dayWithMedia: { backgroundColor: '#fef9c3', borderRadius: 22 },
  todayContainer: { borderWidth: 2, borderColor: '#e53e3e', borderRadius: 22 },
  todayText: { color: '#e53e3e', fontWeight: 'bold' },
  disabledDayText: { color: '#cbd5e0' },
  dayIcon: { fontSize: 12, position: 'absolute', bottom: 2, right: 2 },
  mediaDot: { position: 'absolute', bottom: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#ecc94b' },
  legendContainer: { flexDirection: 'row', justifyContent: 'center', paddingVertical: 12, backgroundColor: '#fff', marginTop: 10, marginHorizontal: 16, borderRadius: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12 },
  legendColor: { width: 20, height: 20, borderRadius: 10, marginRight: 6 },
  legendNormal: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#cbd5e0' },
  legendHasNote: { backgroundColor: '#c6f6d5' },
  legendHasMedia: { backgroundColor: '#fef9c3' },
  legendToday: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#e53e3e' },
  legendText: { fontSize: 12, color: '#4a5568' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 20, paddingTop: 20, paddingBottom: Platform.OS === 'ios' ? 30 : 20, minHeight: 400 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#2d3748' },
  closeButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#edf2f7', justifyContent: 'center', alignItems: 'center' },
  closeButtonText: { fontSize: 18, color: '#4a5568', fontWeight: 'bold' },
  selectedDateText: { fontSize: 16, color: '#4299e1', fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '500', color: '#4a5568', marginBottom: 8 },
  iconRow: { flexDirection: 'row', marginBottom: 16 },
  iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#edf2f7', justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  iconSelected: { backgroundColor: '#bee3f8', borderWidth: 2, borderColor: '#4299e1' },
  iconText: { fontSize: 24 },
  noteInput: { backgroundColor: '#f7fafc', borderRadius: 12, padding: 12, fontSize: 16, color: '#2d3748', minHeight: 100, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 16 },
  pictureButton: { backgroundColor: '#4c51bf', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  pictureButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  alarmButton: { backgroundColor: '#edf2f7', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 8 },
  alarmButtonText: { color: '#4a5568', fontSize: 14 },
  clearAlarmButton: { alignItems: 'center', marginBottom: 16 },
  clearAlarmText: { color: '#e53e3e', fontSize: 12 },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  saveButton: { backgroundColor: '#4299e1' },
  deleteButton: { backgroundColor: '#fc8181' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
