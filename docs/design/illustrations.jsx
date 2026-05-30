/* shari — calm empty/status states (no red, no alarm).
   Friendly grayscale spot illustrations + a shared StatusState layout.
   Brand color appears ONLY on the optional primary action button. */

const ART_STROKE = '#bcc1ca';
const ART_LINE = '#d3d7dd';
const ART_FILL = '#ffffff';
const ART_BACK = '#f1f1f4';

/* video-history empty: a small stack of video cards */
function ArtNoHistory() {
  return (
    <svg width="140" height="132" viewBox="0 0 140 132" fill="none" aria-hidden="true">
      <circle cx="70" cy="66" r="56" fill={ART_BACK} />
      <rect x="38" y="44" width="56" height="32" rx="6" fill="#fafafb" stroke={ART_LINE} strokeWidth="2.5" />
      <rect x="48" y="56" width="56" height="34" rx="6" fill={ART_FILL} stroke={ART_STROKE} strokeWidth="2.5" />
      <path d="M70 65 l12 8 -12 8 Z" fill="#cdd1d8" />
    </svg>
  );
}

/* busy / try-again: a teacup with steam — “give it a moment” */
function ArtBusy() {
  return (
    <svg width="140" height="132" viewBox="0 0 140 132" fill="none" aria-hidden="true">
      <circle cx="70" cy="66" r="56" fill={ART_BACK} />
      <path d="M59 38 q-7 -9 0 -18" stroke="#cdd1d8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M70 36 q-7 -9 0 -18" stroke="#cdd1d8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M81 38 q-7 -9 0 -18" stroke="#cdd1d8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M47 54 h46 l-4 32 a11 11 0 0 1 -11 10 H62 a11 11 0 0 1 -11 -10 Z" fill={ART_FILL} stroke={ART_STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M93 60 h6 a9 9 0 0 1 0 18 h-6" fill="none" stroke={ART_STROKE} strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 104 h50" stroke={ART_STROKE} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

/* not-found: a document being searched */
function ArtNotFound() {
  return (
    <svg width="140" height="132" viewBox="0 0 140 132" fill="none" aria-hidden="true">
      <circle cx="70" cy="66" r="56" fill={ART_BACK} />
      <path d="M48 36 h26 l14 14 v40 a4 4 0 0 1 -4 4 H48 a4 4 0 0 1 -4 -4 V40 a4 4 0 0 1 4 -4 Z" fill={ART_FILL} stroke={ART_STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M74 36 v14 h14" fill="none" stroke={ART_STROKE} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M53 60 h20 M53 70 h26" stroke={ART_LINE} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="91" cy="84" r="14" fill="#fafafb" stroke="#aab0b8" strokeWidth="3" />
      <path d="M101 94 l10 10" stroke="#aab0b8" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

/* Shared calm status layout. Centered, generous, grayscale.
   `primary` (brand fill) is the ONLY brand color here. */
function StatusState({ art, title, body, primary, secondary }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 36px', textAlign: 'center' }}>
      <div style={{ marginBottom: 22 }}>{art}</div>
      <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: C.textPrimary, marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: FONT, fontSize: 13.5, color: C.textTertiary, lineHeight: 1.7, maxWidth: 278 }}>{body}</div>
      {primary && (
        <div style={{ width: '100%', maxWidth: 300, marginTop: 28 }}>
          <PrimaryButton>{primary}</PrimaryButton>
        </div>
      )}
      {secondary && <div style={{ marginTop: 12 }}><SecondaryButton>{secondary}</SecondaryButton></div>}
    </div>
  );
}

Object.assign(window, { ArtNoHistory, ArtBusy, ArtNotFound, StatusState });
