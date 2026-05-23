import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { TRPC_URL, trpc } from "./src/lib/trpc";

/**
 * tRPC + React Query を画面で疎通確認するだけの最小App。
 * MVP実装時に画面遷移・状態管理・UIを足していく。
 */
function HelloScreen() {
  const { data, isLoading, error } = trpc.hello.useQuery({ name: "シャリ" });

  if (isLoading) return <ActivityIndicator size="large" />;
  if (error) {
    return (
      <View style={styles.errorBox}>
        <Text style={styles.errorTitle}>接続失敗</Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <Text style={styles.hint}>backend (pnpm --filter @shari/backend dev) を起動していますか？</Text>
      </View>
    );
  }

  return (
    <View style={styles.helloBox}>
      <Text style={styles.title}>{data?.message}</Text>
      <Text style={styles.timestamp}>{data?.timestamp}</Text>
    </View>
  );
}

export default function App() {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [httpBatchLink({ url: TRPC_URL })],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <View style={styles.container}>
          <HelloScreen />
          <StatusBar style="auto" />
        </View>
      </QueryClientProvider>
    </trpc.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  helloBox: {
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 12,
    color: "#888",
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
  hint: {
    fontSize: 12,
    color: "#666",
    marginTop: 8,
  },
});
