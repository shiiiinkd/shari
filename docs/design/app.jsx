/* shari — visual spec canvas. Lays every screen state out as a 390-wide frame. */

/* Tab-bar states reference (the 3 active patterns on one card) */
function TabBarStates() {
  const rows = [
    { active: 'summary', name: '要約 タブ がアクティブ' },
    { active: 'library', name: 'ライブラリ タブ がアクティブ' },
    { active: 'settings', name: '設定 タブ がアクティブ' },
  ];
  return (
    <div style={{ width: SCREEN_W, background: C.bg, fontFamily: FONT, padding: '20px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {rows.map(r => (
          <div key={r.active}>
            <div style={{ fontSize: 12, color: C.textTertiary, padding: '0 20px 8px' }}>{r.name}</div>
            <TabBar active={r.active} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* Design-token reference sheet */
function Swatch({ color, name, hex }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 30, height: 30, borderRadius: 6, background: color, border: `1px solid ${C.border}` }} />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: C.textPrimary }}>{name}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.textTertiary }}>{hex}</span>
      </div>
    </div>
  );
}

function TokenSheet() {
  const head = { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.textTertiary, marginBottom: 14 };
  const cell = { display: 'flex', flexDirection: 'column', gap: 13 };
  return (
    <div style={{ width: 720, background: C.bg, fontFamily: FONT, padding: 36, boxSizing: 'border-box' }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: C.textPrimary }}>デザイントークン</div>
      <div style={{ fontSize: 13, color: C.textTertiary, marginTop: 4, marginBottom: 28 }}>実装時に定数化できる値。配色は固定、余白・角丸・タイポは本モックの提案値。</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px 40px' }}>
        <div>
          <div style={head}>ブランド（3箇所のみ）</div>
          <div style={cell}>
            <Swatch color={C.brand} name="brand — タブ / 主ボタン" hex="#4f46e5" />
            <Swatch color={C.brandPressed} name="brand.pressed — cache文字" hex="#3730a3" />
            <Swatch color={C.brandSubtle} name="brand.subtle — cache背景" hex="#eef2ff" />
          </div>
        </div>
        <div>
          <div style={head}>テキスト</div>
          <div style={cell}>
            <Swatch color={C.textPrimary} name="text.primary" hex="#11161d" />
            <Swatch color={C.textSecondary} name="text.secondary" hex="#666666" />
            <Swatch color={C.textTertiary} name="text.tertiary" hex="#9aa0a8" />
            <Swatch color={C.textDisabled} name="text.disabled" hex="#aab0b8" />
          </div>
        </div>
        <div>
          <div style={head}>サーフェス & 罫線</div>
          <div style={cell}>
            <Swatch color={C.surface} name="surface — カード/操作" hex="#fafafa" />
            <Swatch color={C.surface2} name="surface.2 — コード/骨格" hex="#f4f4f6" />
            <Swatch color={C.border} name="border — ヘアライン" hex="#ececef" />
            <Swatch color={C.border2} name="border.2 — 入力/分割線" hex="#dcdfe4" />
          </div>
        </div>
        <div>
          <div style={head}>セマンティック</div>
          <div style={cell}>
            <Swatch color={C.errorText} name="error.text" hex="#cc0000" />
            <Swatch color={C.errorBg} name="error.bg" hex="#fdeceb" />
          </div>
          <div style={{ ...head, marginTop: 26 }}>余白スケール（4pt）</div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
            {[4,8,12,16,20,24].map(s => (
              <div key={s} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: s, height: s, background: C.brand, opacity: 0.18, borderRadius: 2 }} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.textTertiary }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={head}>角丸</div>
          <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end' }}>
            {[{r:4,l:'xs'},{r:8,l:'sm'},{r:10,l:'md'},{r:12,l:'lg'}].map(o => (
              <div key={o.r} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 40, height: 40, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: o.r }} />
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.textTertiary }}>{o.l} · {o.r}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div style={head}>タイポ（pt）</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[{s:11,n:'ラベル/サイト名'},{s:13,n:'操作/エラー'},{s:15,n:'要約本文'},{s:16,n:'入力/主ボタン'},{s:18,n:'セクション見出し'},{s:20,n:'画面H1'}].map(o => (
              <div key={o.s} style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                <span style={{ fontSize: o.s, fontWeight: o.s >= 18 ? 700 : 400, color: C.textPrimary, width: 70 }}>{o.s}px</span>
                <span style={{ fontSize: 12, color: C.textTertiary }}>{o.n}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* heights for the two tall result frames — measured to fit content exactly */
const H_SUCCESS = window.__SHARI_H_SUCCESS || 1470;
const H_VIEW = window.__SHARI_H_VIEW || 926;

function App() {
  return (
    <DesignCanvas>
      <DCSection id="foundation" title="土台 & トークン" subtitle="ボトムタブの3状態とデザイントークン">
        <DCArtboard id="tabbar" label="ボトムタブ — アクティブ3状態" width={SCREEN_W} height={420}><TabBarStates /></DCArtboard>
        <DCArtboard id="tokens" label="デザイントークン一覧" width={720} height={760}><TokenSheet /></DCArtboard>
      </DCSection>

      <DCSection id="summary" title="要約タブ" subtitle="URL を入力して要約を作る（初期タブ）">
        <DCArtboard id="sum-a" label="A · 標準" width={SCREEN_W} height={844}><SummaryScreen variant="standard" /></DCArtboard>
        <DCArtboard id="sum-b" label="B · クリップボードに URL あり" width={SCREEN_W} height={844}><SummaryScreen variant="paste" /></DCArtboard>
        <DCArtboard id="sum-c" label="C · 入力エラー" width={SCREEN_W} height={844}><SummaryScreen variant="error" /></DCArtboard>
      </DCSection>

      <DCSection id="library" title="ライブラリタブ" subtitle="要約履歴の一覧（ブランドカラーなし）">
        <DCArtboard id="lib-a" label="A · 一覧" width={SCREEN_W} height={844}><LibraryScreen variant="list" /></DCArtboard>
        <DCArtboard id="lib-b" label="B · 空" width={SCREEN_W} height={844}><LibraryScreen variant="empty" /></DCArtboard>
        <DCArtboard id="lib-c" label="C · 読み込み中（スケルトン）" width={SCREEN_W} height={844}><LibraryScreen variant="loading" /></DCArtboard>
        <DCArtboard id="lib-d" label="D · 追加読み込み" width={SCREEN_W} height={844}><LibraryScreen variant="more" /></DCArtboard>
      </DCSection>

      <DCSection id="result" title="Result（要約結果）" subtitle="タブを覆う全画面。上部に戻る＋「要約」固定タイトル">
        <DCArtboard id="res-a" label="A · 生成中" width={SCREEN_W} height={844}><ResultScreen variant="generating" /></DCArtboard>
        <DCArtboard id="res-b" label="B · 成功（新規・関連記事あり）" width={SCREEN_W} height={H_SUCCESS}><ResultScreen variant="success" /></DCArtboard>
        <DCArtboard id="res-c" label="C · 成功（閲覧・関連記事なし）" width={SCREEN_W} height={H_VIEW}><ResultScreen variant="view" /></DCArtboard>
        <DCArtboard id="res-d" label="D · エラー" width={SCREEN_W} height={844}><ResultScreen variant="error" /></DCArtboard>
        <DCArtboard id="res-e" label="E · 閲覧でキャッシュ無し（NOT_FOUND）" width={SCREEN_W} height={844}><ResultScreen variant="notfound" /></DCArtboard>
      </DCSection>

      <DCSection id="settings" title="設定タブ" subtitle="MVP は最小構成">
        <DCArtboard id="set-a" label="設定" width={SCREEN_W} height={844}><SettingsScreen /></DCArtboard>
      </DCSection>
    </DesignCanvas>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
