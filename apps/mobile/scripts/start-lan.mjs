/**
 * 実機 Expo Go 用の expo 起動ラッパー。
 *
 * なぜ必要か:
 *   SSH 開発機は NIC が複数ある（en0/en1 の LAN + Tailscale の utun 100.x 等）。
 *   この環境では `expo start` / `--host lan` の自動判定が LAN IP を選べず 127.0.0.1 に
 *   フォールバックし、実機が backend(:8787) に届かず「通信エラー」になる。
 *   → LAN IPv4（192.168.x を優先、loopback と Tailscale 100.x は除外）を自分で選び、
 *     REACT_NATIVE_PACKAGER_HOSTNAME に渡して Metro に正しい hostUri を出させる。
 *
 * Web は `dev:web`（このラッパーを通さない）を使うので影響しない。
 * 出先のトンネル接続は別経路（/expo-dev skill 参照）。
 */
import { spawn } from "node:child_process";
import { networkInterfaces } from "node:os";

function pickLanIp() {
  const candidates = [];
  for (const addrs of Object.values(networkInterfaces())) {
    for (const a of addrs ?? []) {
      // 外部 IPv4 のみ。Tailscale(100.64.0.0/10 の慣用 100.x) は除外。
      if (a.family === "IPv4" && !a.internal && !a.address.startsWith("100.")) {
        candidates.push(a.address);
      }
    }
  }
  return candidates.find((ip) => ip.startsWith("192.168.")) ?? candidates[0];
}

const host = pickLanIp();
const env = { ...process.env };
if (host) {
  env.REACT_NATIVE_PACKAGER_HOSTNAME = host;
  console.log(
    `[start-lan] REACT_NATIVE_PACKAGER_HOSTNAME=${host}（実機はこの IP で backend に繋ぐ）`,
  );
} else {
  console.warn(
    "[start-lan] LAN IP を検出できませんでした。localhost で起動します（実機は届きません）",
  );
}

const child = spawn("expo", ["start", ...process.argv.slice(2)], {
  stdio: "inherit",
  env,
  shell: true,
});
child.on("exit", (code) => process.exit(code ?? 0));
