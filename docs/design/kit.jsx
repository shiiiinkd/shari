/* shari — visual spec kit: tokens, phone chrome, controls.
   Color is LOCKED per brief. Brand indigo #4f46e5 appears in EXACTLY 3 places:
   (1) active tab indicator+icon+label  (2) primary "要約する" button  (3) cache badge text.
   Everything else is grayscale. No web fonts — OS system stack only. Icons: Ionicons. */

const FONT = '-apple-system, BlinkMacSystemFont, "Hiragino Kaku Gothic ProN", "Hiragino Sans", "Yu Gothic", Meiryo, "Noto Sans CJK JP", system-ui, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

const C = {
  brand:        '#4f46e5',  // active tab, primary button
  brandPressed: '#3730a3',  // cache badge text
  brandSubtle:  '#eef2ff',  // cache badge bg, primary-button focus tint
  bg:           '#ffffff',
  surface:      '#fafafa',  // cards / action buttons
  surface2:     '#f4f4f6',  // code block / skeleton base
  surface3:     '#f0f0f2',  // inline code
  textPrimary:  '#11161d',
  textSecondary:'#666666',  // channel names, inactive tabs
  textTertiary: '#9aa0a8',  // dates, captions
  textDisabled: '#aab0b8',
  border:       '#ececef',  // hairline card border
  border2:      '#dcdfe4',  // input border / dividers
  errorText:    '#cc0000',
  errorBg:      '#fdeceb',
  skeleton:     '#e8e8ec',
  font: FONT, mono: MONO,
};

/* device dimensions (iPhone 13/14 logical) */
const SCREEN_W = 390;
const SCREEN_H = 844;
const STATUS_H = 50;
const TABBAR_H = 84;

