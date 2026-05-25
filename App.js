import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Calendar } from 'react-native-calendars';
import PushNotification from 'react-native-push-notification';

const App = () => {
  // State for storing notes: { '2026-05-11': 'Meeting with team', ... }
  const [notes, setNotes] = useState({});
  
  // State for today's note display
  const [todayNote, setTodayNote] = useState('');
  
  // State for modal visibility and selected date
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [noteText, setNoteText] = useState('');
  
  // Track app state to re-check when app comes to foreground
  const appState = useRef(AppState.currentState);

  // Helper: Get today's date string in YYYY-MM-DD format
  const getTodayDateString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Helper: Check if a date is in the future (strictly > today)
  const isFutureDate = (dateString) => {
    return dateString > getTodayDateString();
  };

  // Configure push notifications
  const configurePushNotification = () => {
    PushNotification.configure({
      onRegister: function (token) {
        console.log('TOKEN:', token);
      },
      onNotification: function (notification) {
        console.log('NOTIFICATION:', notification);
        notification.finish(PushNotification.FetchResult.NoData);
      },
      onAction: function (notification) {
        console.log('ACTION:', notification.action);
      },
      onRegistrationError: function(err) {
        console.error('Registration error:', err);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channel for Android (required for Android 8+)
    if (Platform.OS === 'android') {
      PushNotification.createChannel(
        {
          channelId: 'calendar-notes-channel',
          channelName: 'Calendar Notes Channel',
          channelDescription: 'Notifications for calendar notes reminders',
          soundName: 'default',
          importance: 4,
          vibrate: true,
        },
        (created) => console.log(`Channel created: ${created}`)
      );
    }
  };

  // Schedule a notification for a specific future date
  const scheduleNotificationForDate = (dateString, noteText) => {
    if (!isFutureDate(dateString)) return;
    
    // Parse the date and set to 9:00 AM on that day
    const [year, month, day] = dateString.split('-');
    const scheduledDate = new Date(year, month - 1, day, 9, 0, 0);
    
    // Don't schedule if the date is in the past
    if (scheduledDate <= new Date()) return;
    
    PushNotification.localNotificationSchedule({
      channelId: 'calendar-notes-channel',
      id: `note_${dateString}`,
      title: '📅 Calendar Note Reminder',
      message: noteText.length > 100 ? noteText.substring(0, 100) + '...' : noteText,
      date: scheduledDate,
      allowWhileIdle: true,
      repeatType: null, // Only fire once
      vibrate: true,
      playSound: true,
      soundName: 'default',
    });
  };

  // Cancel all scheduled notifications and reschedule for all future notes
  const rescheduleAllFutureNotifications = async () => {
    try {
      // Cancel all existing local notifications
      PushNotification.cancelAllLocalNotifications();
      
      // Get current notes
      const currentNotes = notes;
      const todayStr = getTodayDateString();
      
      // Schedule notifications for each future date that has a note
      Object.entries(currentNotes).forEach(([date, note]) => {
        if (isFutureDate(date) && note && note.trim() !== '') {
          scheduleNotificationForDate(date, note);
        }
      });
    } catch (error) {
      console.error('Failed to reschedule notifications:', error);
    }
  };

  // Load saved notes from device storage when app starts
  useEffect(() => {
    configurePushNotification();
    loadNotes();
  }, []);

  // Save notes to device storage whenever notes change
  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

  // Update today's note display and reschedule future notifications when notes change
  useEffect(() => {
    updateTodayNote();
    rescheduleAllFutureNotifications();
  }, [notes]);

  // Listen for app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // App came to foreground - update today's note and ensure notifications are scheduled
        updateTodayNote();
        rescheduleAllFutureNotifications();
      }
      appState.current = nextAppState;
    });
    
    return () => {
      subscription.remove();
    };
  }, []);

  // Load notes from AsyncStorage
  const loadNotes = async () => {
    try {
      const storedNotes = await AsyncStorage.getItem('calendar_notes');
      if (storedNotes !== null) {
        setNotes(JSON.parse(storedNotes));
      }
    } catch (error) {
      console.error('Failed to load notes:', error);
    }
  };

  // Save notes to AsyncStorage
  const saveNotes = async (notesToSave) => {
    try {
      await AsyncStorage.setItem('calendar_notes', JSON.stringify(notesToSave));
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  // Update the today's note display
  const updateTodayNote = () => {
    const todayStr = getTodayDateString();
    const noteForToday = notes[todayStr] || '';
    setTodayNote(noteForToday);
  };

  // Handle date press on calendar
  const onDayPress = (day) => {
    const dateString = day.dateString;
    setSelectedDate(dateString);
    setNoteText(notes[dateString] || '');
    setModalVisible(true);
  };

  // Save note for the selected date
  const saveNote = () => {
    const trimmedNote = noteText.trim();
    let updatedNotes = { ...notes };

    if (trimmedNote === '') {
      // If note is empty, remove the entry for this date
      delete updatedNotes[selectedDate];
    } else {
      // Save or update note
      updatedNotes[selectedDate] = trimmedNote;
    }

    setNotes(updatedNotes);
    setModalVisible(false);
    setNoteText('');
    setSelectedDate('');
  };

  // Delete note for the selected date
  const deleteNote = () => {
    if (notes[selectedDate]) {
      const updatedNotes = { ...notes };
      delete updatedNotes[selectedDate];
      setNotes(updatedNotes);
      Alert.alert('Success', 'Note deleted successfully');
      setModalVisible(false);
      setNoteText('');
      setSelectedDate('');
    } else {
      Alert.alert('Info', 'No note to delete for this date');
    }
  };

  // Custom day component to show different colors for dates with notes
  const CustomDay = (props) => {
    const { date, state, onPress } = props;
    const dateString = date.dateString;
    const hasNote = notes[dateString] !== undefined;
    const isSelected = selectedDate === dateString;
    const isToday = dateString === getTodayDateString();

    // Determine styles
    let containerStyle = styles.dayContainer;
    let textStyle = styles.dayText;

    if (hasNote) {
      containerStyle = { ...containerStyle, ...styles.dayWithNote };
    }

    if (isSelected) {
      containerStyle = { ...containerStyle, ...styles.selectedDay };
    }
    
    if (isToday && !hasNote) {
      textStyle = { ...textStyle, ...styles.todayText };
    }

    // Disabled dates (previous/next month)
    if (state === 'disabled') {
      textStyle = { ...textStyle, ...styles.disabledDayText };
    }

    return (
      <TouchableOpacity
        style={containerStyle}
        onPress={() => onPress(date)}
        activeOpacity={0.7}
      >
        <Text style={textStyle}>{date.day}</Text>
      </TouchableOpacity>
    );
  };

  // Format date for display in modal header
  const formatDateForHeader = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📅 Calendar Notes</Text>
        <Text style={styles.headerSubtitle}>
          Tap any date to add or edit a note
        </Text>
      </View>

      <Calendar
        onDayPress={onDayPress}
        dayComponent={CustomDay}
        theme={{
          calendarBackground: '#ffffff',
          monthTextColor: '#2d3748',
          textMonthFontSize: 18,
          textMonthFontWeight: 'bold',
          arrowColor: '#4a5568',
          todayTextColor: '#e53e3e',
          'stylesheet.calendar.header': {
            week: {
              marginTop: 5,
              marginBottom: 10,
              flexDirection: 'row',
              justifyContent: 'space-around',
            },
            dayHeader: {
              width: 40,
              textAlign: 'center',
              fontSize: 14,
              color: '#718096',
              fontWeight: '500',
            },
          },
        }}
      />

      {/* Legend */}
      <View style={styles.legendContainer}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.legendNormal]} />
          <Text style={styles.legendText}>No note</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.legendHasNote]} />
          <Text style={styles.legendText}>Has note</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, styles.legendSelected]} />
          <Text style={styles.legendText}>Selected</Text>
        </View>
      </View>

      {/* Today's Note Display - New Feature */}
      {todayNote !== '' && (
        <View style={styles.todayNoteContainer}>
          <View style={styles.todayNoteHeader}>
            <Text style={styles.todayNoteIcon}>📝</Text>
            <Text style={styles.todayNoteTitle}>Today's Note</Text>
          </View>
          <Text style={styles.todayNoteText}>{todayNote}</Text>
        </View>
      )}

      {/* Modal for writing/editing notes */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write a note</Text>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.closeButton}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.selectedDateText}>
              {formatDateForHeader(selectedDate)}
            </Text>

            <TextInput
              style={styles.noteInput}
              multiline
              placeholder="Write something about this day..."
              placeholderTextColor="#a0aec0"
              value={noteText}
              onChangeText={setNoteText}
              textAlignVertical="top"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.deleteButton]}
                onPress={deleteNote}
              >
                <Text style={styles.buttonText}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={saveNote}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 10,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#718096',
    marginTop: 4,
  },
  // Custom day styles
  dayContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  dayText: {
    fontSize: 16,
    color: '#2d3748',
    fontWeight: '500',
  },
  dayWithNote: {
    backgroundColor: '#c6f6d5',
  },
  selectedDay: {
    borderWidth: 2,
    borderColor: '#4299e1',
    backgroundColor: '#ebf8ff',
  },
  todayText: {
    color: '#e53e3e',
    fontWeight: 'bold',
  },
  disabledDayText: {
    color: '#cbd5e0',
  },
  // Legend styles
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    marginTop: 10,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 6,
  },
  legendNormal: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#cbd5e0',
  },
  legendHasNote: {
    backgroundColor: '#c6f6d5',
  },
  legendSelected: {
    backgroundColor: '#ebf8ff',
    borderWidth: 2,
    borderColor: '#4299e1',
  },
  legendText: {
    fontSize: 12,
    color: '#4a5568',
  },
  // Today's Note styles (new)
  todayNoteContainer: {
    backgroundColor: '#fffaf0',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ecc94b',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  todayNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  todayNoteIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  todayNoteTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#b7791f',
  },
  todayNoteText: {
    fontSize: 14,
    color: '#744210',
    lineHeight: 20,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2d3748',
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#edf2f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#4a5568',
    fontWeight: 'bold',
  },
  selectedDateText: {
    fontSize: 16,
    color: '#4299e1',
    fontWeight: '600',
    marginBottom: 12,
  },
  noteInput: {
    backgroundColor: '#f7fafc',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#2d3748',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  saveButton: {
    backgroundColor: '#4299e1',
  },
  deleteButton: {
    backgroundColor: '#fc8181',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default App;