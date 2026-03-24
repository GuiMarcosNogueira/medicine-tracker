import { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, fonts, type Theme } from '@medstock/ui';

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

function buildGrid(year: number, month: number): (number | null)[] {
  const firstDow = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function DatePickerField({ label, value, onChange, error }: Props) {
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);
  const { width } = useWindowDimensions();
  const [showModal, setShowModal] = useState(false);

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
    setShowModal(true);
  }

  function prevMonth() {
    setViewMonth(m => {
      if (m === 0) { setViewYear(y => y - 1); return 11; }
      return m - 1;
    });
  }

  function nextMonth() {
    setViewMonth(m => {
      if (m === 11) { setViewYear(y => y + 1); return 0; }
      return m + 1;
    });
  }

  function selectDay(day: number) {
    onChange(dateToISO(new Date(viewYear, viewMonth, day)));
    setShowModal(false);
  }

  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth();
  const todayD = today.getDate();

  const selY = value ? date.getFullYear() : -1;
  const selM = value ? date.getMonth() : -1;
  const selD = value ? date.getDate() : -1;

  const grid = buildGrid(viewYear, viewMonth);
  const cellSize = Math.floor((Math.min(width, 400) - 48) / 7);

  return (
    <View>
      <Text style={s.label}>{label}</Text>
      <Pressable
        style={[s.input, Boolean(error) && s.inputError]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={[s.inputText, !value && s.placeholder]}>
          {displayValue || 'Selecionar data'}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={theme.textMuted} />
      </Pressable>
      {Boolean(error) && <Text style={s.error}>{error}</Text>}

      <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
        <Pressable style={s.overlay} onPress={() => setShowModal(false)} />
        <View style={s.sheet}>

          {/* Month navigation */}
          <View style={s.navRow}>
            <Pressable onPress={prevMonth} style={s.navBtn} hitSlop={12}>
              <Ionicons name="chevron-back" size={20} color={theme.primary} />
            </Pressable>
            <Text style={s.monthTitle}>
              {MONTHS_PT[viewMonth]} {viewYear}
            </Text>
            <Pressable onPress={nextMonth} style={s.navBtn} hitSlop={12}>
              <Ionicons name="chevron-forward" size={20} color={theme.primary} />
            </Pressable>
          </View>

          {/* Day-of-week header */}
          <View style={s.dowRow}>
            {DAYS_PT.map(d => (
              <Text key={d} style={[s.dowCell, { width: cellSize }]}>{d}</Text>
            ))}
          </View>

          {/* Grid */}
          <View style={s.grid}>
            {grid.map((day, idx) => {
              if (!day) return <View key={idx} style={{ width: cellSize, height: cellSize }} />;

              const isSelected = day === selD && viewMonth === selM && viewYear === selY;
              const isToday    = day === todayD && viewMonth === todayM && viewYear === todayY;

              return (
                <Pressable
                  key={idx}
                  style={[
                    s.dayCell,
                    { width: cellSize, height: cellSize },
                    isSelected && s.dayCellSelected,
                    !isSelected && isToday && s.dayCellToday,
                  ]}
                  onPress={() => { selectDay(day); }}
                >
                  <Text style={[
                    s.dayText,
                    isSelected && s.dayTextSelected,
                    !isSelected && isToday && s.dayTextToday,
                  ]}>
                    {day}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Cancel footer */}
          <Pressable style={s.cancelRow} onPress={() => setShowModal(false)}>
            <Text style={s.cancelText}>Cancelar</Text>
          </Pressable>

        </View>
      </Modal>
    </View>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    label:       { fontSize: 13, fontWeight: '600', color: t.text, marginBottom: 6, fontFamily: fonts.bodySemi },
    input:       { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: t.borderSub, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 13, marginBottom: 4, backgroundColor: t.surface },
    inputError:  { borderColor: t.coral },
    inputText:   { flex: 1, fontSize: 15, color: t.text, fontFamily: fonts.mono },
    placeholder: { color: t.textMuted, fontFamily: fonts.body },
    error:       { color: t.coral, fontSize: 12, marginBottom: 12, marginLeft: 4 },

    // Modal
    overlay:   { flex: 1, backgroundColor: t.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' },
    sheet:     { backgroundColor: t.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingBottom: 32 },

    // Navigation
    navRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 20 },
    navBtn:    { padding: 4 },
    monthTitle:{ fontSize: 18, fontWeight: '700', color: t.text, fontFamily: fonts.heading },

    // Day-of-week
    dowRow:    { flexDirection: 'row', marginBottom: 4 },
    dowCell:   { textAlign: 'center', fontSize: 11, color: t.textMuted, fontFamily: fonts.mono, paddingVertical: 4 },

    // Grid
    grid:            { flexDirection: 'row', flexWrap: 'wrap' },
    dayCell:         { alignItems: 'center', justifyContent: 'center', borderRadius: 100 },
    dayCellSelected: { backgroundColor: t.primary },
    dayCellToday:    { borderWidth: 1.5, borderColor: t.primary },
    dayText:         { fontSize: 14, color: t.text, fontFamily: fonts.body },
    dayTextSelected: { color: '#FFFFFF', fontWeight: '700', fontFamily: fonts.bodySemi },
    dayTextToday:    { color: t.primary, fontWeight: '600', fontFamily: fonts.bodySemi },

    // Footer
    cancelRow:  { alignItems: 'center', marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.surfaceAlt },
    cancelText: { fontSize: 15, color: t.textMuted, fontWeight: '600', fontFamily: fonts.bodySemi },
  });
}