/* ── Status bar (notch layout) ───────────────────────────────── */
function StatusBar() {
  const ink = '#11161d';
  return (
    <div style={{ position: 'relative', height: STATUS_H, flexShrink: 0, background: C.bg }}>
      <span style={{
        position: 'absolute', left: 30, top: 16, fontFamily: FONT,
        fontSize: 15, fontWeight: 600, color: ink, letterSpacing: '0.2px',
      }}>9:41</span>
      {/* notch */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 158, height: 30, background: '#000', borderRadius: '0 0 20px 20px',
      }} />
      {/* right cluster */}
      <div style={{ position: 'absolute', right: 28, top: 18, display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="18" height="11" viewBox="0 0 18 11"><rect x="0" y="7" width="3" height="4" rx="0.6" fill={ink}/><rect x="4.6" y="4.6" width="3" height="6.4" rx="0.6" fill={ink}/><rect x="9.2" y="2.3" width="3" height="8.7" rx="0.6" fill={ink}/><rect x="13.8" y="0" width="3" height="11" rx="0.6" fill={ink}/></svg>
        <svg width="16" height="11" viewBox="0 0 17 12"><path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" fill={ink}/><path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" fill={ink}/><circle cx="8.5" cy="10.5" r="1.5" fill={ink}/></svg>
        <svg width="25" height="12" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" stroke={ink} strokeOpacity="0.35" fill="none"/><rect x="2" y="2" width="18" height="9" rx="2" fill={ink}/><path d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z" fill={ink} fillOpacity="0.4"/></svg>
      </div>
    </div>
  );
}

/* ── Home indicator ──────────────────────────────────────────── */
function HomeIndicator() {
  return (
    <div style={{ height: 26, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: C.bg }}>
      <div style={{ width: 134, height: 5, borderRadius: 100, background: 'rgba(17,22,29,0.82)' }} />
    </div>
  );
}

/* ── Bottom tab bar ──────────────────────────────────────────── */
const TABS = [
  { key: 'summary', label: '要約',     icon: 'sparkles' },
  { key: 'library', label: 'ライブラリ', icon: 'library' },
  { key: 'settings', label: '設定',     icon: 'settings' },
];

function TabBar({ active }) {
  return (
    <div style={{ flexShrink: 0, background: C.bg, borderTop: `0.5px solid ${C.border2}` }}>
      <div style={{ display: 'flex', height: TABBAR_H - 26 }}>
        {TABS.map(t => {
          const on = t.key === active;
          const col = on ? C.brand : C.textSecondary;
          return (
            <div key={t.key} style={{
              flex: 1, position: 'relative', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 4,
            }}>
              {on && <div style={{ position: 'absolute', top: 0, width: 26, height: 3, borderRadius: 3, background: C.brand }} />}
              <ion-icon name={on ? t.icon : t.icon + '-outline'} style={{ fontSize: 24, color: col }}></ion-icon>
              <span style={{ fontFamily: FONT, fontSize: 11, fontWeight: on ? 600 : 500, color: col, letterSpacing: '0.2px' }}>{t.label}</span>
            </div>
          );
        })}
      </div>
      <HomeIndicator />
    </div>
  );
}

/* ── Result full-screen header (grayscale — NO brand color) ──── */
function ResultHeader() {
  return (
    <div style={{
      flexShrink: 0, height: 47, position: 'relative', background: C.bg,
      borderBottom: `0.5px solid ${C.border2}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', left: 6, top: 0, height: 47, width: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <ion-icon name="chevron-back" style={{ fontSize: 28, color: C.textPrimary }}></ion-icon>
      </div>
      <span style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, color: C.textPrimary }}>要約</span>
    </div>
  );
}

/* ── Phone frame: assembles a full 390-wide screen ───────────── */
function Phone({ tab, result, children, contentStyle, height }) {
  return (
    <div style={{ width: SCREEN_W, height: height || undefined, minHeight: height ? undefined : SCREEN_H, background: C.bg, display: 'flex', flexDirection: 'column', fontFamily: FONT, overflow: 'hidden' }}>
      <StatusBar />
      {result && <ResultHeader />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, ...contentStyle }}>{children}</div>
      {result ? <HomeIndicator /> : <TabBar active={tab} />}
    </div>
  );
}

/* ── Controls ────────────────────────────────────────────────── */
function PrimaryButton({ children, disabled }) {
  return (
    <button disabled={disabled} style={{
      width: '100%', minHeight: 50, border: 'none', borderRadius: 10,
      background: disabled ? C.textDisabled : C.brand, color: '#fff',
      fontFamily: FONT, fontSize: 16, fontWeight: 700, cursor: 'default',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  );
}

/* gray outline, no brand */
function SecondaryButton({ children, icon, full }) {
  return (
    <button style={{
      alignSelf: full ? 'stretch' : 'flex-start', width: full ? '100%' : undefined,
      minHeight: 44, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border2}`,
      background: C.bg, color: C.textSecondary, fontFamily: FONT, fontSize: 14, fontWeight: 500,
      cursor: 'default', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>
      {icon && <ion-icon name={icon} style={{ fontSize: 18, color: C.textSecondary }}></ion-icon>}
      {children}
    </button>
  );
}

/* outline action (コピー / シェア) */
function ActionButton({ children, icon, done }) {
  return (
    <button style={{
      minHeight: 44, padding: '0 16px', borderRadius: 8, border: `1px solid ${C.border2}`,
      background: C.surface, color: C.textSecondary, fontFamily: FONT, fontSize: 13, fontWeight: 600,
      cursor: 'default', display: 'flex', alignItems: 'center', gap: 7,
    }}>
      {icon && <ion-icon name={done ? 'checkmark' : icon} style={{ fontSize: 17, color: C.textSecondary }}></ion-icon>}
      {children}
    </button>
  );
}

function Skeleton({ width = '100%', height = 14, radius = 5, style }) {
  return <div style={{ width, height, borderRadius: radius, background: C.skeleton, animation: 'shariPulse 1.5s ease-in-out infinite', ...style }} />;
}

function CacheBadge() {
  return <span style={{
    fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
    color: C.brandPressed, background: C.brandSubtle, padding: '2px 7px', borderRadius: 5,
  }}>cache</span>;
}

function Spinner({ size = 18, color = C.textTertiary }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', border: `2px solid ${C.skeleton}`, borderTopColor: color, animation: 'shariSpin 0.8s linear infinite' }} />;
}

Object.assign(window, {
  C, FONT, MONO, SCREEN_W, SCREEN_H,
  StatusBar, HomeIndicator, TabBar, ResultHeader, Phone,
  PrimaryButton, SecondaryButton, ActionButton, Skeleton, CacheBadge, Spinner,
});
