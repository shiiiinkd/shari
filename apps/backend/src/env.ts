/**
 * Cloudflare Workers の env バインディングを Zod で検証する。
 * 必須シークレットが未投入なら起動時に fail-fast する。
 * 新規シークレット追加は /setup-secret skill 参照（4箇所の更新が必要）。
 */
import { z } from "zod";

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1, "ANTHROPIC_API_KEY is required"),
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),
  QIITA_TOKEN: z.string().optional(),
  ALLOWED_ORIGIN: z.string().min(1).default("*"),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export function parseEnv(env: unknown): ValidatedEnv {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    // Workers のログに残るよう Error で投げる。
    // 詳細な欠落キーがログから読み取れるように JSON 化。
    throw new Error(`Invalid env: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  return parsed.data;
}

/** ALLOWED_ORIGIN（カンマ区切り）→ Hono cors の origin オプション形に変換。 */
export function buildCorsOrigin(allowed: string): string | string[] {
  const list = allowed
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (list.length === 1 && list[0] === "*") return "*";
  return list;
}
