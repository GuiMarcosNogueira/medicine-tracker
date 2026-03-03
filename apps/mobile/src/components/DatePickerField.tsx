import { useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';

interface Props {
  label: string;
  value: string;        // YYYY-MM-DD
  onChange: (v: string) => void;
  error?: string | undefined;
}

function parseDateSafe(s: string): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
}

function dateToISO(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function DatePickerField({ label, value, onChange, error }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [tempDate, setTempDate]   = useState<Date>(parseDateSafe(value));

  const date         = parseDateSafe(value);
  const displayValue = value
    ? date.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  function openPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value:    date,
        mode:     'date',
        onChange: (_, selected) => { if (selected) onChange(dateToISO(selected)); },
      });
    } else {
      setTempDate(date);
      setShowModal(true);
    }
  }

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        style={[styles.input, Boolean(error) && styles.inputError]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[styles.inputText, !value && styles.placeholder]}>
          {displayValue || 'Selecionar data'}
        </Text>
        <Text style={styles.icon}>📅</Text>
      </Pressable>
      {Boolean(error) && <Text style={styles.error}>{error}</Text>}

      {/* iOS modal spinner */}
      <Modal visible={showModal} transparent animationType="slide">
        <Pressable style={styles.overlay} onPress={() => setShowModal(false)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Pressable onPress={() => setShowModal(false)}>
              <Text style={styles.btnCancel}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={() => { onChange(dateToISO(tempDate)); setShowModal(false); }}>
              <Text style={styles.btnDone}>Concluído</Text>
            </Pressable>
          </View>
          <DateTimePicker
            value={tempDate}
            mode="date"
            display="spinner"
            onChange={(_, selected) => { if (selected) setTempDate(selected); }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  label:       { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 6 },
  input:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 4, backgroundColor: '#FFFFFF' },
  inputError:  { borderColor: '#F0735A' },
  inputText:   { flex: 1, fontSize: 15, color: '#1A1D1A' },
  placeholder: { color: '#9CA59C' },
  icon:        { fontSize: 16 },
  error:       { color: '#F0735A', fontSize: 12, marginBottom: 12, marginLeft: 4 },
  // iOS modal
  overlay:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet:       { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E8ECE5' },
  btnCancel:   { fontSize: 15, color: '#9CA59C', fontWeight: '600' },
  btnDone:     { fontSize: 15, color: '#1A9E96', fontWeight: '700' },
});
