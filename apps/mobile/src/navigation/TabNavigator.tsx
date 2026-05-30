import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, semantic } from "../theme";
import { LibraryScreen } from "../screens/LibraryScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { SummarizeScreen } from "../screens/SummarizeScreen";
import type { TabParamList } from "./types";

const Tab = createBottomTabNavigator<TabParamList>();

type IoniconName = keyof typeof Ionicons.glyphMap;

/** タブごとの filled / outline アイコン名（型安全に union で持つ）。 */
const TAB_ICONS: Record<keyof TabParamList, { on: IoniconName; off: IoniconName }> = {
  Summarize: { on: "sparkles", off: "sparkles-outline" },
  Library: { on: "library", off: "library-outline" },
  Settings: { on: "settings", off: "settings-outline" },
};

/**
 * カスタム tabBar。モック（kit.jsx TabBar）に忠実に:
 *   - アクティブタブ: ブランド色のインジケーター線（26x3）をタブ上端に＋filled アイコン＋ラベル太字
 *   - 非アクティブ: グレー（textSecondary）＋outline アイコン
 *   - 上端 hairline 罫線（border2）、下端は safe-area inset を確保
 * ブランド色が出るのはアクティブタブのみ（規律 place #1）。
 */
function ShariTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const descriptor = descriptors[route.key];
        if (!descriptor) return null;
        const { options } = descriptor;
        const focused = state.index === index;
        const routeName = route.name as keyof TabParamList;
        const label = options.title ?? route.name;
        const icons = TAB_ICONS[routeName];
        const color = focused ? semantic.tabActive : semantic.tabInactive;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };
        const onLongPress = () => {
          navigation.emit({ type: "tabLongPress", target: route.key });
        };

        return (
          <Pressable
            key={route.key}
            style={styles.item}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          >
            <View
              style={[
                styles.indicator,
                { backgroundColor: focused ? semantic.tabActive : "transparent" },
              ]}
            />
            <Ionicons name={focused ? icons.on : icons.off} size={24} color={color} />
            <Text style={[styles.label, { color, fontWeight: focused ? "600" : "500" }]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * ボトムタブ。初期タブは Summarize（要約）。各タブのヘッダは出さず、ヘッダは Result 側でのみ表示する。
 */
export function TabNavigator() {
  return (
    <Tab.Navigator
      initialRouteName="Summarize"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <ShariTabBar {...props} />}
    >
      <Tab.Screen name="Summarize" component={SummarizeScreen} options={{ title: "要約" }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: "ライブラリ" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "設定" }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border2,
  },
  item: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingTop: 8,
    paddingBottom: 6,
  },
  indicator: {
    position: "absolute",
    top: 0,
    width: 26,
    height: 3,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.22,
  },
});
