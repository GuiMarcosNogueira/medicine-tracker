import { View, Text, StyleSheet } from 'react-native';

interface Props {
  label: string;
  value: string;        // YYYY-MM-DD
  onChange: (v: string) => void;
  error?: string | undefined;
}

// Web: <input type="date"> — display format is controlled by the browser/OS locale
// The value is always stored and returned as YYYY-MM-DD (the HTML date input spec).
export function DatePickerField({ label, value, onChange, error }: Props) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <input
        type="date"
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{
          border: `1px solid ${error ? '#F0735A' : '#D1D9CC'}`,
          borderRadius: 16,
          padding: '13px 12px',
          marginBottom: 4,
          fontSize: 15,
          backgroundColor: '#FFFFFF',
          color: value ? '#1A1D1A' : '#9CA59C',
          width: '100%',
          fontFamily: 'inherit',
          boxSizing: 'border-box',
          outline: 'none',
          cursor: 'pointer',
          display: 'block',
        }}
      />
      {Boolean(error) && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#2E332E', marginBottom: 6 },
  error: { color: '#F0735A', fontSize: 12, marginBottom: 12, marginLeft: 4 },
});
