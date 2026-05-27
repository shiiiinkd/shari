import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { ensureSession, supabase } from "./src/lib/supabase";
import { TRPC_URL, trpc } from "./src/lib/trpc";

/**
 * App 構造:
 *   SafeAreaProvider
 *     └ trpc.Provider
 *         └ QueryClientProvider
 *             └ RootNavigator (NavigationContainer + native-stack)
 *
 * 起動時に ensureSession() で匿名サインインを終わらせてから RootNavigator を描く。
 * 認証成立前に Navigation を出すと、各 screen 内の protectedProcedure 呼び出しが
 * UNAUTHORIZED で空振りするため、ガードはトップレベルに置く。
 */
export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    ensureSession()
      .then(() => setAuthReady(true))
      .catch((e: unknown) => setAuthError(e instanceof Error ? e.message : String(e)));
  }, []);

  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: TRPC_URL,
          // 各リクエストで最新の access_token を Authorization に乗せる。
          // ヘッダは関数として渡すことで、毎リクエスト直前に評価される。
          // getSession の error を握り潰すと「ヘッダ無し → API 側 UNAUTHORIZED」
          // しか観測できず認証系不具合の切り分けが困難になるため、警告ログを残す。
          headers: async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
              console.warn("trpc_header_get_session_failed", error.message);
              return {};
            }
            const token = data.session?.access_token;
            return token ? { Authorization: `Bearer ${token}` } : {};
          },
        }),
      ],
    }),
  );

  if (authError) {
    return (
      <SafeAreaProvider>
        <View style={styles.fallback}>
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>セッション初期化失敗</Text>
            <Text style={styles.errorMessage}>{authError}</Text>
          </View>
        </View>
      </SafeAreaProvider>
    );
  }

  if (!authReady) {
    return (
      <SafeAreaProvider>
        <View style={styles.fallback}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <RootNavigator />
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorBox: {
    alignItems: "center",
    gap: 8,
    padding: 16,
    backgroundColor: "#fee",
    borderRadius: 8,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#c00",
  },
  errorMessage: {
    fontSize: 14,
    color: "#c00",
  },
});
