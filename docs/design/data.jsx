/* shari — sample content: library rows, markdown summary, related-article cards.
   All sample copy is taken verbatim from the brief. Grayscale only. */

const LIBRARY_ITEMS = [
  { title: 'Rust の所有権を10分で理解する',        channel: 'Tech Lounge JP',     date: '2日前' },
  { title: 'React Server Components 完全解説',     channel: 'Frontend Bytes',     date: '1週間前' },
  { title: 'Postgres インデックス設計の実践',       channel: 'Database Deep Dive', date: '3週間前' },
  { title: 'Kubernetes ネットワーキング入門',       channel: 'Cloud Native 日本',   date: '先月' },
];

/* 16:9 youtube-thumbnail placeholder */
function Thumb({ w = 132 }) {
  return (
    <div style={{
      width: w, aspectRatio: '16 / 9', flexShrink: 0, borderRadius: 8, overflow: 'hidden',
      background: C.surface2, border: `1px solid ${C.border}`, position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', background: 'rgba(17,22,29,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 0, height: 0, borderTop: '6px solid transparent', borderBottom: '6px solid transparent', borderLeft: `9px solid rgba(17,22,29,0.45)`, marginLeft: 2 }} />
      </div>
    </div>
  );
}

function LibraryRow({ item }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'flex-start' }}>
      <Thumb />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3, paddingTop: 1 }}>
        <div style={{
          fontFamily: FONT, fontSize: 14, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{item.title}</div>
        <div style={{ fontFamily: FONT, fontSize: 12.5, color: C.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.channel}</div>
        <div style={{ fontFamily: FONT, fontSize: 12, color: C.textTertiary }}>{item.date}</div>
      </div>
    </div>
  );
}

function LibrarySkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', alignItems: 'flex-start' }}>
      <Skeleton width={132} height={74} radius={8} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 3 }}>
        <Skeleton height={13} width="92%" />
        <Skeleton height={13} width="64%" />
        <Skeleton height={11} width="34%" style={{ marginTop: 2 }} />
      </div>
    </div>
  );
}

/* ── Markdown summary (4-section sample from brief) ──────────── */
function MD_H2({ children }) {
  return <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 700, color: C.textPrimary, margin: '18px 0 8px', lineHeight: 1.3 }}>{children}</div>;
}
function MD_P({ children }) {
  return <p style={{ fontFamily: FONT, fontSize: 15, lineHeight: 1.65, color: C.textPrimary, margin: '0 0 6px' }}>{children}</p>;
}
function MD_LI({ children }) {
  return (
    <li style={{ fontFamily: FONT, fontSize: 15, lineHeight: 1.6, color: C.textPrimary, marginBottom: 7, paddingLeft: 4 }}>{children}</li>
  );
}
function Code({ children }) {
  return <code style={{ fontFamily: MONO, fontSize: 13, background: C.surface3, color: C.textPrimary, padding: '1.5px 5px', borderRadius: 4 }}>{children}</code>;
}

function SummaryMarkdown() {
  const ul = { margin: '2px 0 8px', paddingLeft: 20, listStyleType: 'disc' };
  return (
    <div>
      <MD_H2>一行サマリ</MD_H2>
      <MD_P>Rust の所有権・借用・ライフタイムを、GC 言語との対比で実例ベースに整理した入門解説。</MD_P>

      <MD_H2>主な内容</MD_H2>
      <ul style={ul}>
        <MD_LI>所有権の3ルール: 各値は単一の所有者を持つ / スコープを抜けると drop される / 代入や関数渡しで move する</MD_LI>
        <MD_LI>借用と参照: <Code>&T</Code>（共有・複数可）と <Code>&mut T</Code>（排他・同時に1つ）は同時に成立しない</MD_LI>
        <MD_LI>ライフタイム注釈が必要になる典型ケースと、省略規則（elision）が効く条件</MD_LI>
        <MD_LI>コンパイラの borrow checker がデータ競合を実行前に弾く仕組み</MD_LI>
      </ul>

      <MD_H2>技術的ハイライト</MD_H2>
      <ul style={ul}>
        <MD_LI><Code>Box&lt;T&gt;</Code> / <Code>Rc&lt;T&gt;</Code> / <Code>Arc&lt;T&gt;</Code> の使い分けとヒープ確保のコスト感</MD_LI>
        <MD_LI><Code>Clone</Code> と move のトレードオフ、不要な <Code>.clone()</Code> を避ける指針</MD_LI>
        <MD_LI>非同期コードで <Code>'static</Code> 境界が要求される理由</MD_LI>
      </ul>

      <MD_H2>補足</MD_H2>
      <MD_P>GC を持つ言語からの移行者向け。次の一歩は公式の The Book 4章。</MD_P>
    </div>
  );
}

/* ── Related-article cards (Slack link-preview, grayscale) ───── */
const ARTICLES = [
  { site: 'QIITA', title: 'Rust の所有権システムを完全に理解する', desc: 'move・borrow・lifetime をコンパイラの視点から図解。所有権で詰まる典型パターンと回避策をまとめた。', author: 'taro_dev', image: true },
  { site: 'ZENN',  title: 'borrow checker と仲良くなる方法',        desc: 'エラーメッセージの読み方と、参照のスコープを縮める実践的リファクタリング手順を紹介。', author: 'nyan_engineer', image: false },
];

function ArticleCard({ article }) {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden', background: C.surface }}>
      {article.image && (
        <div style={{ width: '100%', aspectRatio: '1.91', background: C.surface2, borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ion-icon name="image-outline" style={{ fontSize: 34, color: '#c8ccd3' }}></ion-icon>
        </div>
      )}
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, letterSpacing: '0.07em', color: C.textTertiary }}>{article.site}</div>
        <div style={{
          fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: C.textPrimary, lineHeight: 1.4,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{article.title}</div>
        <div style={{
          fontFamily: FONT, fontSize: 12.5, color: C.textSecondary, lineHeight: 1.5, marginTop: 1,
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{article.desc}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: '50%', background: C.surface2, border: `1px solid ${C.border}`, flexShrink: 0 }} />
          <span style={{ fontFamily: FONT, fontSize: 12.5, color: C.textSecondary }}>{article.author}</span>
        </div>
      </div>
    </div>
  );
}

function ArticleSkeletonCard() {
  return (
    <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.surface, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Skeleton width={48} height={10} />
      <Skeleton height={14} width="88%" />
      <Skeleton height={12} width="96%" />
    </div>
  );
}

Object.assign(window, {
  LIBRARY_ITEMS, Thumb, LibraryRow, LibrarySkeletonRow,
  SummaryMarkdown, ARTICLES, ARTICLE: ARTICLES, ArticleCard, ArticleSkeletonCard,
});
