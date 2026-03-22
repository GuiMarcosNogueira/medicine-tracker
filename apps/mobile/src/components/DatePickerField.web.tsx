import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fonts } from '../lib/theme';

interface Props {
  label: string;
  value: string;       // YYYY-MM-DD
  onChange: (v: string) => void;
  error?: string | undefined;
}

const MONTHS_PT = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];
const DAYS_PT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

const CAL_WIDTH = 308;
const CELL = Math.floor(CAL_WIDTH / 7); // 44px

function parseDateSafe(s: string): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date();
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y ?? 2000, (m ?? 1) - 1, d ?? 1);
}

function dateToISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePickerField({ label, value, onChange, error }: Props) {
  const [open, setOpen] = useState(false);

  const date = parseDateSafe(value);
  const [viewYear, setViewYear]   = useState(date.getFullYear());
  const [viewMonth, setViewMonth] = useState(date.getMonth());

  const displayValue = value
    ? parseDateSafe(value).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : '';

  function openPicker() {
    const d = parseDateSafe(value);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setOpen(o => !o);
  }

  function prevMonth() {
    setViewMonth(m => { if (m === 0) { setViewYear(y => y - 1); return 11; } return m - 1; });
  }
  function nextMonth() {
    setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });
  }

  const today = new Date();
  const selY = value ? date.getFullYear() : -1;
  const selM = value ? date.getMonth() : -1;
  const selD = value ? date.getDate() : -1;

  const grid = buildGrid(viewYear, viewMonth);

  return (
    <View style={styles.wrapper}>
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
        <Ionicons name={open ? 'calendar' : 'calendar-outline'} size={18} color={open ? '#1A9E96' : '#9CA59C'} />
      </Pressable>
      {Boolean(error) && <Text style={styles.error}>{error}</Text>}

      {open && (
        <>
          {/* Invisible backdrop to close */}
          <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />

          <View style={styles.dropdown}>
            {/* Month navigation */}
            <View style={styles.navRow}>
              <Pressable onPress={prevMonth} style={styles.navBtn} hitSlop={8}>
                <Ionicons name="chevron-back" size={18} color="#147570" />
              </Pressable>
              <Text style={styles.monthTitle}>{MONTHS_PT[viewMonth]} {viewYear}</Text>
              <Pressable onPress={nextMonth} style={styles.navBtn} hitSlop={8}>
                <Ionicons name="chevron-forward" size={18} color="#147570" />
              </Pressable>
            </View>

            {/* Day-of-week header */}
            <View style={styles.dowRow}>
              {DAYS_PT.map(d => (
                <Text key={d} style={[styles.cell, styles.dowCell]}>{d}</Text>
              ))}
            </View>

            {/* Day grid */}
            <View style={styles.grid}>
              {grid.map((day, idx) => {
                if (!day) return <View key={idx} style={styles.cell} />;

                const isSelected = day === selD && viewMonth === selM && viewYear === selY;
                const isToday    = day === today.getDate() && viewMonth === today.getMonth() && viewYear === today.getFullYear();

                return (
                  <Pressable
                    key={idx}
                    style={[styles.cell, styles.dayCell, isSelected && styles.dayCellSelected, !isSelected && isToday && styles.dayCellToday]}
                    onPress={() => { onChange(dateToISO(new Date(viewYear, viewMonth, day))); setOpen(false); }}
                  >
                    <Text style={[styles.dayText, isSelected && styles.dayTextSelected, !isSelected && isToday && styles.dayTextToday]}>
                      {day}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { position: 'relative', zIndex: 100 },
  label:      { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 6, fontFamily: fonts.bodySemi },
  input:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#D1D9CC', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 4, backgroundColor: '#FFFFFF' },
  inputError: { borderColor: '#F0735A' },
  inputText:  { flex: 1, fontSize: 15, color: '#1A1D1A', fontFamily: fonts.mono },
  placeholder:{ color: '#9CA59C', fontFamily: fonts.body },
  error:      { color: '#F0735A', fontSize: 12, marginBottom: 12, marginLeft: 4 },

  backdrop:   { position: 'fixed' as never, top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 },

  dropdown:   {
    position: 'absolute',
    top: 64,
    left: 0,
    zIndex: 200,
    width: CAL_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E0E4E0',
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },

  navRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 4 },
  navBtn:     { padding: 4 },
  monthTitle: { fontSize: 15, fontWeight: '700', color: '#1A1D1A', fontFamily: fonts.heading },

  dowRow:     { flexDirection: 'row' },
  dowCell:    { fontSize: 10, color: '#9CA59C', fontFamily: fonts.mono, textAlign: 'center' as never, paddingVertical: 4 },

  grid:       { flexDirection: 'row', flexWrap: 'wrap', width: CAL_WIDTH },
  cell:       { width: CELL, height: CELL, alignItems: 'center', justifyContent: 'center' },

  dayCell:         { borderRadius: 100 },
  dayCellSelected: { backgroundColor: '#1A9E96' },
  dayCellToday:    { borderWidth: 1.5, borderColor: '#1A9E96' },
  dayText:         { fontSize: 13, color: '#1A1D1A', fontFamily: fonts.body },
  dayTextSelected: { color: '#FFFFFF', fontWeight: '700', fontFamily: fonts.bodySemi },
  dayTextToday:    { color: '#1A9E96', fontWeight: '600', fontFamily: fonts.bodySemi },
});
