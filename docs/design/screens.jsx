/* shari — screen frames. Each export is a complete 390-wide phone screen.
   IA & color locked per brief; visual styling (spacing/type/cards) is the proposal. */

const PAD = 24;        // summary-tab screen padding
const RES_PAD = 20;    // result screen padding
const LABEL_INK = '#333a44';

function FieldLabel({ children }) {
  return <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 500, color: LABEL_INK, marginBottom: 2 }}>{children}</div>;
}

function UrlInput({ value, focused }) {
  const empty = !value;
  return (
    <div style={{
      minHeight: 50, borderRadius: 10, padding: '0 14px', display: 'flex', alignItems: 'center',
      background: C.bg, border: `1.5px solid ${focused ? C.brand : C.border2}`,
      boxShadow: focused ? `0 0 0 4px ${C.brandSubtle}` : 'none',
    }}>
      <span style={{ fontFamily: FONT, fontSize: 15.5, color: empty ? C.textTertiary : C.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>
        {empty ? 'https://www.youtube.com/watch?v=...' : value}
      </span>
      {focused && <div style={{ width: 1.5, height: 22, background: C.brand, marginLeft: 1 }} />}
    </div>
  );
}

/* ── 要約タブ ─────────────────────────────────────────────── */
function SummaryScreen({ variant }) {
  // variant: 'standard' | 'paste' | 'error'
  const error = variant === 'error';
  return (
    <Phone tab="summary" height={844}>
      <div style={{ padding: PAD, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ marginTop: 8 }}>
          <FieldLabel>YouTube URL を入力</FieldLabel>
          <UrlInput
            value={error ? 'https://youtu.be/watch-broken' : ''}
            focused={error || variant === 'paste'}
          />
        </div>

        {variant === 'paste' && (
          <SecondaryButton icon="clipboard-outline">クリップボードから貼り付け</SecondaryButton>
        )}

        <div style={{ marginTop: 4 }}>
          <PrimaryButton disabled={!error}>要約する</PrimaryButton>
        </div>

        {error && (
          <div style={{ fontFamily: FONT, fontSize: 13, color: C.errorText, marginTop: 2 }}>
            正しい YouTube URL を入力してください
          </div>
        )}
      </div>
    </Phone>
  );
}

/* ── ライブラリタブ ──────────────────────────────────────── */
function LibraryScreen({ variant }) {
  // variant: 'list' | 'empty' | 'loading' | 'more'
  return (
    <Phone tab="library" height={844}>
      {variant === 'empty' ? (
        <StatusState
          art={<ArtNoHistory />}
          title="まだ要約はありません"
          body="要約タブで動画を要約すると、ここに並んでいきます。"
        />
      ) : (
        <div style={{ flex: 1, overflow: 'hidden', padding: '4px 20px 0' }}>
          {variant === 'loading' ? (
            <div style={{ display: 'flex', flexDirection: 'column', divideY: 0 }}>
              {[0,1,2,3,4].map(i => (
                <div key={i} style={{ borderBottom: i < 4 ? `1px solid ${C.border}` : 'none' }}><LibrarySkeletonRow /></div>
              ))}
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {LIBRARY_ITEMS.map((it, i) => (
                  <div key={i} style={{ borderBottom: `1px solid ${C.border}` }}><LibraryRow item={it} /></div>
                ))}
              </div>
              {variant === 'more' && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 0' }}>
                  <Spinner />
                  <span style={{ fontFamily: FONT, fontSize: 12.5, color: C.textTertiary }}>読み込み中</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Phone>
  );
}

/* ── Result（全画面） ────────────────────────────────────── */
function SectionTitle({ children, badge }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
      <span style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.textPrimary }}>{children}</span>
      {badge && <CacheBadge />}
    </div>
  );
}

function ResultScreen({ variant }) {
  // 'generating' | 'success' | 'view' | 'error' | 'notfound'
  const body = (() => {
    if (variant === 'generating') {
      return (
        <div style={{ padding: RES_PAD, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <Skeleton width={64} height={20} radius={6} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Skeleton height={14} /><Skeleton height={14} /><Skeleton height={14} width="85%" /><Skeleton height={14} width="60%" />
            </div>
          </div>
          <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.textTertiary }}>字幕を取得して要約中（初回は 20〜40 秒）</div>
        </div>
      );
    }
    if (variant === 'error') {
      return (
        <StatusState
          art={<ArtBusy />}
          title="少し混み合っているようです"
          body="うまく読み込めませんでした。少し時間をおいて、もう一度お試しください。"
          primary="もう一度試す"
        />
      );
    }
    if (variant === 'notfound') {
      return (
        <StatusState
          art={<ArtNotFound />}
          title="保存済みの要約がありません"
          body="この動画はまだ要約されていません。今すぐ要約できます。"
          primary="再要約する"
        />
      );
    }
    // success / view
    const copied = variant === 'view'; // show "コピーしました" state on the view frame for variety
    return (
      <div style={{ padding: RES_PAD, display: 'flex', flexDirection: 'column' }}>
        <SectionTitle badge={variant === 'success'}>要約</SectionTitle>
        <SummaryMarkdown />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <ActionButton icon="copy-outline" done={copied}>{copied ? 'コピーしました' : 'コピー'}</ActionButton>
          <ActionButton icon="share-outline">シェア</ActionButton>
        </div>

        {variant === 'success' && (
          <div style={{ marginTop: 28 }}>
            <div style={{ fontFamily: FONT, fontSize: 18, fontWeight: 700, color: C.textPrimary, marginBottom: 10 }}>関連記事</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ARTICLES.map((a, i) => <ArticleCard key={i} article={a} />)}
            </div>
          </div>
        )}
      </div>
    );
  })();

  const fixed = variant === 'generating' || variant === 'error' || variant === 'notfound';
  return <Phone result height={fixed ? 844 : undefined}>{body}</Phone>;
}

/* ── 設定タブ ─────────────────────────────────────────────── */
function SettingsRow({ label, detail, last }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', minHeight: 52, padding: '0 16px',
      borderBottom: last ? 'none' : `1px solid ${C.border}`,
    }}>
      <span style={{ flex: 1, fontFamily: FONT, fontSize: 15, color: C.textPrimary }}>{label}</span>
      {detail && <span style={{ fontFamily: FONT, fontSize: 14, color: C.textTertiary, marginRight: 8 }}>{detail}</span>}
      <ion-icon name="chevron-forward" style={{ fontSize: 17, color: C.textTertiary }}></ion-icon>
    </div>
  );
}

function SettingsScreen() {
  return (
    <Phone tab="settings" height={844}>
      <div style={{ flex: 1, overflow: 'hidden', padding: '28px 20px 0' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, marginBottom: 28 }}>
          <div style={{ fontFamily: FONT, fontSize: 26, fontWeight: 700, color: C.textPrimary, letterSpacing: '0.01em' }}>shari</div>
          <div style={{ fontFamily: FONT, fontSize: 13, color: C.textTertiary }}>バージョン 0.1.0</div>
        </div>
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden', background: C.bg }}>
          <SettingsRow label="バージョン" detail="0.1.0" />
          <SettingsRow label="このアプリについて" last />
        </div>
      </div>
    </Phone>
  );
}

Object.assign(window, { SummaryScreen, LibraryScreen, ResultScreen, SettingsScreen, SettingsRow });
