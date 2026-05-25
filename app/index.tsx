import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  Alert,
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
import { Calendar, DateData } from 'react-native-calendars';

const App = () => {
  // Explicitly type notes as object with string keys and string values
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [noteText, setNoteText] = useState('');

  useEffect(() => {
    loadNotes();
  }, []);

  useEffect(() => {
    saveNotes(notes);
  }, [notes]);

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

  const saveNotes = async (notesToSave: Record<string, string>) => {
    try {
      await AsyncStorage.setItem('calendar_notes', JSON.stringify(notesToSave));
    } catch (error) {
      console.error('Failed to save notes:', error);
    }
  };

  const onDayPress = (day: DateData) => {
    const dateString = day.dateString;
    setSelectedDate(dateString);
    setNoteText(notes[dateString] || ''); // ✅ No error now
    setModalVisible(true);
  };

  const saveNote = () => {
    const trimmedNote = noteText.trim();
    let updatedNotes = { ...notes };

    if (trimmedNote === '') {
      delete updatedNotes[selectedDate];
    } else {
      updatedNotes[selectedDate] = trimmedNote;
    }

    setNotes(updatedNotes);
    setModalVisible(false);
    setNoteText('');
    setSelectedDate('');
  };

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

  const formatDateForHeader = (dateString: string) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getMarkedDates = () => {
    const marked: Record<string, any> = {};

    Object.keys(notes).forEach((date) => {
      marked[date] = {
        customStyles: {
          container: {
            backgroundColor: '#c6f6d5',
            borderRadius: 20,
          },
          text: {
            color: '#2d3748',
          },
        },
      };
    });

    if (selectedDate) {
      marked[selectedDate] = {
        ...marked[selectedDate],
        customStyles: {
          container: {
            borderWidth: 2,
            borderColor: '#4299e1',
            backgroundColor: '#ebf8ff',
            borderRadius: 20,
          },
          text: {
            color: '#2d3748',
            fontWeight: 'bold',
          },
        },
      };
    }

    return marked;
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
        markingType="custom"
        markedDates={getMarkedDates()}
        theme={
          {
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
            'stylesheet.day.basic': {
              container: {
                width: 40,
                height: 40,
                alignItems: 'center',
                justifyContent: 'center',
              },
              text: {
                fontSize: 16,
                color: '#2d3748',
                fontWeight: '500',
              },
            },
          } as any
        }
      />

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