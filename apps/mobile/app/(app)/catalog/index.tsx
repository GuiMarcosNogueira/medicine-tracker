import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Full implementation in Phase 3.
export default function CatalogSearchScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Catálogo — Em breve</Text>
      </View>
    </SafeAreaView>
  );
}
