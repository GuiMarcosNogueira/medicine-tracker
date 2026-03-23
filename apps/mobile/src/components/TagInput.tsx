import { useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  type TextInputKeyPressEventData,
  type NativeSyntheticEvent,
} from 'react-native';
import { useTheme, type Theme } from '@medstock/ui';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = 'Adicionar...' }: TagInputProps) {
  const [input, setInput] = useState('');
  const inputRef = useRef<TextInput>(null);
  const theme = useTheme();
  const s = useMemo(() => styles(theme), [theme]);

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
    <Pressable style={s.container} onPress={() => { inputRef.current?.focus(); }}>
      {tags.map((tag, i) => (
        <View key={`${tag}-${i}`} style={s.chip}>
          <Text style={s.chipText}>{tag}</Text>
          <Pressable onPress={() => { removeTag(i); }} hitSlop={6} style={s.chipRemove}>
            <Text style={s.chipRemoveText}>✕</Text>
          </Pressable>
        </View>
      ))}
      {tags.length < 15 && (
        <TextInput
          ref={inputRef}
          style={s.input}
          value={input}
          onChangeText={handleChangeText}
          onKeyPress={handleKeyPress}
          onSubmitEditing={handleSubmitEditing}
          placeholder={tags.length === 0 ? placeholder : ''}
          placeholderTextColor={theme.textMuted}
          returnKeyType="done"
          blurOnSubmit={false}
          autoCapitalize="sentences"
        />
      )}
    </Pressable>
  );
}

function styles(t: Theme) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: t.borderSub,
      borderRadius: 16,
      backgroundColor: t.surface,
      padding: 8,
      marginBottom: 16,
      gap: 6,
      minHeight: 46,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: t.primaryBg,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 4,
      gap: 4,
    },
    chipText: {
      fontSize: 13,
      color: t.primary,
      fontWeight: '600',
    },
    chipRemove: {
      marginLeft: 2,
    },
    chipRemoveText: {
      fontSize: 11,
      color: t.primary,
      fontWeight: '700',
    },
    input: {
      fontSize: 14,
      color: t.text,
      flex: 1,
      minWidth: 80,
      paddingVertical: 2,
      paddingHorizontal: 4,
    },
  });
}
