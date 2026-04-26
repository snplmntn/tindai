import 'react-native-gesture-handler';

import { Feather, FontAwesome, Ionicons } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthProvider } from '@/context/AuthContext';
import { LocalDataProvider } from '@/features/local-data/LocalDataContext';
import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    ...Feather.font,
    ...FontAwesome.font,
  });

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <AuthProvider>
          <LocalDataProvider>
            <StatusBar style="dark" />
            <RootNavigator />
          </LocalDataProvider>
        </AuthProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
