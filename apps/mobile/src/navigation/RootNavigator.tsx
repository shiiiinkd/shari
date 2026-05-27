import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HomeScreen } from "../screens/HomeScreen";
import { ResultScreen } from "../screens/ResultScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root の native-stack。Home が起点。
 * NavigationContainer は本コンポーネント内に閉じ込めるが、
 * 認証ガード / trpc.Provider は App.tsx 側で上位に置く。
 */
export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: "shari" }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: "要約" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
