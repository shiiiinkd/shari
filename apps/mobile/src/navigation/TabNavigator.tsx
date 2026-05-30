import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { LibraryScreen } from "../screens/LibraryScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SummarizeScreen } from "../screens/SummarizeScreen";
import type { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

/**
 * アクティブ / 非アクティブのタブ色。
 * テーマ基盤は未導入のため定数で持つ（ブランドのアクセント = ティール #0a7）。
 */
const ACTIVE_TINT = "#0a7";
const INACTIVE_TINT = "#888";

/**
 * ボトムタブ。初期タブは Summarize（要約）。
 * 各タブのヘッダは出さず（headerShown:false）、ヘッダは Result(全画面) 側でのみ表示する。
 * アイコンは Expo 同梱の Ionicons。
 */
export function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Summarize"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE_TINT,
        tabBarInactiveTintColor: INACTIVE_TINT,
      }}
    >
      <Tab.Screen
        name="Summarize"
        component={SummarizeScreen}
        options={{
          title: "要約",
          tabBarIcon: ({ color, size }) => <Ionicons name="sparkles" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          title: "ライブラリ",
          tabBarIcon: ({ color, size }) => <Ionicons name="library" color={color} size={size} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: "設定",
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" color={color} size={size} />,
        }}
      />
    </Tab.Navigator>
  );
}
