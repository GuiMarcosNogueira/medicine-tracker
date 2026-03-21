import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputKeyPressEventData,
  type NativeSyntheticEvent,
} from 'react-native';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Adicionar...' }: TagInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);

  function commitInput(raw: string) {
    const value = raw.trim().replace(/,$/, '').trim();
    if (!value) return;
    if (tags.length >= 15) return;
    if (tags.some(t => t.toLowerCase() === value.toLowerCase())) return;
    onChange([...tags, value]);
    setInput('');
  }

  function handleChangeText(text: string) {
    if (text.endsWith(',')) {
      commitInput(text);
    } else {
      setInput(text.slice(0, 60));
    }
  }

  function handleKeyPress(e: NativeSyntheticEvent<TextInputKeyPressEventData>) {
    if (e.nativeEvent.key === 'Backspace' && input === '' && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  }

  function handleSubmitEditing() {
    commitInput(input);
  }

  function removeTag(index: number) {
    const next = tags.filter((_, i) => i !== index);
    onChange(next);
  }

  return (
    <Pressable style={styles.container} onPress={() => { inputRef.current?.focus(); }}>
      {tags.map((tag, i) => (
        <View key={`${tag}-${i}`} style={styles.chip}>
          <Text style={styles.chipText}>{tag}</Text>
          <Pressable onPress={() => { removeTag(i); }} hitSlop={6} style={styles.chipRemove}>
            <Text style={styles.chipRemoveText}>✕</Text>
          </Pressable>
        </View>
      ))}
      {tags.length < 15 && (
        <TextInput
          ref={inputRef}
          style={styles.input}
          value={input}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          onSubmitEditing={handleSubmitEditing}
          placeholder={tags.length === 0 ? placeholder : ''}
          placeholderTextColor="#9CA59C"
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="sentences"
        />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#D1D9CC',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 8,
    marginBottom: 16,
    gap: 6,
    minHeight: 46,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E6F5F4',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
  },
  chipText: {
    fontSize: 13,
    color: '#1A9E96',
    fontWeight: '600',
  },
  chipRemove: {
    marginLeft: 2,
  },
  chipRemoveText: {
    fontSize: 11,
    color: '#1A9E96',
    fontWeight: '700',
  },
  input: {
    fontSize: 14,
    color: '#1A1D1A',
    flex: 1,
    minWidth: 80,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
});
