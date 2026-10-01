// src/components/DateTimePickerModal.tsx
//
// Drop-in replacement for `react-native-modal-datetime-picker` built directly
// on top of `@react-native-community/datetimepicker@9.x`, which deprecated the
// `onChange` prop in favour of `onValueChange` + `onDismiss`.
//
// Supported props: isVisible, mode ("date" | "time" | "datetime"), date,
// minimumDate, onConfirm(date), onCancel.
//
// Behaviour:
//  - Android: native pickers, presented one at a time. For "datetime" we chain
//    a date picker → time picker and merge the results.
//  - iOS:     inline spinner wrapped in our own modal sheet with Cancel / Done.
//
// MARKER: dateTimePickerV9Fix — onValueChange takes DateTimePickerChangeEvent
// (v9), NOT DateTimePickerEvent (that type belongs to the deprecated onChange).

import DateTimePicker, {
  DateTimePickerChangeEvent,
} from '@react-native-community/datetimepicker';
import { useEffect, useState } from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type Mode = 'date' | 'time' | 'datetime';

interface Props {
  isVisible: boolean;
  mode?: Mode;
  date?: Date;
  minimumDate?: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const DateTimePickerModal = ({
  isVisible,
  mode = 'datetime',
  date,
  minimumDate,
  onConfirm,
  onCancel,
}: Props) => {
  // -------- Android state --------
  // 'date' | 'time' while a native picker is open; null when closed.
  const [androidStep, setAndroidStep] = useState<'date' | 'time' | null>(null);
  // Working date while we chain date → time pickers on Android.
  const [tempDate, setTempDate] = useState<Date | null>(null);

  // -------- iOS state --------
  // Edited date while the spinner is open.
  const [iosDate, setIosDate] = useState<Date>(date ?? new Date());

  // Reset internal state whenever the modal is opened/closed.
  useEffect(() => {
    if (!isVisible) {
      setAndroidStep(null);
      setTempDate(null);
      return;
    }

    const initial = date ?? new Date();
    setTempDate(initial);
    setIosDate(initial);

    if (Platform.OS === 'android') {
      setAndroidStep(mode === 'time' ? 'time' : 'date');
    } else {
      setAndroidStep(null);
    }
  }, [isVisible, date, mode]);

  if (!isVisible) return null;

  // ─────────────────────────────────────────────────────────────────────
  // Android
  // ─────────────────────────────────────────────────────────────────────
  if (Platform.OS === 'android') {
    if (!androidStep) return null;

    const current = tempDate ?? new Date();

    const handleAndroidChange = (
      _event: DateTimePickerChangeEvent,
      selected?: Date,
    ) => {
      // User dismissed (Back button / system cancel)
      if (!selected) {
        setAndroidStep(null);
        onCancel();
        return;
      }

      // Single-mode pickers: confirm immediately.
      if (mode !== 'datetime') {
        setAndroidStep(null);
        onConfirm(selected);
        return;
      }

      // "datetime" → chain date then time.
      if (androidStep === 'date') {
        setTempDate(selected);
        setAndroidStep('time');
      } else {
        // androidStep === 'time' → merge date + time.
        const merged = new Date(current);
        merged.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
        setAndroidStep(null);
        onConfirm(merged);
      }
    };

    return (
      <DateTimePicker
        value={current}
        mode={androidStep === 'time' ? 'time' : 'date'}
        minimumDate={androidStep === 'date' ? minimumDate : undefined}
        onValueChange={handleAndroidChange}
        onDismiss={() => {
          setAndroidStep(null);
          onCancel();
        }}
      />
    );
  }

  // ─────────────────────────────────────────────────────────────────────
  // iOS
  // ─────────────────────────────────────────────────────────────────────
  return (
    <Modal
      transparent
      animationType="slide"
      visible={isVisible}
      onRequestClose={onCancel}
    >
      <TouchableOpacity
        style={styles.iosOverlay}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.iosSheet}
          onPress={() => {
            /* swallow taps so they don't dismiss the sheet */
          }}
        >
          <View style={styles.iosHeader}>
            <TouchableOpacity onPress={onCancel} hitSlop={12}>
              <Text style={styles.iosCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onConfirm(iosDate)}
              hitSlop={12}
            >
              <Text style={styles.iosDoneText}>Done</Text>
            </TouchableOpacity>
          </View>

          <DateTimePicker
            value={iosDate}
            mode={mode === 'datetime' ? 'datetime' : mode}
            minimumDate={minimumDate}
            display="spinner"
            onValueChange={(_event: DateTimePickerChangeEvent, selected?: Date) => {
              if (selected) setIosDate(selected);
            }}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  iosOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  iosSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 24,
  },
  iosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  iosCancelText: {
    fontSize: 16,
    color: '#4a5568',
  },
  iosDoneText: {
    fontSize: 16,
    color: '#4299e1',
    fontWeight: '600',
  },
});

export default DateTimePickerModal;
