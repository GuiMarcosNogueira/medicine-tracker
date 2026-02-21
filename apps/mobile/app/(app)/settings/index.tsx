import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Full implementation in Phase 4.
export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Configurações — Em breve</Text>
      </View>
    </SafeAreaView>
  );
}
