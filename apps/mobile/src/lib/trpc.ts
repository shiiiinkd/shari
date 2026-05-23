/**
 * tRPC client（mobile側）。
 * packages/api の AppRouter 型をimportして型安全に呼び出す。
 *
 * 注: backend URLは現状ハードコード。後で expo-constants + .env or app.config.ts に置き換える。
 */
import type { AppRouter } from "@shari/api";
import { createTRPCReact } from "@trpc/react-query";

export const trpc = createTRPCReact<AppRouter>();

/**
 * ローカル開発時のbackend URL。
 * - iOS Simulator: http://localhost:8787
 * - Android Emulator: http://10.0.2.2:8787（エミュレータからホストへのIP）
 * - 実機: PCのLAN IPを指定（例: http://192.168.x.x:8787）
 *
 * Expo Constants で実機/エミュレータを判別して切り替えるのが本来。
 * MVP前にここを整理する。
 */
export const TRPC_URL = "http://localhost:8787/trpc";
