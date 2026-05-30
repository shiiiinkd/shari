import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ResultScreen } from "../screens/ResultScreen";
import { TabNavigator } from "./TabNavigator";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Root の native-stack。Tabs(ボトムタブ) が起点。
 * Result は Tabs の上に全画面で push し、タブバーを覆う（ヘッダ「要約」+ 戻る）。
 *
 * NavigationContainer は本コンポーネント内に閉じ込めるが、
 * 認証ガード / trpc.Provider は App.tsx 側で上位に置く。
 */
export function RootNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={TabNavigator} options={{ headerShown: false }} />
        <Stack.Screen name="Result" component={ResultScreen} options={{ title: "要約" }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
