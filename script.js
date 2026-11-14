// Reset Journal · DEMO. Giống app.js của bản đầy đủ; dữ liệu do local-api.js lưu trong trình duyệt.
// Reset Journal v0: toàn bộ giao diện chạy trong file này.
// Trang chỉ có 1 file HTML; phần sau dấu # trên địa chỉ quyết định hiện màn hình nào:
//   #/              gallery
//   #/new           thêm lệnh
//   #/trade/5       chi tiết lệnh số 5
//   #/trade/5/edit  sửa lệnh số 5

// ---------- Danh sách lựa chọn (sửa ở đây nếu muốn đổi) ----------
let SESSIONS = ['Asia', 'London', 'NY AM', 'NY PM', 'Out of session'];
let SYMBOLS = ['MNQ', 'NQ', 'MES', 'ES', 'MGC', 'GC'];
let CONFIRMATIONS = ['MSS', 'CISD', 'IFVG', 'FVG', 'SMT']; // tín hiệu khung nhỏ (10/11: bỏ OB/BB/BPR vì đã ở HTF PDA, bỏ Displacement)
let MISTAKES = [
  'FOMO', 'Revenge Trading', 'Overconfidence', 'Fear of Losing',
  'Greed', 'Impatience', 'Outcome Bias', 'Confirmation Bias',
  'Sized up after loss', 'Moved to BE too early',
];
const SHOTS = [
  { key: 'img_htf', label: 'HTF chart', hint: 'Higher timeframe: context, bias' },
  { key: 'img_ltf', label: 'Entry chart', hint: 'Entry timeframe: your entry' },
  { key: 'img_after', label: 'After', hint: 'How it played out' },
];
// Draw on Liquidity: lấy từ journal Notion của chủ dự án
let DOLS = ['IRL → ERL', 'ERL → IRL', 'London High', 'London Low', 'Asia High', 'Asia Low', 'EQH', 'EQL', 'ATH', 'PDH', 'PDL', 'NWOG', 'NDOG', 'HTF PD Array', 'BSL', 'SSL'];
// Cảm xúc trước khi vào lệnh (chọn được nhiều)
// Vùng PDA khung lớn (10/11), sửa được bằng ô + Add
let PDAS = ['FVG', 'IFVG', 'OB', 'BB', 'BPR'];
// Cấu trúc M15 có thuận xu hướng H1/H4 (HTF Bias) không: true / false / null (chưa đủ thông tin)
const alignedOf = (bias, m15) => (!bias || !m15 || bias === 'undecided' ? null : m15 === bias);
let EMOTIONS = ['Calm', 'Focused', 'Anxious', 'Impatient', 'Bored', 'Want to win back losses', 'Overconfident', 'Tired'];
let MAX_LOSSES = 2;
// Model (thêm 2026-11-09): thành phần theo 3 tầng + các model chủ dự án tự tạo
let PDA_HTF = ['BPR', 'OB', 'FVG', 'BB'];
let STRUCT_M15 = ['MSS', 'Trend aligned', 'Sweep'];
let ENTRY_M1 = ['Sweep', 'MSS', 'FVG', 'IFVG', 'CISD', 'OB', 'Displacement'];
let MODELS = []; // [{ id, name, items: [...cũ], recipe?: { dols, pdas, pda_tf, structure, confirmations, entry_tf } }]
let MODELS_TRASH = []; // 14/11: strategy đã xoá nằm trong Trash 30 ngày: [{ ...strategy, deleted_at, trades: [{ id, items, checks }] }]
const utcStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' '); // cùng kiểu deleted_at của server
const trashAge = (at) => (Date.now() - new Date(`${at.replace(' ', 'T')}Z`).getTime()) / 86400000;
let PDA_TFS = ['H4', 'H1'];    // khung giờ của vùng HTF PDA (tự thêm được ở editor model, 11/11)
let ENTRY_TFS = ['M5', 'M1'];  // khung giờ vào lệnh
// Các danh sách chọn theo khoá cài đặt: [lấy, gán]. Dùng để xoá một lựa chọn và hoàn tác (⌘Z) việc xoá (11/11).
const LISTS = {
  dols: [() => DOLS, (a) => { DOLS = a; }], pdas: [() => PDAS, (a) => { PDAS = a; }], confirmations: [() => CONFIRMATIONS, (a) => { CONFIRMATIONS = a; }],
  mistakes: [() => MISTAKES, (a) => { MISTAKES = a; }], emotions: [() => EMOTIONS, (a) => { EMOTIONS = a; }],
  pda_tfs: [() => PDA_TFS, (a) => { PDA_TFS = a; }], entry_tfs: [() => ENTRY_TFS, (a) => { ENTRY_TFS = a; }],
};
async function removeListItem(key, v) {
  const [get, set] = LISTS[key];
  const i = get().indexOf(v);
  if (i < 0) return;
  const next = get().filter((x) => x !== v);
  set(next);
  await api('/api/settings', { method: 'PUT', body: JSON.stringify({ [key]: next }) });
  pushUndo(`Removed ${v} from the list`, [{ kind: 'listitem', key, v, i }]);
}
// Các bước chủ dự án tự đặt (09/11): tên, khung giờ dùng được, thành phần. Lưu ở settings "steps".
// Id htf/m15/m1 giữ từ bản cũ để lệnh đã tick vẫn khớp. Khung giờ đã chọn lưu trong seen dạng "bước:@H1".
let STEPS = [];
let TIERS = []; // [[id, tên, tên]] dựng từ STEPS
const defaultSteps = () => [
  { id: 'htf', name: 'HTF PDA', tfs: [], items: [...PDA_HTF] },
  { id: 'm15', name: 'Structure', tfs: [], items: [...STRUCT_M15] },
  { id: 'm1', name: 'Entry', tfs: [], items: [...ENTRY_M1] },
];
function setSteps(list) { STEPS = list; TIERS = STEPS.map((x) => [x.id, x.name, x.name]); }
const tierList = (k) => STEPS.find((x) => x.id === k)?.items || [];
const stepTfs = (k) => STEPS.find((x) => x.id === k)?.tfs || [];
const isTf = (x) => x.slice(x.indexOf(':') + 1).startsWith('@'); // "htf:@H1" là khung giờ, không phải điều kiện
const tfOf = (seen, k) => ((seen || []).find((x) => x.startsWith(`${k}:@`)) || '').slice(k.length + 2) || null;
const nameOf = (n) => (n.startsWith('@') ? n.slice(1) : n);
const splitItem = (x) => { const i = x.indexOf(':'); return [x.slice(0, i), x.slice(i + 1)]; };
const itemLabel = (x) => { const [k, n] = splitItem(x); return `${n} (${(TIERS.find((T) => T[0] === k) || [, , k])[2]})`; };
// Điểm lệnh = % điều kiện của model đã tick (4/5 = 80%). Không chọn model = không có điểm.
const modelScore = (t) => (t.model_id && t.model_items?.length ? Math.round((t.model_checks.length / t.model_items.length) * 100) : null);
const modelMissing = (t) => (t.model_items || []).filter((x) => !t.model_checks.includes(x));
const scoreTone = (s) => (s == null ? '' : s === 100 ? 'win' : s < 60 ? 'loss' : 'mid');
const scoreBadge = (t) => { const s = modelScore(t); return s == null ? '' : `<span class="score-badge ${scoreTone(s)}" title="Strategy score: ${s}% of the strategy's conditions">${s}%</span>`; };

const app = document.getElementById('app');
let trades = [];
let filters = { setup: '', account: '', mistake: '', outcome: '', plan: '' };
let accounts = [];
let allTrades = []; // mọi lệnh; `trades` là lệnh sau khi lọc theo công tắc tài khoản
let searchText = '';
let period = 'week'; // week | month | all

// ---------- Tiện ích ----------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Ngày giờ theo New York (giờ của thị trường), không theo giờ máy
const NY = 'America/New_York';
// Settings → Time zone: 5 múi giờ ứng với 5 ngôn ngữ (id IANA, tên thành phố, viết tắt). Lưu theo trình duyệt, khoá rj-tz. Lệnh đã lưu không bị đổi ngày.
const TZS = [
  ['America/New_York', 'New York', 'NY'], ['Asia/Ho_Chi_Minh', 'Ho Chi Minh', 'VN'], ['Europe/Madrid', 'Madrid', 'MAD'],
  ['America/Sao_Paulo', 'São Paulo', 'SP'], ['Asia/Jakarta', 'Jakarta', 'JKT'],
];
const tzId = () => {
  let v = null; try { v = localStorage.getItem('rj-tz'); } catch { /* bỏ qua */ }
  if (v === 'local') { // giá trị cũ "My computer": quy về múi giờ máy nếu có trong danh sách, không thì Ho Chi Minh
    try { const z = Intl.DateTimeFormat().resolvedOptions().timeZone; if (TZS.some((t) => t[0] === z)) return z; } catch { /* bỏ qua */ }
    return 'Asia/Ho_Chi_Minh';
  }
  return TZS.some((t) => t[0] === v) ? v : NY;
};
const tzRow = () => TZS.find((t) => t[0] === tzId()) || TZS[0];
const tzCity = () => tzRow()[1];
const tzShort = () => tzRow()[2];
// "(UTC-5)" hoặc "(UTC+5:30)": tính theo ngày hôm nay nên tự đổi theo giờ mùa hè
const tzOffset = (id) => {
  try {
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(new Date().toLocaleString('en-US', { timeZone: id, timeZoneName: 'longOffset' }));
    return m ? `(UTC${m[1]}${+m[2]}${m[3] && m[3] !== '00' ? ':' + m[3] : ''})` : '(UTC)';
  } catch { return '(UTC)'; }
};
const tzOpt = () => ({ timeZone: tzId() });
const todayStr = () => new Date().toLocaleDateString('sv-SE', tzOpt()); // YYYY-MM-DD
const nowTime = () => new Date().toLocaleTimeString('en-GB', { ...tzOpt(), hour: '2-digit', minute: '2-digit', hour12: false });
const cap1 = (str) => str.charAt(0).toUpperCase() + str.slice(1); // "tháng 11 năm 2026" → "Tháng 11 năm 2026"
const MONTHS = window.I18N?.months || ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']; // tên tháng theo ngôn ngữ đã chọn
const fmtDate = (d) => (d ? `${d.slice(8, 10)} ${MONTHS[Number(d.slice(5, 7)) - 1]}` : '');
const imgSrc = (v) => (!v ? '' : v.startsWith('data:') ? v : `/uploads/${encodeURIComponent(v)}`);
const uniq = (key) => [...new Set(trades.map((t) => t[key]).filter(Boolean))].sort();
const sign = (v) => (v > 0 ? '+' : v < 0 ? '−' : '');

// Thắng/thua dựa vào P&L ($); nếu chưa có $ thì dựa vào R
function outcomeOf(t) {
  const v = t.pnl_usd ?? t.result_r;
  if (v == null) return 'open';
  return v > 0 ? 'win' : v < 0 ? 'loss' : 'flat';
}
// Nhập nhanh: 1 dòng = cả ngày, có thể nhiều lệnh. Không biết từng lệnh thắng/thua,
// nên không đưa vào Trade win %, Avg win/loss, Profit factor.
const nTrades = (t) => (t.quick ? (t.trade_count || 1) : 1);
const notQuick = (t) => !t.quick;
const countTrades = (rows) => rows.reduce((acc, t) => acc + nTrades(t), 0);
const fmtUsd = (v) => (v == null ? '' : `${sign(v)}$${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`);
const fmtRv = (v) => (v == null ? '' : `${sign(v)}${Math.abs(v).toFixed(1)}R`);
function fmtResult(t) {
  if (t.pnl_usd == null && t.result_r == null) return 'Open';
  return t.result_r != null ? fmtRv(t.result_r) : fmtUsd(t.pnl_usd);
}

async function api(path, options = {}) {
  const res = await fetch(path, {
    ...options,
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

// ---------- Bộ đếm thua liên tiếp hôm nay ----------
// Đếm số lệnh thua liên tiếp tính từ lệnh gần nhất hôm nay.
// Lệnh thắng hoặc hoà cắt chuỗi; lệnh chưa đóng thì bỏ qua.
function updateStreak() {
  const today = allTrades
    .filter((t) => t.date === todayStr() && outcomeOf(t) !== 'open')
    .sort((a, b) => (a.time || '').localeCompare(b.time || '') || a.id - b.id);
  let streak = 0;
  for (const t of today) streak = outcomeOf(t) === 'loss' ? streak + 1 : 0;
  // Dòng đếm thua dưới thanh trên đã bỏ (chủ dự án, 08/11). Chỉ giữ banner STOP đỏ khi chạm luật.
  const banner = document.getElementById('stop-banner');
  banner.innerHTML = `<strong>STOP.</strong> ${MAX_LOSSES} loss${MAX_LOSSES === 1 ? '' : 'es'} in a row today. Close the charts. Your session is over.`;
  banner.hidden = streak < MAX_LOSSES;
}

async function loadTrades() {
  let settings;
  let ver;
  [allTrades, accounts, settings, notes, ver] = await Promise.all([api('/api/trades'), api('/api/accounts'), api('/api/settings'),
    api('/api/notes').catch(() => ({})), // server cũ chưa có ghi chú thì coi như rỗng
    api('/api/version').catch(() => null)]);
  serverHasTrash = !!ver?.trash;
  isTestCopy = !!ver?.test;
  isDemo = !!ver?.demo;
  showServerBanner();
  applySettings(settings);
  trades = allTrades;
  updateStreak();
  renderScopeSwitch();
  const lastEl = document.getElementById('last-trade');
  if (lastEl) lastEl.textContent =allTrades[0] ? `Last trade: ${fmtDate(allTrades[0].date)}` : 'No trades yet';
}

// ---------- Dashboard ----------
// Ngày thứ Hai của tuần này (tuần tính từ thứ Hai)
function weekStart() {
  const [y, m, d] = todayStr().split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(d - ((dt.getUTCDay() + 6) % 7));
  return dt.toISOString().slice(0, 10);
}
function inPeriod(t) {
  if (period === 'all') return true;
  if (period === 'month') return t.date.slice(0, 7) === todayStr().slice(0, 7);
  return t.date >= weekStart();
}
const byTime = (a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || '') || a.id - b.id;
const pct = (n, d) => (d ? Math.round((n / d) * 100) : null);

// Icon SVG nét mảnh (không dùng emoji)
const ICON = {
  up: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
  down: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 7l6 6 4-4 8 8"/><path d="M14 17h7v-7"/></svg>',
  flat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16"/></svg>',
  dollar: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18"/><path d="M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.6 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3"/></svg>',
  target: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
  trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/></svg>',
  ratio: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19L19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/></svg>',
  list: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/></svg>',
  clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  cross: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/></svg>',
};

// Pill có icon + chữ, để không chỉ dựa vào màu (đúng quy tắc truy cập)
function pill(text, tone, icon) {
  return `<span class="pill ${tone || ''}">${icon ? ICON[icon] : ''}${text}</span>`;
}
function trendPill(v) {
  const tone = v > 0 ? 'win' : v < 0 ? 'loss' : '';
  return `<span class="pill pill-icon ${tone}" aria-hidden="true">${ICON[v > 0 ? 'up' : v < 0 ? 'down' : 'flat']}</span>`;
}

// ---------- Dashboard (bố cục theo ảnh ảnh mẫu chủ dự án gửi 08/11; màu và font theo branding) ----------
let chartUnit = 'usd';  // usd | r
let notes = {};          // ghi chú theo ngày { 'YYYY-MM-DD': '...' }

function smoothPath(pts) {
  // Đường cong mượt kiểu "monotone": đi qua mọi điểm, không vọt quá đỉnh/đáy thật (không vẽ sai số liệu)
  const n = pts.length;
  if (n < 2) return '';
  if (n === 2) return `M${pts[0][0]} ${pts[0][1]} L${pts[1][0]} ${pts[1][1]}`;
  const dx = []; const dy = []; const m = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = pts[i + 1][0] - pts[i][0]; dy[i] = pts[i + 1][1] - pts[i][1]; m[i] = dy[i] / dx[i]; }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i]; const b = t[i + 1] / m[i]; const h = Math.hypot(a, b);
    if (h > 3) { t[i] = (3 * a * m[i]) / h; t[i + 1] = (3 * b * m[i]) / h; }
  }
  let d = `M${pts[0][0].toFixed(2)} ${pts[0][1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const c1 = [pts[i][0] + dx[i] / 3, pts[i][1] + (t[i] * dx[i]) / 3];
    const c2 = [pts[i + 1][0] - dx[i] / 3, pts[i + 1][1] - (t[i + 1] * dx[i]) / 3];
    d += ` C${c1[0].toFixed(2)} ${c1[1].toFixed(2)}, ${c2[0].toFixed(2)} ${c2[1].toFixed(2)}, ${pts[i + 1][0].toFixed(2)} ${pts[i + 1][1].toFixed(2)}`;
  }
  return d;
}

// Mốc chia trục dọc tròn số (VD −50, 0, 50, 100) để nhãn dễ đọc
function niceTicks(lo, hi, count = 4) {
  if (lo === hi) { lo -= 1; hi += 1; }
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.floor(lo / step) * step; ; v += step) {
    ticks.push(Number(v.toFixed(10)));
    if (v >= hi - step * 1e-9) break;
  }
  return ticks;
}

// Biểu đồ có trục số bên trái. mode: cum = đường cộng dồn có nền mờ; daily = cột từng ngày
function axisChart(days, mode, unit) {
  if (!days.length) return '<div class="empty small">No closed trades in this period.</div>';
  const lbl = (d) => d.label ?? fmtDate(d.date); // nhãn trục ngang: ngày, hoặc giờ (Daily Journal)
  const fmt = (v) => (unit === 'usd' ? fmtUsd(Math.round(v)) || '$0' : fmtRv(v) || '0.0R');
  const fmtTick = (v) => `${v < 0 ? '−' : ''}${unit === 'usd' ? '$' : ''}${Math.abs(v).toLocaleString('en-US')}${unit === 'r' ? 'R' : ''}`;
  const vals = days.map((d) => d.value);
  let run = 0;
  const series = mode === 'cum' ? [0, ...vals.map((v) => (run += v))] : vals; // đường cộng dồn bắt đầu từ 0
  const n = series.length;
  const ticks = niceTicks(Math.min(0, ...series), Math.max(0, ...series));
  const min = ticks[0]; const max = ticks[ticks.length - 1]; const span = max - min || 1;
  const X = (i) => (n === 1 ? 50 : mode === 'cum' ? 2 + (i / (n - 1)) * 96 : 6 + (i / (n - 1)) * 88);
  const Y = (v) => 4 + (1 - (v - min) / span) * 92;
  const zeroY = Y(0);
  const last = series[n - 1];
  const color = (mode === 'cum' ? last : 1) >= 0 ? 'var(--accent)' : 'var(--loss)';
  const hgrid = ticks.map((t) => `<line x1="0" x2="100" y1="${Y(t)}" y2="${Y(t)}" class="${t === 0 ? 'zero' : 'hgrid'}"/>`).join('');
  const tickText = ticks.map(fmtTick);
  const yWidth = Math.max(...tickText.map((s) => s.length)) * 7 + 6;
  const yLabels = ticks.map((t, i) => `<span style="top:${Y(t)}%">${tickText[i]}</span>`).join('');
  const labelDays = mode === 'cum' ? [null, ...days] : days;
  const step = Math.max(1, Math.ceil(labelDays.length / 5));
  const labels = labelDays.map((d, i) => (d && (i % step === 0 || i === labelDays.length - 1) ? `<span style="left:${X(i)}%">${lbl(d)}</span>` : '')).join('');
  let body;
  if (mode === 'cum') {
    const line = smoothPath(series.map((v, i) => [X(i), Y(v)]));
    const area = `${line} L${X(n - 1)} ${Y(min)} L${X(0)} ${Y(min)} Z`;
    body = `
      <defs><linearGradient id="cum-fill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${color}" stop-opacity="0.42"/><stop offset="1" stop-color="${color}" stop-opacity="0.02"/>
      </linearGradient></defs>
      <path d="${area}" fill="url(#cum-fill)"/>
      <path d="${line}" class="cum-line" style="stroke:${color}"/>`;
  } else {
    const bw = Math.min(6, 50 / n);
    body = series.map((v, i) => {
      const top = Math.min(Y(v), zeroY); const h = Math.max(0.8, Math.abs(Y(v) - zeroY));
      return `<rect x="${(X(i) - bw / 2).toFixed(2)}" y="${top.toFixed(2)}" width="${bw.toFixed(2)}" height="${h.toFixed(2)}" rx="0.6" class="${v >= 0 ? 'bar-win' : 'bar-loss'}"><title>${lbl(days[i])}: ${fmt(v)}</title></rect>`;
    }).join('');
  }
  const endDot = mode === 'cum' ? `<span class="end-dot" style="left:${X(n - 1)}%;top:${Y(last)}%;border-color:${color}" title="${fmt(last)}"></span>` : '';
  return `<div class="axis-chart">
      <div class="y-labels" style="width:${yWidth}px" aria-hidden="true">${yLabels}</div>
      <div class="plot">
        <div class="chart-area" role="img" aria-label="${mode === 'cum' ? 'Cumulative' : 'Daily'} P&L: ${days.map((d) => `${lbl(d)} ${fmt(d.value)}`).join(', ')}">
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${hgrid}${body}</svg>
          ${endDot}
        </div>
        <div class="x-labels" aria-hidden="true">${labels}</div>
      </div>
    </div>`;
}

// Nửa vòng tròn (gauge) cho thẻ Win %: thắng / hoà / thua
function gauge(parts) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  let off = 0;
  const segs = total ? parts.filter((p) => p.value).map((p) => {
    const len = (p.value / total) * 50;
    const s = `<circle cx="50" cy="50" r="40" pathLength="100" stroke="${p.color}" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${-off}"/>`;
    off += len;
    return s;
  }).join('') : '';
  return `<div class="gauge-box">
    <svg class="gauge" viewBox="0 4 100 52" aria-hidden="true"><g transform="rotate(180 50 50)">
      <circle cx="50" cy="50" r="40" pathLength="100" stroke="var(--line)" stroke-dasharray="50 50"/>${segs}
    </g></svg>
    <div class="gauge-counts">${parts.map((p) => `<span class="${p.tone}" title="${p.value} ${p.label}">${p.value}</span>`).join('')}</div>
  </div>`;
}

// Vòng tròn nhỏ (thẻ Profit factor): $ thắng so với $ thua
function miniRing(win, loss) {
  const total = win + loss;
  const len = total ? (win / total) * 100 : 0;
  return `<svg class="mini-ring" viewBox="0 0 100 100" aria-hidden="true"><g transform="rotate(-90 50 50)">
    <circle cx="50" cy="50" r="38" stroke="${total ? 'var(--loss)' : 'var(--line)'}"/>
    ${len ? `<circle cx="50" cy="50" r="38" pathLength="100" stroke="var(--accent)" stroke-dasharray="${len} ${100 - len}"/>` : ''}
  </g></svg>`;
}

Object.assign(ICON, {
  info: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8v.5"/></svg>',
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h10l4 4v12H5z"/><path d="M9 12h6M9 16h4"/></svg>',
});

// Thẻ của Dashboard: tiêu đề + icon (i) giải thích cách tính
const tile = (title, info, body, cls = '', extra = '') => `
  <section class="tile ${cls}">
    <header class="tile-head"><h3>${title}</h3>${info ? `<button type="button" class="info-tip" data-tip="${esc(info)}" aria-label="What is ${esc(String(title).split('<')[0].replace(/&amp;/g, '&').trim())}?">${ICON.info}</button>` : ''}${extra}</header>
    ${body}
  </section>`;

// ---------- Reset Score: 6 trục giống ảnh ảnh mẫu (chủ dự án chốt 08/11), mỗi trục 0–100 ----------
// Công thức là của Reset Journal (ảnh mẫu không công bố công thức của họ), ghi rõ trong ô (i).
// Tính bằng $ nếu có, không thì bằng R.
function resetScore(list, closed) {
  const cap = (v) => Math.max(0, Math.min(100, v));
  const useUsd = closed.some((t) => t.pnl_usd != null);
  const k = useUsd ? 'pnl_usd' : 'result_r';
  const rows = closed.filter((t) => t[k] != null).sort(byTime);
  const money = (v) => (useUsd ? fmtUsd(Math.round(v)) || '$0' : fmtRv(v) || '0.0R');
  const amt = (v) => money(v).replace(/^\+/, ''); // số tiền không dấu + (mức sụt, tổng thắng)
  const perTrade = closed.filter(notQuick);
  const wins = perTrade.filter((t) => outcomeOf(t) === 'win');
  const losses = perTrade.filter((t) => outcomeOf(t) === 'loss');
  const gw = rows.filter((t) => t[k] > 0).reduce((acc, t) => acc + t[k], 0);
  const gl = -rows.filter((t) => t[k] < 0).reduce((acc, t) => acc + t[k], 0);
  const net = gw - gl;
  const pgw = rows.filter((t) => notQuick(t) && t[k] > 0).reduce((acc, t) => acc + t[k], 0);
  const pgl = -rows.filter((t) => notQuick(t) && t[k] < 0).reduce((acc, t) => acc + t[k], 0);
  const pf = pgl ? pgw / pgl : null;
  const avgW = wins.filter((t) => t[k] != null).map((t) => t[k]);
  const avgL = losses.filter((t) => t[k] != null).map((t) => t[k]);
  const ratio = avgW.length && avgL.length ? (avgW.reduce((x, y) => x + y, 0) / avgW.length) / Math.abs(avgL.reduce((x, y) => x + y, 0) / avgL.length) : null;
  // Sụt giảm lớn nhất: từ đỉnh của đường P&L cộng dồn xuống đáy sau đó
  let cum = 0; let peak = 0; let maxDD = 0;
  rows.forEach((t) => { cum += t[k]; peak = Math.max(peak, cum); maxDD = Math.max(maxDD, peak - cum); });
  // Ổn định: ngày thắng lớn nhất chiếm bao nhiêu phần tổng lời của các ngày thắng (giống luật consistency của quỹ prop)
  const byDay = {};
  rows.forEach((t) => { byDay[t.date] = (byDay[t.date] || 0) + t[k]; });
  const green = Object.values(byDay).filter((v) => v > 0);
  const greenSum = green.reduce((x, y) => x + y, 0);
  const bestShare = green.length ? Math.max(...green) / greenSum : null;
  const axes = [
    { name: 'Win %', v: perTrade.length ? (wins.length / perTrade.length) * 100 : null, raw: `${wins.length} of ${perTrade.length} trades won` },
    { name: 'Profit factor', v: pf != null ? cap((pf / 3) * 100) : pgw > 0 ? 100 : null, raw: pf != null ? `${pf.toFixed(2)} (3.0 or more = 100)` : 'no losing trades' },
    { name: 'Avg win/loss', v: ratio != null ? cap((ratio / 3) * 100) : null, raw: ratio != null ? `${ratio.toFixed(2)} (3.0 or more = 100)` : 'needs a win and a loss' },
    { name: 'Recovery factor', v: !rows.length ? null : net <= 0 ? 0 : maxDD ? cap(((net / maxDD) / 3) * 100) : 100,
      raw: maxDD ? `net ${money(net)} ÷ max drawdown ${amt(maxDD)} = ${(net / maxDD).toFixed(2)} (3.0 or more = 100)` : 'no drawdown yet' },
    { name: 'Max drawdown', v: !rows.length ? null : !maxDD ? 100 : gw ? cap((1 - maxDD / gw) * 100) : 0,
      raw: `largest drop ${amt(maxDD)} vs total won ${amt(gw)} (smaller drop = higher score)` },
    { name: 'Consistency', v: bestShare == null ? null : cap((1 - bestShare) * 100),
      raw: bestShare == null ? 'needs a green day' : `best day = ${Math.round(bestShare * 100)}% of all green-day profit (lower = more consistent)` },
  ];
  const vals = axes.map((x) => x.v).filter((v) => v != null);
  return { axes, score: vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null };
}

const AXIS_TIPS = {
  'Win %': 'Win %: how many of your trades made money. Score = your win %.',
  'Profit factor': 'Profit factor: money won ÷ money lost. Above 1.0 means you make more than you lose. 3.0 or more scores 100.',
  'Avg win/loss': 'Avg win/loss: your average win ÷ your average loss. 3.0 or more scores 100.',
  'Recovery factor': 'Recovery factor: net profit ÷ your biggest drawdown. It shows how well you earn money back after a losing run. 3.0 or more scores 100.',
  'Max drawdown': 'Max drawdown: the biggest drop of your running P&L, from a high point down to a low point. A smaller drop gives a higher score.',
  'Consistency': 'Consistency: how much of your profit came from your single best day. If one day made all the money, the score is low. Many prop firms have a rule like this.',
};
function radarHTML(axes) {
  const n = axes.length;
  const pt = (i, r) => { const a = (-90 + (360 / n) * i) * (Math.PI / 180); return [50 + r * Math.cos(a), 50 + r * Math.sin(a)]; };
  const poly = (r) => axes.map((_, i) => pt(i, r).map((v) => v.toFixed(2)).join(',')).join(' ');
  const rings = [25, 50, 75, 100].map((p) => `<polygon points="${poly(0.46 * p)}" class="ring"/>`).join('');
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, 46); return `<line x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" class="ring"/>`; }).join('');
  const data = axes.map((a, i) => pt(i, 0.46 * (a.v ?? 0)));
  const shape = `<polygon points="${data.map((p) => p.map((v) => v.toFixed(2)).join(',')).join(' ')}" class="shape"/>`;
  const dots = data.map(([x, y]) => `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="1.6" class="dot"/>`).join('');
  // Nhãn trục là HTML (không nằm trong SVG) để chữ sắc nét.
  // Đặt nhãn NGOÀI biểu đồ: bên phải thì chữ chạy sang phải, bên trái thì chữ dồn sang trái,
  // trên/dưới thì canh giữa. Biểu đồ rộng 180px (khớp --rs trong CSS), nhãn cách đỉnh 10px.
  const SIZE = 180; const R = 0.46 * SIZE + 10;
  const labels = axes.map((a, i) => {
    const ang = (-90 + (360 / n) * i) * (Math.PI / 180);
    const c = Math.cos(ang); const sn = Math.sin(ang);
    const side = c > 0.2 ? 'r' : c < -0.2 ? 'l' : sn < 0 ? 't' : 'b';
    return `<span class="side-${side}" style="left:calc(50% + ${(R * c).toFixed(1)}px);top:calc(50% + ${(R * sn).toFixed(1)}px)" data-tip="${esc(`${AXIS_TIPS[a.name] || a.name}\n\nYours: ${a.raw}`)}" tabindex="0" role="button">${a.name}<b>${a.v == null ? '—' : Math.round(a.v)}</b></span>`;
  }).join('');
  return `<div class="radar" role="img" aria-label="${axes.map((a) => `${a.name} ${a.v == null ? 'no data' : Math.round(a.v)}`).join(', ')}">
    <svg viewBox="0 0 100 100" aria-hidden="true">${rings}${spokes}${shape}${dots}</svg>${labels}
  </div>`;
}

// ---------- Plan tracker: mỗi ô là một ngày giao dịch, màu theo "có theo plan không" ----------
function planTrackerHTML() {
  const WEEKS = 12;
  const byDate = {};
  trades.forEach((t) => { (byDate[t.date] ||= []).push(t); });
  const status = (rows) => {
    if (!rows || !rows.length) return 'none';
    if (rows.some((t) => t.followed_plan === 'no')) return 'bad';
    return rows.every((t) => t.followed_plan === 'yes') ? 'ok' : 'unk';
  };
  const label = { none: 'No trades', ok: 'Followed plan', bad: 'Broke plan', unk: 'Plan not answered' };
  const firstMonday = addDays(weekStart(), -7 * (WEEKS - 1));
  const today = todayStr();
  const cols = [];
  for (let w = 0; w < WEEKS; w++) {
    const mon = addDays(firstMonday, 7 * w);
    cols.push({ mon, days: [0, 1, 2, 3, 4].map((i) => addDays(mon, i)) });
  }
  const months = cols.map((c, i) => (i === 0 || c.mon.slice(5, 7) !== cols[i - 1].mon.slice(5, 7) ? MONTHS[Number(c.mon.slice(5, 7)) - 1] : '')).map((m) => `<span>${m}</span>`).join('');
  const rows = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map((dn, r) => `
    <span class="pt-day">${dn}</span>
    ${cols.map((c) => {
      const key = c.days[r];
      const st = key > today ? 'future' : status(byDate[key]);
      return st === 'future' ? '<span class="pt-cell future"></span>'
        : `<button type="button" class="pt-cell ${st}" data-goto="${key}" title="${fmtDate(key)}: ${label[st]}" aria-label="${fmtDate(key)}: ${label[st]}"></button>`;
    }).join('')}`).join('');
  // Tuần này: bao nhiêu ngày giao dịch theo đúng plan
  const thisWeek = cols[cols.length - 1].days.filter((d) => d <= today).map((d) => status(byDate[d])).filter((s) => s !== 'none');
  const okDays = thisWeek.filter((s) => s === 'ok').length;
  return `
    <div class="pt" style="--weeks:${WEEKS}">
      <span></span>${months}
      ${rows}
    </div>
    <ul class="pt-legend">
      <li><span class="pt-cell ok"></span>Followed plan</li>
      <li><span class="pt-cell bad"></span>Broke plan</li>
      <li><span class="pt-cell unk"></span>Not answered</li>
    </ul>
    <div class="pt-foot">
      <div>
        <small>This week</small>
        <b>${okDays}/${thisWeek.length}</b> <span class="muted">days on plan</span>
        <div class="bar"><span style="width:${thisWeek.length ? (okDays / thisWeek.length) * 100 : 0}%"></span></div>
      </div>
    </div>`;
}

// ---------- Account balance: số dư = số dư ban đầu + tổng P&L của tài khoản ----------
function balanceHTML() {
  const inScope = accounts.filter((a) => (scope === 'all' ? true
    : scope === 'real' ? a.type === 'personal'
      : scope === 'demo' ? a.type === 'demo'
      : scope === 'prop' ? isProp(a) : `acc:${a.id}` === scope));
  const withStart = inScope.filter((a) => a.starting_balance != null);
  if (!withStart.length) {
    return `<div class="tile-empty">
      <p>${accounts.length ? 'Add a starting balance to an account to see it here.' : 'No accounts yet.'}</p>
      <a class="btn btn-soft" href="#/accounts">${accounts.length ? 'Open Accounts' : 'Add an account'}</a>
    </div>`;
  }
  const rows = withStart.map((a) => {
    const pnl = allTrades.filter((t) => t.account_id === a.id && t.pnl_usd != null).reduce((s, t) => s + t.pnl_usd, 0);
    return { a, pnl, bal: a.starting_balance + pnl };
  });
  const total = rows.reduce((s, r) => s + r.bal, 0);
  const money = (v) => `$${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  return `<div class="bal-total">${money(total)}</div>
    <ul class="bal-list">${rows.map((r) => `<li><span>${esc(r.a.name)}<small>${ACC_TYPES[r.a.type]}</small></span>
      <span class="num"><b>${money(r.bal)}</b><small class="${r.pnl > 0 ? 'win' : r.pnl < 0 ? 'loss' : ''}">${fmtUsd(r.pnl) || '$0'}</small></span></li>`).join('')}</ul>`;
}

// ---------- Nhập nhanh trên lịch: lười thêm lệnh thì chỉ gõ số tiền hoặc R của ngày ----------
// Tạo một "lệnh nhanh" (quick = 1) chỉ có ngày + kết quả. Nó được tính như 1 lệnh trong số liệu.
function quickAddHTML(day) {
  return `<form class="quick-add" data-quick="${day}" autocomplete="off">
    <span class="qa-label">Quick result</span>
    <label class="qa-field"><input name="n" type="number" min="1" step="1" inputmode="numeric" placeholder="1" aria-label="Number of trades" style="width:64px"><span>trades</span></label>
    <label class="qa-field"><span>$</span><input name="usd" type="number" step="0.01" inputmode="decimal" placeholder="120 or -80" aria-label="Result in dollars"></label>
    <span class="muted">and/or</span>
    <label class="qa-field"><input name="r" type="number" step="0.01" inputmode="decimal" placeholder="1.5 or -1" aria-label="Result in R"><span>R</span></label>
    <button class="btn btn-primary btn-sm" type="submit">Add</button>
    <span class="saved error" role="status"></span>
  </form>`;
}
function bindQuickAdd() {
  app.querySelectorAll('form[data-quick]').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const day = f.dataset.quick;
    const usd = f.usd.value.trim(); const r = f.r.value.trim(); const n = f.n.value.trim();
    const msg = f.querySelector('.saved');
    if (!usd && !r) { msg.textContent = 'Type a $ amount or an R result.'; f.usd.focus(); return; }
    f.querySelector('button').disabled = true;
    try {
      await api('/api/trades', { method: 'POST', body: JSON.stringify({ date: day, quick: 1, trade_count: n, pnl_usd: usd, result_r: r, account_id: scopeAccountId() }) });
      await route();
      toast(`Added ${[usd ? fmtUsd(Number(usd)) || '$0' : '', r ? fmtRv(Number(r)) || '0R' : ''].filter(Boolean).join(' · ')} on ${fmtDate(day)}`);
    } catch (ex) {
      msg.textContent = ex.message; f.querySelector('button').disabled = false;
    }
  }));
}

// Tải lại dữ liệu nhưng giữ nguyên chỗ đang cuộn (để không bị nhảy lên đầu trang sau khi gõ số)
async function refreshKeepScroll() { await route(); } // route() tự giữ chỗ cuộn khi ở cùng trang

// Đọc một ô số: bỏ $, dấu phẩy, chữ R; ô trống = null
function cellNum(text) {
  const v = String(text).trim().replace(/[\s,$]/g, '').replace('−', '-').replace(/r$/i, '');
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}
function bindCalInput() {
  const cell = app.querySelector('.cal-day.editing');
  if (!cell) return;
  const day = cell.dataset.editDay;
  const quickId = Number(cell.dataset.quickId) || null;
  const usdIn = cell.querySelector('input[name=usd]');
  const rIn = cell.querySelector('input[name=r]');
  const start = `${usdIn.value}|${rIn.value}`;
  let busy = false;
  const stop = () => { calEditing = null; renderDashboard(); };
  const save = async () => {
    if (busy) return;
    busy = true;
    if (`${usdIn.value}|${rIn.value}` === start) { stop(); return; }
    const usd = cellNum(usdIn.value); const r = cellNum(rIn.value);
    const bad = Number.isNaN(usd) ? usdIn : Number.isNaN(r) ? rIn : null;
    if (bad) { busy = false; bad.setCustomValidity('Type a number, like 120 or -80'); bad.reportValidity(); return; }
    try {
      if (usd === null && r === null) {
        if (quickId) {
          await api(`/api/trades/${quickId}`, { method: 'DELETE' });
          calEditing = null; await refreshKeepScroll();
          pushUndo(`Deleted quick entry (${fmtDate(day)})`, [{ kind: 'trade', id: quickId }]);
        } else stop();
        return;
      }
      const keepAcc = quickId ? (trades.find((x) => x.id === quickId)?.account_id ?? '') : scopeAccountId();
      const body = JSON.stringify({ date: day, quick: 1, pnl_usd: usd ?? '', result_r: r ?? '', account_id: keepAcc });
      if (quickId) await api(`/api/trades/${quickId}`, { method: 'PUT', body });
      else await api('/api/trades', { method: 'POST', body });
      calEditing = null; await refreshKeepScroll();
      toast(`${quickId ? 'Updated' : 'Added'} ${[usd !== null ? fmtUsd(usd) || '$0' : '', r !== null ? fmtRv(r) || '0R' : ''].filter(Boolean).join(' · ')} on ${fmtDate(day)}`);
    } catch (ex) {
      busy = false; toast(ex.message);
    }
  };
  [usdIn, rIn].forEach((inp) => {
    inp.addEventListener('input', () => inp.setCustomValidity(''));
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); save(); }
      if (e.key === 'Escape') { e.preventDefault(); busy = true; stop(); }
    });
  });
  // Bấm ra ngoài ô (không phải chuyển giữa 2 ô $ và R) thì lưu
  cell.addEventListener('focusout', (e) => { if (!busy && !cell.contains(e.relatedTarget)) save(); });
}

// ---------- Khung ngày giữa màn hình (bấm ô lịch) ----------
// Gồm: kết quả ngày (Trades / $ / R), danh sách lệnh (Edit), ghi chú ngày, + Add trade, Delete…
function closeDayModal() { document.querySelector('dialog.day-modal')?.close(); }
function openDayModal(day) {
  closeDayModal();
  const rows = trades.filter((t) => t.date === day).sort(byTime);
  const quick = rows.filter((t) => t.quick);
  const q = quick.length === 1 ? quick[0] : null; // 1 kết quả nhập nhanh thì sửa luôn nó
  const st = dayStats(rows);
  // Ngày đã có lệnh đầy đủ: 3 ô chỉ hiện tổng (khoá), không cho cộng chồng kết quả nhanh
  // Đúng 1 lệnh đầy đủ và không có kết quả nhanh: sửa $ / RR ngay tại đây (không cần Edit). Nhiều lệnh thì khoá (không biết sửa lệnh nào).
  const solo = rows.length === 1 && !rows[0].quick ? rows[0] : null;
  const locked = rows.some(notQuick) && !solo;
  const ro = locked ? ' readonly tabindex="-1"' : '';
  const roN = (locked || solo) ? ' readonly tabindex="-1"' : '';
  const long = new Date(`${day}T12:00:00Z`).toLocaleDateString((window.I18N?.locale || 'en-US'), { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  const summary = [st.n ? `${st.n} trade${st.n === 1 ? '' : 's'}` : 'No trades', st.usd != null ? fmtUsd(st.usd) || '$0' : '', st.r != null ? fmtRv(st.r) : ''].filter(Boolean).join(' · ');
  const dlg = document.createElement('dialog');
  dlg.className = 'day-modal';
  dlg.setAttribute('aria-label', long);
  dlg.innerHTML = `
    <header class="dm-head">
      <div><h2>${long}</h2><p class="hint">${esc(summary)}</p></div>
      <button type="button" class="dm-x" data-dm-close aria-label="Close">${ICON.cross}</button>
    </header>
    <form class="dm-quick${locked ? ' locked' : ''}" autocomplete="off">
      <div class="dm-label"><b>Day result</b><span class="hint">${locked ? 'Calculated from your trades. Edit a trade below to change it.' : solo ? 'Change this trade\'s result here. Press Edit below for anything else.' : q ? 'Edit the result you typed for this day.' : 'No time to log each trade? Type the day total.'}</span></div>
      <div class="dm-fields">
        <label>Trades<input name="n" inputmode="numeric" value="${locked || solo ? st.n : q?.trade_count ?? ''}" placeholder="optional"${roN}></label>
        <label>$ P&amp;L<input name="usd" inputmode="decimal" value="${locked || solo ? (st.usd != null ? +st.usd.toFixed(2) : '') : q?.pnl_usd ?? ''}" placeholder="e.g. $120"${ro}></label>
        <label>RR<input name="r" inputmode="decimal" value="${locked || solo ? (st.r != null ? +st.r.toFixed(2) : '') : q?.result_r ?? ''}" placeholder="optional"${ro}></label>
        ${locked ? '' : '<button type="submit" class="btn btn-primary">Save</button>'}
      </div>
      ${solo ? '<p class="hint dm-tip">Change $ P&amp;L and RR is recalculated from your risk · Change only RR to override it · Enter to save</p>' : locked ? '' : `<p class="hint dm-tip">Only the $ amount is needed. A losing day? Add a minus: -$80 · RR = risk-to-reward, e.g. 1.5 = you made 1.5× your risk · Enter to save${q ? ' · Clear all boxes and save to remove it' : ''}</p>`}
      <p class="saved error" role="status"></p>
    </form>
    ${rows.filter(notQuick).length ? `<section class="dm-sec"><h3>Trades</h3>${dayTradesHTML(rows.filter(notQuick))}</section>` : ''}
    ${quick.length > 1 ? `<section class="dm-sec"><h3>Day results</h3>${dayTradesHTML(quick)}</section>` : ''}
    <section class="dm-sec">
      <label class="dm-note-label" for="dm-note">Day note</label>
      <textarea id="dm-note" rows="3" maxlength="2000" placeholder="How did the day go? Market, mood, why you sat out…">${esc(notes[day] || '')}</textarea>
      <div class="list-actions"><button type="button" class="btn btn-sm" data-dm-note>Save note</button><span class="saved ok" role="status" id="dm-note-msg"></span></div>
    </section>
    <footer class="dm-foot">
      <a class="btn btn-soft" href="#/new?date=${day}">+ Add full trade</a>
      ${rows.length || notes[day] ? '<button type="button" class="btn btn-soft btn-danger" data-dm-delete>Delete…</button>' : ''}
      <button type="button" class="btn" data-dm-close>Close</button>
    </footer>`;
  document.body.append(dlg);
  let changed = false;
  const y0 = window.scrollY; // đóng khung xong trả trang về đúng chỗ cũ, không nhảy
  dlg.addEventListener('close', async () => {
    dlg.remove();
    if (changed && (location.hash || '#/') === '#/') await refreshKeepScroll();
    if ((location.hash || '#/') === '#/') window.scrollTo(0, y0);
  });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }); // bấm ra nền mờ thì đóng
  dlg.querySelectorAll('[data-dm-close]').forEach((b) => b.addEventListener('click', () => dlg.close()));
  dlg.querySelectorAll('a[href^="#/"]').forEach((a) => a.addEventListener('click', () => dlg.close()));

  // Lưu kết quả ngày
  const f = dlg.querySelector('.dm-quick');
  const msg = f.querySelector('.saved');
  f.addEventListener('input', () => { msg.textContent = ''; });
  let saving = false; // chặn Enter 2 lần lưu 2 kết quả
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (locked || saving) return;
    saving = true;
    try { await (solo ? saveSolo() : saveQuick()); } finally { saving = false; }
  });
  // Sửa kết quả của lệnh duy nhất trong ngày (không cần mở Edit). Hoàn tác được bằng ⌘Z.
  async function saveSolo() {
    const usd = cellNum(f.usd.value); const r = cellNum(f.r.value);
    if ([usd, r].some((v) => Number.isNaN(v))) { msg.textContent = 'Use numbers only, like 120, -80 or 1.5.'; return; }
    if (usd === null && r === null) { msg.textContent = 'A trade needs a $ amount or an RR. Type one of them.'; return; }
    const shown = (v) => (v == null ? null : +v.toFixed(2));
    const usdChanged = usd !== shown(solo.pnl_usd); const rChanged = r !== shown(solo.result_r);
    if (!usdChanged && !rChanged) { msg.textContent = 'Nothing changed.'; return; }
    const body = {};
    if (usdChanged) body.pnl_usd = usd ?? '';
    if (rChanged) body.result_r = r ?? '';
    // Chỉ sửa RR mà lệch xa so với $ ÷ Risk: hỏi lại cho chắc
    const pnlNow = usdChanged ? usd : solo.pnl_usd;
    if (rChanged && !usdChanged && r !== null && solo.risk_usd > 0 && pnlNow != null) {
      const implied = pnlNow / solo.risk_usd;
      if (Math.abs(r - implied) > 0.2) {
        const ok = await askDialog({ title: 'RR does not match P&L', body: `Risk is $${solo.risk_usd} and P&L is ${fmtUsd(pnlNow) || '$0'}, which is ${fmtRv(Math.round(implied * 100) / 100) || '0R'}. Change RR to ${fmtRv(r) || '0R'} anyway?`, actions: [{ value: 'ok', label: 'Change RR only' }] });
        if (ok !== 'ok') return;
      }
    }
    try {
      await api(`/api/trades/${solo.id}/result`, { method: 'PUT', body: JSON.stringify(body) });
      changed = true; dlg.close();
      pushUndo(`Updated result (${fmtDate(day)})`, [{ kind: 'result', id: solo.id, pnl: solo.pnl_usd ?? null, r: solo.result_r ?? null }]);
    } catch (ex) { msg.textContent = ex.message; }
  }
  async function saveQuick() {
    const n = cellNum(f.n.value); const usd = cellNum(f.usd.value); const r = cellNum(f.r.value);
    if ([n, usd, r].some((v) => Number.isNaN(v))) { msg.textContent = 'Use numbers only, like 3, 120, -80 or 1.5.'; return; }
    if (n !== null && !(Number.isInteger(n) && n >= 1)) { msg.textContent = 'Trades must be a whole number, like 1, 2 or 3.'; return; }
    try {
      if (usd === null && r === null) {
        if (q) {
          await api(`/api/trades/${q.id}`, { method: 'DELETE' });
          changed = true; dlg.close();
          pushUndo(`Deleted day result (${fmtDate(day)})`, [{ kind: 'trade', id: q.id }]);
        } else msg.textContent = 'Type a $ amount or an R result.';
        return;
      }
      const body = JSON.stringify({ date: day, quick: 1, trade_count: n ?? '', pnl_usd: usd ?? '', result_r: r ?? '', account_id: q ? (q.account_id ?? '') : scopeAccountId() });
      if (q) await api(`/api/trades/${q.id}`, { method: 'PUT', body });
      else await api('/api/trades', { method: 'POST', body });
      changed = true; dlg.close();
      toast(`${q ? 'Updated' : 'Saved'} ${fmtDate(day)}: ${[n ? `${n} trade${n === 1 ? '' : 's'}` : '', usd !== null ? fmtUsd(usd) || '$0' : '', r !== null ? fmtRv(r) || '0R' : ''].filter(Boolean).join(' · ')}`);
    } catch (ex) { msg.textContent = ex.message; }
  }

  // Ghi chú ngày (khung vẫn mở)
  dlg.querySelector('[data-dm-note]').addEventListener('click', async () => {
    const text = dlg.querySelector('#dm-note').value.trim();
    const m = dlg.querySelector('#dm-note-msg');
    try {
      await api(`/api/notes/${day}`, { method: 'PUT', body: JSON.stringify({ note: text }) });
      if (text) notes[day] = text;
      else if (notes[day]) { delete notes[day]; pushUndo(`Deleted day note (${fmtDate(day)})`, [{ kind: 'day_note', id: day }]); }
      changed = true; m.textContent = text ? 'Saved' : 'Note removed'; m.className = 'saved ok';
    } catch (ex) { m.textContent = ex.message; m.className = 'saved error'; }
  });
  dlg.querySelector('[data-dm-delete]')?.addEventListener('click', () => { dlg.close(); deleteDay(day); });

  dlg.showModal();
  if (locked) dlg.querySelector('.dm-x').focus(); else f.n.focus();
}

// ---------- Khung ngày dưới lịch: lệnh của ngày (sửa được) + ghi chú ngày ----------
let noteMsg = '';
function dayPanelHTML(day, rows) {
  const st = dayStats(rows);
  const long = new Date(`${day}T12:00:00Z`).toLocaleDateString((window.I18N?.locale || 'en-US'), { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
  const summary = [st.n ? `${st.n} trade${st.n === 1 ? '' : 's'}` : 'No trades', st.usd != null ? fmtUsd(st.usd) || '$0' : '', st.r != null ? fmtRv(st.r) : ''].filter(Boolean).join(' · ');
  return `
    <div class="day-panel" id="day-panel">
      <div class="day-panel-head">
        <div><h3>${long}</h3><p class="hint">${summary}</p></div>
        <div class="day-actions">
          <a class="btn btn-primary" href="#/new?date=${day}">+ Add trade</a>
          <button type="button" class="btn btn-soft btn-danger" data-delete-day title="Or press ${DEL_HINT}">Delete…</button>
          <button type="button" class="btn btn-soft" data-close-day>Close</button>
        </div>
      </div>
      <div class="day-cols">
        <div>
          ${rows.length ? dayTradesHTML(rows)
            : '<p class="hint">No trades on this day. Use “+ Add trade” to log one for this date.</p>'}
        </div>
        <div class="day-note">
          <label for="day-note">Day note</label>
          <textarea id="day-note" rows="4" maxlength="2000" placeholder="How did the day go? Market, mood, why you sat out…">${esc(notes[day] || '')}</textarea>
          <div class="list-actions">
            <button type="button" class="btn" id="save-note">Save note</button>
            <span class="saved ${noteMsg.startsWith('Not saved') ? 'error' : 'ok'}" id="note-msg" role="status">${esc(noteMsg)}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function renderDashboard() {
  const list = trades.filter(inPeriod).sort(byTime);
  const closed = list.filter((t) => outcomeOf(t) !== 'open');
  const perTrade = closed.filter(notQuick); // lệnh có kết quả từng lệnh (không gồm nhập nhanh)
  const wins = perTrade.filter((t) => outcomeOf(t) === 'win');
  const losses = perTrade.filter((t) => outcomeOf(t) === 'loss');
  const flats = perTrade.filter((t) => outcomeOf(t) === 'flat');
  const hasQuick = closed.some((t) => t.quick);
  const quickNote = hasQuick ? ' Quick entries (day totals) are not included.' : '';
  const withR = closed.filter((t) => t.result_r != null);
  const withUsd = closed.filter((t) => t.pnl_usd != null);
  const sum = (rows, k) => rows.reduce((s, t) => s + (t[k] || 0), 0);
  const avg = (rows, k) => { const r = rows.filter((t) => t[k] != null); return r.length ? sum(r, k) / r.length : null; };
  const tone = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : '');

  // Đơn vị: $ nếu có dữ liệu $, không thì R
  const unit = chartUnit === 'usd' && withUsd.length ? 'usd' : 'r';
  const k = unit === 'usd' ? 'pnl_usd' : 'result_r';
  const rowsU = unit === 'usd' ? withUsd : withR;
  const fmtU = (v) => (v == null ? '—' : unit === 'usd' ? fmtUsd(Math.round(v)) || '$0' : fmtRv(v) || '0.0R');
  const net = sum(rowsU, k);

  // Profit factor = tổng thắng ÷ tổng thua (theo đơn vị đang xem)
  const grossWin = sum(rowsU.filter((t) => notQuick(t) && t[k] > 0), k);
  const grossLoss = -sum(rowsU.filter((t) => notQuick(t) && t[k] < 0), k);
  const pf = grossLoss ? grossWin / grossLoss : null;
  const avgWin = avg(wins, k); const avgLoss = avg(losses, k);
  const ratio = avgWin != null && avgLoss ? avgWin / Math.abs(avgLoss) : null;

  // Theo ngày: cộng $ và R của từng ngày
  const byDay = {};
  closed.forEach((t) => { (byDay[t.date] ||= []).push(t); });
  const dayNet = Object.entries(byDay).map(([date, rows]) => {
    const u = rows.filter((t) => t.pnl_usd != null);
    const rr = rows.filter((t) => t.result_r != null);
    return { date, usd: u.length ? sum(u, 'pnl_usd') : null, r: rr.length ? sum(rr, 'result_r') : null };
  }).sort((a, b) => a.date.localeCompare(b.date));
  const dayVal = (d) => d.usd ?? d.r;
  const dayWins = dayNet.filter((d) => dayVal(d) > 0).length;
  const dayLosses = dayNet.filter((d) => dayVal(d) < 0).length;
  const chartDays = dayNet.filter((d) => (unit === 'usd' ? d.usd : d.r) != null).map((d) => ({ date: d.date, value: unit === 'usd' ? d.usd : d.r }));
  const leftOut = closed.some((t) => t[k] == null) ? `<p class="hint small-hint">Trades with no ${unit === 'usd' ? '$' : 'R'} result are left out${unit === 'usd' ? '. Switch to R to see them' : ''}.</p>` : '';

  const rs = resetScore(list, closed);
  const periodName = { week: 'this week', month: 'this month', all: 'all time' }[period];

  if (!calMonth) calMonth = todayStr().slice(0, 7);
  const b = buildMonth(calMonth);
  const shownDays = b.weeks.flatMap((w) => w.days.map((d) => d.key));
  const showPanel = calSelected && shownDays.includes(calSelected);
  const recent = [...trades].sort((a, z) => byTime(z, a)).slice(0, 7);

  app.innerHTML = `
    <div class="dash-top">
      <div>
        <h1>Dashboard</h1>
        <p class="hint">Last trade: <b>${trades[0] ? fmtDate(trades[0].date) : '—'}</b> · ${esc(scopeLabel())}</p>
      </div>
      <div class="dash-controls">
        <div class="segmented" role="group" aria-label="Period">
          ${[['week', 'Week'], ['month', 'Month'], ['all', 'All']].map(([v, l]) => `<button type="button" data-period="${v}" class="${period === v ? 'on' : ''}" aria-pressed="${period === v}">${l}</button>`).join('')}
        </div>
        <div class="toggle small" role="group" aria-label="Unit">
          <button type="button" data-unit="usd" class="${unit === 'usd' ? 'on' : ''}" ${withUsd.length ? '' : 'disabled'}>$</button>
          <button type="button" data-unit="r" class="${unit === 'r' ? 'on' : ''}">R</button>
        </div>
      </div>
    </div>


    <div class="kpi-row">
      ${tile(`Net P&amp;L <span class="count" title="Closed trades">${countTrades(closed)}</span>`, `Net P&L = everything you made minus everything you lost (${periodName}).\nExample: +$334, +$60 and −$154 → +$240.\nThe small number next to the title is how many trades.`, `
        <div class="kpi-body"><div class="big ${tone(net)}">${rowsU.length ? fmtU(net) : '—'}</div></div>
        <div class="kpi-sub">${unit === 'usd' && withR.length ? fmtRv(sum(withR, 'result_r')) : unit === 'r' && withUsd.length ? fmtUsd(sum(withUsd, 'pnl_usd')) : '&nbsp;'}</div>`)}
      ${tile('Trade win %', `How many of your trades made money.\nExample: 3 wins out of 4 trades = 75%.\nUnder the gauge: wins · breakeven · losses.\nA high win % alone does not mean you make money. Check Avg win/loss too.${quickNote}`, `
        <div class="kpi-body"><div class="big">${perTrade.length ? `${pct(wins.length, perTrade.length)}%` : '—'}</div>
        ${gauge([{ label: 'winning trades', value: wins.length, color: 'var(--accent)', tone: 'win' }, { label: 'breakeven trades', value: flats.length, color: 'var(--muted)', tone: '' }, { label: 'losing trades', value: losses.length, color: 'var(--loss)', tone: 'loss' }])}</div>`)}
      ${tile('Profit factor', `Total money won ÷ total money lost.\nExample: $394 won, $154 lost → 2.56. For every $1 you lose, you make $2.56.\nBelow 1.0 = losing money. Above 1.0 = making money.\nNeeds 20–30 trades before you can trust it.${quickNote}`, `
        <div class="kpi-body"><div class="big">${pf != null ? pf.toFixed(2) : grossWin > 0 ? '∞' : '—'}</div>${miniRing(grossWin, grossLoss)}</div>`)}
      ${tile('Day win %', 'How many of your trading days ended in profit. It counts days, not trades.\nExample: 3 green days out of 4 = 75%.\nUnder the gauge: green · flat · red days.', `
        <div class="kpi-body"><div class="big">${dayNet.length ? `${pct(dayWins, dayNet.length)}%` : '—'}</div>
        ${gauge([{ label: 'green days', value: dayWins, color: 'var(--accent)', tone: 'win' }, { label: 'flat days', value: dayNet.length - dayWins - dayLosses, color: 'var(--muted)', tone: '' }, { label: 'red days', value: dayLosses, color: 'var(--loss)', tone: 'loss' }])}</div>`)}
      ${tile('Avg win/loss trade', `Your average winning trade ÷ your average losing trade.\nExample: average win $197, average loss $154 → 1.28. Your wins are 1.28× the size of your losses.\nBelow 1.0 = your losses are bigger than your wins, so you need a high win % to make money.${quickNote}`, `
        <div class="kpi-body wl">
          <div class="big">${ratio != null ? ratio.toFixed(2) : '—'}</div>
          <div class="wl-bar">
            <div class="bar2"><span class="w" style="flex:${avgWin ?? 0}"></span><span class="l" style="flex:${Math.abs(avgLoss ?? 0)}"></span></div>
            <div class="wl-nums"><span class="win">${avgWin != null ? fmtU(avgWin) : '—'}</span><span class="loss">${avgLoss != null ? fmtU(avgLoss) : '—'}</span></div>
          </div>
        </div>`)}
    </div>

    <div class="tile-grid">
      ${tile('Score', 'One score from 0 to 100, made from 6 numbers.\nHover or tap each label on the chart to see what it means and your own number.\nIt sums up your results. It is not a grade of you as a trader, and it needs 20+ trades to mean much.', `
        ${rs.score == null ? '<div class="tile-empty"><p>No trades in this period.</p></div>' : `
        ${radarHTML(rs.axes)}
        <div class="score-foot">
          <div><small>Your Score</small><b>${Math.round(rs.score)}</b></div>
          <div class="score-scale">
            <div class="bar"><span style="width:${rs.score}%"></span></div>
            <div class="scale-nums"><span>0</span><span>20</span><span>40</span><span>60</span><span>80</span><span>100</span></div>
          </div>
        </div>
        <p class="hint small-hint">Based on ${countTrades(closed)} trade${countTrades(closed) === 1 ? '' : 's'}${countTrades(closed) < MIN_RELIABLE ? ' (not reliable yet)' : ''}</p>`}`, 'score-tile')}
      ${tile('Plan tracker', 'Each square is one day in the last 12 weeks.\nGreen: every trade followed your plan.\nRed: at least one trade broke your plan.\nGrey: plan not answered (or a quick day result).\nClick a square to open that day.', planTrackerHTML(), 'pt-tile')}
      ${tile('Daily net cumulative P&amp;L', `Your running total, day by day (${periodName}). Each point adds that day to all the days before it.\nLine going up = your account is growing.`, `${axisChart(chartDays, 'cum', unit)}${leftOut}`)}
      ${tile('Net daily P&amp;L', `The result of each single day (${periodName}).\nGreen bar = profitable day. Red bar = losing day.`, `${axisChart(chartDays, 'daily', unit)}${leftOut}`)}
      ${tile('Recent trades', '', recent.length ? `
        <div class="table-wrap flat"><table class="table compact">
          <thead><tr><th>Date</th><th>Symbol</th><th class="num">Net P&amp;L</th></tr></thead>
          <tbody>${recent.map((t) => `<tr data-id="${t.id}" data-ctx-trade="${t.id}">
            <td>${fmtDate(t.date)}</td>
            <td><a href="#/trade/${t.id}">${t.quick ? 'Quick entry' : esc(t.symbol || '—')}</a>${t.followed_plan === 'no' ? ` <span class="status-dot bad" title="Broke plan">${ICON.cross}</span>` : ''}</td>
            <td class="num ${outcomeOf(t)}">${t.pnl_usd != null ? fmtUsd(t.pnl_usd) : fmtResult(t)}</td>
          </tr>`).join('')}</tbody>
        </table></div>` : '<div class="tile-empty"><p>No trades yet.</p><a class="btn btn-soft" href="#/new">+ New trade</a></div>', '', '<a class="link tile-link" href="#/trades">View all</a>')}
      ${tile('Account balance', 'Account balance = starting balance + the $ result of every trade in that account.\nSet the starting balance in Accounts (top bar → Manage accounts).', balanceHTML())}
      ${tile('Strategy Performance', `Win % of each of your strategies (${periodName}): trades that made money ÷ all closed trades of that strategy.\nExample: Strategy 1 won 6 of 10 trades → 60%.\nQuick entries (day totals) are not counted. Click a row for the full table.`, modelPerfHTML(list), 'mp-tile', '<a class="link tile-link" href="#/strategies">Strategies</a>')}
    </div>

    <section class="tile cal-tile" id="cal-section">
      ${calHeadHTML()}
      ${calView === 'year' ? calYearHTML(calMonth.slice(0, 4)) : calGridHTML(b)}
    </section>
  `;
  noteMsg = '';

  app.querySelectorAll('[data-period]').forEach((btn) => btn.addEventListener('click', () => { period = btn.dataset.period; renderDashboard(); }));
  app.querySelectorAll('[data-unit]').forEach((btn) => btn.addEventListener('click', () => { chartUnit = btn.dataset.unit; renderDashboard(); }));
  app.querySelectorAll('[data-shift]').forEach((btn) => btn.addEventListener('click', () => {
    const n = Number(btn.dataset.shift);
    if (n === 0) calMonth = todayStr().slice(0, 7);
    else { const [yy, mm] = calMonth.split('-').map(Number); calMonth = iso(new Date(Date.UTC(yy, mm - 1 + n, 1))).slice(0, 7); }
    calSelected = null; calEditing = null;
    renderDashboard();
  }));
  // Nhảy năm (giữ tháng), đổi Month / Year, bấm 1 ô tháng ở chế độ Year thì về lịch tháng đó
  app.querySelectorAll('[data-shift-year]').forEach((btn) => btn.addEventListener('click', () => {
    const [yy, mm] = calMonth.split('-').map(Number); calMonth = `${yy + Number(btn.dataset.shiftYear)}-${String(mm).padStart(2, '0')}`;
    calSelected = null; calEditing = null; renderDashboard();
  }));
  app.querySelectorAll('[data-cal-view]').forEach((btn) => btn.addEventListener('click', () => { calView = btn.dataset.calView; calSelected = null; calEditing = null; renderDashboard(); }));
  app.querySelectorAll('[data-cal-month]').forEach((btn) => btn.addEventListener('click', () => { calMonth = btn.dataset.calMonth; calView = 'month'; calSelected = null; calEditing = null; renderDashboard(); }));
  const openDay = (day) => {
    calSelected = day;
    if (!shownDays.includes(day)) calMonth = day.slice(0, 7);
    app.querySelectorAll('.cal-day.selected').forEach((c) => c.classList.remove('selected'));
    app.querySelector(`.cal-day[data-day="${day}"]`)?.classList.add('selected');
    openDayModal(day);
  };
  app.querySelectorAll('.cal-day[data-day]').forEach((d) => d.addEventListener('click', () => openDay(d.dataset.day)));
  app.querySelectorAll('[data-goto]').forEach((c) => c.addEventListener('click', () => { calSelected = null; calMonth = c.dataset.goto.slice(0, 7); openDay(c.dataset.goto); document.getElementById('cal-section').scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
  app.querySelector('[data-close-day]')?.addEventListener('click', () => { calSelected = null; calEditing = null; renderDashboard(); });
  bindCalInput();
  bindQuickAdd();
  app.querySelector('[data-delete-day]')?.addEventListener('click', () => deleteDay(calSelected));
  app.querySelector('#save-note')?.addEventListener('click', async (e) => {
    const day = calSelected;
    const text = document.getElementById('day-note').value.trim();
    e.target.disabled = true;
    try {
      await api(`/api/notes/${day}`, { method: 'PUT', body: JSON.stringify({ note: text }) });
      if (text) notes[day] = text; else if (notes[day]) { delete notes[day]; pushUndo(`Deleted day note (${fmtDate(day)})`, [{ kind: 'day_note', id: day }]); }
      noteMsg = text ? 'Saved' : 'Note removed';
    } catch (ex) {
      noteMsg = `Not saved: ${ex.message}. Reload the page and try again.`;
    }
    renderDashboard();
  });
  app.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => { location.hash = `#/trade/${tr.dataset.id}`; }));
}

// ---------- Daily Journal: mỗi ngày một thẻ (theo ảnh ảnh mẫu chủ dự án gửi 08/11) ----------
let dailyOpen = new Set();   // các ngày đang mở rộng (xem lệnh + ghi chú)
let dailyExtra = new Set();  // ngày trống được bấm từ lịch nhỏ (để thêm ghi chú / lệnh)
let dailyMonth = null;       // tháng của lịch nhỏ bên phải, 'YYYY-MM'
let dailyMsg = {};           // thông báo sau khi lưu ghi chú, theo ngày

ICON.chev = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>';

const longDate = (day, withYear = true) => new Date(`${day}T12:00:00Z`).toLocaleDateString(window.I18N?.locale || 'en-US',
  { weekday: 'short', month: 'short', day: 'numeric', ...(withYear ? { year: 'numeric' } : {}), timeZone: 'UTC' });

// Danh sách lệnh của một ngày, mỗi lệnh có nút Edit (dùng ở Dashboard và Daily Journal)
function dayTradesHTML(rows) {
  return `<ul class="day-trades">${[...rows].sort(byTime).map((t) => `
    <li data-ctx-trade="${t.id}">
      <a href="#/trade/${t.id}" class="dt-main">
        <b>${t.quick ? 'Quick entry' : esc([t.time, t.symbol, t.direction === 'long' ? 'Long' : t.direction === 'short' ? 'Short' : ''].filter(Boolean).join(' · ') || 'Trade')}</b>
        <small>${esc(t.model_name || t.setup_name || t.confirmations.join(' + ') || accName(t) || '')}</small>
      </a>
      ${resultPill(t)}
      <span class="dt-actions"><button type="button" class="btn btn-soft btn-sm" data-move-trade="${t.id}">Move to…</button><a class="btn btn-soft btn-sm" href="#/trade/${t.id}/edit">Edit</a></span>
    </li>`).join('')}</ul>`;
}

function dayCardHTML(day, rows, unit) {
  const k = unit === 'usd' ? 'pnl_usd' : 'result_r';
  const closed = rows.filter((t) => outcomeOf(t) !== 'open').sort(byTime);
  const withK = closed.filter((t) => t[k] != null);
  const sumOf = (list, key) => list.reduce((acc, t) => acc + t[key], 0);
  const net = sumOf(withK, k);
  const withUsd = closed.filter((t) => t.pnl_usd != null);
  const withR = closed.filter((t) => t.result_r != null);
  const perTrade = closed.filter(notQuick);
  const wins = perTrade.filter((t) => outcomeOf(t) === 'win').length;
  const losses = perTrade.filter((t) => outcomeOf(t) === 'loss').length;
  const gw = sumOf(withK.filter((t) => notQuick(t) && t[k] > 0), k);
  const gl = -sumOf(withK.filter((t) => notQuick(t) && t[k] < 0), k);
  const answered = rows.filter((t) => t.followed_plan);
  const followed = answered.filter((t) => t.followed_plan === 'yes').length;
  const fmtU = (v) => (unit === 'usd' ? fmtUsd(Math.round(v * 100) / 100) || '$0' : fmtRv(v) || '0.0R');
  const tone = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : '');
  const open = dailyOpen.has(day);
  // Biểu đồ nhỏ: P&L cộng dồn theo từng lệnh trong ngày, nhãn là giờ vào lệnh
  const points = withK.map((t, i) => ({ date: day, label: t.time || `#${i + 1}`, value: t[k] }));
  const stat = (label, value, cls = '') => `<div><dt>${label}</dt><dd class="${cls}">${value}</dd></div>`;
  const msg = dailyMsg[day] || '';
  return `
    <article class="tile day-card ${open ? 'open' : ''}" id="day-${day}">
      <header class="day-head">
        <button type="button" class="chev" data-toggle="${day}" aria-expanded="${open}" aria-label="${open ? 'Hide' : 'Show'} trades and note for ${longDate(day)}">${ICON.chev}</button>
        <h3>${longDate(day)}</h3>
        ${withK.length ? `<span class="day-net ${tone(net)}">Net P&amp;L ${fmtU(net)}</span>` : ''}
        ${notes[day] && !open ? `<span class="note-flag" title="${esc(notes[day])}">${ICON.note}Note</span>` : ''}
        <button type="button" class="btn btn-soft day-note-btn" data-note="${day}">${ICON.note}${notes[day] ? 'Edit note' : 'Add note'}</button>
      </header>
      ${rows.length ? `
      <div class="day-body">
        <div class="day-chart">${points.length ? axisChart(points, 'cum', unit) : '<p class="hint">No closed trades with a result yet.</p>'}</div>
        <dl class="day-stats">
          ${stat('Total trades', countTrades(rows))}
          ${stat('Winners', wins)}
          ${stat('Net P&amp;L', withUsd.length ? fmtUsd(sumOf(withUsd, 'pnl_usd')) || '$0' : '—', withUsd.length ? tone(sumOf(withUsd, 'pnl_usd')) : '')}
          ${stat('Total R', withR.length ? fmtRv(sumOf(withR, 'result_r')) || '0.0R' : '—', withR.length ? tone(sumOf(withR, 'result_r')) : '')}
          ${stat('Winrate', perTrade.length ? `${pct(wins, perTrade.length)}%` : '—')}
          ${stat('Losers', losses)}
          ${stat('Followed plan', answered.length ? `${followed}/${answered.length}` : '—', answered.length && followed < answered.length ? 'loss' : '')}
          ${stat('Profit factor', gl ? (gw / gl).toFixed(2) : gw > 0 ? '∞' : '—')}
        </dl>
      </div>` : '<p class="hint">No trades on this day.</p>'}
      ${open ? `
      <div class="day-quick">${quickAddHTML(day)}</div>
      <div class="day-more">
        <div>
          <h4>Trades</h4>
          ${rows.length ? dayTradesHTML(rows) : ''}
          <a class="btn btn-primary btn-sm" href="#/new?date=${day}">+ Add trade</a>
        </div>
        <div class="day-note">
          <label for="note-${day}">Day note</label>
          <textarea id="note-${day}" rows="4" maxlength="2000" placeholder="How did the day go? Market, mood, why you sat out…">${esc(notes[day] || '')}</textarea>
          <div class="list-actions">
            <button type="button" class="btn" data-save-note="${day}">Save note</button>
            <span class="saved ${msg.startsWith('Not saved') ? 'error' : 'ok'}" role="status">${esc(msg)}</span>
          </div>
        </div>
      </div>` : ''}
    </article>`;
}

// Lịch nhỏ bên phải: ô xanh/đỏ theo kết quả ngày, bấm để nhảy tới ngày đó
function miniCalHTML(month, byDate) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7; // tuần bắt đầu từ Thứ Hai
  const today = todayStr();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push('<span></span>');
  for (let d = 1; d <= daysIn; d++) {
    const key = `${month}-${String(d).padStart(2, '0')}`;
    const tone = statTone(dayStats(byDate[key] || []));
    cells.push(`<button type="button" class="mc-day ${tone} ${key === today ? 'today' : ''} ${notes[key] ? 'has-note' : ''}" data-mc="${key}"
      aria-label="${longDate(key)}${byDate[key] ? `, ${byDate[key].length} trades` : ''}${notes[key] ? ', has a note' : ''}">${d}</button>`);
  }
  const name = cap1(first.toLocaleString((window.I18N?.locale || 'en-US'), { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  return `
    <div class="mc-head">
      <button type="button" class="btn btn-soft mc-nav" data-mc-shift="-1" aria-label="Previous month">‹</button>
      <b>${name}</b>
      <button type="button" class="btn btn-soft mc-nav" data-mc-shift="1" aria-label="Next month">›</button>
    </div>
    <div class="mc-grid">
      ${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => `<span class="mc-dow">${d}</span>`).join('')}
      ${cells.join('')}
    </div>`;
}

function renderDaily() {
  const byDate = {};
  trades.forEach((t) => { (byDate[t.date] ||= []).push(t); });
  const withUsd = trades.some((t) => t.pnl_usd != null);
  const unit = chartUnit === 'usd' && withUsd ? 'usd' : 'r';
  const days = [...new Set([...Object.keys(byDate), ...Object.keys(notes), ...dailyExtra])].sort().reverse();
  if (!dailyMonth) dailyMonth = (days[0] || todayStr()).slice(0, 7);

  app.innerHTML = `
    <div class="dash-top">
      <div>
        <h1>Daily Journal</h1>
        <p class="hint">${days.length} day${days.length === 1 ? '' : 's'} · ${esc(scopeLabel())} · ${tzCity()} dates</p>
      </div>
      <div class="dash-controls">
        <button type="button" class="btn btn-soft" data-all="close">Collapse all</button>
        <button type="button" class="btn btn-soft" data-all="open">Expand all</button>
        <div class="toggle small" role="group" aria-label="Unit">
          <button type="button" data-unit="usd" class="${unit === 'usd' ? 'on' : ''}" ${withUsd ? '' : 'disabled'}>$</button>
          <button type="button" data-unit="r" class="${unit === 'r' ? 'on' : ''}">R</button>
        </div>
      </div>
    </div>
    <div class="daily-layout">
      <div class="daily-list">
        ${days.length ? days.map((d) => dayCardHTML(d, byDate[d] || [], unit)).join('')
          : '<div class="empty">No trades yet. <a class="link" href="#/new">+ New trade</a></div>'}
      </div>
      <aside class="tile mini-cal">${miniCalHTML(dailyMonth, byDate)}</aside>
    </div>`;
  dailyMsg = {};

  const rerender = (focusDay) => {
    renderDaily();
    if (focusDay) document.getElementById(`day-${focusDay}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  app.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.toggle;
    if (dailyOpen.has(d)) dailyOpen.delete(d); else dailyOpen.add(d);
    rerender();
  }));
  app.querySelectorAll('[data-note]').forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.note;
    dailyOpen.add(d);
    rerender();
    document.getElementById(`note-${d}`)?.focus();
  }));
  app.querySelectorAll('[data-all]').forEach((b) => b.addEventListener('click', () => {
    dailyOpen = b.dataset.all === 'open' ? new Set(days) : new Set();
    rerender();
  }));
  app.querySelectorAll('[data-unit]').forEach((b) => b.addEventListener('click', () => { chartUnit = b.dataset.unit; rerender(); }));
  app.querySelectorAll('[data-mc-shift]').forEach((b) => b.addEventListener('click', () => {
    const [yy, mm] = dailyMonth.split('-').map(Number);
    dailyMonth = iso(new Date(Date.UTC(yy, mm - 1 + Number(b.dataset.mcShift), 1))).slice(0, 7);
    rerender();
  }));
  app.querySelectorAll('[data-mc]').forEach((b) => b.addEventListener('click', () => {
    const d = b.dataset.mc;
    if (!byDate[d] && !notes[d]) dailyExtra.add(d); // ngày trống: hiện thẻ để ghi chú hoặc thêm lệnh
    dailyOpen.add(d);
    rerender(d);
  }));
  bindQuickAdd();
  app.querySelectorAll('[data-save-note]').forEach((b) => b.addEventListener('click', async () => {
    const d = b.dataset.saveNote;
    const text = document.getElementById(`note-${d}`).value.trim();
    b.disabled = true;
    try {
      await api(`/api/notes/${d}`, { method: 'PUT', body: JSON.stringify({ note: text }) });
      if (text) notes[d] = text; else if (notes[d]) { delete notes[d]; pushUndo(`Deleted day note (${fmtDate(d)})`, [{ kind: 'day_note', id: d }]); }
      dailyMsg[d] = text ? 'Saved' : 'Note removed';
    } catch (ex) {
      dailyMsg[d] = `Not saved: ${ex.message}. Reload the page and try again.`;
    }
    rerender();
  }));
}

function statusPill(t) {
  if (t.mistakes.length) return pill(esc(t.mistakes[0]), 'loss', 'alert');
  if (t.followed_plan === 'yes') return pill('Plan', 'win', 'check');
  if (t.followed_plan === 'no') return pill('Broke plan', 'loss', 'cross');
  return '<span class="muted">—</span>';
}
function resultPill(t) {
  const o = outcomeOf(t);
  return pill(fmtResult(t), o === 'win' ? 'win' : o === 'loss' ? 'loss' : '');
}

function recentTable(rows) {
  return `<div class="table-wrap"><table class="table">
    <thead><tr><th class="hide-sm">No</th><th>Setup</th><th class="hide-sm">Date</th><th>Result</th><th class="hide-sm">Status</th></tr></thead>
    <tbody>${rows.map((t, i) => {
      const thumb = t.images?.[0]?.f;
      return `<tr data-id="${t.id}" data-ctx-trade="${t.id}">
        <td class="hide-sm muted">#${i + 1}</td>
        <td>
          <a class="setup-cell" href="#/trade/${t.id}">
            <span class="mini">${thumb ? `<img src="${esc(imgSrc(thumb))}" alt="" loading="lazy">` : ''}</span>
            <span><b>${esc(t.model_name || t.setup_name || t.confirmations.join(' + ') || 'Trade')}</b>
            <small>${esc([t.symbol, t.direction === 'long' ? 'Long' : t.direction === 'short' ? 'Short' : ''].filter(Boolean).join(' '))}<span class="show-sm"> · ${fmtDate(t.date)}</span></small></span>
          </a>
        </td>
        <td class="hide-sm">${fmtDate(t.date)}</td>
        <td>${resultPill(t)}</td>
        <td class="hide-sm">${statusPill(t)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

// ---------- Giao diện sáng / tối ----------
// Lựa chọn: dark | light. Lưu trong trình duyệt của máy này.
// Chỉ có 2 chế độ: dark | light (giá trị cũ khác coi như dark)
const themePref = () => { try { return localStorage.getItem('rj-theme') === 'light' ? 'light' : 'dark'; } catch { return 'dark'; } };
function applyTheme(pref = themePref()) {
  document.documentElement.dataset.theme = pref === 'light' ? 'light' : 'dark';
}
function setTheme(pref) {
  try { localStorage.setItem('rj-theme', pref); } catch { /* bỏ qua */ }
  applyTheme(pref);
}
document.getElementById('theme-toggle').addEventListener('click', () => {
  setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
  if (location.hash === '#/settings') renderSettings();
});

// ---------- Nút thu gọn / mở rộng sidebar (nhớ trong trình duyệt) ----------
function syncSideToggle() {
  const collapsed = document.documentElement.classList.contains('side-collapsed');
  const btn = document.getElementById('side-toggle');
  btn.setAttribute('aria-expanded', String(!collapsed));
  btn.setAttribute('aria-label', collapsed ? 'Expand menu' : 'Collapse menu');
  btn.title = collapsed ? 'Expand menu' : 'Collapse menu';
}
document.getElementById('side-toggle').addEventListener('click', () => {
  const collapsed = document.documentElement.classList.toggle('side-collapsed');
  try { localStorage.setItem('rj-sidebar', collapsed ? 'collapsed' : 'open'); } catch { /* bỏ qua */ }
  syncSideToggle();
});
syncSideToggle();

// ---------- Tài khoản: tiền thật (personal) và tiền quỹ (prop) ----------
const ACC_TYPES = {
  personal: 'Personal · Live',     // tiền thật của bạn
  demo: 'Personal · Demo',         // tài khoản tập, không mất tiền (thêm 2026-11-09)
  prop_eval: 'Prop · Evaluation',  // đang thi, có trả phí
  prop_funded: 'Prop · Funded',    // đã qua, được cấp vốn
};
// Gợi ý cho từng loại tài khoản trong form "New account"
const ACC_TYPE_HELP = {
  personal: { desc: 'Your own money at a broker', name: 'e.g. Capital.com live', firm: 'Broker', firmPh: 'e.g. Capital.com, IBKR', bal: 'e.g. 1000',
    hint: 'Real money. Results count in Live P&L and Net cash.' },
  demo: { desc: 'Practice or paper trading, no real money', name: 'e.g. TradingView paper', firm: 'Platform', firmPh: 'e.g. TradingView, NinjaTrader sim', bal: 'e.g. 10000',
    hint: 'Practice only. Results show in Demo P&L and are never added to Net cash.' },
  prop_eval: { desc: 'A prop challenge you paid for', name: 'e.g. Topstep 25K #2', firm: 'Prop firm', firmPh: 'e.g. Topstep, The5ers', bal: 'e.g. 25000',
    hint: 'Add the fee you paid and the firm rules, so you can see how close you are to the limits.' },
  prop_funded: { desc: 'You passed and got a funded account', name: 'e.g. Topstep XFA 50K', firm: 'Prop firm', firmPh: 'e.g. Topstep, The5ers', bal: 'e.g. 50000',
    hint: 'Funded account. Profits are not your cash until you get a payout.' },
};
const ACC_STATUS = { active: 'Active', passed: 'Passed', failed: 'Failed', closed: 'Closed' };
const accOf = (t) => accounts.find((a) => a.id === t.account_id) || null;
const accName = (t) => accOf(t)?.name || '';
const isProp = (a) => !!a && a.type.startsWith('prop');

// Công tắc chung: all | real | prop | acc:<id>. Nhớ lựa chọn trong trình duyệt (nếu được).
let scope = (() => { try { return localStorage.getItem('rj-scope') || 'all'; } catch { return 'all'; } })();
// Lệnh chưa gắn tài khoản (VD kết quả nhanh cũ) hiện ở mọi lựa chọn, để không bao giờ "biến mất"
function applyScope(list) {
  if (scope === 'all') return list;
  // Mỗi tài khoản tính ĐỘC LẬP (13/11): lệnh chưa gắn tài khoản chỉ được tính ở "All accounts"
  const keep = (fn) => list.filter((t) => t.account_id != null && fn(t));
  if (scope === 'real') return keep((t) => accOf(t)?.type === 'personal');
  if (scope === 'demo') return keep((t) => accOf(t)?.type === 'demo');
  if (scope === 'prop') return keep((t) => isProp(accOf(t)));
  const id = Number(scope.slice(4));
  return keep((t) => t.account_id === id);
}
// Kết quả nhanh gắn vào tài khoản đang chọn ở thanh trên (hoặc tài khoản duy nhất thuộc loại đó)
function scopeAccountId() {
  if (scope.startsWith('acc:')) return Number(scope.slice(4));
  const fit = { real: (a) => a.type === 'personal', demo: (a) => a.type === 'demo', prop: (a) => isProp(a) }[scope];
  const list = fit ? accounts.filter(fit) : [];
  return list.length === 1 ? list[0].id : '';
}
// Tài khoản mặc định cho lệnh mới (13/11): tài khoản đang chọn ở thanh trên; nếu chỉ có 1 tài khoản đang mở thì lấy nó; còn lại để trống, bắt chọn
function defaultAccountId() {
  const id = scopeAccountId();
  if (id) return id;
  const open = accounts.filter((a) => a.status === 'active');
  return open.length === 1 ? open[0].id : null;
}
function scopeLabel() {
  if (scope === 'all') return 'All accounts';
  if (scope === 'real') return 'Live accounts';
  if (scope === 'demo') return 'Demo accounts';
  if (scope === 'prop') return 'Prop accounts';
  return (accounts.find((a) => `acc:${a.id}` === scope)?.name || 'Account');
}
function renderScopeSwitch() {
  const sel = document.getElementById('scope');
  if (scope.startsWith('acc:') && !accounts.some((a) => `acc:${a.id}` === scope)) scope = 'all';
  sel.innerHTML = `
    <option value="all">All accounts</option>
    <option value="real">Live (real money)</option>
    <option value="demo">Demo (practice)</option>
    <option value="prop">Prop</option>
    ${accounts.length ? `<optgroup label="One account">${accounts.map((a) => `<option value="acc:${a.id}">${esc(a.name)}</option>`).join('')}</optgroup>` : ''}
    <option value="manage">Manage accounts…</option>`;
  sel.value = scope;
  sel.classList.toggle('on', scope !== 'all');
}
document.getElementById('scope').addEventListener('change', (e) => {
  if (e.target.value === 'manage') { e.target.value = scope; location.hash = '#/accounts'; return; }
  scope = e.target.value;
  try { localStorage.setItem('rj-scope', scope); } catch { /* bỏ qua nếu trình duyệt chặn */ }
  route();
});

// Ô chọn tài khoản trong form lệnh
function accountSelect(currentId) {
  const opts = accounts.filter((a) => a.status === 'active' || a.id === currentId);
  return `<select name="account_id">
    <option value="">— No account —</option>
    ${opts.map((a) => `<option value="${a.id}" ${a.id === currentId ? 'selected' : ''}>${esc(a.name)} · ${ACC_TYPES[a.type]}</option>`).join('')}
  </select>`;
}

let editingAccount = null; // id đang sửa, 'new' khi thêm mới

function renderAccounts() {
  const stats = (a) => {
    const rows = allTrades.filter((t) => t.account_id === a.id && outcomeOf(t) !== 'open');
    const usd = rows.filter((t) => t.pnl_usd != null);
    const r = rows.filter((t) => t.result_r != null);
    return { n: rows.length, usd: usd.length ? usd.reduce((s, t) => s + t.pnl_usd, 0) : null, r: r.length ? r.reduce((s, t) => s + t.result_r, 0) : null };
  };
  const personal = accounts.filter((a) => a.type === 'personal');
  const props = accounts.filter(isProp);
  const personalPnl = personal.reduce((s, a) => s + (stats(a).usd || 0), 0);
  const propFees = props.reduce((s, a) => s + (a.cost_usd || 0), 0);
  const realNet = personalPnl - propFees;
  const unassigned = allTrades.filter((t) => !t.account_id).length;
  const tone = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : '');

  const form = (a) => {
    const v = a || { name: '', type: '', firm: '', status: 'active' };
    const num = (k, label, ph) => `<label>${label} <input type="number" min="0" step="any" name="${k}" value="${v[k] ?? ''}" placeholder="${ph}"></label>`;
    return `<form class="acc-form tile" data-id="${a ? a.id : 'new'}" novalidate>
      <h3>${a ? 'Edit account' : 'New account'}</h3>
      <div class="field-label">1. What kind of account?</div>
      <div class="acc-types" role="radiogroup" aria-label="Account type">
        ${Object.entries(ACC_TYPES).map(([k, l]) => `
          <label class="acc-type">
            <input type="radio" name="type" value="${k}" ${v.type === k ? 'checked' : ''} required>
            <span><b>${l}</b><small>${ACC_TYPE_HELP[k].desc}</small></span>
          </label>`).join('')}
      </div>
      <div class="field-label">2. Details</div>
      <p class="hint acc-type-hint"></p>
      <div class="cols">
        <label>Name <input name="name" value="${esc(v.name)}" placeholder="Pick a type first" required></label>
        <label><span class="firm-label">Broker / Firm</span> <input name="firm" value="${esc(v.firm || '')}" placeholder=""></label>
        <label>Status <select name="status">${Object.entries(ACC_STATUS).map(([k, l]) => `<option value="${k}" ${v.status === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <div class="cols">
        ${num('starting_balance', 'Starting balance ($)', 'e.g. 1000')}
      </div>
      <div class="cols prop-only">
        ${num('cost_usd', 'Challenge fee paid ($)', 'e.g. 75')}
        ${num('profit_target', 'Profit target ($)', 'e.g. 2000')}
        ${num('max_loss', 'Max loss limit ($)', 'e.g. 1000')}
        ${num('daily_loss', 'Daily loss limit ($)', 'e.g. 500')}
      </div>
      <p class="error" role="alert" hidden></p>
      <div class="form-actions">
        ${a ? '<button type="button" class="btn btn-danger" data-delete>Delete</button>' : ''}
        <button type="button" class="btn" data-cancel>Cancel</button>
        <button type="submit" class="btn btn-primary">Save account</button>
      </div>
    </form>`;
  };

  const card = (a) => {
    if (editingAccount === a.id) return form(a);
    const st = stats(a);
    return `<div class="tile acc-card">
      <div class="kpi-top">
        <span class="icon-tile">${ICON[a.type === 'personal' ? 'dollar' : a.type === 'demo' ? 'clock' : 'target']}</span>
        <div><h3>${ACC_TYPES[a.type]}</h3><div class="kpi-name">${esc(a.name)}</div></div>
        <button class="btn btn-soft acc-edit" data-edit="${a.id}">Edit</button>
      </div>
      <div class="pills">
        ${pill(ACC_STATUS[a.status], a.status === 'failed' ? 'loss' : a.status === 'active' || a.status === 'passed' ? 'win' : '')}
        ${a.firm ? pill(esc(a.firm)) : ''}
        ${a.cost_usd ? pill(`Fee $${a.cost_usd}`) : ''}
      </div>
      <dl class="acc-stats">
        <div><dt>Trades</dt><dd>${st.n}</dd></div>
        <div><dt>P&amp;L</dt><dd class="${tone(st.usd)}">${st.usd != null ? fmtUsd(st.usd) || '$0' : '—'}</dd></div>
        <div><dt>R</dt><dd class="${tone(st.r)}">${st.r != null ? fmtRv(st.r) : '—'}</dd></div>
      </dl>
    </div>`;
  };

  const demos = accounts.filter((x) => x.type === 'demo');
  app.innerHTML = `
    <div class="dash-top">
      <div>
        <h1>Accounts</h1>
        <p class="hint">Keep your own money, practice and prop accounts apart. ${accounts.length} account${accounts.length === 1 ? '' : 's'}.</p>
      </div>
      <div class="dash-controls"><button class="btn btn-primary" data-new>+ New account</button></div>
    </div>

    <div class="kpi-row acc-sum">
      ${tile('Live P&amp;L', 'The total result of all trades in your Personal · Live accounts. This is your own money. Demo and prop trades are not included.', `
        <div class="kpi-body"><div class="big ${tone(personalPnl)}">${personal.length ? fmtUsd(personalPnl) || '$0' : '—'}</div></div>
        <div class="kpi-sub">${personal.length ? 'From trades in Live accounts' : 'No Live account yet'}</div>`)}
      ${tile('Prop fees paid', 'Money you spent on prop challenges (the fee you enter on each prop account).', `
        <div class="kpi-body"><div class="big ${propFees ? 'loss' : ''}">${props.length ? (propFees ? `−$${propFees.toLocaleString('en-US')}` : '$0') : '—'}</div></div>
        <div class="kpi-sub">Money spent on challenges · ${props.length} prop account${props.length === 1 ? '' : 's'}</div>`)}
      ${tile('Net cash', 'Live P&L minus prop fees. What you really made or lost with your own money. Prop profits are not counted until you get a payout.', `
        <div class="kpi-body"><div class="big ${tone(realNet)}">${personal.length || props.length ? fmtUsd(realNet) || '$0' : '—'}</div></div>
        <div class="kpi-sub">Live P&amp;L − prop fees</div>`)}
      ${tile('Demo P&amp;L', 'Practice result from Personal · Demo accounts. Not real money, so it is never added to Net cash.', `
        <div class="kpi-body"><div class="big ${tone(demos.reduce((x, d) => x + (stats(d).usd || 0), 0))}">${demos.length ? fmtUsd(demos.reduce((x, d) => x + (stats(d).usd || 0), 0)) || '$0' : '—'}</div></div>
        <div class="kpi-sub">${demos.length ? 'Practice only, not real money' : 'No Demo account yet'}</div>`)}
    </div>

    ${unassigned ? `<p class="notice">${ICON.alert}${unassigned} trade${unassigned === 1 ? ' has' : 's have'} no account yet. Open a trade, choose its account, and save.</p>` : ''}
    ${editingAccount === 'new' ? form(null) : ''}
    ${accounts.length ? `<div class="acc-grid">${accounts.map(card).join('')}</div>`
      : editingAccount === 'new' ? '' : `<div class="empty">No accounts yet.<br>Add your Live, Demo and prop accounts so their results stay apart.<br>
          <button class="btn btn-primary" data-new>+ New account</button></div>`}
  `;

  app.querySelectorAll('[data-new]').forEach((b) => b.addEventListener('click', () => { editingAccount = 'new'; renderAccounts(); app.querySelector('.acc-form input')?.focus(); }));
  app.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => { editingAccount = Number(b.dataset.edit); renderAccounts(); }));
  app.querySelectorAll('.acc-form').forEach((f) => {
    const syncProp = () => {
      const type = f.elements.namedItem('type').value;
      const h = ACC_TYPE_HELP[type];
      f.querySelector('.prop-only').hidden = !type.startsWith('prop');
      f.querySelectorAll('.acc-type').forEach((c) => c.classList.toggle('on', c.querySelector('input').checked));
      f.querySelector('.acc-type-hint').textContent = h ? h.hint : 'Pick the kind of account first.';
      f.querySelector('.firm-label').textContent = h ? h.firm : 'Broker / Firm';
      f.elements.namedItem('name').placeholder = h ? h.name : 'Pick a type first';
      f.elements.namedItem('firm').placeholder = h ? h.firmPh : '';
      f.elements.namedItem('starting_balance').placeholder = h ? h.bal : 'e.g. 1000';
    };
    f.addEventListener('change', (e) => { if (e.target.name === 'type') syncProp(); });
    syncProp();
    f.querySelector('[data-cancel]').addEventListener('click', () => { editingAccount = null; renderAccounts(); });
    f.querySelector('[data-delete]')?.addEventListener('click', async () => {
      if (!confirm('Delete this account? This cannot be undone.')) return;
      try { await api(`/api/accounts/${f.dataset.id}`, { method: 'DELETE' }); editingAccount = null; await loadTrades(); renderAccounts(); }
      catch (ex) { const e = f.querySelector('.error'); e.textContent = ex.message; e.hidden = false; }
    });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const body = Object.fromEntries(new FormData(f));
      body.type = body.type || '';
      if (!body.type.startsWith('prop')) { body.profit_target = ''; body.max_loss = ''; body.daily_loss = ''; body.cost_usd = ''; }
      const err = f.querySelector('.error'); err.hidden = true;
      try {
        await (f.dataset.id === 'new'
          ? api('/api/accounts', { method: 'POST', body: JSON.stringify(body) })
          : api(`/api/accounts/${f.dataset.id}`, { method: 'PUT', body: JSON.stringify(body) }));
        editingAccount = null; await loadTrades(); renderAccounts();
      } catch (ex) { err.textContent = ex.message; err.hidden = false; }
    });
  });
}

// ---------- Settings ----------
const DEFAULT_LISTS = {
  confirmations: [...CONFIRMATIONS], mistakes: [...MISTAKES], emotions: [...EMOTIONS],
  dols: [...DOLS], sessions: [...SESSIONS], symbols: [...SYMBOLS],
};
const LIST_LABELS = {
  confirmations: 'Entry confirmations', mistakes: 'Mistakes', emotions: 'Feelings before entry',
  dols: 'DOLs (Draw on Liquidity)', sessions: 'Sessions', symbols: 'Symbols',
};
// Áp cài đặt từ server vào các danh sách đang dùng trong form
function applySettings(st) {
  CONFIRMATIONS = st.confirmations || DEFAULT_LISTS.confirmations;
  if (st.pdas) PDAS = st.pdas;
  MISTAKES = st.mistakes || DEFAULT_LISTS.mistakes;
  EMOTIONS = st.emotions || DEFAULT_LISTS.emotions;
  DOLS = st.dols || DEFAULT_LISTS.dols;
  SESSIONS = st.sessions || DEFAULT_LISTS.sessions;
  if (!SESSIONS.includes('Out of session')) SESSIONS = [...SESSIONS, 'Out of session']; // 14/11: lệnh ngoài giờ các phiên chính
  SYMBOLS = st.symbols || DEFAULT_LISTS.symbols;
  MAX_LOSSES = st.max_losses || 2;
  if (st.pda_htf) PDA_HTF = st.pda_htf;
  if (st.struct_m15) STRUCT_M15 = st.struct_m15;
  if (st.entry_m1) ENTRY_M1 = st.entry_m1;
  setSteps(st.steps?.length ? st.steps : defaultSteps());
  MODELS = st.models || [];
  MODELS_TRASH = (st.models_trash || []).filter((m) => trashAge(m.deleted_at) < 30);
  if (Array.isArray(st.pda_tfs)) PDA_TFS = st.pda_tfs;
  if (Array.isArray(st.entry_tfs)) ENTRY_TFS = st.entry_tfs;
}
const currentLists = () => ({ confirmations: CONFIRMATIONS, mistakes: MISTAKES, emotions: EMOTIONS, dols: DOLS, sessions: SESSIONS, symbols: SYMBOLS });


// Settings gọn (chủ dự án chốt 08/11): chỉ còn Sáng/Tối và Xoá tất cả lệnh.
// Luật STOP và các danh sách chọn giữ giá trị đã lưu, không sửa ở đây nữa.
// Thùng rác: lệnh, ghi chú ngày, ghi chú Notebook đã xoá (giữ 30 ngày)
let trash = { trades: [], day_notes: [], notes: [] };
// Lấy strategy ra khỏi Trash (Restore hoặc ⌘Z): đặt lại vào danh sách, gắn lại các lệnh chưa đổi sang strategy khác
async function restoreTrashedModel(id, at = null) {
  const e = MODELS_TRASH.find((x) => x.id === id); if (!e) return null;
  const { deleted_at: _d, trades: links = [], ...m } = e;
  const name = MODELS.some((x) => x.name.toLowerCase() === m.name.toLowerCase()) ? `${m.name} (restored)` : m.name;
  const next = [...MODELS]; next.splice(at == null || at < 0 ? next.length : Math.min(at, next.length), 0, { ...m, name });
  const nt = MODELS_TRASH.filter((x) => x.id !== id);
  await api('/api/settings', { method: 'PUT', body: JSON.stringify({ models: next, models_trash: nt }) });
  MODELS = next; MODELS_TRASH = nt;
  for (const l of links) {
    const t = allTrades.find((x) => x.id === l.id);
    if (!t || t.model_id) continue; // lệnh đã xoá, hoặc đã chọn strategy khác thì để yên
    await api(`/api/trades/${l.id}/strategy`, { method: 'PUT', body: JSON.stringify({ model_id: id, model_name: name, model_items: l.items, model_checks: l.checks }) }).catch(() => {});
  }
  await loadTrades();
  return name;
}
async function purgeTrashedModels(ids) {
  const nt = MODELS_TRASH.filter((x) => !ids.includes(x.id));
  await api('/api/settings', { method: 'PUT', body: JSON.stringify({ models_trash: nt }) });
  MODELS_TRASH = nt;
}
function trashRows() {
  const daysLeft = (s) => Math.max(0, 30 - Math.floor((Date.now() - new Date(`${s.replace(' ', 'T')}Z`).getTime()) / 86400000));
  const row = (kind, id, title, sub, at) => `
    <li><span><b>${title}</b><small>${sub} · deleted ${fmtStamp(at)} · ${daysLeft(at)} days left</small></span>
      <button type="button" class="btn btn-soft btn-sm" data-restore="${kind}|${id}">Restore</button>
      <button type="button" class="btn btn-soft btn-sm btn-danger" data-purge="${kind}|${id}">Delete forever</button></li>`;
  return [
    ...trash.trades.map((t) => row('trade', t.id, esc([fmtDate(t.date), t.time, t.symbol, t.direction === 'long' ? 'Long' : t.direction === 'short' ? 'Short' : ''].filter(Boolean).join(' · ')), `Trade · ${fmtResult(t)}`, t.deleted_at)),
    ...trash.day_notes.map((d) => row('day_note', d.date, esc(longDate(d.date)), `Day note · ${esc(d.note.slice(0, 60))}`, d.deleted_at)),
    ...trash.notes.map((n) => row('note', n.id, esc(n.title || 'Untitled'), 'Notebook note', n.deleted_at)),
    ...MODELS_TRASH.map((m) => row('model', m.id, esc(m.name), `Strategy · ${m.trades?.length || 0} trade${m.trades?.length === 1 ? '' : 's'}`, m.deleted_at)),
  ];
}

async function renderSettings() {
  try { trash = await api('/api/trash'); } catch { trash = { trades: [], day_notes: [], notes: [] }; }
  const rows = trashRows();
  const pref = themePref();
  app.innerHTML = `
    <div class="dash-top"><div><h1>Settings</h1><p class="hint">Saved on this computer</p></div></div>

    <div class="set-wrap">
    <section class="tile set-block">
      <h3>Appearance</h3>
      <div class="toggle" role="group" aria-label="Theme">
        ${[['dark', 'Dark'], ['light', 'Light']].map(([v, l]) =>
          `<button type="button" data-theme-pref="${v}" class="${pref === v ? 'on' : ''}" aria-pressed="${pref === v}">${l}</button>`).join('')}
      </div>
    </section>

    <section class="tile set-block">
      <h3>Time zone</h3>
      <p class="hint">Decides what counts as "today" on the calendar and the default time for a new trade. Saved trades keep their dates.</p>
      <select class="tz-select" data-tz-select aria-label="Time zone">
        ${TZS.map(([id, city]) => `<option value="${id}" ${tzId() === id ? 'selected' : ''} data-no-i18n>${tzOffset(id)} ${city}</option>`).join('')}
      </select>
      <p class="hint"><span>Today</span>: <b data-no-i18n>${esc(longDate(todayStr()))}</b></p>
    </section>

    <section class="tile set-block lang-block">
      <h3>Language</h3>
      <p class="hint">Choose your preferred language</p>
      <div class="lang-list" role="radiogroup" aria-label="Language">
        ${Object.entries(window.I18N?.LANGS || { en: 'English' }).map(([code, name]) => `<label class="lang-opt"><input type="radio" name="lang" value="${code}" ${(window.I18N?.lang || 'en') === code ? 'checked' : ''}><span data-no-i18n>${name}</span></label>`).join('')}
      </div>
    </section>

    <section class="tile set-block trash-block">
      <h3>Trash</h3>
      <p class="hint">Deleted trades, notes and strategies stay here for 30 days, then they are gone for good. You can also press <kbd>${IS_MAC ? '⌘' : 'Ctrl+'}Z</kbd> right after deleting.</p>
      ${rows.length ? `<ul class="trash-list">${rows.join('')}</ul>
        <div class="list-actions"><button type="button" class="btn btn-soft" data-restore-all>Restore all</button><button type="button" class="btn btn-danger-solid" data-empty-trash>Empty trash</button></div>`
        : '<p class="hint"><b>Trash is empty.</b></p>'}
    </section>

    <section class="tile set-block danger-block">
      <h3>Delete all trades</h3>
      <p class="hint">Deletes all ${allTrades.length} trade${allTrades.length === 1 ? '' : 's'} in every account and moves them to Trash. Accounts and day notes stay. In this demo, your data lives only in this browser.</p>
      <label class="inline">Type <b>DELETE</b> to confirm
        <input id="delete-confirm" autocomplete="off" spellcheck="false" style="width:140px">
      </label>
      <button type="button" class="btn btn-danger-solid" id="delete-all" disabled>Delete all trades</button>
      <span class="saved" id="delete-msg" role="status"></span>
    </section>
    </div>
  `;

  app.querySelectorAll('input[name="lang"]').forEach((r) => r.addEventListener('change', () => window.I18N?.set(r.value)));
  app.querySelector('[data-tz-select]')?.addEventListener('change', (e) => {
    try { localStorage.setItem('rj-tz', e.target.value); } catch { /* bỏ qua */ }
    location.reload(); // tải lại để lịch, ngày mặc định và các tháng đang xem dùng múi giờ mới
  });
  app.querySelectorAll('[data-theme-pref]').forEach((b) => b.addEventListener('click', () => { setTheme(b.dataset.themePref); renderSettings(); }));
  const item = (v) => { const [kind, ...rest] = v.split('|'); return { kind, id: rest.join('|') }; };
  const restore = async (items) => {
    try {
      const ms = items.filter((x) => x.kind === 'model'); const rest = items.filter((x) => x.kind !== 'model');
      if (rest.length) await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ items: rest }) });
      for (const x of ms) await restoreTrashedModel(Number(x.id));
      await loadTrades(); toast(`Restored ${items.length} item${items.length === 1 ? '' : 's'}`);
    } catch (ex) { toast(ex.message); }
    renderSettings();
  };
  app.querySelectorAll('[data-restore]').forEach((b) => b.addEventListener('click', () => restore([item(b.dataset.restore)])));
  app.querySelector('[data-restore-all]')?.addEventListener('click', () => restore([
    ...trash.trades.map((t) => ({ kind: 'trade', id: t.id })), ...trash.day_notes.map((d) => ({ kind: 'day_note', id: d.date })), ...trash.notes.map((n) => ({ kind: 'note', id: n.id })), ...MODELS_TRASH.map((m) => ({ kind: 'model', id: m.id }))]));
  app.querySelectorAll('[data-purge]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await askDialog({ title: 'Delete forever?', body: 'This item and its chart images will be gone for good. This cannot be undone.', actions: [{ label: 'Delete forever', value: 'yes', danger: true }] });
    if (!ok) return;
    try { const it = item(b.dataset.purge); if (it.kind === 'model') await purgeTrashedModels([Number(it.id)]); else await api('/api/trash/purge', { method: 'POST', body: JSON.stringify({ items: [it] }) }); } catch (ex) { toast(ex.message); }
    renderSettings();
  }));
  app.querySelector('[data-empty-trash]')?.addEventListener('click', async () => {
    const ok = await askDialog({ title: 'Empty trash?', body: `${rows.length} item${rows.length === 1 ? '' : 's'} will be gone for good, with their chart images. This cannot be undone.`, actions: [{ label: 'Empty trash', value: 'yes', danger: true }] });
    if (!ok) return;
    try { await api('/api/trash/purge', { method: 'POST', body: JSON.stringify({ all: true }) }); if (MODELS_TRASH.length) await purgeTrashedModels(MODELS_TRASH.map((m) => m.id)); } catch (ex) { toast(ex.message); }
    renderSettings();
  });
  // Nút xoá chỉ bật khi gõ đúng chữ DELETE
  const delInput = app.querySelector('#delete-confirm');
  const delBtn = app.querySelector('#delete-all');
  delInput.addEventListener('input', () => { delBtn.disabled = delInput.value.trim() !== 'DELETE' || !allTrades.length; });
  delBtn.addEventListener('click', async () => {
    const msg = app.querySelector('#delete-msg');
    try {
      const r = await api('/api/trades', { method: 'DELETE', body: JSON.stringify({ confirm: delInput.value.trim() }) });
      calSelected = null;
      await loadTrades();
      renderSettings();
      const m = app.querySelector('#delete-msg');
      m.textContent = `Moved ${r.deleted} trade${r.deleted === 1 ? '' : 's'} to Trash.`; m.className = 'saved ok';
      pushUndo(`Moved ${r.deleted} trade${r.deleted === 1 ? '' : 's'} to Trash`, (r.ids || []).map((id) => ({ kind: 'trade', id })));
    } catch (ex) { msg.textContent = ex.message; msg.className = 'saved error'; }
  });
}

// Cộng/trừ ngày cho chuỗi 'YYYY-MM-DD'
const addDays = (dateStr, n) => { const d = new Date(`${dateStr}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// ---------- Calendar: lời/lỗ theo từng ngày (giờ New York) ----------
let calMonth = null;     // 'YYYY-MM' đang xem
let calView = 'month';   // 14/11: 'month' = lịch tháng, 'year' = 12 ô tháng của năm
let calSelected = null;  // ngày đang bấm xem, 'YYYY-MM-DD'
let calEditing = null;   // ngày đang gõ số ngay trong ô lịch

const iso = (dt) => dt.toISOString().slice(0, 10);
function dayStats(rows) {
  const closed = rows.filter((t) => outcomeOf(t) !== 'open');
  const withUsd = closed.filter((t) => t.pnl_usd != null);
  const withR = closed.filter((t) => t.result_r != null);
  return {
    n: countTrades(rows),
    usd: withUsd.length ? withUsd.reduce((s, t) => s + t.pnl_usd, 0) : null,
    r: withR.length ? withR.reduce((s, t) => s + t.result_r, 0) : null,
  };
}
// Màu ô: theo $ nếu có, không thì theo R
const statTone = (st) => { const v = st.usd ?? st.r; return v == null ? '' : v > 0 ? 'win' : v < 0 ? 'loss' : 'flat'; };
const statLines = (st) => `
  ${st.usd != null ? `<b>${fmtUsd(st.usd) || '$0'}</b>` : ''}
  ${st.r != null ? `<span>${fmtRv(st.r)}</span>` : ''}
  ${st.n ? `<small>${st.n} trade${st.n === 1 ? '' : 's'}</small>` : ''}`;

// Tính dữ liệu cho một tháng: các tuần (thứ Hai–Sáu), tổng tuần, tổng tháng
function buildMonth(month) {
  const [y, m] = month.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 1, 1));
  const last = new Date(Date.UTC(y, m, 0));
  // Bắt đầu từ thứ Hai của tuần chứa ngày 1
  const start = new Date(first);
  start.setUTCDate(1 - ((first.getUTCDay() + 6) % 7));
  const byDate = {};
  trades.forEach((t) => { (byDate[t.date] ||= []).push(t); });
  const monthTrades = trades.filter((t) => t.date.slice(0, 7) === month);
  const monthStat = dayStats(monthTrades);

  const weeks = [];
  for (let wk = new Date(start); wk <= last; wk.setUTCDate(wk.getUTCDate() + 7)) {
    const days = [];
    const weekRows = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(wk); d.setUTCDate(wk.getUTCDate() + i);
      const key = iso(d);
      const rows = (byDate[key] || []).filter((t) => t.date.slice(0, 7) === month);
      weekRows.push(...rows);
      days.push({ key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === m - 1, weekend: i >= 5, rows });
    }
    // Bỏ hàng không có ngày nào thuộc tháng này
    if (days.some((d) => d.inMonth)) weeks.push({ days, stat: dayStats(weekRows) });
  }

  const monthName = cap1(first.toLocaleString((window.I18N?.locale || 'en-US'), { month: 'long', year: 'numeric', timeZone: 'UTC' }));
  return { y, m, weeks, monthStat, monthName, byDate };
}

// Đầu lịch (14/11, theo mẫu chủ dự án gửi): ‹ Tháng › ‹ Năm › + Today + Month / Year
function calHeadHTML() {
  // 14/11 (chủ dự án): bỏ tiêu đề "November 2026" + dòng tổng tháng; một hàng gọn: trái = ‹ Tháng › ‹ Năm ›, phải = Today + Month / Year
  const [yy, mm] = calMonth.split('-').map(Number);
  const loc = window.I18N?.locale || 'en-US';
  const mName = cap1(new Date(Date.UTC(yy, mm - 1, 1)).toLocaleString(loc, { month: 'long', timeZone: 'UTC' }));
  const year = String(yy);
  const isYear = calView === 'year';
  const step = (attr, prev, next, label, cls) => `<span class="cal-step"><button type="button" class="cal-arrow" ${attr}="-1" aria-label="${prev}">‹</button><b class="cal-step-label ${cls}">${esc(label)}</b><button type="button" class="cal-arrow" ${attr}="1" aria-label="${next}">›</button></span>`;
  return `<header class="cal-bar">
        <div class="cal-bar-left">
          ${isYear ? '' : step('data-shift', 'Previous month', 'Next month', mName, '')}
          ${step('data-shift-year', 'Previous year', 'Next year', year, 'year')}
        </div>
        <div class="cal-bar-right">
          <button type="button" class="btn btn-soft btn-sm cal-today" data-shift="0">Today</button>
          <div class="segmented cal-view" role="group" aria-label="Calendar view">${[['month', 'Month'], ['year', 'Year']].map(([v, l]) => `<button type="button" data-cal-view="${v}" class="${calView === v ? 'on' : ''}" aria-pressed="${calView === v}">${l}</button>`).join('')}</div>
        </div>
      </header>`;
}
// Chế độ Year: 12 ô tháng, màu giống ô ngày, bấm để mở tháng đó
function calYearHTML(year) {
  const loc = window.I18N?.locale || 'en-US';
  const nowM = todayStr().slice(0, 7);
  return `<div class="cal-year" role="grid" aria-label="${year}">${Array.from({ length: 12 }, (_, i) => {
    const key = `${year}-${String(i + 1).padStart(2, '0')}`;
    const st = dayStats(trades.filter((t) => t.date.slice(0, 7) === key));
    const name = cap1(new Date(Date.UTC(Number(year), i, 1)).toLocaleString(loc, { month: 'long', timeZone: 'UTC' }));
    return `<button type="button" role="gridcell" class="cal-day cal-mcell ${statTone(st)} ${key === nowM ? 'today' : ''}" data-cal-month="${key}" aria-label="${esc(name)} ${year}${st.n ? `, ${st.n} trade${st.n === 1 ? '' : 's'}` : ''}">
      <span class="cal-num">${esc(name)}</span>${st.n ? statLines(st) : '<small>—</small>'}</button>`;
  }).join('')}</div>`;
}

// Vẽ lưới lịch (dùng ở trang Calendar và trên Dashboard)
function calGridHTML({ weeks, monthName }) {
  const today = todayStr();
  return `
  <div class="cal" role="grid" aria-label="${monthName}">
      <div class="cal-row cal-head" role="row">
        ${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => `<div role="columnheader">${d}</div>`).join('')}
        <div role="columnheader" class="cal-week-col">Weekly</div>
      </div>
      ${weeks.map((w, i) => `
        <div class="cal-row" role="row">
          ${w.days.map((d) => {
            const st = dayStats(d.rows);
            if (d.key === calEditing) {
              // Ngày chỉ có 1 lệnh nhập nhanh thì sửa luôn số đó; còn lại thì gõ số mới
              const only = d.rows.length === 1 && d.rows[0].quick ? d.rows[0] : null;
              return `<div role="gridcell" class="cal-day editing ${d.inMonth ? '' : 'out'} ${statTone(st)}" data-edit-day="${d.key}" data-quick-id="${only ? only.id : ''}">
                <span class="cal-num">${d.day}</span>
                <label class="cal-field"><span>$</span><input class="cal-input" name="usd" value="${only?.pnl_usd ?? ''}" placeholder=""
                  inputmode="decimal" autocomplete="off" aria-label="P&L in dollars for ${d.key}"></label>
                <label class="cal-field"><span>R</span><input class="cal-input" name="r" value="${only?.result_r != null && only?.pnl_usd == null ? only.result_r : (only?.result_r ?? '')}" placeholder=""
                  inputmode="decimal" autocomplete="off" aria-label="Result in R for ${d.key}"></label>
                <small>${d.rows.length && !only ? 'Adds to this day · ' : ''}Enter ↵</small>
              </div>`;
            }
            return `<button type="button" role="gridcell" class="cal-day ${d.inMonth ? '' : 'out'} ${d.weekend ? 'weekend' : ''} ${statTone(st)} ${d.key === today ? 'today' : ''} ${d.key === calSelected ? 'selected' : ''}"
              data-day="${d.key}" ${st.n ? 'draggable="true" title="Drag onto another day to move these trades"' : ''} aria-label="${d.key}${st.n ? `, ${st.n} trade${st.n === 1 ? '' : 's'}` : ''}${notes[d.key] ? ', has a note' : ''}">
              <span class="cal-num">${d.day}${notes[d.key] ? `<i class="cal-note" title="Has a note">${ICON.note}</i>` : ''}</span>${statLines(st)}</button>`;
          }).join('')}
          <div class="cal-week ${statTone(w.stat)}" role="gridcell"><span class="cal-num">Week ${i + 1}</span>${w.stat.n ? statLines(w.stat) : '<small>—</small>'}</div>
        </div>`).join('')}
    </div>`;
}

// ---------- Donut (biểu đồ tròn rỗng giữa) ----------
// parts: [{ label, value, color }]; center: chữ ở giữa
function donut(parts, center, label) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  let offset = 0;
  const segs = total ? parts.filter((p) => p.value).map((p) => {
    const len = (p.value / total) * 100;
    const seg = `<circle cx="50" cy="50" r="40" pathLength="100" stroke="${p.color}" stroke-dasharray="${len} ${100 - len}" stroke-dashoffset="${-offset}"/>`;
    offset += len;
    return seg;
  }).join('') : '';
  return `<div class="donut-wrap">
    <div class="donut-box">
      <svg class="donut" viewBox="0 0 100 100" role="img" aria-label="${label}: ${parts.map((p) => `${p.label} ${p.value}`).join(', ')}">
        <circle cx="50" cy="50" r="40" stroke="var(--line)"/>
        <g transform="rotate(-90 50 50)">${segs}</g>
      </svg>
      <span class="donut-center" aria-hidden="true">${center}</span>
    </div>
    <ul class="legend">${parts.map((p) => `<li><span class="swatch" style="background:${p.color}"></span>${p.label}<b>${p.value}</b></li>`).join('')}</ul>
  </div>`;
}

// Dưới số lệnh này, các con số thống kê chưa đáng tin
const MIN_RELIABLE = 20;

// ---------- Trades: gallery có bộ lọc và tìm kiếm ----------
// Tìm trong setup, ghi chú, account, mã, confirmation, lỗi, bài học
function matchesSearch(t) {
  if (!searchText) return true;
  const hay = [t.model_name, t.setup_name, t.market_context, t.area_of_interest, t.lesson, accName(t), t.symbol, t.session,
    t.news_note, t.hindsight, t.htf_bias, ...t.dols, ...t.emotions, ...t.confirmations, ...t.mistakes].join(' ').toLowerCase();
  return searchText.toLowerCase().split(/\s+/).every((w) => hay.includes(w));
}

function renderGallery() {
  const list = trades.filter((t) =>
    matchesSearch(t) &&
    (!filters.setup || (filters.setup === '__none' ? !t.model_id && !t.quick : (t.model_name || t.setup_name) === filters.setup)) &&
    (!filters.account || String(t.account_id) === filters.account) &&
    (!filters.mistake || t.mistakes.includes(filters.mistake)) &&
    (!filters.outcome || outcomeOf(t) === filters.outcome) &&
    (!filters.plan || t.followed_plan === filters.plan));

  const option = (value, label, current) => `<option value="${esc(value)}" ${value === current ? 'selected' : ''}>${esc(label)}</option>`;
  const select = (key, allLabel, items) =>
    `<select data-filter="${key}" aria-label="${allLabel}">${option('', allLabel, filters[key])}${items.map(([v, l]) => option(v, l, filters[key])).join('')}</select>`;

  app.innerHTML = `
    <div class="page-head">
      <div>
        <h1>Trades</h1>
        <p>${trades.length} trade${trades.length === 1 ? '' : 's'} logged${list.length !== trades.length ? ` · showing ${list.length}` : ''}${searchText ? ` · search: "${esc(searchText)}" <a class="link" href="#/trades" id="clear-search">Clear</a>` : ''}</p>
      </div>
    </div>
    ${trades.length ? `
    <div class="filters">
      ${select('setup', 'All strategies', [...[...new Set(trades.map((t) => t.model_name || t.setup_name).filter(Boolean))].sort().map((s) => [s, s]), ['__none', 'No strategy']])}
      ${select('account', 'All accounts', accounts.map((a) => [String(a.id), a.name]))}
      ${select('mistake', 'All mistakes', MISTAKES.map((m) => [m, m]))}
      ${select('outcome', 'Win / Loss', [['win', 'Wins'], ['loss', 'Losses'], ['flat', 'Breakeven'], ['open', 'Open']])}
      ${select('plan', 'Followed plan?', [['yes', 'Followed plan'], ['no', 'Broke plan']])}
    </div>` : ''}
    ${!trades.length ? `
      <div class="empty">No trades yet.<br>Fill in "Before the trade" before you click buy or sell.<br>
        <a href="#/new" class="btn btn-primary">+ New trade</a></div>`
      : !list.length ? '<div class="empty">No trades match these filters.</div>'
      : `<div class="sel-bar" id="sel-bar" hidden><b></b><button type="button" class="btn btn-sm btn-danger-solid" id="sel-delete">Delete</button><button type="button" class="btn btn-sm btn-soft" id="sel-clear">Clear</button><span class="hint">${DEL_HINT} to delete · Right-click for options · Esc to clear</span></div>
        <p class="hint sel-tip">Tip: drag across cards to select several. ${IS_MAC ? '⌘' : 'Ctrl'}+A selects all.</p>
        <div class="gallery-area"><div class="grid">${list.map(card).join('')}</div></div>`}
  `;
  bindGallerySelect();
  app.querySelectorAll('[data-filter]').forEach((sel) => {
    sel.addEventListener('change', () => { filters[sel.dataset.filter] = sel.value; renderGallery(); });
  });
  app.querySelector('#clear-search')?.addEventListener('click', (e) => {
    e.preventDefault(); searchText = ''; document.querySelector('#search input').value = ''; renderGallery();
  });
}

function card(t) {
  const thumb = t.images?.[0]?.f;
  const tags = [t.model_name || t.setup_name, ...t.confirmations].filter(Boolean).join(' · ');
  const plan = [t.followed_plan === 'yes' ? pill('Plan', 'win', 'check')
    : t.followed_plan === 'no' ? pill('Broke plan', 'loss', 'cross') : '', t.model_id ? scoreBadge(t) : ''].filter(Boolean).join(' ');
  return `
    <a class="card" href="#/trade/${t.id}" data-ctx-trade="${t.id}" draggable="false">
      <span class="sel-check" aria-hidden="true">${ICON.check}</span>
      <div class="thumb">${thumb ? `<img src="${esc(imgSrc(thumb))}" alt="" loading="lazy" draggable="false">` : 'No chart yet'}</div>
      <div class="body">
        <div class="row">
          <span class="meta">${fmtDate(t.date)} · ${t.quick ? 'Quick entry' : esc(t.symbol || '')} ${t.direction ? (t.direction === 'long' ? 'Long' : 'Short') : ''}</span>
          ${resultPill(t)}
        </div>
        <div class="row meta">
          <span>${esc(accName(t))}</span>
          <span>${t.result_r != null && t.pnl_usd != null ? fmtUsd(t.pnl_usd) : ''}</span>
        </div>
        ${tags ? `<div class="tags">${esc(tags)}</div>` : ''}
        ${plan ? `<div class="tags">${plan}</div>` : ''}
        ${t.mistakes.length ? `<div class="tags">${t.mistakes.map((m) => pill(esc(m), 'loss', 'alert')).join(' ')}</div>` : ''}
      </div>
    </a>`;
}

// ---------- Models (thêm 2026-11-09): tự tạo model, xem model nào thắng ----------
// Gom lệnh theo model. Chỉ lệnh có kết quả, không gồm nhập nhanh (không có checklist).
function modelGroups(list) {
  const rows = list.filter((t) => notQuick(t) && outcomeOf(t) !== 'open');
  const groups = new Map();
  for (const t of rows) {
    const key = t.model_id || 0;
    if (!groups.has(key)) {
      const live = MODELS.find((m) => m.id === key);
      groups.set(key, { id: key, name: key ? (live?.name || `${t.model_name} (deleted)`) : 'No strategy', rows: [] });
    }
    groups.get(key).rows.push(t);
  }
  // Model chưa có lệnh nào vẫn hiện (0 lệnh), "No model" luôn ở cuối
  for (const m of MODELS) if (!groups.has(m.id)) groups.set(m.id, { id: m.id, name: m.name, rows: [] });
  const winPct = (rs) => (rs.length ? pct(rs.filter((t) => outcomeOf(t) === 'win').length, rs.length) : null);
  return [...groups.values()].map((g) => {
    const scores = g.rows.map(modelScore).filter((s) => s != null);
    const full = g.rows.filter((t) => modelScore(t) === 100);
    const part = g.rows.filter((t) => modelScore(t) != null && modelScore(t) < 100);
    return { ...g, n: g.rows.length, win: winPct(g.rows), avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
      fullN: full.length, fullWin: winPct(full), partN: part.length, partWin: winPct(part) };
  }).sort((a, b) => (!a.id) - (!b.id) || b.n - a.n || a.name.localeCompare(b.name))
    .filter((g) => g.id || g.n); // "No model" chỉ hiện khi có lệnh
}
const FEW = 20; // dưới 20 lệnh: chưa đủ để tin
const fewTag = () => ''; // 14/11: chủ dự án bỏ nhãn "few" (dưới 20 lệnh) ở mọi nơi

function modelPerfHTML(list) {
  const gs = modelGroups(list);
  if (!MODELS.length && !gs.some((g) => g.id)) return `<div class="tile-empty"><p>No strategies yet. Save your setup as a strategy, then pick it when you log a trade.</p><a class="btn btn-soft" href="#/strategies">Create a strategy</a></div>`;
  return `<div class="mp-list">${gs.map((g) => `
    <a class="mp-row" href="#/strategies">
      <span class="mp-name">${esc(g.name)}</span>
      <span class="mp-bar"><span style="width:${g.win ?? 0}%"></span></span>
      <b class="mp-win">${g.win != null ? `${g.win}%` : '—'}</b>
      <span class="mp-n">${g.n} trade${g.n === 1 ? '' : 's'} ${fewTag(g.n)}</span>
    </a>`).join('')}</div>`;
}

// Bảng "By condition": mỗi thành phần (đã tick "What I saw") thắng bao nhiêu
function conditionsHTML(list) {
  const rows = list.filter((t) => notQuick(t) && outcomeOf(t) !== 'open' && t.seen?.length);
  const line = (tier, name, g) => `<tr><td class="mc-tier">${tier}</td><td><b>${esc(name)}</b> ${fewTag(g.n)}</td><td class="num">${g.n}</td><td class="num">${g.win != null ? `${g.win}%` : '—'}</td><td class="num ${g.avgR > 0 ? 'win' : g.avgR < 0 ? 'loss' : ''}">${g.avgR != null ? fmtRv(g.avgR) || '0.0R' : '—'}</td></tr>`;
  const body = TIERS.map(([k, , short]) => {
    const names = [...new Set(rows.flatMap((t) => t.seen.filter((x) => splitItem(x)[0] === k && !isTf(x)).map((x) => splitItem(x)[1])))];
    const items = names.map((n) => [n, groupStat(rows.filter((t) => t.seen.includes(`${k}:${n}`)))]).sort((a, b) => b[1].n - a[1].n);
    return items.map(([n, g], i) => line(i ? '' : esc(short), n, g)).join('');
  }).join('');
  return `<section class="tile model-stats">
    <header class="tile-head"><h3>By condition</h3>
      <button type="button" class="info-tip" data-tip="${esc(`For each strategy condition you ticked on your trades (for example OB in Bias, or Sweep in Entry): how many trades had it, how many of them won, and the average R.\nAvg R matters as much as Win %: 40% wins at +3R beats 60% wins at +0.5R.\nUnder ${FEW} trades the numbers can be luck.`)}" aria-label="What is By condition?">${ICON.info}</button>
    </header>
    ${body ? `<div class="table-wrap flat"><table class="table cond-table"><thead><tr><th></th><th>Condition</th><th class="num">Trades</th><th class="num">Win %</th><th class="num">Avg R</th></tr></thead><tbody>${body}</tbody></table></div>`
      : '<div class="tile-empty"><p>No ticks yet. Pick a strategy when you log a trade and tick the conditions you saw. This table fills in by itself.</p></div>'}
  </section>`;
}

let editingModel = null; // null | 'new' | id
let editingStep = null; // null | 'new' | id bước đang sửa

// "My steps": các bước chủ dự án tự đặt (tên, khung giờ, thành phần)
function stepsHTML() {
  const editor = (st) => `
    <form class="step-form" data-step-form="${st ? st.id : 'new'}" autocomplete="off">
      <label>Step name <input name="name" maxlength="24" value="${esc(st?.name || '')}" placeholder="e.g. Bias, Structure, Entry" required></label>
      <div><div class="field-label">Conditions <span class="hint">· click one to remove it</span></div>
        <div class="chips" data-step-items>${(st?.items || []).map((v) => `<button type="button" class="chip on" aria-pressed="true" data-value="${esc(v)}">${esc(v)}</button>`).join('')}<input class="chip-add" maxlength="36" placeholder="+ Add" aria-label="Add a condition"></div></div>
      <p class="error" role="alert" hidden></p>
      <div class="form-actions">
        ${st && STEPS.length > 1 ? '<button type="button" class="btn btn-soft btn-danger" data-step-del>Delete step</button><span style="flex:1"></span>' : ''}
        <button type="button" class="btn" data-step-cancel>Cancel</button><button class="btn btn-primary" type="submit">Save step</button>
      </div>
    </form>`;
  return `<section class="tile steps-tile">
    <header class="tile-head"><h3>My steps</h3>
      <button type="button" class="info-tip" data-tip="${esc('Your list of conditions, grouped in steps from big picture to entry. For example: Bias → Structure → Entry.\nName the steps your way and list what you look for in each one.\nYou build your models from these conditions.')}" aria-label="What are steps?">${ICON.info}</button>
      ${editingStep || STEPS.length >= 5 ? '' : '<button type="button" class="btn btn-soft btn-sm tile-link" data-step-new>+ Add step</button>'}
    </header>
    <ol class="steps-list">${STEPS.map((st) => (editingStep === st.id ? `<li class="editing">${editor(st)}</li>` : `
      <li><div class="step-main"><b>${esc(st.name)}</b>
        <div class="hint">${st.items.length ? st.items.map(esc).join(' · ') : 'No conditions yet'}</div></div>
        <button type="button" class="btn btn-soft btn-sm" data-step-edit="${st.id}">Edit</button></li>`)).join('')}
      ${editingStep === 'new' ? `<li class="editing">${editor(null)}</li>` : ''}</ol>
  </section>`;
}
function bindSteps() {
  app.querySelector('[data-step-new]')?.addEventListener('click', () => { editingStep = 'new'; renderModels(); });
  app.querySelectorAll('[data-step-edit]').forEach((b) => b.addEventListener('click', () => { editingStep = b.dataset.stepEdit; renderModels(); }));
  const f = app.querySelector('[data-step-form]');
  if (!f) return;
  const err = f.querySelector('.error');
  const show = (m) => { err.textContent = m; err.hidden = false; };
  f.querySelector('[data-step-cancel]').addEventListener('click', () => { editingStep = null; renderModels(); });
  const box = f.querySelector('[data-step-items]');
  box.addEventListener('click', (e) => { const c = e.target.closest('.chip'); if (c) { c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on')); } });
  box.addEventListener('keydown', (e) => {
    if (!e.target.classList.contains('chip-add') || e.key !== 'Enter') return;
    e.preventDefault();
    const v = e.target.value.trim(); e.target.value = '';
    if (!v || v.includes(':') || v.startsWith('@')) return;
    let c = [...box.querySelectorAll('.chip')].find((x) => x.dataset.value.toLowerCase() === v.toLowerCase());
    if (!c) { e.target.insertAdjacentHTML('beforebegin', `<button type="button" class="chip" data-value="${esc(v)}">${esc(v)}</button>`); c = e.target.previousElementSibling; }
    c.classList.add('on'); c.setAttribute('aria-pressed', 'true');
  });
  const usedBy = (id) => MODELS.filter((m) => m.items.some((x) => splitItem(x)[0] === id));
  f.querySelector('[data-step-del]')?.addEventListener('click', async () => {
    const id = f.dataset.stepForm;
    const used = usedBy(id);
    if (used.length) return show(`${used.map((m) => m.name).join(', ')} still use this step. Edit or delete ${used.length === 1 ? 'that model' : 'those models'} first.`);
    const ok = await askDialog({ title: 'Delete this step?', body: 'Trades you already logged keep what you ticked, but this step will no longer show in forms and tables.', actions: [{ label: 'Delete step', value: 'yes', danger: true }] });
    if (!ok) return;
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ steps: STEPS.filter((x) => x.id !== id) }) });
      setSteps(STEPS.filter((x) => x.id !== id)); editingStep = null; toast('Step deleted'); renderModels();
    } catch (ex) { show(ex.message); }
  });
  f.name.focus();
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = f.name.value.trim();
    const tfs = []; // khung giờ đã bỏ (chủ dự án chốt 09/11)
    const items = [...box.querySelectorAll('.chip.on')].map((c) => c.dataset.value);
    if (!name) return show('Give the step a name, like Bias or Entry.');
    const isNew = editingStep === 'new';
    if (STEPS.some((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== editingStep)) return show('You already have a step with this name.');
    // Điều kiện đang được model dùng thì không cho bỏ (model sẽ mất điều kiện)
    if (!isNew) {
      const old = STEPS.find((x) => x.id === editingStep);
      const removed = old.items.filter((v) => !items.includes(v));
      const hit = MODELS.filter((m) => removed.some((v) => m.items.includes(`${old.id}:${v}`)));
      if (hit.length) return show(`${hit.map((m) => m.name).join(', ')} still need${hit.length === 1 ? 's' : ''} ${removed.filter((v) => hit.some((m) => m.items.includes(`${old.id}:${v}`))).join(', ')}. Edit the model first.`);
    }
    let id = editingStep;
    if (isNew) { let n = 1; while (STEPS.some((x) => x.id === `s${n}`)) n += 1; id = `s${n}`; }
    const next = isNew ? [...STEPS, { id, name, tfs, items }] : STEPS.map((x) => (x.id === id ? { id, name, tfs, items } : x));
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ steps: next }) });
      setSteps(next); editingStep = null; toast(`Saved ${name}`); renderModels();
    } catch (ex) { show(ex.message); }
  });
}
let newPrefill = null; // điều kiện điền sẵn khi tạo model mới (hiện chưa dùng, để trống)
// Số liệu của một nhóm lệnh: số lệnh, Win %, R trung bình, $ tổng
function groupStat(rows) {
  const r = rows.filter((t) => t.result_r != null);
  return { n: rows.length, win: rows.length ? pct(rows.filter((t) => outcomeOf(t) === 'win').length, rows.length) : null,
    avgR: r.length ? r.reduce((a, t) => a + t.result_r, 0) / r.length : null,
    net: rows.some((t) => t.pnl_usd != null) ? rows.reduce((a, t) => a + (t.pnl_usd || 0), 0) : null };
}
// ---------- Editor model (11/11): model = công thức theo trình tự Daily → HTF → Structure → Entry ----------
// chủ dự án tick những gì thuộc model, tự thêm PDA / khung giờ mới bằng "+ Add". Chọn model ở lệnh mới thì form tự điền theo công thức.
let modelDraft = null; // bản nháp đang sửa: { name, dols, pdas, pda_tf, structure, confirmations, entry_tf }
const RECIPE_KEYS = ['dols', 'pdas', 'pda_tf', 'structure', 'confirmations', 'entry_tf'];
const blankRecipe = () => ({ dols: [], pdas: [], pda_tf: [], structure: [], confirmations: [], entry_tf: [] });
const ME_CFG = {
  dols: { list: () => DOLS, set: (a) => { DOLS = a; }, key: 'dols' },
  pdas: { list: () => PDAS, set: (a) => { PDAS = a; }, key: 'pdas' },
  pda_tf: { list: () => PDA_TFS, set: (a) => { PDA_TFS = a; }, key: 'pda_tfs', tf: true },
  structure: { list: () => ['bullish', 'bearish', 'sideways'], fixed: true },
  confirmations: { list: () => CONFIRMATIONS, set: (a) => { CONFIRMATIONS = a; }, key: 'confirmations' },
  entry_tf: { list: () => ENTRY_TFS, set: (a) => { ENTRY_TFS = a; }, key: 'entry_tfs', tf: true },
};
// Một dòng tóm tắt công thức, VD "FVG, OB · H4 + H1 → Bullish → MSS · M1"
function recipeLine(r) {
  if (!r) return '';
  const tf = (a) => (a?.length ? ` · ${a.join(' + ')}` : '');
  return [(r.dols || []).join(', '), r.pdas?.length ? `${r.pdas.join(', ')}${tf(r.pda_tf)}` : '',
    (r.structure || []).map(cap1).join(' / '), r.confirmations?.length ? `${r.confirmations.join(', ')}${tf(r.entry_tf)}` : ''].filter(Boolean).join(' → ');
}
function modelEditorHTML() {
  const g = (key) => `<div class="chips" data-me="${key}"></div>`;
  const step = (n, rows) => `<div class="su-step"><span class="su-num">${n}</span><div class="su-body">${rows.map(([label, key]) => `<div class="su-row"><span class="su-label">${label}</span>${g(key)}</div>`).join('')}</div></div>`;
  return `<form class="tile model-editor" data-model-form="${editingModel}" autocomplete="off">
    <header class="tile-head"><h3>${editingModel === 'new' ? 'New strategy' : 'Edit strategy'}</h3></header>
    <label>Strategy name <input name="name" maxlength="40" value="${esc(modelDraft.name)}" placeholder="e.g. Strategy 2022"></label>
    <p class="hint">Pick what belongs to this strategy, in the order you trade it. When you choose the strategy on a new trade, these are filled in for you. You can still change them on each trade.</p>
    ${step(1, [['Daily target', 'dols']])}
    ${step(2, [['HTF PDA', 'pdas'], ['Timeframe', 'pda_tf']])}
    ${step(3, [['Structure', 'structure']])}
    ${step(4, [['Entry signal', 'confirmations'], ['Entry on', 'entry_tf']])}
    <p class="error" role="alert" hidden></p>
    <div class="form-actions"><button type="button" class="btn" data-model-cancel>Cancel</button><button type="submit" class="btn btn-primary">Save strategy</button></div>
  </form>`;
}
function bindModelEditor(show) {
  const f = app.querySelector('.model-editor');
  if (!f || !modelDraft) return;
  const d = modelDraft;
  // Số liệu của từng PDA từ mọi lệnh đã có kết quả (có model hay không đều tính), để chọn PDA cho model dựa trên số liệu
  const pdaStat = (() => {
    const closed = trades.filter((t) => notQuick(t) && outcomeOf(t) !== 'open');
    const g = groupBy(closed, (t) => t.pdas || []); const m = new Map();
    g.forEach((list, k) => { const s = groupStat(list); m.set(k, `${s.win == null ? '—' : `${s.win}%`} · ${s.n}`); });
    return m;
  })();
  f.querySelectorAll('[data-me]').forEach((box) => {
    const key = box.dataset.me; const cfg = ME_CFG[key];
    const paint = () => {
      const all = [...new Set([...cfg.list(), ...d[key]])];
      box.innerHTML = all.map((v) => `<span class="chip-wrap"><button type="button" class="chip ${d[key].includes(v) ? 'on' : ''}" aria-pressed="${d[key].includes(v)}" data-value="${esc(v)}">${esc(cfg.fixed ? cap1(v) : v)}${key === 'pdas' && pdaStat.has(v) ? `<span class="chip-stat" title="Win % and number of trades with this PDA">${esc(pdaStat.get(v))}</span>` : ''}</button>${cfg.fixed ? '' : `<button type="button" class="chip-x" data-remove="${esc(v)}" aria-label="Remove ${esc(v)} from the list" title="Remove from the list">×</button>`}</span>`).join('')
        + (cfg.fixed ? '' : `<input class="chip-add" maxlength="${cfg.tf ? 8 : 40}" placeholder="+ Add" aria-label="Add your own">`);
    };
    // Xoá hẳn một lựa chọn khỏi danh sách (lệnh và model đã dùng nó vẫn giữ giá trị cũ). Dùng cho dấu × và chuột phải → Delete.
    const removeOption = async (v) => {
      const ok = await askDialog({ title: `Remove ${esc(v)}?`, body: 'It will no longer show as an option. Trades and strategies that already use it keep it. You can add it again any time.', actions: [{ label: 'Remove', value: 'yes', danger: true }] });
      if (!ok) return;
      d[key] = d[key].filter((y) => y !== v);
      paint();
      removeListItem(cfg.key, v).then(paint).catch((ex) => show(`Not saved to your list: ${ex.message}`));
    };
    box.addEventListener('contextmenu', (e) => {
      const c = e.target.closest('.chip');
      if (!c || cfg.fixed) return;
      e.preventDefault(); e.stopPropagation(); // không để menu chuột phải chung của trang đóng mất menu này
      showMenu(e.clientX, e.clientY, [{ act: 'delete', label: 'Delete', danger: true }], () => removeOption(c.dataset.value));
    });
    box.addEventListener('click', async (e) => {
      const x = e.target.closest('.chip-x');
      if (x) { removeOption(x.dataset.remove); return; }
      const b = e.target.closest('.chip'); if (!b) return;
      const v = b.dataset.value;
      d[key] = d[key].includes(v) ? d[key].filter((x) => x !== v) : [...d[key], v];
      paint();
    });
    // "+ Add": chọn luôn và nhớ vào danh sách chung (Settings) để lần sau còn
    const addFrom = (input, refocus) => {
      const v = input.value.trim().slice(0, cfg.tf ? 8 : 40);
      if (!v || v.includes(':')) return;
      const same = cfg.list().find((x) => x.toLowerCase() === v.toLowerCase()) || v;
      if (!d[key].includes(same)) d[key].push(same);
      if (!cfg.list().some((x) => x.toLowerCase() === same.toLowerCase())) {
        const next = [...cfg.list(), same]; cfg.set(next);
        api('/api/settings', { method: 'PUT', body: JSON.stringify({ [cfg.key]: next }) }).catch((ex) => show(`Not saved to your list: ${ex.message}`));
      }
      paint();
      if (refocus) box.querySelector('.chip-add')?.focus();
    };
    box.addEventListener('keydown', (e) => { if (e.target.classList.contains('chip-add') && e.key === 'Enter') { e.preventDefault(); addFrom(e.target, true); } });
    box.addEventListener('focusout', (e) => { if (e.target.classList.contains('chip-add')) addFrom(e.target, false); });
    box.addEventListener('rj-repaint', paint); // hoàn tác một lựa chọn đã xoá thì vẽ lại
    paint();
  });
}

// ---------- Models + Review (10/11) ----------
// Model chỉ là tên để nhóm lệnh. Trang này để review cuối tuần / cuối tháng:
// Win % theo model, theo M15 có thuận HTF không, theo PDA, khung giờ PDA, khung vào lệnh, Entry Confirmation, Daily target.
let reviewOffset = 0; // 0 = kỳ hiện tại, 1 = kỳ trước…
function reviewRange(per, off) {
  if (per === 'all') return { test: () => true, label: 'All time' };
  if (per === 'month') {
    const [y, m] = todayStr().split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - off, 1));
    const key = d.toISOString().slice(0, 7);
    return { test: (t) => t.date.slice(0, 7) === key, label: cap1(d.toLocaleDateString((window.I18N?.locale || 'en-US'), { month: 'long', year: 'numeric', timeZone: 'UTC' })) };
  }
  const ws = new Date(`${weekStart()}T00:00:00Z`); ws.setUTCDate(ws.getUTCDate() - 7 * off);
  const we = new Date(ws); we.setUTCDate(we.getUTCDate() + 6);
  const a = ws.toISOString().slice(0, 10); const b = we.toISOString().slice(0, 10);
  return { test: (t) => t.date >= a && t.date <= b, label: `${fmtDate(a)} – ${fmtDate(b)}` };
}
// Gom lệnh theo nhãn (một lệnh có thể thuộc nhiều nhãn, VD 2 PDA)
function groupBy(rows, keysOf) {
  const m = new Map();
  rows.forEach((t) => keysOf(t).forEach((k) => { if (k) { if (!m.has(k)) m.set(k, []); m.get(k).push(t); } }));
  return m;
}
let modelsMode = 'review'; // 'strategies' = trang Strategies (thẻ + editor), 'review' = trang Review (số liệu + Breakdown)
let reviewTab = 'pda'; // tab đang mở trong Breakdown (mở sẵn PDA: cuối tuần/tháng xem PDA nào thắng nhiều nhất)
const hourLabel = (time) => { const h = String(parseInt(time, 10)).padStart(2, '0'); const n = String((parseInt(time, 10) + 1) % 24).padStart(2, '0'); return `${h}:00–${n}:00`; };
function renderModels() {
  const closedOf = (rows) => rows.filter((t) => notQuick(t) && outcomeOf(t) !== 'open');
  const strat = modelsMode === 'strategies';
  // Trang Strategies luôn xem toàn bộ thời gian; trang Review theo Week/Month/All
  const per = strat ? 'all' : period; const off = strat ? 0 : reviewOffset;
  const cur = reviewRange(per, off);
  const prev = per === 'all' ? null : reviewRange(per, off + 1);
  const rows = closedOf(trades.filter(cur.test));
  const prows = prev ? closedOf(trades.filter(prev.test)) : [];
  const pc = (v) => (v == null ? '—' : `${v}%`);
  const rv = (v) => (v == null ? '—' : fmtRv(v) || '0.0R');
  const usd = (v) => (v == null ? '—' : fmtUsd(v) || '$0');
  const tone = (v) => (v > 0 ? 'win' : v < 0 ? 'loss' : '');
  const delta = (now, before) => {
    if (now == null || before == null || !prev) return '';
    const d = now - before;
    return d === 0 ? '<span class="delta">= prev</span>' : `<span class="delta ${d > 0 ? 'win' : 'loss'}" title="Win % change vs the previous period">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} pts</span>`;
  };
  const bar = (v) => `<span class="rv-bar"><span style="width:${v ?? 0}%"></span></span>`;
  const all = groupStat(rows); const pall = prev ? groupStat(prows) : null;

  // Thẻ model: mọi model đã tạo + "No model" nếu có lệnh
  const modelKey = (t) => t.model_id || 0;
  const mg = groupBy(rows, (t) => [String(modelKey(t))]); const pmg = groupBy(prows, (t) => [String(modelKey(t))]);
  const cards = [...MODELS.map((m) => ({ id: m.id, name: m.name })),
    ...[...mg.keys()].filter((k) => k !== '0' && !MODELS.some((m) => String(m.id) === k)).map((k) => ({ id: Number(k), name: `${mg.get(k)[0].model_name} (deleted)`, gone: true })),
    ...(mg.has('0') ? [{ id: 0, name: 'No strategy', none: true }] : [])];
  const cardHTML = (c) => {
    const s = groupStat(mg.get(String(c.id)) || []); const p = pmg.has(String(c.id)) ? groupStat(pmg.get(String(c.id))) : null;
    const recipe = recipeLine(MODELS.find((m) => m.id === c.id)?.recipe);
    const tip = c.none ? 'See these trades and pick a strategy for each' : c.gone ? 'Restore this strategy or move its trades to No strategy' : 'Click to edit this strategy';
    return `<div class="m-card ${c.none ? 'none' : ''} ${c.gone ? 'gone' : ''} ${editingModel === c.id ? 'is-editing' : ''}" ${strat ? `data-card="${c.none ? 'none' : c.gone ? 'gone' : 'edit'}" data-card-id="${c.id}" role="button" tabindex="0" title="${tip}"` : ''}>
      <header><b title="${esc(c.name)}">${esc(c.name)}</b>${c.none ? '' : `<button type="button" class="m-more" ${c.gone ? `data-gone-menu="${c.id}"` : `data-model-menu="${c.id}"`} aria-label="Options for ${esc(c.name)}">⋯</button>`}</header>
      <p class="m-recipe" ${recipe ? `title="${esc(recipe)}"` : 'aria-hidden="true"'}>${recipe ? esc(recipe) : '&nbsp;'}</p>
      <div class="m-win"><span>${pc(s.win)}</span><small>win</small></div>
      ${bar(s.win)}
      <p class="m-line">${s.n} trade${s.n === 1 ? '' : 's'} · <span class="${tone(s.avgR)}">${rv(s.avgR)}</span> · <span class="${tone(s.net)}">${usd(s.net)}</span></p>
      <p class="m-line">${s.n ? (fewTag(s.n) || delta(s.win, p?.win) || '&nbsp;') : `<span class="hint">${strat ? 'No trades yet' : 'No trades in this period'}</span>`}</p>
    </div>`;
  };

  // Review (14/11, chủ dự án chốt): bỏ 6 tab, thay bằng 4 khối xếp dọc, mỗi khối 1 câu kết luận + bảng: Strategy · PDA · Mistakes · Session & Time
  const stratName = (k) => { if (k === '0') return 'No strategy'; const m = MODELS.find((x) => String(x.id) === k); return m ? m.name : `${(mg.get(k) || [])[0]?.model_name || 'Strategy'} (deleted)`; };
  const byWin = (g) => (a, b) => { const A = groupStat(g.get(a)); const B = groupStat(g.get(b)); return (B.win ?? -1) - (A.win ?? -1) || B.n - A.n || (B.avgR ?? -99) - (A.avgR ?? -99); };
  const table = (g, pgx, keys, nameOf, cols = 'full') => `<div class="rv-rows ${cols === 'short' ? 'short' : ''}">
      <div class="rv-row head"><span></span><span>Win %</span><span class="num">Trades</span>${cols === 'short' ? '' : '<span class="num">Avg R</span>'}<span class="num">Net</span>${prev && cols !== 'short' ? '<span class="num">vs prev</span>' : ''}</div>
      ${keys.map((k) => { const st = groupStat(g.get(k)); const p = pgx?.has(k) ? groupStat(pgx.get(k)) : null; return `<div class="rv-row">
        <span class="rv-name">${esc(nameOf(k))} ${fewTag(st.n)}</span>
        <span class="rv-winc">${bar(st.win)}<b>${pc(st.win)}</b></span>
        <span class="num">${st.n}</span>${cols === 'short' ? '' : `<span class="num ${tone(st.avgR)}">${rv(st.avgR)}</span>`}<span class="num ${tone(st.net)}">${usd(st.net)}</span>
        ${prev && cols !== 'short' ? `<span class="num">${delta(st.win, p?.win) || '<span class="hint">—</span>'}</span>` : ''}</div>`; }).join('')}
    </div>`;
  const bestOf = (g, keys, nameOf) => { if (!keys.length) return ''; const k = keys.slice().sort(byWin(g))[0]; const st = groupStat(g.get(k)); return `Best: <b>${esc(nameOf(k))}</b> · ${pc(st.win)} win · ${st.n} trade${st.n === 1 ? '' : 's'} ${fewTag(st.n)}`; };
  const block = (num, title, info, lead, body) => `<section class="tile rv-block">
      <header class="tile-head"><h3>${num} · ${title}</h3><button type="button" class="info-tip" data-tip="${esc(`${info}\nQuick entries (day totals) are not counted.`)}" aria-label="What is this?">${ICON.info}</button></header>
      ${lead ? `<p class="rv-lead">${lead}</p>` : ''}
      ${body}
    </section>`;
  const emptyP = (txt) => `<div class="tile-empty"><p>${txt}</p></div>`;
  // 1 · Strategy
  const sKeys = [...mg.keys()].sort(byWin(mg));
  const b1 = block(1, 'Strategy', 'Win % of each strategy you picked on your trades. Trades with no strategy have their own row.', bestOf(mg, sKeys, stratName), table(mg, pmg, sKeys, stratName));
  // 2 · PDA
  const pdg = groupBy(rows, (t) => t.pdas || []); const ppdg = groupBy(prows, (t) => t.pdas || []);
  const pKeys = [...pdg.keys()].sort(byWin(pdg));
  const b2 = block(2, 'PDA', 'Win % of each HTF PDA you ticked, with or without a strategy. A trade with 2 PDAs counts in both rows.', bestOf(pdg, pKeys, (k) => k),
    pKeys.length ? table(pdg, ppdg, pKeys, (k) => k) : emptyP('No trades with a PDA ticked yet. Tick the HTF PDA in the Setup block when you log a trade.'));
  // 3 · Mistakes: lỗi nào làm mất tiền nhiều nhất, so với lệnh sạch (không lỗi)
  const mkg = groupBy(rows, (t) => t.mistakes || []);
  const mKeys = [...mkg.keys()].sort((a, b) => groupStat(mkg.get(a)).net - groupStat(mkg.get(b)).net || mkg.get(b).length - mkg.get(a).length);
  const withM = rows.filter((t) => (t.mistakes || []).length); const clean = rows.filter((t) => !(t.mistakes || []).length);
  const lossOf = (list) => list.reduce((sum, t) => sum + (t.pnl_usd < 0 ? t.pnl_usd : 0), 0);
  const mCost = lossOf(withM); const cs = groupStat(clean); const ms = groupStat(withM);
  const worst = mKeys[0]; const worstLoss = worst ? lossOf(mkg.get(worst)) : 0;
  const mLead = !withM.length ? (rows.length ? 'No mistakes logged in this period. Keep it up.' : '')
    : `${mCost < 0 ? `Mistakes cost you <b class="loss">${usd(mCost)}</b> in losing trades.` : 'Trades with mistakes did not lose money this time.'}${worst && worstLoss < 0 ? ` Biggest leak: <b>${esc(worst)}</b> (<span class="loss">${usd(worstLoss)}</span>).` : ''}`;
  const mBody = mKeys.length ? `${table(mkg, groupBy(prows, (t) => t.mistakes || []), mKeys, (k) => k)}
      <div class="rv-compare">
        <div><small>Clean trades (no mistake)</small><b>${pc(cs.win)} win</b><span class="hint">${cs.n} trade${cs.n === 1 ? '' : 's'} · <span class="${tone(cs.net)}">${usd(cs.net)}</span></span></div>
        <div><small>Trades with a mistake</small><b>${pc(ms.win)} win</b><span class="hint">${ms.n} trade${ms.n === 1 ? '' : 's'} · <span class="${tone(ms.net)}">${usd(ms.net)}</span></span></div>
      </div>` : emptyP('No mistakes ticked on trades in this period.');
  const b3 = block(3, 'Mistakes', 'Each mistake you ticked on your trades, worst Net first. Net = total $ of the trades with that mistake. A trade with 2 mistakes counts in both rows.', mLead, mBody);
  // 4 · Session & Time: bảng phiên + giờ tốt nhất / tệ nhất (không hiện đủ 24 giờ cho gọn)
  const sg = groupBy(rows, (t) => (t.session ? [t.session] : [])); const psg = groupBy(prows, (t) => (t.session ? [t.session] : []));
  const sesKeys = [...sg.keys()].sort(byWin(sg));
  const hg = groupBy(rows, (t) => (/^\d{1,2}:\d{2}/.test(t.time || '') ? [hourLabel(t.time)] : []));
  const hKeys = [...hg.keys()].sort(byWin(hg));
  const hourLine = (label, k) => { const st = groupStat(hg.get(k)); return `<p class="rv-hour"><small>${label}</small><b>${esc(k)}</b> · ${pc(st.win)} win · ${st.n} trade${st.n === 1 ? '' : 's'} · <span class="${tone(st.net)}">${usd(st.net)}</span> ${fewTag(st.n)}</p>`; };
  const hours = hKeys.length ? `<div class="rv-hours">${hourLine('Best hour', hKeys[0])}${hKeys.length > 1 ? hourLine('Worst hour', hKeys[hKeys.length - 1]) : ''}</div>` : '';
  const b4 = block(4, 'Session &amp; Time', 'Uses the Session and Time you enter on each trade. Hours are grouped, for example 07:00–08:00. Trades without a time are left out of the hours.',
    bestOf(sg, sesKeys, (k) => k), sesKeys.length || hKeys.length ? `${sesKeys.length ? table(sg, psg, sesKeys, (k) => k) : ''}${hours}` : emptyP('No trades with a session or time yet.'));
  const reviewBlocks = rows.length ? `${b1}${b2}${b3}${b4}` : `<section class="tile">${emptyP(`No closed trades in ${esc(cur.label)}.${period !== 'all' ? ' Use ‹ to look at an earlier period.' : ''}`)}</section>`;

  app.innerHTML = `
    <div class="page-head rv-head">
      <div>${strat ? '<h1>Strategies</h1><p>Build your strategies step by step, then see how each one performs.</p>' : '<h1>Review</h1><p>Look back at a week or a month: which strategy, PDA, mistakes and hours really matter for you.</p>'}</div>
      ${strat ? '' : `<div class="review-bar">
        <div class="segmented" role="group" aria-label="Period">
          ${[['week', 'Week'], ['month', 'Month'], ['all', 'All']].map(([v, l]) => `<button type="button" data-period="${v}" class="${period === v ? 'on' : ''}" aria-pressed="${period === v}">${l}</button>`).join('')}
        </div>
        <div class="rv-nav">
          ${period === 'all' ? '' : `<button type="button" class="rv-arrow" data-rv="1" aria-label="Previous ${period}">‹</button>`}
          <b class="rv-label">${esc(cur.label)}</b>
          ${period === 'all' ? '' : `<button type="button" class="rv-arrow" data-rv="-1" aria-label="Next ${period}" ${reviewOffset === 0 ? 'disabled' : ''}>›</button>`}
          ${reviewOffset ? '<button type="button" class="btn btn-soft btn-sm" data-rv="0">Now</button>' : ''}
        </div>
      </div>`}
    </div>

    ${strat ? '' : `<section class="tile rv-summary">
      <div><small>Trades</small><b>${all.n}</b><span class="hint">${pall ? `prev ${pall.n}` : '&nbsp;'}</span></div>
      <div><small>Win %</small><b>${pc(all.win)}</b>${pall ? delta(all.win, pall.win) || '<span class="hint">&nbsp;</span>' : '<span class="hint">&nbsp;</span>'}</div>
      <div><small>Avg R</small><b class="${tone(all.avgR)}">${rv(all.avgR)}</b><span class="hint">${pall ? `prev ${rv(pall.avgR)}` : '&nbsp;'}</span></div>
      <div><small>Net</small><b class="${tone(all.net)}">${usd(all.net)}</b><span class="hint">${pall ? `prev ${usd(pall.net)}` : '&nbsp;'}</span></div>
    </section>`}

    ${strat && loadTradeDraft() ? `<div class="draft-banner" role="status"><span>Your trade in progress is saved. Pick up where you left off.</span><span class="draft-actions"><a class="btn btn-primary btn-sm" href="${esc(loadTradeDraft().route)}">Back to your trade</a><button type="button" class="btn btn-soft btn-sm" data-draft-discard>Discard</button></span></div>` : ''}
    ${strat ? `
    ${editingModel !== null && modelDraft ? modelEditorHTML() : ''}
    <div class="m-cards">
      ${cards.map(cardHTML).join('')}
      ${editingModel === null ? '<button type="button" class="m-card m-new" data-model-new><span>+</span>New strategy</button>' : ''}
    </div>
    <p class="error rv-error" role="alert" hidden></p>` : ''}

    ${strat ? '' : reviewBlocks}`;

  app.querySelector('[data-draft-discard]')?.addEventListener('click', () => { clearTradeDraft(); renderModels(); });
  app.querySelectorAll('[data-period]').forEach((b) => b.addEventListener('click', () => { period = b.dataset.period; reviewOffset = 0; renderModels(); }));
  app.querySelectorAll('[data-rv]').forEach((b) => b.addEventListener('click', () => { const n = Number(b.dataset.rv); reviewOffset = n === 0 ? 0 : Math.max(0, reviewOffset + n); renderModels(); }));
  const err = app.querySelector('.rv-error');
  const show = (m) => { err.textContent = m; err.hidden = false; };
  app.querySelector('[data-model-new]')?.addEventListener('click', () => { editingModel = 'new'; modelDraft = { name: '', ...blankRecipe() }; renderModels(); app.querySelector('.model-editor')?.scrollIntoView({ block: 'center' }); app.querySelector('.model-editor input[name="name"]')?.focus(); });
  app.querySelector('[data-model-cancel]')?.addEventListener('click', () => { editingModel = null; modelDraft = null; renderModels(); });
  if (strat) bindModelEditor(show);
  // Xoá strategy (14/11, chủ dự án: những gì đã xoá luôn vào thùng rác): strategy vào Trash 30 ngày, các lệnh của nó về "No strategy". Restore hoặc ⌘Z thì gắn lại.
  const delModel = async (m) => {
    const linked = allTrades.filter((t) => t.model_id === m.id);
    const ok = await askDialog({ title: `Delete ${esc(m.name)}?`, body: `It goes to Trash for 30 days.${linked.length ? ` Its ${linked.length} trade${linked.length === 1 ? '' : 's'} move${linked.length === 1 ? 's' : ''} to No strategy until you restore it.` : ''} Press ${IS_MAC ? '⌘' : 'Ctrl+'}Z to bring it back.`, actions: [{ label: 'Delete strategy', value: 'yes', danger: true }] });
    if (!ok) return;
    try {
      const at = MODELS.findIndex((x) => x.id === m.id);
      for (const t of linked) await api(`/api/trades/${t.id}/strategy`, { method: 'PUT', body: JSON.stringify({ model_id: null }) });
      const entry = { ...JSON.parse(JSON.stringify(m)), deleted_at: utcStamp(), trades: linked.map((t) => ({ id: t.id, items: t.model_items || [], checks: t.model_checks || [] })) };
      const next = MODELS.filter((x) => x.id !== m.id); const nt = [...MODELS_TRASH.filter((x) => x.id !== m.id), entry];
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ models: next, models_trash: nt }) });
      MODELS = next; MODELS_TRASH = nt;
      if (editingModel === m.id) { editingModel = null; modelDraft = null; }
      await loadTrades(); trades = applyScope(allTrades); renderModels();
      pushUndo(`Deleted strategy ${m.name}`, [{ kind: 'model', id: m.id, i: at }]);
    } catch (ex) { toast(ex.message); }
  };
  const editModel = (m) => { editingModel = m.id; modelDraft = { name: m.name, ...blankRecipe(), ...JSON.parse(JSON.stringify(m.recipe || {})) }; renderModels(); app.querySelector('.model-editor')?.scrollIntoView({ block: 'center' }); app.querySelector('.model-editor input[name="name"]')?.select(); };
  app.querySelectorAll('[data-model-menu]').forEach((b) => b.addEventListener('click', (ev) => {
    ev.stopPropagation(); // không để cú bấm này đóng luôn menu vừa mở
    const m = MODELS.find((x) => x.id === Number(b.dataset.modelMenu));
    const r = b.getBoundingClientRect();
    showMenu(r.left, r.bottom + 4, [{ act: 'edit', label: 'Edit' }, { act: 'delete', label: 'Delete', danger: true }], (act) => {
      if (act === 'edit') editModel(m);
      if (act === 'delete') delModel(m);
    });
  }));
  // Strategy đã xoá nhưng còn lệnh dùng (14/11): tạo lại cùng tên, hoặc gỡ các lệnh về "No strategy" (có ⌘Z)
  const goneTrades = (id) => allTrades.filter((t) => t.model_id === id);
  const restoreGone = async (id) => {
    const ts = goneTrades(id); if (!ts.length) return;
    const src = ts.slice().sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    let name = src.model_name || 'Strategy';
    if (MODELS.some((m) => m.name.toLowerCase() === name.toLowerCase())) name = `${name} (restored)`;
    const next = [...MODELS, { id, name, items: [...(src.model_items || [])] }];
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ models: next }) });
      MODELS = next; renderModels();
      pushUndo(`Restored strategy ${name}`, [{ kind: 'unmodel', id }]);
      toast(`Restored ${name}. Its recipe was not kept, click the card to fill it in again.`);
    } catch (ex) { toast(ex.message); }
  };
  const clearGone = async (id) => {
    const ts = goneTrades(id); if (!ts.length) return;
    const name = ts[0].model_name || 'this strategy';
    const ok = await askDialog({ title: `Move ${ts.length} trade${ts.length === 1 ? '' : 's'} to No strategy?`, body: `These trades will no longer show “${esc(name)} (deleted)”. Everything else on them stays the same. You can undo with ⌘Z.`, actions: [{ label: 'Move to No strategy', value: 'yes' }] });
    if (!ok) return;
    const undo = [];
    try {
      for (const t of ts) {
        await api(`/api/trades/${t.id}/strategy`, { method: 'PUT', body: JSON.stringify({ model_id: null }) });
        undo.push({ kind: 'tmodel', id: t.id, model_id: t.model_id, model_name: t.model_name, model_items: t.model_items || [], model_checks: t.model_checks || [] });
      }
    } catch (ex) { toast(ex.message); }
    if (undo.length) pushUndo(`Moved ${undo.length} trade${undo.length === 1 ? '' : 's'} to No strategy`, undo);
    await loadTrades(); trades = applyScope(allTrades); renderModels();
  };
  const goneMenu = (id, x, y) => showMenu(x, y, [{ act: 'restore', label: 'Restore strategy' }, { act: 'clear', label: 'Move trades to No strategy' }], (act) => { if (act === 'restore') restoreGone(id); if (act === 'clear') clearGone(id); });
  app.querySelectorAll('[data-gone-menu]').forEach((b) => b.addEventListener('click', (ev) => { ev.stopPropagation(); const r = b.getBoundingClientRect(); goneMenu(Number(b.dataset.goneMenu), r.left, r.bottom + 4); }));
  // Bấm cả thẻ (14/11): strategy → mở Edit; đã xoá → menu Restore / Move; No strategy → trang Trades lọc lệnh chưa có strategy
  app.querySelectorAll('[data-card]').forEach((card) => {
    const open = (ev) => {
      if (ev.target.closest('button, a, input, select')) return;
      const id = Number(card.dataset.cardId); const kind = card.dataset.card;
      if (kind === 'edit') { const m = MODELS.find((x) => x.id === id); if (m) editModel(m); }
      else if (kind === 'gone') { ev.stopPropagation(); const r = card.getBoundingClientRect(); goneMenu(id, r.left + 16, r.top + 48); }
      else { filters = { setup: '__none', account: '', mistake: '', outcome: '', plan: '' }; location.hash = '#/trades'; }
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); open(ev); } });
  });
  app.querySelectorAll('[data-model-form]').forEach((f) => f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isNew = f.dataset.modelForm === 'new';
    const name = f.name.value.trim();
    const id = isNew ? Math.max(0, ...MODELS.map((m) => m.id), ...MODELS_TRASH.map((m) => m.id), ...allTrades.map((t) => t.model_id || 0)) + 1 : Number(f.dataset.modelForm);
    if (!name) return show('Type a strategy name, like Strategy 2022.');
    if (MODELS.some((m) => m.name.toLowerCase() === name.toLowerCase() && m.id !== id)) return show('You already have a strategy with this name.');
    const recipe = {};
    for (const k of RECIPE_KEYS) { const arr = [...(modelDraft?.[k] || [])]; if (ME_CFG[k].tf) arr.sort((a, b) => ME_CFG[k].list().indexOf(a) - ME_CFG[k].list().indexOf(b)); if (arr.length) recipe[k] = arr; }
    const hasRecipe = Object.keys(recipe).length > 0;
    const next = isNew ? [...MODELS, { id, name, items: [], ...(hasRecipe ? { recipe } : {}) }]
      : MODELS.map((m) => { if (m.id !== id) return m; const { recipe: _old, ...rest } = m; return { ...rest, name, ...(hasRecipe ? { recipe } : {}) }; });
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ models: next }) });
      MODELS = next; editingModel = null; modelDraft = null; toast(`Saved ${name}`); renderModels();
    } catch (ex) { show(ex.message); }
  }));
}

// ---------- Màn hình 2: Thêm / sửa lệnh ----------
// ---------- Nháp lệnh đang nhập (13/11) ----------
// Lưu trong sessionStorage (mất khi đóng tab). Chỉ khôi phục khi quay lại form TỪ trang Strategies.
const DRAFT_KEY = 'rj-trade-draft';
let prevRouteHash = null; // trang đứng ngay trước trang hiện tại
function loadTradeDraft() { try { return JSON.parse(sessionStorage.getItem(DRAFT_KEY) || 'null'); } catch { return null; } }
function clearTradeDraft() { try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* bỏ qua */ } }
function saveTradeDraft(route, t) {
  const body = { route, t };
  try { sessionStorage.setItem(DRAFT_KEY, JSON.stringify(body)); return true; }
  catch { // ảnh dán quá lớn: giữ phần chữ, bỏ ảnh mới (ảnh đã lưu trên máy thì giữ vì chỉ là tên file)
    try {
      const keep = (t.images || []).filter((x) => !String(x.f).startsWith('data:'));
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ route, t: { ...t, images: keep }, droppedImages: true }));
      return true;
    } catch { return false; }
  }
}
function renderForm(existing, presetDate) {
  // Lệnh mới: lấy sẵn account và risk của lệnh gần nhất cho đỡ gõ lại
  // presetDate: khi bấm "+ Add trade" từ một ngày trên lịch (ngày khác hôm nay thì để trống giờ)
  const last = trades[0] || {};
  const t0 = existing || {
    date: presetDate || todayStr(), time: presetDate && presetDate !== todayStr() ? '' : nowTime(), session: last.session || 'NY AM', symbol: last.symbol || 'MNQ',
    account_id: defaultAccountId(), risk_usd: null, direction: null, // Risk để trống: chủ dự án không muốn tự điền theo lệnh trước (13/11)
    setup_name: '', market_context: '', area_of_interest: '', confirmations: [], conditions_met: null,
    pnl_usd: null, contracts: null, followed_plan: null, mistakes: [], lesson: '',
    emotions: [], plan_break_reason: '', htf_bias: null, dols: [], news_today: null, news_note: '', hindsight: '',
    images: [],
  };
  // Quay lại từ trang Strategies: điền lại những gì đã nhập dở
  const draftRoute = existing ? `#/trade/${existing.id}/edit` : (location.hash || '#/new');
  const savedDraft = loadTradeDraft();
  const restoring = !!(savedDraft && savedDraft.route === draftRoute && (prevRouteHash || '').startsWith('#/strategies'));
  const t = restoring ? { ...t0, ...savedDraft.t } : t0;
  if (savedDraft) clearTradeDraft();
  if (restoring) setTimeout(() => toast(savedDraft.droppedImages ? 'Your trade is back. Pasted images were too big to keep, add them again.' : 'Your trade is back, nothing was lost'), 0);
  const state = {
    direction: t.direction,
    conditions_met: t.conditions_met,
    followed_plan: t.followed_plan,
    confirmations: [...t.confirmations],
    mistakes: [...t.mistakes],
    emotions: [...(t.emotions || [])],
    dols: [...(t.dols || [])],
    htf_bias: t.htf_bias,
    news_today: t.news_today,
    pdas: [...(t.pdas || [])],
    marks: JSON.parse(JSON.stringify(t.marks || {})), // nét vẽ trên ảnh
    pda_tf: [...(t.pda_tf || [])],
    m15_structure: t.m15_structure || null,
    entry_tf: t.entry_tf || null,
    // Ảnh: tên file (ảnh đã lưu) hoặc data URL (ảnh mới dán), kèm nét vẽ m
    images: (t.images || []).map((x) => ({ src: x.f, m: x.m || [] })),
    viewing: null,
    activeSlot: null,
    // Model: lệnh cũ giữ bản chụp điều kiện lúc nhập; chọn model khác thì lấy điều kiện hiện tại của model đó
    model: t.model_id ? { id: t.model_id, name: t.model_name, items: [...(t.model_items || [])] } : null,
    seen: [...(t.seen?.length ? t.seen : t.model_checks || []), ...(t.htf_tf && !(t.seen || []).some((x) => x.startsWith('htf:@')) ? [`htf:@${t.htf_tf}`] : [])],
  };
  const modelOpts = [...MODELS.map((m) => [m.id, m.name])];
  if (t.model_id && !MODELS.some((m) => m.id === t.model_id)) modelOpts.push([t.model_id, `${t.model_name} (deleted)`]);
  const datalist = (id, items) => `<datalist id="${id}">${items.map((s) => `<option value="${esc(s)}">`).join('')}</datalist>`;
  const toggle = (key, ...opts) => `<div class="toggle" data-toggle="${key}" role="group">${opts
      .map(([v, l]) => `<button type="button" data-value="${v}">${l}</button>`).join('')}</div>`;
  const back = existing ? `#/trade/${t.id}` : '#/';

  // Form gọn (chủ dự án duyệt 09/11): 4 khối Trade / Setup / Review / Charts, 2 cột trên máy tính.
  // Bỏ Entry Confirmation + Area of Interest (đã có trong Model), gộp Hindsight vào Lesson.
  // Lệnh cũ còn nội dung Hindsight thì vẫn hiện ô đó để không mất chữ.
  app.innerHTML = `
    <a class="back" href="${back}">← Back</a>
    <h1 style="margin:10px 0 20px">${existing ? 'Edit trade' : 'New trade'}</h1>
    <form class="trade trade-v2" autocomplete="off" novalidate>
      <div class="tf-grid">
      <div class="tf-col">
      <fieldset class="tf-trade">
        <legend>Trade</legend>
        <div class="cols c3">
          <label>Date <input type="date" name="date" value="${esc(t.date)}" required></label>
          <label>Time (${tzShort()}) <input type="time" name="time" value="${esc(t.time || '')}"></label>
          <label>Session <select name="session">${sessionOpts(t.session)}</select></label>
        </div>
        <div class="cols c2">
          <label>Symbol <input name="symbol" list="symbols" value="${esc(t.symbol || '')}"></label>
          <label>Account ${accountSelect(t.account_id)}</label>
        </div>
        ${datalist('symbols', SYMBOLS)}
        ${accounts.length ? '' : '<p class="hint">No accounts yet. <a class="link" href="#/accounts">Add your accounts</a> to keep Live, Demo and prop results apart.</p>'}
        <div>
          <div class="field-label">Direction</div>
          ${toggle('direction', ['long', 'Long'], ['short', 'Short'])}
        </div>
        <div class="cols c2">
          <label>Risk ($) <input type="number" name="risk_usd" min="0" step="any" value="${t.risk_usd ?? ''}" placeholder="e.g. 50"></label>
          <label>Contracts <input type="number" name="contracts" min="1" step="1" value="${t.contracts ?? ''}"></label>
        </div>
        <div class="cols c2">
          <label>P&amp;L ($) <input type="number" name="pnl_usd" step="any" value="${t.pnl_usd ?? ''}" placeholder="e.g. 100 or -50"></label>
          <div><div class="field-label">Result in R</div><div class="r-preview" id="r-preview"></div></div>
        </div>
        <div class="news-row">
          <div>
            <div class="field-label">News today?</div>
            ${toggle('news_today', ['no', 'No news'], ['yes', 'High-impact'])}
          </div>
          <label>News (optional) <input name="news_note" value="${esc(t.news_note || '')}" placeholder="e.g. CPI 8:30"></label>
        </div>
      </fieldset>

      <fieldset class="tf-setup">
        <legend>Setup</legend>
        <p class="setup-flow">Daily <span>→</span> HTF <span>→</span> Structure <span>→</span> Entry</p>
        <div class="su-step"><span class="su-num">1</span><div class="su-body">
          <div class="su-row"><span class="su-label">Daily target</span><div class="chips" data-chips="dols"></div></div>
        </div></div>
        <div class="su-step"><span class="su-num">2</span><div class="su-body">
          <div class="su-row"><span class="su-label">HTF Bias</span>${toggle('htf_bias', ['bullish', 'Bullish'], ['bearish', 'Bearish'], ['undecided', 'Undecided'])}</div>
          <div class="su-row"><span class="su-label">HTF PDA</span><div class="su-ctl">
            <div class="chips" data-chips="pdas"></div>
            <div class="pda-tf"><span class="su-sub">on</span><div class="toggle" data-multi="pda_tf" role="group" aria-label="PDA timeframe">${[...new Set([...PDA_TFS, ...(t.pda_tf || [])])].map((v) => `<button type="button" data-value="${esc(v)}">${esc(v)}</button>`).join('')}</div><span class="hint">Pick more than one if they line up</span></div>
          </div></div>
        </div></div>
        <div class="su-step"><span class="su-num">3</span><div class="su-body">
          <div class="su-row"><span class="su-label">Structure</span><div class="su-ctl su-inline">${toggle('m15_structure', ['bullish', 'Bullish'], ['bearish', 'Bearish'], ['sideways', 'Sideways'])}<span class="aligned-line" id="aligned" aria-live="polite"></span></div></div>
        </div></div>
        <div class="su-step"><span class="su-num">4</span><div class="su-body">
          <div class="su-row"><span class="su-label">Entry on</span>${toggle('entry_tf', ...[...new Set([...ENTRY_TFS, ...(t.entry_tf ? [t.entry_tf] : [])])].map((v) => [esc(v), esc(v)]))}</div>
          <div class="su-row"><span class="su-label">Confirmation</span><div class="chips" data-chips="confirmations"></div></div>
        </div></div>
        <div class="su-step su-extra"><span class="su-num" aria-hidden="true"></span><div class="su-body">
          <div class="su-row"><span class="su-label">Strategy</span><div class="su-ctl su-inline">
            <select name="model_id" aria-label="Strategy" class="su-select">
              <option value="">No strategy</option>
              ${modelOpts.map(([id, name]) => `<option value="${id}" ${id === t.model_id ? 'selected' : ''}>${esc(name)}</option>`).join('')}
            </select>
            <a class="link" href="#/strategies" id="manage-models">${MODELS.length ? 'Edit strategies' : 'Create a strategy'}</a></div></div>
          <div class="su-row"><span class="su-label">Context</span><textarea name="market_context" rows="2" aria-label="Market context" placeholder="Optional. e.g. Ranging since London, swept Asia low">${esc(t.market_context || '')}</textarea></div>
        </div></div>
      </fieldset>
      </div>

      <div class="tf-col">
      <fieldset class="tf-review">
        <legend>Review</legend>
        <div>
          <div class="field-label">Did I follow my plan?</div>
          ${toggle('followed_plan', ['yes', 'Yes'], ['no', 'No'])}
        </div>
        <label id="break-reason" hidden>What made me change my plan?
          <textarea name="plan_break_reason" rows="2" placeholder="e.g. Lost 2 in a row and wanted it back / Price moved fast without me">${esc(t.plan_break_reason || '')}</textarea>
        </label>
        <div>
          <div class="field-label">How did I feel before entry?</div>
          <div class="chips" data-chips="emotions"></div>
        </div>
        <div>
          <div class="field-label">Mistakes</div>
          <div class="chips" data-chips="mistakes"></div>
        </div>
        <label>Lesson / what I'd do differently <textarea name="lesson" rows="3">${esc(t.lesson || '')}</textarea></label>
        ${t.hindsight ? `<label>Hindsight (old field) <textarea name="hindsight" rows="2">${esc(t.hindsight)}</textarea></label>` : ''}
      </fieldset>

      <fieldset class="tf-charts">
        <legend>Charts</legend>
        <div class="shots shots-flex" data-images></div>
      </fieldset>
      </div>
      </div>

      <p class="error" role="alert" hidden></p>
      <div class="form-actions sticky-actions">
        <a class="btn" href="${back}">Cancel</a>
        <button class="btn btn-primary" type="submit">Save trade</button>
      </div>
    </form>`;

  const form = app.querySelector('form');

  // R tự tính ngay khi gõ: R = P&L ÷ Risk
  const rPreview = form.querySelector('#r-preview');
  function updateR() {
    const risk = parseFloat(form.risk_usd.value);
    const pnl = parseFloat(form.pnl_usd.value);
    if ((!(risk > 0) || Number.isNaN(pnl)) && existing && existing.result_r != null) {
      const r = existing.result_r;
      rPreview.className = `r-preview r ${r > 0 ? 'win' : r < 0 ? 'loss' : 'flat'}`;
      rPreview.textContent = `${fmtRv(r)} (entered as R)`;
      return;
    }
    if (!(risk > 0) || Number.isNaN(pnl)) {
      rPreview.className = 'r-preview';
      rPreview.textContent = !(risk > 0) ? 'Enter risk and P&L' : 'Enter P&L';
      return;
    }
    const r = Math.round((pnl / risk) * 100) / 100;
    rPreview.className = `r-preview r ${r > 0 ? 'win' : r < 0 ? 'loss' : 'flat'}`;
    rPreview.textContent = fmtRv(r);
  }
  form.risk_usd.addEventListener('input', updateR);
  form.pnl_usd.addEventListener('input', updateR);
  updateR();

  // Nút bật/tắt (Long-Short, Yes-No)
  form.querySelectorAll('[data-toggle]').forEach((box) => {
    const key = box.dataset.toggle;
    const paint = () => box.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('on', b.dataset.value === state[key]);
      b.setAttribute('aria-pressed', b.dataset.value === state[key]);
    });
    box.addEventListener('rj-repaint', paint); // chọn model thì form tự điền rồi vẽ lại
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      state[key] = state[key] === b.dataset.value ? null : b.dataset.value;
      paint();
      syncBreakReason();
      syncAligned();
    });
    paint();
  });
  // Nút chọn nhiều (khung giờ của PDA: H4, H1 hoặc cả hai)
  form.querySelectorAll('[data-multi]').forEach((box) => {
    const key = box.dataset.multi;
    const paint = () => box.querySelectorAll('button').forEach((b) => { const on = state[key].includes(b.dataset.value); b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
    box.addEventListener('rj-repaint', paint);
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const v = b.dataset.value;
      state[key] = state[key].includes(v) ? state[key].filter((x) => x !== v) : [...state[key], v];
      paint();
    });
    paint();
  });
  // M15 có thuận HTF Bias không: tự tính, không phải bấm
  function syncAligned() {
    const el = form.querySelector('#aligned'); if (!el) return;
    const a = alignedOf(state.htf_bias, state.m15_structure);
    el.className = `aligned-line ${a === true ? 'win' : a === false ? 'loss' : ''}`;
    el.innerHTML = a === true ? `${ICON.check} Aligned with HTF Bias` : a === false ? `${ICON.cross} Not aligned with HTF Bias` : state.m15_structure ? 'Pick an HTF Bias to check alignment' : '';
  }
  syncAligned();
  // Ô "What made me change my plan?" chỉ hiện khi chọn "No"
  function syncBreakReason() {
    const box = form.querySelector('#break-reason');
    box.hidden = state.followed_plan !== 'no';
  }
  syncBreakReason();

  // Model giờ chỉ là tên để nhóm lệnh (10/11)
  bindSessionSelect(form.session);
  form.model_id.addEventListener('change', () => {
    const id = Number(form.model_id.value) || null;
    const m = MODELS.find((x) => x.id === id);
    state.model = id ? { id, name: m ? m.name : t.model_name, items: [] } : null;
    // Model có công thức (11/11): điền sẵn các ô Setup theo công thức. Mỗi lệnh vẫn sửa được.
    const r = m?.recipe;
    if (!r) return;
    if (r.dols?.length) state.dols = [...r.dols];
    if (r.pdas?.length) state.pdas = [...r.pdas];
    if (r.pda_tf?.length) state.pda_tf = [...r.pda_tf];
    if (r.structure?.length === 1) state.m15_structure = r.structure[0]; // nhiều lựa chọn thì để chủ dự án tự chọn từng lệnh
    if (r.confirmations?.length) state.confirmations = [...r.confirmations];
    if (r.entry_tf?.length === 1) state.entry_tf = r.entry_tf[0];
    form.querySelectorAll('[data-toggle], [data-multi], [data-chips]').forEach((b) => b.dispatchEvent(new Event('rj-repaint')));
    syncAligned();
    toast(`Filled in from ${m.name}`);
  });
  // "Edit strategies" (13/11): hỏi Leave / Cancel; Leave thì LƯU NHÁP lệnh đang nhập (kể cả ảnh dán chưa lưu) rồi sang trang Strategies.
  // Quay lại form (nút "Back to your trade" hoặc nút Back của trình duyệt) thì mọi thứ được điền lại.
  form.querySelector('#manage-models').addEventListener('click', async (e) => {
    e.preventDefault();
    const ok = await askDialog({ title: 'Leave this trade?', body: 'What you typed here is kept. Come back with “Back to your trade” on the Strategies page and carry on.', actions: [{ label: 'Leave', value: 'yes' }] });
    if (!ok) return;
    saveTradeDraft(draftRoute, draftFromForm());
    location.hash = '#/strategies';
  });

  // Chip chọn nhiều + ô thêm chip mới
  // Chip mới gõ ở "+ Add" được lưu vào danh sách chung (Settings), lần sau vẫn còn (sửa 09/11)
  const listOf = (key) => ({ mistakes: MISTAKES, emotions: EMOTIONS, confirmations: CONFIRMATIONS, dols: DOLS, pdas: PDAS }[key]);
  const rememberChip = (key, v) => {
    const cur = listOf(key);
    if (cur.some((x) => x.toLowerCase() === v.toLowerCase())) return;
    const next = [...cur, v];
    if (key === 'mistakes') MISTAKES = next; else if (key === 'emotions') EMOTIONS = next;
    else if (key === 'confirmations') CONFIRMATIONS = next; else if (key === 'dols') DOLS = next; else if (key === 'pdas') PDAS = next;
    api('/api/settings', { method: 'PUT', body: JSON.stringify({ [key]: next }) }).catch((ex) => toast(`Not saved to your list: ${ex.message}`));
  };
  form.querySelectorAll('[data-chips]').forEach((box) => {
    const key = box.dataset.chips;
    const paint = () => {
      const base = listOf(key);
      const all = [...new Set([...base, ...state[key]])];
      box.innerHTML = all.map((v) => `<button type="button" class="chip ${state[key].includes(v) ? 'on' : ''} ${key === 'mistakes' ? 'bad' : ''}" aria-pressed="${state[key].includes(v)}" data-value="${esc(v)}">${esc(v)}</button>`).join('')
        + '<input class="chip-add" placeholder="+ Add" aria-label="Add your own">';
    };
    box.addEventListener('rj-repaint', paint);
    // Chuột phải vào một chip → Delete: xoá khỏi danh sách chung (lệnh cũ đã dùng vẫn giữ). Có thêm thì phải có xoá (11/11).
    box.addEventListener('contextmenu', (e) => {
      const c = e.target.closest('.chip'); if (!c) return;
      e.preventDefault(); e.stopPropagation();
      const v = c.dataset.value;
      showMenu(e.clientX, e.clientY, [{ act: 'delete', label: 'Delete', danger: true }], async () => {
        const ok = await askDialog({ title: `Remove ${esc(v)}?`, body: 'It will no longer show as an option. Trades and strategies that already use it keep it. You can add it again any time.', actions: [{ label: 'Remove', value: 'yes', danger: true }] });
        if (!ok) return;
        state[key] = state[key].filter((y) => y !== v);
        removeListItem(key, v).then(paint).catch((ex) => toast(`Not saved to your list: ${ex.message}`));
        paint();
      });
    });
    box.addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      const v = b.dataset.value;
      state[key] = state[key].includes(v) ? state[key].filter((x) => x !== v) : [...state[key], v];
      paint();
    });
    const addFrom = (input, refocus) => {
      const v = input.value.trim().slice(0, 40);
      if (!v) return;
      const same = listOf(key).find((x) => x.toLowerCase() === v.toLowerCase()) || v; // gõ "fvg" thì dùng "FVG" có sẵn
      if (!state[key].includes(same)) state[key].push(same);
      rememberChip(key, same);
      paint();
      if (refocus) box.querySelector('.chip-add').focus();
    };
    box.addEventListener('keydown', (e) => {
      if (!e.target.classList.contains('chip-add') || e.key !== 'Enter') return;
      e.preventDefault();
      addFrom(e.target, true);
    });
    // Gõ xong mà bấm ra chỗ khác (không Enter) thì vẫn thêm, không mất chữ
    box.addEventListener('focusout', (e) => { if (e.target.classList.contains('chip-add')) addFrom(e.target, false); });
    paint();
  });

  // Ảnh chart linh động (10/11): bao nhiêu ảnh cũng được, không gắn nhãn. Cmd+V, kéo thả, hoặc nút Add image.
  const shotBox = form.querySelector('[data-images]');
  const chartLabel = (i) => `Chart ${i + 1}`;
  function paintShots() {
    shotBox.innerHTML = state.images.map((im, i) => {
      const src = imgSrc(im.src); const n = im.m?.length || 0;
      return `<div class="shot filled" tabindex="0" data-idx="${i}" aria-label="${chartLabel(i)}">
        ${n ? `<svg class="anno-svgimg" role="img" aria-label="${chartLabel(i)}" preserveAspectRatio="xMidYMid meet" data-src="${esc(src)}" data-marks="${esc(JSON.stringify(im.m))}"></svg>` : `<img src="${esc(src)}" alt="${chartLabel(i)}">`}
        ${n ? `<span class="mark-badge">${n} drawing${n === 1 ? '' : 's'}</span>` : ''}
        <button type="button" class="remove" aria-label="Delete ${chartLabel(i)}" title="Delete this image">${ICON.cross}</button>
      </div>`;
    }).join('') + `<button type="button" class="shot shot-add" data-add-image><span class="shot-plus">+</span><b>Add image</b><span>or paste with ${IS_MAC ? '⌘' : 'Ctrl+'}V · drop files here</span></button>`;
    hydrateThumbs(shotBox);
  }
  // Đọc file ảnh; replaceIdx = thay ảnh ở vị trí đó, không có thì thêm vào cuối
  function addFiles(files, replaceIdx = null) {
    [...files].filter((f) => f && f.type.startsWith('image/')).forEach((file, k) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (replaceIdx != null && k === 0 && state.images[replaceIdx]) {
          state.images[replaceIdx] = { src: reader.result, m: [] }; // ảnh mới: nét vẽ cũ không còn khớp
          const v = document.querySelector('dialog.img-view img'); if (v && state.viewing === replaceIdx) v.src = reader.result;
        } else state.images.push({ src: reader.result, m: [] });
        paintShots();
      };
      reader.readAsDataURL(file);
    });
  }
  const pickFiles = (replaceIdx = null) => {
    const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*', multiple: replaceIdx == null });
    input.onchange = () => addFiles(input.files, replaceIdx);
    input.click();
  };
  shotBox.addEventListener('click', (e) => {
    if (e.target.closest('[data-add-image]')) { pickFiles(); return; }
    const shot = e.target.closest('.shot[data-idx]'); if (!shot) return;
    const i = Number(shot.dataset.idx);
    if (e.target.closest('.remove')) { state.images.splice(i, 1); paintShots(); return; }
    // Bấm ảnh: xem lớn + vẽ ngay trong form
    state.viewing = i;
    openImageViewer(imgSrc(state.images[i].src), chartLabel(i), () => pickFiles(i), {
      get: () => state.images[i]?.m || [],
      set: (l) => { if (state.images[i]) { state.images[i].m = l; paintShots(); } },
    }, { onDelete: () => { state.images.splice(i, 1); paintShots(); } }); // xoá thật khi bấm Save trade
    document.querySelector('dialog.img-view')?.addEventListener('close', () => { state.viewing = null; });
  });
  const fsCharts = form.querySelector('.tf-charts');
  fsCharts.addEventListener('dragover', (e) => { if ([...(e.dataTransfer?.items || [])].some((x) => x.kind === 'file')) { e.preventDefault(); fsCharts.classList.add('dragover'); } });
  fsCharts.addEventListener('dragleave', (e) => { if (!fsCharts.contains(e.relatedTarget)) fsCharts.classList.remove('dragover'); });
  fsCharts.addEventListener('drop', (e) => { e.preventDefault(); fsCharts.classList.remove('dragover'); addFiles(e.dataTransfer.files); });
  paintShots();

  // Cmd+V: đang xem 1 ảnh thì thay ảnh đó, không thì thêm ảnh mới
  onPaste = (e) => {
    const items = [...(e.clipboardData?.items || [])].filter((x) => x.type.startsWith('image/'));
    if (!items.length) return;
    e.preventDefault();
    addFiles(items.map((x) => x.getAsFile()), state.viewing ?? null);
  };

  // Chụp lại mọi thứ đang nhập (chữ trong ô + chip + ảnh) thành dạng giống một lệnh để điền lại sau
  function draftFromForm() {
    const fd = new FormData(form); const f = {};
    for (const [k, v] of fd.entries()) if (typeof v === 'string') f[k] = v;
    return {
      date: f.date, time: f.time, session: f.session, symbol: f.symbol,
      account_id: f.account_id ? Number(f.account_id) : null, risk_usd: f.risk_usd ?? '', pnl_usd: f.pnl_usd ?? '', contracts: f.contracts ?? '',
      market_context: f.market_context || '', lesson: f.lesson || '', plan_break_reason: f.plan_break_reason || '', news_note: f.news_note || '', hindsight: f.hindsight || '',
      direction: state.direction, conditions_met: state.conditions_met, followed_plan: state.followed_plan,
      confirmations: [...state.confirmations], mistakes: [...state.mistakes], emotions: [...state.emotions], dols: [...state.dols],
      htf_bias: state.htf_bias, news_today: state.news_today, pdas: [...state.pdas], pda_tf: [...state.pda_tf],
      m15_structure: state.m15_structure, entry_tf: state.entry_tf,
      model_id: state.model?.id ?? null, model_name: state.model?.name || '', model_items: state.model?.items || [],
      images: state.images.map((x) => ({ f: x.src, m: x.m || [] })),
    };
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    if (accounts.length && !fd.get('account_id')) {
      const er = form.querySelector('.error');
      er.textContent = 'Choose an account so this trade is counted in the right place.'; er.hidden = false;
      form.querySelector('select[name="account_id"]')?.focus();
      return;
    }
    const body = {
      date: fd.get('date'), time: fd.get('time'), session: fd.get('session'), symbol: fd.get('symbol'),
      account_id: fd.get('account_id'), risk_usd: fd.get('risk_usd'), pnl_usd: fd.get('pnl_usd'),
      setup_name: t.setup_name || '', market_context: fd.get('market_context'), // Setup name cũ: giữ nguyên, ô đã thay bằng Model
      // Area of Interest đã bỏ khỏi form: giữ nguyên chữ cũ
      area_of_interest: t.area_of_interest || '', lesson: fd.get('lesson'), contracts: fd.get('contracts'),
      direction: state.direction, conditions_met: state.conditions_met, followed_plan: state.followed_plan,
      model_id: state.model?.id ?? '', model_name: state.model?.name || '', model_items: [],
      // Chỉ lưu điều kiện của model đã chọn (bỏ khung giờ / tick cũ ngoài model)
      seen: [], model_checks: [], // model chỉ còn là tên (10/11)
      pdas: state.pdas, pda_tf: state.pda_tf, m15_structure: state.m15_structure, entry_tf: state.entry_tf,
      confirmations: state.confirmations, mistakes: state.mistakes, emotions: state.emotions,
      plan_break_reason: fd.get('plan_break_reason'),
      htf_bias: state.htf_bias, news_today: state.news_today, news_note: fd.get('news_note'),
      dols: state.dols, hindsight: fd.get('hindsight') ?? '',
      // Lệnh không có $ thì giữ R đã nhập trước đó
      result_r: existing ? existing.result_r : null,
      images: state.images.map((x) => ({ src: x.src, m: x.m || [] })),
    };
    const btn = form.querySelector('[type=submit]');
    const err = form.querySelector('.error');
    btn.disabled = true; btn.textContent = 'Saving...'; err.hidden = true;
    try {
      const saved = existing
        ? await api(`/api/trades/${t.id}`, { method: 'PUT', body: JSON.stringify(body) })
        : await api('/api/trades', { method: 'POST', body: JSON.stringify(body) });
      location.hash = `#/trade/${saved.id}`;
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      btn.disabled = false; btn.textContent = 'Save trade';
    }
  });
}

// ---------- Màn hình 3: Chi tiết lệnh ----------
// Trang chi tiết lệnh: 1 trang liền (13/11 chủ dự án bỏ 4 tab vì phải bấm qua lại, rời rạc)
function renderDetail(t) {
  const row = (label, value) => `<div><dt>${label}</dt><dd>${value === '' || value == null ? '<span style="color:var(--muted)">—</span>' : value}</dd></div>`;
  const cap = (v) => (v ? v[0].toUpperCase() + v.slice(1) : '');
  const yesNo = (v, noIsBad) => (v === 'yes' ? 'Yes' : v === 'no' ? (noIsBad ? '<span style="color:var(--loss-text)">No</span>' : 'No') : '');
  const imgs = t.images || [];
  app.innerHTML = `
    <div class="detail">
      <a class="back" href="#/trades">← Trades</a>
      <div class="page-head" style="margin:0">
        <div>
          <h1>${fmtDate(t.date)} · ${esc(t.symbol || '')} ${t.direction === 'long' ? 'Long' : t.direction === 'short' ? 'Short' : ''}</h1>
          <p>${[t.session, t.time, accOf(t) ? `${accName(t)} (${ACC_TYPES[accOf(t).type]})` : '', t.model_name || t.setup_name].filter(Boolean).map(esc).join(' · ')}${t.model_id ? ` ${scoreBadge(t)}` : ''}</p>
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <span class="r ${outcomeOf(t)}" style="font-size:26px;margin-right:8px">${fmtResult(t)}</span>
          <a class="btn" href="#/trade/${t.id}/edit">Edit</a>
          <button class="btn btn-danger" id="delete">Delete</button>
        </div>
      </div>
      <dl class="info dt-panel" style="margin:0">
        ${row('Risk', t.risk_usd != null ? `$${t.risk_usd}` : '')}
        ${row('P&amp;L', fmtUsd(t.pnl_usd))}
        ${row('Result in R', fmtRv(t.result_r))}
        ${row('Contracts', t.contracts ?? '')}
        ${row('News today?', t.news_today === 'yes' ? `High-impact news${t.news_note ? `: ${esc(t.news_note)}` : ''}` : t.news_today === 'no' ? 'No news' : '')}
        ${row('Daily target (DOL)', esc(t.dols.join(', ')))}
        ${row('HTF Bias (H1/H4)', cap(t.htf_bias))}
        ${row('HTF PDA', t.pdas?.length ? `${esc(t.pdas.join(', '))}${t.pda_tf?.length ? ` <span class="hint">on ${esc(t.pda_tf.join(' + '))}</span>` : ''}` : '')}
        ${row('Structure', t.m15_structure ? `${cap(t.m15_structure)} ${alignedOf(t.htf_bias, t.m15_structure) === true ? `<span class="mc-yes">${ICON.check}aligned</span>` : alignedOf(t.htf_bias, t.m15_structure) === false ? `<span class="mc-no-plain">${ICON.cross}not aligned</span>` : ''}` : '')}
        ${row('Entry', [t.entry_tf ? `on ${esc(t.entry_tf)}` : '', esc(t.confirmations.join(', '))].filter(Boolean).join(' · '))}
        ${row('Strategy', t.model_id ? `${esc(t.model_name)}${MODELS.some((m) => m.id === t.model_id) ? '' : ' <span class="hint">(deleted)</span>'}` : '')}
        ${row('Market Context', esc(t.market_context))}
        ${t.area_of_interest ? row('Area of Interest', esc(t.area_of_interest)) : ''}
        ${t.conditions_met ? row('All 3 conditions met?', yesNo(t.conditions_met, true)) : ''}
        ${row('Felt before entry', esc(t.emotions.join(', ')))}
        ${row('Followed my plan?', yesNo(t.followed_plan, true))}
        ${t.followed_plan === 'no' ? row('What made me change my plan', esc(t.plan_break_reason)) : ''}
        ${row('Mistakes', t.mistakes.length ? `<span style="color:var(--loss-text)">${esc(t.mistakes.join(', '))}</span>` : '')}
        ${t.hindsight ? row('Hindsight', esc(t.hindsight)) : ''}
        ${row('Lesson', esc(t.lesson))}
      </dl>
      ${imgs.length ? `<div class="shots-view">${imgs.map((im, i) => `
        <figure>
          <button type="button" class="shot-open" data-open-shot="${i}" title="Click to zoom in or draw on this chart"><span class="anno-wrap" data-marks="${esc(JSON.stringify(im.m || []))}"><img src="${esc(imgSrc(im.f))}" alt="Chart ${i + 1}"><svg class="anno-svg" aria-hidden="true"></svg></span></button>
        </figure>`).join('')}</div>` : ''}
    </div>`;
  hydrateMarks(app); // vẽ lớp nét vẽ lên ảnh chart
  // Bấm ảnh → xem lớn + vẽ ngay tại đây (10/11), tự lưu, không cần mở Edit
  let saveTimer = null;
  app.querySelectorAll('[data-open-shot]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.openShot);
    openImageViewer(imgSrc(imgs[i].f), `Chart ${i + 1}`, null, {
      get: () => imgs[i].m || [],
      set: (l) => {
        imgs[i].m = l;
        const wrap = b.querySelector('.anno-wrap'); wrap.dataset.marks = JSON.stringify(l); hydrateMarks(b);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(async () => {
          try { await api(`/api/trades/${t.id}/marks`, { method: 'PUT', body: JSON.stringify({ index: i, marks: l }) }); }
          catch (ex) { toast(`Drawing not saved: ${ex.message}`); }
        }, 400);
      },
    }, {
      autosave: true,
      onDelete: async () => {
        const ok = await askDialog({ title: `Delete chart ${i + 1}?`, body: 'The image and its drawings are removed from this trade. This cannot be undone.', actions: [{ label: 'Delete image', value: 'yes', danger: true }] });
        if (!ok) return;
        try { await api(`/api/trades/${t.id}/images/${i}`, { method: 'DELETE' }); toast('Image deleted'); await refreshKeepScroll(); }
        catch (ex) { toast(ex.message); }
      },
    });
  }));
  document.getElementById('delete').addEventListener('click', async () => {
    const name = [fmtDate(t.date), t.time, t.symbol].filter(Boolean).join(' · ');
    const ok = await askDialog({ title: 'Delete this trade?', body: `${esc(name)}. It goes to Trash, and ${IS_MAC ? '⌘' : 'Ctrl+'}Z brings it back.`, actions: [{ label: 'Delete trade', value: 'yes', danger: true }] });
    if (!ok) return;
    await api(`/api/trades/${t.id}`, { method: 'DELETE' });
    location.hash = '#/trades';
    pushUndo(`Deleted trade ${name}`, [{ kind: 'trade', id: t.id }]);
  });
}


// ---------- Nét vẽ trên ảnh chart (10/11): lớp riêng, ảnh gốc giữ nguyên ----------
// Toạ độ lưu theo tỉ lệ 0–1 của ảnh. SVG phủ lên ảnh, viewBox = kích thước thật của ảnh.
// Kiểu nét: c = màu (tên cũ hoặc #hex), a = opacity, w = độ dày, z = cỡ chữ, b/i = đậm/nghiêng, st = viền box
const MARK_COLOR = { teal: '#14B8A6', red: '#E5484D', yellow: '#F5B83D', white: '#FFFFFF' };
const markColor = (c) => MARK_COLOR[c] || (/^#[0-9a-f]{6}$/i.test(c || '') ? c : MARK_COLOR.teal);
let markUid = 0; // id riêng cho đầu mũi tên (nhiều SVG trên cùng trang)
function marksSVG(list, W, H, opts = {}) {
  const unit = Math.max(1, Math.min(W, H) / 500); // 1 độ dày = bao nhiêu px trên ảnh
  const uid = `m${markUid += 1}`;
  let defs = '';
  const shape = (m, i) => {
    const col = markColor(m.c); const op = m.a ?? 1; const sw = (m.w ?? 2) * unit;
    if (opts.hide === i) return '';
    const at = opts.editable ? ` data-mi="${i}" class="mk${opts.sel === i ? ' sel' : ''}"` : '';
    if (m.t === 'hline') return `<line${at} x1="0" x2="${W}" y1="${m.y * H}" y2="${m.y * H}" stroke="${col}" stroke-opacity="${op}" stroke-width="${sw}" stroke-dasharray="${sw * 4} ${sw * 2}"/>`;
    if (m.t === 'line' || m.t === 'arrow') {
      let mk = '';
      if (m.t === 'arrow') { const id = `${uid}-${i}`; defs += `<marker id="${id}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="${col}" fill-opacity="${op}"/></marker>`; mk = ` marker-end="url(#${id})"`; }
      // Vùng bấm rộng hơn nét thật để dễ chọn đường mảnh
      const hitLine = opts.editable ? `<line data-mi="${i}" class="mk-hit" x1="${m.x1 * W}" y1="${m.y1 * H}" x2="${m.x2 * W}" y2="${m.y2 * H}" stroke="#000" stroke-opacity="0" stroke-width="${sw + unit * 10}" stroke-linecap="round"/>` : '';
      return `<line${at} x1="${m.x1 * W}" y1="${m.y1 * H}" x2="${m.x2 * W}" y2="${m.y2 * H}" stroke="${col}" stroke-opacity="${op}" stroke-width="${sw}" stroke-linecap="round"${mk}/>${hitLine}`;
    }
    if (m.t === 'box') {
      const x = Math.min(m.x1, m.x2) * W; const y = Math.min(m.y1, m.y2) * H;
      return `<rect${at} x="${x}" y="${y}" width="${Math.abs(m.x2 - m.x1) * W}" height="${Math.abs(m.y2 - m.y1) * H}" fill="${col}" fill-opacity="${(op * 0.25).toFixed(3)}" ${m.st === false ? 'stroke="none"' : `stroke="${col}" stroke-opacity="${op}" stroke-width="${sw}"`}/>`;
    }
    if (m.t === 'text') {
      const fs = ((m.z ?? 20) * H) / 700;
      return `<text${at} x="${m.x * W}" y="${m.y * H}" stroke="none" fill="${col}" fill-opacity="${op}" font-size="${fs}" font-weight="${m.b ? 700 : 400}" font-style="${m.i ? 'italic' : 'normal'}" font-family="IBM Plex Sans, system-ui, sans-serif" dominant-baseline="middle">${esc(m.s)}</text>`;
    }
    return '';
  };
  const body = (list || []).map(shape).join('');
  // Điểm nắm của nét đang chọn (10/11): line/arrow 2 điểm đầu–cuối, box 4 góc tròn + 4 cạnh vuông. Kéo để chỉnh.
  let handles = '';
  const m = opts.editable && opts.sel != null ? (list || [])[opts.sel] : null;
  if (m && m.t !== 'text' && m.t !== 'hline') {
    const r = unit * 5; const hw = unit * 1.6;
    const dot = (h, x, y, sq) => (sq
      ? `<rect data-h="${h}" class="mk-h" x="${x - r * 0.85}" y="${y - r * 0.85}" width="${r * 1.7}" height="${r * 1.7}" rx="${r * 0.35}" fill="#fff" stroke="#2962FF" stroke-width="${hw}"/>`
      : `<circle data-h="${h}" class="mk-h" cx="${x}" cy="${y}" r="${r}" fill="#fff" stroke="#2962FF" stroke-width="${hw}"/>`);
    if (m.t === 'box') {
      const x1 = Math.min(m.x1, m.x2) * W; const x2 = Math.max(m.x1, m.x2) * W; const y1 = Math.min(m.y1, m.y2) * H; const y2 = Math.max(m.y1, m.y2) * H;
      const xm = (x1 + x2) / 2; const ym = (y1 + y2) / 2;
      handles = [dot('nw', x1, y1), dot('n', xm, y1, 1), dot('ne', x2, y1), dot('e', x2, ym, 1), dot('se', x2, y2), dot('s', xm, y2, 1), dot('sw', x1, y2), dot('w', x1, ym, 1)].join('');
    } else {
      handles = dot('p1', m.x1 * W, m.y1 * H) + dot('p2', m.x2 * W, m.y2 * H);
    }
  }
  return `<defs>${defs}</defs>${body}${handles}`;
}
// Gắn lớp nét vẽ vào mọi ảnh có data-marks trong một vùng (chờ ảnh tải xong để biết kích thước)
function hydrateMarks(root) {
  root.querySelectorAll('.anno-wrap').forEach((w) => {
    const img = w.querySelector('img'); const svg = w.querySelector('svg');
    const draw = () => {
      const W = img.naturalWidth || 1000; const H = img.naturalHeight || 600;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      try { svg.innerHTML = marksSVG(JSON.parse(w.dataset.marks || '[]'), W, H); } catch { svg.innerHTML = ''; }
    };
    if (img.complete && img.naturalWidth) draw(); else img.addEventListener('load', draw, { once: true });
  });
}
// Ô ảnh nhỏ có nét vẽ: vẽ cả ảnh lẫn nét trong 1 SVG để luôn khớp vị trí
function hydrateThumbs(root) {
  root.querySelectorAll('svg.anno-svgimg').forEach((svg) => {
    const im = new Image();
    im.onload = () => {
      const W = im.naturalWidth; const H = im.naturalHeight;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      let list = []; try { list = JSON.parse(svg.dataset.marks || '[]'); } catch { /* bỏ qua */ }
      svg.innerHTML = `<image href="${esc(svg.dataset.src)}" width="${W}" height="${H}"/>${marksSVG(list, W, H)}`;
    };
    im.src = svg.dataset.src;
  });
}

// ---------- Xem ảnh lớn + công cụ vẽ ----------
// Esc, bấm nền tối hoặc nút Close để đóng. onReplace: chọn file khác thay ảnh này.
// anno: { get(): [nét vẽ], set(list) } → có nút Draw để vẽ lên ảnh. opts.autosave: ghi chú "tự lưu".
// Bảng màu dạng lưới (10/11, theo ảnh mẫu chủ dự án gửi): 1 hàng xám, 1 hàng màu chính, 6 hàng đậm nhạt của từng màu
const DRAW_GRAYS = ['#FFFFFF', '#DADADA', '#B8B8B8', '#9E9E9E', '#808080', '#666666', '#4D4D4D', '#333333', '#1A1A1A', '#000000'];
const DRAW_HUES = ['#E5484D', '#FF9800', '#FFE23B', '#4CAF50', '#14B8A6', '#00BCD4', '#2962FF', '#673AB7', '#9C27B0', '#E91E63'];
const mixHex = (hex, to, t) => { const a = parseInt(hex.slice(1), 16); const b = to === 'w' ? 255 : 0; const ch = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + b * t); return `#${[16, 8, 0].map((sh) => ch(sh).toString(16).padStart(2, '0')).join('')}`.toUpperCase(); };
const DRAW_PRESETS = [...DRAW_GRAYS, ...DRAW_HUES, ...[[0.8, 'w'], [0.62, 'w'], [0.42, 'w'], [0.2, 'w'], [0.25, 'b'], [0.45, 'b']].flatMap(([t, to]) => DRAW_HUES.map((h) => mixHex(h, to, t)))];
function loadDrawStyle() {
  const d = { c: '#14B8A6', a: 1, w: 2, z: 20, b: false, i: false, st: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem('rj-draw-style') || '{}') }; } catch { return d; }
}
function openImageViewer(src, label, onReplace, anno, opts = {}) {
  document.querySelector('dialog.img-view')?.remove();
  const dlg = document.createElement('dialog');
  dlg.className = 'img-view';
  dlg.setAttribute('aria-label', label);
  const TOOLS = [['select', 'Select', '<path d="M5 3l14 8-6 1.5L10 19z"/>'], ['line', 'Line', '<path d="M4 20L20 4"/>'], ['arrow', 'Arrow', '<path d="M5 19L19 5"/><path d="M10 5h9v9"/>'],
    ['box', 'Box', '<rect x="4" y="6" width="16" height="12" rx="1"/>'], ['text', 'Text', '<path d="M5 6h14M12 6v13"/>']]; // Erase đã bỏ (10/11): chọn nét rồi Delete / ⌘X
  let tool = 'line'; let drawing = false;
  const style = loadDrawStyle();
  const saveStyle = () => { try { localStorage.setItem('rj-draw-style', JSON.stringify(style)); } catch { /* bỏ qua */ } };
  let list = anno ? JSON.parse(JSON.stringify(anno.get() || [])) : [];
  const undo = [];
  let sel = null; let selStart = null; // nét đang chọn + bản trước khi chỉnh (để Undo về được)
  let drag = null; let draft = null; let draftHeld = false; let textBox = null;
  const baseTip = onReplace ? 'Esc to close · Cmd+V now replaces this image' : 'Esc to close · Draw to mark up this chart';
  dlg.innerHTML = `
    <header><b>${esc(label)}</b>
      <div class="iv-actions">
        ${anno ? '<button type="button" class="btn btn-primary btn-sm" data-iv-draw>Draw</button>' : ''}
        ${onReplace ? '<button type="button" class="btn btn-soft btn-sm" data-iv-replace>Replace…</button>' : ''}
        ${opts.onDelete ? '<button type="button" class="btn btn-soft btn-sm btn-danger" data-iv-delimg>Delete image</button>' : ''}
        <a class="btn btn-soft btn-sm" href="${esc(src)}" target="_blank" rel="noopener" title="Opens the original image, without your drawings">Open in new tab</a>
        <button type="button" class="btn btn-sm" data-iv-close>Close</button>
      </div></header>
    ${anno ? `<div class="iv-tools" hidden>
      <div class="iv-group" role="group" aria-label="Tool">${TOOLS.map(([k, l, d]) => `<button type="button" class="iv-tool" data-tool="${k}" title="${l}" aria-label="${l}"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg><span>${l}</span></button>`).join('')}</div>
      <div class="iv-group iv-style">
        <span class="iv-editing" hidden>Selected</span>
        <div class="iv-colorwrap"><button type="button" class="iv-swatch" data-iv-color title="Color and opacity" aria-label="Color and opacity"><span></span></button>
          <div class="iv-pop" hidden>
            <div class="iv-presets">${DRAW_PRESETS.map((c, k) => `<button type="button" data-preset="${c}" style="--c:${c}" aria-label="${c}"${k === 20 ? ' class="gap-top"' : ''}></button>`).join('')}</div>
            <div class="iv-custom">
              <span class="iv-cur" aria-hidden="true"></span>
              <label class="iv-plus" title="Custom color"><input type="color" data-iv-picker aria-label="Pick a custom color">+</label>
              <input type="text" data-iv-hex maxlength="7" spellcheck="false" aria-label="Color code">
            </div>
            <div class="iv-op"><span>Opacity</span>
              <div class="iv-opline"><input type="range" min="10" max="100" step="5" data-iv-opacity aria-label="Opacity"><span class="iv-opv" data-iv-opv></span></div>
            </div>
          </div></div>
        <label class="iv-range iv-for" data-for="line arrow box">Width <input type="range" min="1" max="8" step="1" data-iv-width><span data-iv-wv></span></label>
        <label class="iv-check iv-for" data-for="box"><input type="checkbox" data-iv-border> Border</label>
        <span class="iv-for iv-textctl" data-for="text">
          <select data-iv-size aria-label="Text size">${[12, 14, 16, 20, 24, 28, 32, 40, 48, 64].map((v) => `<option value="${v}">${v}</option>`).join('')}</select>
          <button type="button" class="iv-fmt" data-iv-bold title="Bold" aria-label="Bold"><b>B</b></button>
          <button type="button" class="iv-fmt" data-iv-italic title="Italic" aria-label="Italic"><i>I</i></button>
        </span>
      </div>
      <div class="iv-group"><button type="button" class="btn btn-soft btn-sm" data-iv-undo title="Undo (${IS_MAC ? '⌘' : 'Ctrl+'}Z)">Undo</button><button type="button" class="btn btn-soft btn-sm btn-danger" data-iv-clear>Clear</button><button type="button" class="btn btn-primary btn-sm" data-iv-done>Done</button></div>
    </div>` : ''}
    <div class="iv-body"><div class="anno-stage"><img src="${esc(src)}" alt="${esc(label)}"><svg class="anno-svg" aria-hidden="true"></svg></div></div>
    <p class="hint iv-tip">${baseTip}</p>`;
  document.body.append(dlg);
  const img = dlg.querySelector('img'); const svg = dlg.querySelector('.anno-svg'); const stage = dlg.querySelector('.anno-stage');
  const q = (sl) => dlg.querySelector(sl);
  let W = 1000; let H = 600;
  const paint = () => {
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = marksSVG(draft ? [...list, draft] : list, W, H, { editable: drawing, sel, hide: textBox?.i });
  };
  const ready = () => { W = img.naturalWidth || W; H = img.naturalHeight || H; paint(); };
  if (img.complete && img.naturalWidth) ready(); else img.addEventListener('load', ready, { once: true });
  const endSel = () => { if (sel !== null && selStart && selStart !== list) undo.push(selStart); sel = null; selStart = null; };
  const commit = (next) => { endSel(); undo.push(list); list = next; anno.set(list); paint(); };
  // Dùng công cụ xong một lần thì tự về Select và chọn sẵn nét vừa vẽ (giống TradingView, 10/11)
  const backToSelect = (pickNew) => {
    tool = 'select';
    if (pickNew && list.length) { sel = list.length - 1; selStart = list; }
    paint(); paintTools();
  };
  const doUndo = () => { endSel(); if (undo.length) { list = undo.pop(); anno.set(list); paint(); paintTools(); } };
  const tip = q('.iv-tip');
  // Kiểu đang hiện trên thanh công cụ: của nét đang chọn / chữ đang sửa, nếu không thì kiểu mặc định
  const curIdx = () => (textBox?.i ?? sel);
  const cur = () => { const i = curIdx(); return i != null && list[i] ? { ...style, w: 2, a: 1, st: true, b: false, i: false, z: 20, ...list[i], c: markColor(list[i].c) } : style; };
  const curType = () => { const i = curIdx(); if (i != null && list[i]) return list[i].t; return textBox ? 'text' : tool; };
  // Đổi kiểu: có nét đang chọn thì chỉ đổi nét đó, không thì đổi kiểu mặc định cho nét sau
  const setProp = (patch) => {
    const i = curIdx();
    if (i != null && list[i]) {
      if (!selStart) selStart = list;
      list = list.map((m, k) => (k === i ? { ...m, ...patch } : m)); anno.set(list);
    }
    if (i == null) { Object.assign(style, patch); saveStyle(); } // chỉ nét mới mới dùng kiểu mặc định; sửa nét cũ không đổi mặc định
    paint(); paintTools();
  };
  const setMode = (on) => {
    drawing = on; dlg.classList.toggle('drawing', on);
    q('.iv-tools').hidden = !on; q('[data-iv-draw]').hidden = on;
    if (!on) { closeText(true); endSel(); }
    tip.textContent = on ? `${DEL_HINT} removes the selected drawing · ${opts.autosave ? 'Saved automatically' : 'Saved when you press Save trade'}` : baseTip;
    paint(); paintTools();
  };
  const paintTools = () => {
    if (!anno) return;
    const c = cur(); const type = curType();
    dlg.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('on', b.dataset.tool === tool));
    dlg.querySelectorAll('.iv-for').forEach((el) => { el.hidden = !el.dataset.for.split(' ').includes(type); });
    q('.iv-editing').hidden = curIdx() == null;
    const sw = q('.iv-swatch span'); sw.style.background = c.c; // màu đặc, opacity chỉnh trong bảng màu
    if (document.activeElement !== q('[data-iv-hex]')) q('[data-iv-hex]').value = c.c.toUpperCase();
    q('[data-iv-picker]').value = c.c;
    q('[data-iv-opacity]').value = Math.round(c.a * 100); q('[data-iv-opv]').textContent = `${Math.round(c.a * 100)}%`;
    q('[data-iv-opacity]').style.setProperty('--oc', c.c); q('.iv-cur').style.background = c.c;
    q('[data-iv-width]').value = c.w; q('[data-iv-wv]').textContent = c.w;
    q('[data-iv-border]').checked = c.st !== false;
    q('[data-iv-size]').value = c.z;
    q('[data-iv-bold]').classList.toggle('on', !!c.b);
    q('[data-iv-italic]').classList.toggle('on', !!c.i);
    dlg.querySelectorAll('[data-preset]').forEach((b) => b.classList.toggle('on', b.dataset.preset.toLowerCase() === c.c.toLowerCase()));
    stage.dataset.mode = tool; // data-mode, KHÔNG dùng data-tool (data-tool là của nút công cụ)
    if (textBox) styleTextBox();
  };
  const pick = (k) => ({ c: style.c, a: style.a, ...(k === 'text' ? { z: style.z, ...(style.b ? { b: true } : {}), ...(style.i ? { i: true } : {}) } : { w: style.w }), ...(k === 'box' && !style.st ? { st: false } : {}) });
  const pos = (e) => { const r = svg.getBoundingClientRect(); return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))]; };
  const hitIdx = (e) => { const v = e.target.closest?.('[data-mi]')?.dataset.mi; return v == null ? null : Number(v); };

  // ----- Ô gõ chữ: chỉ còn viền mảnh mờ, chữ đúng màu và cỡ như lúc vẽ xong -----
  function styleTextBox() {
    const c = cur(); const inp = textBox.input;
    const scale = svg.getBoundingClientRect().height / H; // px màn hình trên 1 đơn vị ảnh
    inp.style.fontSize = `${Math.max(10, ((c.z * H) / 700) * scale)}px`;
    inp.style.fontWeight = c.b ? 700 : 400; inp.style.fontStyle = c.i ? 'italic' : 'normal';
    inp.style.color = c.c; inp.style.opacity = c.a; inp.style.setProperty('--tc', c.c);
    inp.size = Math.max(6, inp.value.length + 2);
  }
  function openText(x, y, i = null) {
    closeText(true);
    if (i != null) { sel = i; selStart = list; }
    const el = document.createElement('div'); el.className = 'anno-text';
    el.style.left = `${x * 100}%`; el.style.top = `${y * 100}%`;
    el.innerHTML = '<input type="text" maxlength="120" placeholder="Type…" aria-label="Text on chart">';
    stage.append(el);
    textBox = { el, input: el.querySelector('input'), x, y, i };
    if (i != null) textBox.input.value = list[i].s;
    textBox.input.addEventListener('input', () => styleTextBox());
    textBox.input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') { ev.preventDefault(); closeText(true); }
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeText(false); }
    });
    paint(); paintTools();
    textBox.input.focus(); // focus ngay để gõ được liền, rồi focus lại sau khi trình duyệt xử lý xong cú bấm
    setTimeout(() => { textBox?.input.focus(); if (i != null) textBox?.input.select(); }, 0);
  }
  function closeText(save) {
    if (!textBox) return;
    const tb = textBox; textBox = null; tb.el.remove();
    const v = tb.input.value.trim().slice(0, 120);
    if (tb.i != null) { // sửa chữ có sẵn
      if (save && v && v !== list[tb.i].s) { list = list.map((m, k) => (k === tb.i ? { ...m, s: v } : m)); anno.set(list); }
      if (save && !v) { const keep = selStart || list; sel = null; selStart = null; undo.push(keep); list = list.filter((_, k) => k !== tb.i); anno.set(list); }
      endSel(); paint(); paintTools(); return;
    }
    if (save && v) { commit([...list, { t: 'text', x: tb.x, y: tb.y, s: v, ...pick('text') }]); backToSelect(false); } else { paint(); paintTools(); }
  }

  if (anno) {
    const pop = q('.iv-pop');
    q('[data-iv-color]').addEventListener('click', (e) => { e.stopPropagation(); pop.hidden = !pop.hidden; });
    dlg.addEventListener('pointerdown', (e) => { if (!pop.hidden && !e.target.closest('.iv-colorwrap')) pop.hidden = true; });
    // Bấm các nút kiểu không làm mất ô chữ đang gõ
    q('.iv-style').addEventListener('mousedown', (e) => { if (textBox && !e.target.matches('input, select')) e.preventDefault(); });
    dlg.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => setProp({ c: b.dataset.preset })));
    q('[data-iv-picker]').addEventListener('input', (e) => setProp({ c: e.target.value }));
    q('[data-iv-hex]').addEventListener('input', (e) => { let v = e.target.value.trim(); if (!v.startsWith('#')) v = `#${v}`; if (/^#[0-9a-f]{6}$/i.test(v)) setProp({ c: v }); });
    q('[data-iv-opacity]').addEventListener('input', (e) => setProp({ a: Number(e.target.value) / 100 }));
    q('[data-iv-width]').addEventListener('input', (e) => setProp({ w: Number(e.target.value) }));
    q('[data-iv-border]').addEventListener('change', (e) => setProp({ st: e.target.checked }));
    q('[data-iv-size]').addEventListener('change', (e) => { setProp({ z: Number(e.target.value) }); textBox?.input.focus(); });
    q('[data-iv-bold]').addEventListener('click', () => { setProp({ b: !cur().b }); textBox?.input.focus(); });
    q('[data-iv-italic]').addEventListener('click', () => { setProp({ i: !cur().i }); textBox?.input.focus(); });
    q('[data-iv-draw]').addEventListener('click', () => setMode(true));
    q('[data-iv-done]').addEventListener('click', () => setMode(false));
    dlg.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { closeText(true); endSel(); draft = null; draftHeld = false; tool = b.dataset.tool; paint(); paintTools(); }));
    q('[data-iv-undo]').addEventListener('click', () => { closeText(false); doUndo(); });
    q('[data-iv-clear]').addEventListener('click', () => { closeText(false); if (list.length) commit([]); });
    // Phím tắt khi vẽ (bắt ở document vì con trỏ có thể không nằm trong khung)
    const onKey = (e) => {
      if (!drawing || e.target.matches?.('input[type="text"]')) return; // đang gõ chữ thì để ô chữ tự xử lý
      if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyZ' || e.key.toLowerCase() === 'z') && !e.shiftKey) { e.preventDefault(); e.stopImmediatePropagation(); doUndo(); return; }
      if (isDeleteKey(e) && sel != null) { e.preventDefault(); e.stopImmediatePropagation(); const i = sel; commit(list.filter((_, k) => k !== i)); paintTools(); }
    };
    document.addEventListener('keydown', onKey, true);
    dlg.addEventListener('close', () => document.removeEventListener('keydown', onKey, true));

    svg.addEventListener('pointerdown', (e) => {
      if (!drawing) return;
      e.preventDefault();
      // Kiểu bấm-bấm (10/11): đã bấm điểm đầu thì cú bấm này là điểm cuối
      if (draft) { draft.pending = false; finish(); return; }
      // Kéo điểm nắm của nét đang chọn
      const hh = e.target.closest?.('[data-h]')?.dataset.h;
      if (hh && sel != null) {
        const o = list[sel];
        const base = o.t === 'box' ? { ...o, x1: Math.min(o.x1, o.x2), x2: Math.max(o.x1, o.x2), y1: Math.min(o.y1, o.y2), y2: Math.max(o.y1, o.y2) } : o;
        drag = { handle: hh, orig: base };
        try { svg.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
        return;
      }
      const hit = hitIdx(e);
      if (tool === 'erase') { if (hit != null) { commit(list.filter((_, k) => k !== hit)); backToSelect(false); } return; }
      const [x, y] = pos(e);
      // Bấm vào chữ có sẵn (bằng Select hoặc Text) → sửa chữ đó
      if ((tool === 'select' || tool === 'text') && hit != null && list[hit].t === 'text') { openText(list[hit].x, list[hit].y, hit); return; }
      // Bấm vào nét có sẵn bằng Select, Line, Arrow hoặc Box → chọn nét đó để kéo / sửa
      if (tool === 'select' || (hit != null && ['line', 'arrow', 'box'].includes(tool))) {
        closeText(true);
        if (hit == null) { endSel(); paint(); paintTools(); return; }
        if (sel !== hit) { endSel(); sel = hit; selStart = list; }
        drag = { x, y, orig: list[hit] };
        try { svg.setPointerCapture(e.pointerId); } catch { /* bỏ qua */ }
        paint(); paintTools();
        return;
      }
      if (tool === 'text') { endSel(); openText(x, y); return; }
      endSel();
      draft = { t: tool, x1: x, y1: y, x2: x, y2: y, ...pick(tool) };
      draftHeld = true; // đang giữ chuột; thả ra mà chưa kéo thì chuyển sang chờ cú bấm thứ hai
      paint(); paintTools();
    });
    svg.addEventListener('pointermove', (e) => {
      if (drag && drag.handle) { // kéo điểm nắm: đổi điểm đầu/cuối hoặc kích thước box
        let [x, y] = pos(e); const o = drag.orig; const h = drag.handle; let n;
        if (h === 'p1' || h === 'p2') {
          const ax = h === 'p1' ? o.x2 : o.x1; const ay = h === 'p1' ? o.y2 : o.y1;
          if (e.shiftKey) { const dx = (x - ax) * W; const dy = (y - ay) * H; const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); const len = Math.hypot(dx, dy); x = Math.min(1, Math.max(0, ax + (Math.cos(ang) * len) / W)); y = Math.min(1, Math.max(0, ay + (Math.sin(ang) * len) / H)); }
          n = h === 'p1' ? { ...o, x1: x, y1: y } : { ...o, x2: x, y2: y };
        } else {
          n = { ...o };
          if (h.includes('w')) n.x1 = x; if (h.includes('e')) n.x2 = x;
          if (h.includes('n')) n.y1 = y; if (h.includes('s')) n.y2 = y;
        }
        list = list.map((m, k) => (k === sel ? n : m)); paint();
        return;
      }
      if (drag) { // kéo để di chuyển nét đang chọn
        const [x, y] = pos(e); const dx = x - drag.x; const dy = y - drag.y; const o = drag.orig;
        const cl = (v) => Math.min(1, Math.max(0, v));
        const moved = o.t === 'text' ? { ...o, x: cl(o.x + dx), y: cl(o.y + dy) } : o.t === 'hline' ? { ...o, y: cl(o.y + dy) } : { ...o, x1: cl(o.x1 + dx), x2: cl(o.x2 + dx), y1: cl(o.y1 + dy), y2: cl(o.y2 + dy) };
        list = list.map((m, k) => (k === sel ? moved : m)); paint();
        return;
      }
      if (!draft) return;
      let [x, y] = pos(e);
      // Giữ Shift: đường thẳng ngang / dọc / chéo 45° (tính theo pixel thật của ảnh)
      if (e.shiftKey && (draft.t === 'line' || draft.t === 'arrow')) {
        const dx = (x - draft.x1) * W; const dy = (y - draft.y1) * H;
        const ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4); const len = Math.hypot(dx, dy);
        x = Math.min(1, Math.max(0, draft.x1 + (Math.cos(ang) * len) / W)); y = Math.min(1, Math.max(0, draft.y1 + (Math.sin(ang) * len) / H));
      }
      draft.x2 = x; draft.y2 = y; paint();
    });
    const finish = () => {
      if (drag) { drag = null; anno.set(list); return; }
      if (!draft) return;
      const { pending, ...d } = draft; draft = null; draftHeld = false;
      if (Math.hypot(d.x2 - d.x1, d.y2 - d.y1) < 0.01) { paint(); return; } // hai cú bấm trùng chỗ thì bỏ
      commit([...list, d]);
      backToSelect(true);
    };
    svg.addEventListener('pointerup', () => {
      if (drag) { finish(); return; }
      if (!draft || !draftHeld) return;
      draftHeld = false;
      // Giữ chuột kéo rồi thả → xong luôn. Chỉ bấm (không kéo) → nét đi theo chuột, bấm lần nữa để kết thúc
      if (Math.hypot(draft.x2 - draft.x1, draft.y2 - draft.y1) >= 0.01) finish(); else { draft.pending = true; paint(); }
    });
    svg.addEventListener('pointercancel', () => { draft = null; drag = null; draftHeld = false; paint(); });
    // Đang gõ chữ / mở bảng màu / đang chọn nét thì Esc chỉ thoát cái đó, không đóng khung
    dlg.addEventListener('cancel', (e) => {
      if (draft) { e.preventDefault(); draft = null; draftHeld = false; paint(); } else if (textBox) { e.preventDefault(); closeText(false); } else if (!pop.hidden) { e.preventDefault(); pop.hidden = true; } else if (sel != null) { e.preventDefault(); endSel(); paint(); paintTools(); }
    });
    paintTools();
  }
  dlg.addEventListener('close', () => dlg.remove());
  dlg.addEventListener('click', (e) => { if (!drawing && (e.target === dlg || e.target.classList.contains('iv-body'))) dlg.close(); });
  q('[data-iv-close]').addEventListener('click', () => { closeText(true); endSel(); dlg.close(); });
  q('[data-iv-replace]')?.addEventListener('click', () => { dlg.close(); onReplace(); });
  q('[data-iv-delimg]')?.addEventListener('click', () => { dlg.close(); opts.onDelete(); });
  dlg.showModal();
}

// ---------- Hộp xác nhận dùng chung (thay cho confirm() của trình duyệt) ----------
// actions: [{ label, value, danger }]. Trả về value của nút được bấm, hoặc null nếu huỷ.
function askDialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'ask';
    dlg.innerHTML = `<h3>${title}</h3><p class="hint">${body}</p>
      <div class="ask-actions">
        <button type="button" class="btn" value="">Cancel</button>
        ${actions.map((a) => `<button type="button" class="btn ${a.danger ? 'btn-danger-solid' : ''}" value="${a.value}">${a.label}</button>`).join('')}
      </div>`;
    document.body.append(dlg);
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v || null); };
    dlg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.value)));
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.showModal();
    dlg.querySelector('button').focus(); // nút Cancel được chọn sẵn, lỡ nhấn Enter cũng không xoá
  });
}

// ---------- Chuyển lệnh sang ngày khác (11/11) ----------
// Hai cách: nút "Move to…" trên từng lệnh, hoặc kéo cả ô ngày (có lệnh) thả lên ô ngày khác. Chỉ đổi ngày; giờ, tài khoản, ghi chú ngày giữ nguyên.
// Hỏi 1 dòng chữ (14/11, dùng cho "+ Add session…")
function askTextDialog({ title, body, label, ok = 'Add', max = 40 }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'ask';
    dlg.innerHTML = `<h3>${title}</h3><p class="hint">${body}</p>
      <label class="inline">${label} <input type="text" maxlength="${max}" style="width:200px"></label>
      <div class="ask-actions"><button type="button" class="btn" value="">Cancel</button><button type="button" class="btn btn-primary" value="ok">${ok}</button></div>`;
    document.body.append(dlg);
    const input = dlg.querySelector('input');
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.value === 'ok' && input.value.trim() ? input.value.trim() : null)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dlg.querySelector('[value="ok"]').click(); } });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.showModal();
    input.focus();
  });
}
// Ô Session trong form lệnh: danh sách phiên + phiên cũ của lệnh (nếu đã bị bỏ) + "+ Add session…"
function sessionOpts(cur) {
  const list = cur && !SESSIONS.includes(cur) ? [...SESSIONS, cur] : SESSIONS;
  return `${list.map((s) => `<option ${s === cur ? 'selected' : ''}>${esc(s)}</option>`).join('')}<option value="__add">+ Add session…</option>`;
}
function bindSessionSelect(sel) {
  let last = sel.value;
  sel.addEventListener('change', async () => {
    if (sel.value !== '__add') { last = sel.value; return; }
    sel.value = last;
    const name = await askTextDialog({ title: 'Add a session', body: 'Name it the way you like, for example “Sydney” or “NY lunch”. It is added to the list for every trade.', label: 'Session' });
    if (!name) return;
    const hit = SESSIONS.find((x) => x.toLowerCase() === name.toLowerCase());
    if (!hit) {
      const next = [...SESSIONS, name];
      try { await api('/api/settings', { method: 'PUT', body: JSON.stringify({ sessions: next }) }); SESSIONS = next; } catch (ex) { toast(ex.message); return; }
    }
    sel.innerHTML = sessionOpts(hit || name); last = sel.value;
    sel.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
function pickDateDialog({ title, body, value }) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    dlg.className = 'ask';
    dlg.innerHTML = `<h3>${title}</h3><p class="hint">${body}</p>
      <label class="inline">New date <input type="date" value="${esc(value)}" style="width:170px"></label>
      <div class="ask-actions"><button type="button" class="btn" value="">Cancel</button><button type="button" class="btn btn-primary" value="ok">Move</button></div>`;
    document.body.append(dlg);
    const input = dlg.querySelector('input');
    const done = (v) => { dlg.close(); dlg.remove(); resolve(v); };
    dlg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.value === 'ok' && /^\d{4}-\d{2}-\d{2}$/.test(input.value) ? input.value : null)));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); dlg.querySelector('[value="ok"]').click(); } });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); done(null); });
    dlg.showModal();
    input.focus();
  });
}
async function moveTrades(list, to) {
  const moved = [];
  try {
    for (const t of list) {
      await api(`/api/trades/${t.id}/date`, { method: 'PUT', body: JSON.stringify({ date: to }) });
      moved.push({ kind: 'move', id: t.id, from: t.date });
    }
  } catch (ex) { toast(`Could not move: ${ex.message}`); }
  if (!moved.length) return;
  closeDayModal();
  await route();
  pushUndo(`Moved ${moved.length} trade${moved.length === 1 ? '' : 's'} to ${longDate(to)}`, moved);
}
document.addEventListener('click', async (e) => {
  const b = e.target.closest?.('[data-move-trade]');
  if (!b) return;
  const t = allTrades.find((x) => x.id === Number(b.dataset.moveTrade));
  if (!t) return;
  const to = await pickDateDialog({ title: 'Move trade', body: 'Pick the new date. The time stays the same.', value: t.date });
  if (to && to !== t.date) await moveTrades([t], to);
});
let dragDay = null;
const clearDrop = () => document.querySelectorAll('.cal-day.drop-target, .cal-day.dragging').forEach((c) => c.classList.remove('drop-target', 'dragging'));
document.addEventListener('dragstart', (e) => {
  const c = e.target.closest?.('.cal-day[data-day][draggable="true"]');
  if (!c) return;
  dragDay = c.dataset.day;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragDay);
  c.classList.add('dragging');
});
document.addEventListener('dragend', () => { dragDay = null; clearDrop(); });
document.addEventListener('dragover', (e) => {
  const c = e.target.closest?.('.cal-day[data-day]');
  if (!dragDay || !c || c.dataset.day === dragDay) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  if (!c.classList.contains('drop-target')) { document.querySelectorAll('.cal-day.drop-target').forEach((x) => x.classList.remove('drop-target')); c.classList.add('drop-target'); }
});
document.addEventListener('drop', async (e) => {
  const c = e.target.closest?.('.cal-day[data-day]');
  if (!dragDay || !c || c.dataset.day === dragDay) return;
  e.preventDefault();
  const from = dragDay; const to = c.dataset.day;
  dragDay = null; clearDrop();
  const list = trades.filter((t) => t.date === from);
  if (!list.length) return;
  const ok = await askDialog({
    title: `Move ${list.length} trade${list.length === 1 ? '' : 's'} to ${longDate(to)}?`,
    body: `From ${longDate(from)}. Only the date changes: times and accounts stay the same. Day notes stay on their day.`,
    actions: [{ label: 'Move', value: 'yes' }],
  });
  if (ok) await moveTrades(list, to);
});

// Xoá lệnh và/hoặc ghi chú của một ngày (từ lịch Dashboard: nút Delete… hoặc phím Delete)
async function deleteDay(day) {
  if (!day) return;
  const rows = trades.filter((t) => t.date === day);
  const hasNote = !!notes[day];
  const n = rows.length;
  const tradesLabel = `Delete ${n} trade${n === 1 ? '' : 's'}`;
  if (!n && !hasNote) {
    await askDialog({ title: longDate(day), body: 'Nothing to delete on this day.', actions: [] });
    return;
  }
  const actions = [];
  if (n) actions.push({ label: tradesLabel, value: 'trades', danger: true });
  if (hasNote) actions.push({ label: 'Delete note', value: 'note', danger: true });
  if (n && hasNote) actions.push({ label: 'Delete both', value: 'both', danger: true });
  const pick = await askDialog({
    title: `Delete from ${longDate(day)}?`,
    body: `${n ? `${n} trade${n === 1 ? '' : 's'} (with chart images)` : ''}${n && hasNote ? ' and ' : ''}${hasNote ? 'a day note' : ''}. They go to Trash. Press ${IS_MAC ? '⌘' : 'Ctrl+'}Z to undo.`,
    actions,
  });
  if (!pick) return;
  const undo = [];
  try {
    if (pick === 'trades' || pick === 'both') for (const t of rows) { await api(`/api/trades/${t.id}`, { method: 'DELETE' }); undo.push({ kind: 'trade', id: t.id }); }
    if (pick === 'note' || pick === 'both') { await api(`/api/notes/${day}`, { method: 'PUT', body: JSON.stringify({ note: '' }) }); undo.push({ kind: 'day_note', id: day }); }
  } catch (ex) {
    await askDialog({ title: 'Could not delete', body: esc(ex.message), actions: [] });
  }
  await route(); // tải lại dữ liệu và vẽ lại trang đang mở
  const what = [undo.some((u) => u.kind === 'trade') ? `${n} trade${n === 1 ? '' : 's'}` : '', undo.some((u) => u.kind === 'day_note') ? 'day note' : ''].filter(Boolean).join(' + ');
  pushUndo(`Deleted ${what} (${fmtDate(day)})`, undo);
}

// Phím Delete / Backspace khi đang chọn một ngày trên lịch (không tính lúc đang gõ chữ)
document.addEventListener('keydown', (e) => {
  if (!isDeleteKey(e)) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable], dialog')) return;
  if ((location.hash || '#/') !== '#/' || !calSelected) return;
  e.preventDefault();
  deleteDay(calSelected);
});

// ---------- Menu chuột phải cho lệnh: Open / Edit / Delete; nhiều lệnh đang chọn: Delete selected ----------
let ctxMenu = null;
function closeCtx() { ctxMenu?.remove(); ctxMenu = null; }
function showMenu(x, y, items, onPick) {
  closeCtx();
  ctxMenu = document.createElement('div');
  ctxMenu.className = 'ctx-menu';
  ctxMenu.setAttribute('role', 'menu');
  ctxMenu.innerHTML = items.map((it) => `<button type="button" role="menuitem" data-act="${it.act}" class="${it.danger ? 'danger' : ''}">${it.label}</button>`).join('');
  document.body.append(ctxMenu);
  // Đặt menu tại con trỏ, không tràn khỏi màn hình
  const w = ctxMenu.offsetWidth; const h = ctxMenu.offsetHeight;
  ctxMenu.style.left = `${Math.min(x, innerWidth - w - 8)}px`;
  ctxMenu.style.top = `${Math.min(y, innerHeight - h - 8)}px`;
  ctxMenu.querySelector('button').focus();
  ctxMenu.addEventListener('click', (ev) => {
    const act = ev.target.closest('[data-act]')?.dataset.act;
    closeCtx();
    if (act) onPick(act);
  });
}
async function deleteOneTrade(t) {
  const name = [fmtDate(t.date), t.time, t.symbol].filter(Boolean).join(' · ');
  const ok = await askDialog({ title: 'Delete this trade?', body: `${esc(name)}. It goes to Trash, and ${IS_MAC ? '⌘' : 'Ctrl+'}Z brings it back.`, actions: [{ label: 'Delete trade', value: 'yes', danger: true }] });
  if (!ok) return;
  try { await api(`/api/trades/${t.id}`, { method: 'DELETE' }); } catch (ex) { await askDialog({ title: 'Could not delete', body: esc(ex.message), actions: [] }); return; }
  if ((location.hash || '').startsWith(`#/trade/${t.id}`)) location.hash = '#/trades'; else await route();
  pushUndo(`Deleted trade ${name}`, [{ kind: 'trade', id: t.id }]);
}
document.addEventListener('contextmenu', (e) => {
  closeCtx();
  // Chuột phải vào ô lịch: Open day / Delete… (xoá lệnh, ghi chú của ngày đó; có hỏi trước, Cmd+Z lấy lại)
  const calCell = e.target.closest('.cal-day[data-day]');
  if (calCell) {
    e.preventDefault();
    const day = calCell.dataset.day;
    calSelected = day;
    document.querySelectorAll('.cal-day.selected').forEach((c) => c.classList.remove('selected'));
    calCell.classList.add('selected');
    const hasStuff = trades.some((t) => t.date === day) || !!notes[day];
    showMenu(e.clientX, e.clientY, [
      { act: 'open', label: 'Open day' },
      { act: 'add', label: 'Add full trade' },
      ...(hasStuff ? [{ act: 'delete', label: 'Delete…', danger: true }] : []),
    ], (act) => {
      if (act === 'open') openDayModal(day);
      if (act === 'add') location.hash = `#/new?date=${day}`;
      if (act === 'delete') deleteDay(day);
    });
    return;
  }
  const el = e.target.closest('[data-ctx-trade]');
  const onTrades = (location.hash || '') === '#/trades';
  // Trang Trades, đang chọn nhiều lệnh: chuột phải vào lệnh đã chọn (hoặc chỗ trống) → xoá tất cả lệnh đang chọn
  if (onTrades && gallerySel.size) {
    const inSel = el && gallerySel.has(Number(el.dataset.ctxTrade));
    if (inSel || (!el && e.target.closest('.gallery-area'))) {
      e.preventDefault();
      const n = gallerySel.size;
      showMenu(e.clientX, e.clientY, [
        { act: 'delete', label: `Delete ${n} selected`, danger: true },
        { act: 'clear', label: 'Clear selection' },
      ], (act) => { if (act === 'delete') deleteSelected(); else { gallerySel.clear(); syncGallerySel(); } });
      return;
    }
    gallerySel.clear(); syncGallerySel(); // chuột phải vào lệnh chưa chọn → bỏ chọn, menu cho 1 lệnh
  }
  if (!el) return;
  const t = allTrades.find((x) => x.id === Number(el.dataset.ctxTrade));
  if (!t) return;
  e.preventDefault();
  showMenu(e.clientX, e.clientY, [
    { act: 'open', label: 'Open' },
    { act: 'edit', label: 'Edit' },
    { act: 'delete', label: 'Delete', danger: true },
  ], (act) => {
    if (act === 'open') location.hash = `#/trade/${t.id}`;
    if (act === 'edit') location.hash = `#/trade/${t.id}/edit`;
    if (act === 'delete') deleteOneTrade(t);
  });
});

// ---------- Trang Trades: kéo chuột bôi đen để chọn nhiều lệnh ----------
// Kéo trên vùng thẻ để vẽ khung chọn. Cmd/Shift + bấm để chọn thêm từng thẻ. Cmd+A chọn hết.
// Chọn xong: chuột phải → "Delete N selected", hoặc nhấn phím delete. Esc để bỏ chọn.
let gallerySel = new Set();
function syncGallerySel() {
  document.querySelectorAll('.grid .card[data-ctx-trade]').forEach((c) => {
    const on = gallerySel.has(Number(c.dataset.ctxTrade));
    c.classList.toggle('sel', on);
    c.setAttribute('aria-selected', String(on));
  });
  const bar = document.getElementById('sel-bar');
  if (!bar) return;
  const n = gallerySel.size;
  bar.hidden = !n;
  bar.querySelector('b').textContent = `${n} trade${n === 1 ? '' : 's'} selected`;
}
async function deleteSelected() {
  const ids = [...gallerySel];
  if (!ids.length) return;
  const ok = await askDialog({
    title: `Delete ${ids.length} trade${ids.length === 1 ? '' : 's'}?`,
    body: `They go to Trash, with their chart images. Press ${IS_MAC ? '⌘' : 'Ctrl+'}Z to bring them back.`,
    actions: [{ label: `Delete ${ids.length}`, value: 'yes', danger: true }],
  });
  if (!ok) return;
  const done = [];
  try { for (const id of ids) { await api(`/api/trades/${id}`, { method: 'DELETE' }); done.push({ kind: 'trade', id }); } } catch (ex) { await askDialog({ title: 'Could not delete', body: esc(ex.message), actions: [] }); }
  gallerySel.clear();
  await route();
  pushUndo(`Deleted ${done.length} trade${done.length === 1 ? '' : 's'}`, done);
}
function bindGallerySelect() {
  const area = app.querySelector('.gallery-area');
  if (!area) return;
  gallerySel = new Set([...gallerySel].filter((id) => area.querySelector(`[data-ctx-trade="${id}"]`)));
  syncGallerySel();
  let dragged = false;
  area.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || e.target.closest('input, select, button, textarea')) return;
    e.preventDefault(); // không bôi đen chữ, không kéo ảnh/link
    const x0 = e.clientX; const y0 = e.clientY;
    const add = e.metaKey || e.ctrlKey || e.shiftKey;
    const base = add ? new Set(gallerySel) : new Set();
    let box = null;
    dragged = false;
    const move = (ev) => {
      if (!dragged && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 6) return;
      dragged = true;
      if (!box) { box = document.createElement('div'); box.className = 'marquee'; document.body.append(box); }
      const l = Math.min(x0, ev.clientX); const t = Math.min(y0, ev.clientY);
      const r = Math.max(x0, ev.clientX); const btm = Math.max(y0, ev.clientY);
      Object.assign(box.style, { left: `${l}px`, top: `${t}px`, width: `${r - l}px`, height: `${btm - t}px` });
      gallerySel = new Set(base);
      area.querySelectorAll('.card[data-ctx-trade]').forEach((c) => {
        const b = c.getBoundingClientRect();
        if (b.left < r && b.right > l && b.top < btm && b.bottom > t) gallerySel.add(Number(c.dataset.ctxTrade));
      });
      syncGallerySel();
    };
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      box?.remove();
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });
  // Bấm thẻ: sau khi kéo thì không mở lệnh; Cmd/Shift + bấm thì chọn thêm/bỏ chọn; bấm chỗ trống thì bỏ chọn
  area.addEventListener('click', (e) => {
    const c = e.target.closest('.card[data-ctx-trade]');
    if (dragged) { e.preventDefault(); dragged = false; return; }
    if (c && (e.metaKey || e.ctrlKey || e.shiftKey)) {
      e.preventDefault();
      const id = Number(c.dataset.ctxTrade);
      if (gallerySel.has(id)) gallerySel.delete(id); else gallerySel.add(id);
      syncGallerySel();
      return;
    }
    if (!c) { gallerySel.clear(); syncGallerySel(); }
  });
  document.getElementById('sel-delete')?.addEventListener('click', deleteSelected);
  document.getElementById('sel-clear')?.addEventListener('click', () => { gallerySel.clear(); syncGallerySel(); });
}
document.addEventListener('keydown', (e) => {
  if ((location.hash || '') !== '#/trades' || e.target.closest?.('input, textarea, select, [contenteditable="true"], dialog')) return;
  if ((e.metaKey || e.ctrlKey) && (e.code === 'KeyA' || e.key.toLowerCase() === 'a')) {
    e.preventDefault();
    document.querySelectorAll('.grid .card[data-ctx-trade]').forEach((c) => gallerySel.add(Number(c.dataset.ctxTrade)));
    syncGallerySel();
  } else if (isDeleteKey(e) && gallerySel.size) {
    e.preventDefault(); deleteSelected();
  } else if (e.key === 'Escape' && gallerySel.size) {
    gallerySel.clear(); syncGallerySel();
  }
});
document.addEventListener('click', (e) => { if (ctxMenu && !ctxMenu.contains(e.target)) closeCtx(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCtx(); });
window.addEventListener('scroll', closeCtx, { passive: true });

// ---------- Hoàn tác: Cmd+Z (Mac) / Ctrl+Z (Windows) sau khi xoá ----------
// Xoá giờ chỉ chuyển vào thùng rác (server giữ 30 ngày), nên hoàn tác = khôi phục từ thùng rác.
// Undo được nhớ trong tab này (sessionStorage), nên tải lại trang vẫn Cmd+Z được.
const undoStack = (() => { try { return JSON.parse(sessionStorage.getItem('rj-undo') || '[]'); } catch { return []; } })();
const saveUndo = () => { try { sessionStorage.setItem('rj-undo', JSON.stringify(undoStack)); } catch { /* bỏ qua */ } };
let isDemo = false;        // bản demo: dữ liệu chỉ nằm trong trình duyệt này
let isTestCopy = false;     // true = đang mở BẢN THỬ của Claude (cổng 3100), không phải journal thật
let serverHasTrash = true;   // false = server đang chạy là bản cũ (xoá là mất hẳn, không hoàn tác được)

// Server cũ: hiện dải cảnh báo đỏ trên cùng, chỉ cách sửa
function showServerBanner() {
  // Bản thử của Claude: dải vàng rõ ràng, để không nhầm với journal thật
  let tb = document.getElementById('test-banner');
  if (isTestCopy && !tb) {
    tb = document.createElement('div');
    tb.id = 'test-banner'; tb.className = 'test-banner'; tb.setAttribute('role', 'alert');
    tb.innerHTML = '<b>TEST COPY</b> · This is Claude’s test page. Nothing here is saved to your journal. Your real journal is <a href="http://localhost:3000">localhost:3000</a>.';
    document.querySelector('.main-col').prepend(tb);
  }
  let el = document.getElementById('server-banner');
  if (serverHasTrash) { el?.remove(); return; }
  if (el) return;
  el = document.createElement('div');
  el.id = 'server-banner'; el.className = 'server-banner'; el.setAttribute('role', 'alert');
  el.innerHTML = '<b>Your journal is running an old version.</b> Deleting is permanent and Undo does not work. Close this tab, then double-click <b>Mo Journal</b> to restart it.';
  document.querySelector('.main-col').prepend(el);
}
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
// Phím xoá (10/11): Delete / Backspace, và Cmd+X (Mac) / Ctrl+X (Windows) cho quen tay dân edit.
// Nhận phím X theo VỊ TRÍ phím (e.code) vì bộ gõ tiếng Việt có thể đổi e.key. Các chỗ gọi hàm này đã bỏ qua lúc đang gõ trong ô chữ.
const isDeleteKey = (e) => e.key === 'Delete' || e.key === 'Backspace'
  || ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.code === 'KeyX' || (e.key || '').toLowerCase() === 'x'));
const DEL_HINT = `Delete or ${IS_MAC ? '⌘' : 'Ctrl+'}X`;

function toast(msg, withUndo = false) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast'; el.className = 'toast'; el.setAttribute('role', 'status');
    document.body.append(el);
  }
  el.innerHTML = `<span>${esc(msg)}</span>${withUndo ? `<button type="button">Undo <kbd>${IS_MAC ? '⌘' : 'Ctrl+'}Z</kbd></button>` : ''}`;
  el.querySelector('button')?.addEventListener('click', undoLast);
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), withUndo ? 10000 : 4000);
}
function pushUndo(label, items) {
  if (!items.length) return;
  if (!serverHasTrash) { toast(`${label} for good. Undo needs the new journal: restart Mo Journal.`); return; }
  undoStack.push({ label, items });
  if (undoStack.length > 30) undoStack.shift();
  saveUndo();
  toast(label, true);
}
async function undoLast() {
  const last = undoStack.pop();
  saveUndo();
  if (!last) { toast('Nothing to undo. Deleted items are in Settings → Trash.'); return; }
  try {
    // Việc chuyển ngày: trả từng lệnh về ngày cũ. Còn lại là xoá: khôi phục từ thùng rác.
    const moves = last.items.filter((i) => i.kind === 'move');
    const rest = last.items.filter((i) => i.kind !== 'move');
    const listItems = last.items.filter((i) => i.kind === 'listitem');
    const modelItems = last.items.filter((i) => i.kind === 'model');
    const resultItems = last.items.filter((i) => i.kind === 'result');
    const tmodelItems = last.items.filter((i) => i.kind === 'tmodel');
    const unmodelItems = last.items.filter((i) => i.kind === 'unmodel');
    const trashItems = rest.filter((i) => !['listitem', 'model', 'result', 'tmodel', 'unmodel'].includes(i.kind));
    for (const it of tmodelItems) await api(`/api/trades/${it.id}/strategy`, { method: 'PUT', body: JSON.stringify({ model_id: it.model_id, model_name: it.model_name, model_items: it.model_items, model_checks: it.model_checks }) });
    if (unmodelItems.length) { const ids = unmodelItems.map((i) => i.id); const next = MODELS.filter((m) => !ids.includes(m.id)); await api('/api/settings', { method: 'PUT', body: JSON.stringify({ models: next }) }); MODELS = next; }
    for (const it of resultItems) await api(`/api/trades/${it.id}/result`, { method: 'PUT', body: JSON.stringify({ pnl_usd: it.pnl, result_r: it.r }) });
    for (const m of moves) await api(`/api/trades/${m.id}/date`, { method: 'PUT', body: JSON.stringify({ date: m.from }) });
    // Lựa chọn đã xoá khỏi danh sách: đặt lại đúng vị trí cũ
    for (const it of listItems) {
      const [get, set] = LISTS[it.key];
      if (get().includes(it.v)) continue;
      const next = [...get()]; next.splice(Math.min(it.i, next.length), 0, it.v);
      set(next);
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ [it.key]: next }) });
    }
    // Model đã xoá: đặt lại đúng vị trí cũ (lệnh cũ của model nhận lại tên và công thức)
    for (const it of modelItems) {
      if (!it.m) { await restoreTrashedModel(it.id, it.i); continue; } // 14/11: strategy nằm trong Trash
      if (MODELS.some((x) => x.id === it.m.id)) continue;
      const next = [...MODELS]; next.splice(Math.min(it.i, next.length), 0, it.m);
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ models: next }) });
      MODELS = next;
    }
    if (trashItems.length) await api('/api/trash/restore', { method: 'POST', body: JSON.stringify({ items: trashItems }) });
    if (listItems.length && !moves.length && !trashItems.length && !modelItems.length) {
      // Chỉ là danh sách chọn: vẽ lại các chip, KHÔNG dựng lại trang (đang gõ dở form thì không mất chữ)
      document.querySelectorAll('[data-chips], [data-me], [data-multi], [data-toggle]').forEach((b) => b.dispatchEvent(new Event('rj-repaint')));
      toast(`Brought back ${listItems.map((i) => i.v).join(', ')}`);
      return;
    }
    await route();
    toast(resultItems.length && !moves.length && !trashItems.length && !modelItems.length ? 'Result restored'
      : moves.length && !trashItems.length && !modelItems.length ? 'Moved back'
      : modelItems.length && !trashItems.length ? `Brought back ${modelItems.map((i) => i.m.name).join(', ')}`
      : `Restored: ${last.label.replace(/^Deleted /, '').replace(/^Moved /, '')}`);
  } catch (ex) {
    undoStack.push(last); saveUndo(); // chưa khôi phục được thì giữ lại để thử lần sau
    toast(`Could not undo: ${ex.message}`);
  }
}
document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || !(e.code === 'KeyZ' || e.key.toLowerCase() === 'z')) return;
  // Đang gõ trong ô chữ: để trình duyệt tự hoàn tác chữ đã gõ
  if (e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
  e.preventDefault();
  undoLast();
});

// ---------- Notebook: thư mục, ghi chú tự do, ghi chú ngày (theo ảnh ảnh mẫu chủ dự án gửi 08/11) ----------
let nb = { folders: [], notes: [] };
let nbView = 'all';     // all | day | f:<id>
let nbSel = null;       // { kind: 'note', id } | { kind: 'day', date }
let nbSearch = '';
let nbTimer = null;     // hẹn giờ tự lưu
let nbPending = null;   // hàm lưu đang chờ

async function loadNotebook() {
  try { nb = await api('/api/notebook'); } catch { nb = { folders: [], notes: [] }; }
}
// Lưu ngay phần đang gõ dở (gọi trước khi đổi trang hoặc đổi ghi chú)
async function nbFlush() {
  clearTimeout(nbTimer);
  const fn = nbPending; nbPending = null;
  if (fn) { try { await fn(); } catch { /* lỗi đã hiện ở dòng trạng thái */ } }
}
function nbSchedule(fn) {
  nbPending = fn;
  clearTimeout(nbTimer);
  const st = document.getElementById('nb-saved');
  if (st) { st.textContent = 'Saving…'; st.className = 'saved'; }
  nbTimer = setTimeout(nbFlush, 700);
}
function nbStatus(text, ok = true) {
  const st = document.getElementById('nb-saved');
  if (st) { st.textContent = text; st.className = `saved ${ok ? 'ok' : 'error'}`; }
}

// Chỉ giữ định dạng đơn giản: đậm, nghiêng, gạch chân, danh sách, tiêu đề. Bỏ mọi thuộc tính và thẻ lạ.
const NB_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'UL', 'OL', 'LI', 'H3', 'P', 'BR', 'DIV']);
function cleanHTML(html) {
  const doc = new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html');
  const walk = (node) => {
    [...node.childNodes].forEach((c) => {
      if (c.nodeType === 3) return;
      if (c.nodeType !== 1 || ['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE'].includes(c.tagName)) { c.remove(); return; }
      walk(c);
      if (!NB_TAGS.has(c.tagName)) { c.replaceWith(...c.childNodes); return; }
      [...c.attributes].forEach((a) => c.removeAttribute(a.name));
    });
  };
  const root = doc.body.firstElementChild;
  walk(root);
  return root.innerHTML;
}
const plainText = (html) => new DOMParser().parseFromString(`<div>${html || ''}</div>`, 'text/html').body.textContent || '';
const fmtStamp = (s) => (s ? new Date(`${s.replace(' ', 'T')}Z`).toLocaleString((window.I18N?.locale || 'en-US'), { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');

// Danh sách mục đang hiện ở cột giữa
function nbItems() {
  const q = nbSearch.toLowerCase();
  const dayItems = Object.keys(notes).sort().reverse().map((d) => ({ kind: 'day', date: d, title: longDate(d), sub: 'Day note', text: notes[d], sort: d }));
  const noteItems = nb.notes.map((n) => ({ kind: 'note', id: n.id, title: n.title || 'Untitled', sub: fmtStamp(n.updated_at), text: plainText(n.body), folder: n.folder_id, sort: n.updated_at.slice(0, 10) }));
  let items;
  if (nbView === 'day') items = dayItems;
  else if (nbView.startsWith('f:')) items = noteItems.filter((n) => n.folder === Number(nbView.slice(2)));
  else items = [...noteItems, ...dayItems].sort((a, b) => b.sort.localeCompare(a.sort));
  return q ? items.filter((it) => `${it.title} ${it.text}`.toLowerCase().includes(q)) : items;
}
const nbIsSel = (it) => nbSel && nbSel.kind === it.kind && (it.kind === 'day' ? nbSel.date === it.date : nbSel.id === it.id);

function nbListHTML() {
  const items = nbItems();
  return items.length ? `<ul class="nb-items">${items.map((it) => `
    <li><button type="button" class="nb-item ${nbIsSel(it) ? 'on' : ''}" ${it.kind === 'day' ? `data-open-day="${it.date}"` : `data-open-note="${it.id}"`}>
      <b>${esc(it.title)}</b><small>${esc(it.sub)}</small>
      ${it.text ? `<span>${esc(it.text.slice(0, 90))}</span>` : ''}
    </button></li>`).join('')}</ul>`
    : `<p class="hint nb-empty">${nbSearch ? 'No notes match your search.' : nbView === 'day' ? 'No day notes yet. Pick a date above to log a day.' : 'No notes here yet.'}</p>`;
}

// Số liệu ngày (biểu đồ + 8 con số), dùng chung kiểu với Daily Journal
function nbDayStats(day) {
  const rows = trades.filter((t) => t.date === day);
  if (!rows.length) return '<p class="hint">No trades on this day.</p>';
  const unit = chartUnit === 'usd' && rows.some((t) => t.pnl_usd != null) ? 'usd' : 'r';
  const html = dayCardHTML(day, rows, unit);
  const m = html.match(/<div class="day-body">[\s\S]*?<\/dl>\s*<\/div>/);
  return m ? m[0] : '';
}

function nbEditorHTML() {
  if (!nbSel) return '<div class="tile-empty"><p>Select a note, or create a new one.</p></div>';
  if (nbSel.kind === 'day') {
    const d = nbSel.date;
    return `
      <div class="nb-meta"><span>Day note · ${tzCity()} date</span><span class="saved" id="nb-saved" role="status"></span></div>
      <h2 class="nb-day-title">${longDate(d)}</h2>
      ${nbDayStats(d)}
      <label class="nb-label" for="nb-day-text">Note</label>
      <textarea id="nb-day-text" class="nb-day-text" rows="10" maxlength="2000" placeholder="How did the day go? Market, mood, why you sat out…">${esc(notes[d] || '')}</textarea>
      <div class="nb-actions">
        ${notes[d] ? '<button type="button" class="btn btn-soft btn-danger" data-nb-delete>Delete note</button>' : ''}
      </div>`;
  }
  const n = nb.notes.find((x) => x.id === nbSel.id);
  if (!n) return '<div class="tile-empty"><p>This note was deleted.</p></div>';
  const tool = (cmd, label, icon, arg = '') => `<button type="button" class="nb-tool" data-cmd="${cmd}" data-arg="${arg}" title="${label}" aria-label="${label}">${icon}</button>`;
  return `
    <div class="nb-meta"><span>Created: ${fmtStamp(n.created_at)} · Last updated: ${fmtStamp(n.updated_at)}</span><span class="saved" id="nb-saved" role="status"></span></div>
    <input class="nb-title" id="nb-title" value="${esc(n.title)}" placeholder="Untitled note" maxlength="200" aria-label="Note title">
    <div class="nb-row">
      <label class="inline">Folder
        <select id="nb-folder">
          <option value="">No folder</option>
          ${nb.folders.map((f) => `<option value="${f.id}" ${f.id === n.folder_id ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}
        </select>
      </label>
      <button type="button" class="btn btn-soft btn-danger" data-nb-delete>Delete note</button>
    </div>
    <div class="nb-toolbar" role="toolbar" aria-label="Formatting">
      ${tool('bold', 'Bold', '<b>B</b>')}
      ${tool('italic', 'Italic', '<i>I</i>')}
      ${tool('underline', 'Underline', '<u>U</u>')}
      <span class="nb-sep"></span>
      ${tool('formatBlock', 'Heading', '<b>H</b>', 'H3')}
      ${tool('formatBlock', 'Normal text', '¶', 'P')}
      <span class="nb-sep"></span>
      ${tool('insertUnorderedList', 'Bullet list', '•&thinsp;≡')}
      ${tool('insertOrderedList', 'Numbered list', '1.&thinsp;≡')}
    </div>
    <div class="nb-body" id="nb-body" contenteditable="true" role="textbox" aria-multiline="true" aria-label="Note" data-placeholder="Write something…">${cleanHTML(n.body)}</div>`;
}

function renderNotebook() {
  const count = (view) => {
    if (view === 'all') return nb.notes.length + Object.keys(notes).length;
    if (view === 'day') return Object.keys(notes).length;
    return nb.notes.filter((n) => n.folder_id === Number(view.slice(2))).length;
  };
  const fBtn = (view, name) => `<button type="button" class="nb-f ${nbView === view ? 'on' : ''}" data-view="${view}"><span>${esc(name)}</span><small>${count(view)}</small></button>`;
  app.innerHTML = `
    <div class="dash-top">
      <div><h1>Notebook</h1><p class="hint">Free notes and day notes in one place. Everything saves by itself.</p></div>
    </div>
    <div class="nb-searchbar">
      <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>
      <input type="search" id="nb-search" placeholder="Search notes" value="${esc(nbSearch)}" aria-label="Search notes">
    </div>
    <div class="nb">
      <aside class="tile nb-folders">
        <button type="button" class="btn btn-soft nb-add-folder" data-add-folder>+ Add folder</button>
        <p class="nb-sec">Folders</p>
        ${fBtn('all', 'All notes')}
        ${fBtn('day', 'Day notes')}
        ${nb.folders.map((f) => `<div class="nb-f-row">${fBtn(`f:${f.id}`, f.name)}<button type="button" class="nb-more" data-folder-menu="${f.id}" aria-label="Options for ${esc(f.name)}">···</button></div>`).join('')}
      </aside>
      <section class="tile nb-list">
        <header class="nb-list-head">
          ${nbView === 'day'
            ? `<label class="inline nb-logday">Log day <input type="date" id="nb-date" value="${todayStr()}" max="${todayStr()}"></label>`
            : '<button type="button" class="btn btn-primary" data-new-note>+ New note</button>'}
        </header>
        <div id="nb-list">${nbListHTML()}</div>
      </section>
      <section class="tile nb-editor" id="nb-editor">${nbEditorHTML()}</section>
    </div>`;
  nbBind();
}

// Gắn sự kiện. Chỉ vẽ lại phần cần thiết để con trỏ không bị nhảy khi đang gõ.
function nbBind() {
  const reList = () => { document.getElementById('nb-list').innerHTML = nbListHTML(); bindList(); };
  const open = async (sel) => { await nbFlush(); nbSel = sel; renderNotebook(); };
  const bindList = () => {
    app.querySelectorAll('[data-open-note]').forEach((b) => b.addEventListener('click', () => open({ kind: 'note', id: Number(b.dataset.openNote) })));
    app.querySelectorAll('[data-open-day]').forEach((b) => b.addEventListener('click', () => open({ kind: 'day', date: b.dataset.openDay })));
  };
  bindList();
  app.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', async () => { await nbFlush(); nbView = b.dataset.view; renderNotebook(); }));
  const search = document.getElementById('nb-search');
  search.addEventListener('input', () => { nbSearch = search.value; reList(); });

  app.querySelector('[data-add-folder]').addEventListener('click', async () => {
    const name = (prompt('Folder name') || '').trim();
    if (!name) return;
    try { const f = await api('/api/notebook/folders', { method: 'POST', body: JSON.stringify({ name }) }); await loadNotebook(); nbView = `f:${f.id}`; renderNotebook(); } catch (ex) { toast(ex.message); }
  });
  app.querySelectorAll('[data-folder-menu]').forEach((b) => b.addEventListener('click', async () => {
    const f = nb.folders.find((x) => x.id === Number(b.dataset.folderMenu));
    const pick = await askDialog({ title: esc(f.name), body: 'Deleting a folder keeps its notes. They move to All notes.', actions: [{ label: 'Rename', value: 'rename' }, { label: 'Delete folder', value: 'delete', danger: true }] });
    try {
      if (pick === 'rename') {
        const name = (prompt('New folder name', f.name) || '').trim();
        if (name) await api(`/api/notebook/folders/${f.id}`, { method: 'PUT', body: JSON.stringify({ name }) });
      }
      if (pick === 'delete') { await api(`/api/notebook/folders/${f.id}`, { method: 'DELETE' }); if (nbView === `f:${f.id}`) nbView = 'all'; }
    } catch (ex) { toast(ex.message); }
    await loadNotebook(); renderNotebook();
  }));
  app.querySelector('[data-new-note]')?.addEventListener('click', async () => {
    await nbFlush();
    try {
      const n = await api('/api/notebook/notes', { method: 'POST', body: JSON.stringify({ title: '', body: '', folder_id: nbView.startsWith('f:') ? Number(nbView.slice(2)) : null }) });
      await loadNotebook(); nbSel = { kind: 'note', id: n.id }; renderNotebook();
      document.getElementById('nb-title')?.focus();
    } catch (ex) { toast(ex.message); }
  });
  document.getElementById('nb-date')?.addEventListener('change', (e) => { if (e.target.value) open({ kind: 'day', date: e.target.value }); });

  // --- Trình soạn ---
  app.querySelector('[data-nb-delete]')?.addEventListener('click', async () => {
    await nbFlush();
    try {
      if (nbSel.kind === 'note') {
        const n = nb.notes.find((x) => x.id === nbSel.id);
        await api(`/api/notebook/notes/${n.id}`, { method: 'DELETE' });
        pushUndo(`Deleted note “${n.title || 'Untitled'}”`, [{ kind: 'note', id: n.id }]);
      } else {
        await api(`/api/notes/${nbSel.date}`, { method: 'PUT', body: JSON.stringify({ note: '' }) });
        pushUndo(`Deleted day note (${fmtDate(nbSel.date)})`, [{ kind: 'day_note', id: nbSel.date }]);
        delete notes[nbSel.date];
      }
    } catch (ex) { toast(ex.message); }
    nbSel = null;
    await loadNotebook(); renderNotebook();
  });

  if (nbSel?.kind === 'day') {
    const ta = document.getElementById('nb-day-text');
    const d = nbSel.date;
    ta?.addEventListener('input', () => nbSchedule(async () => {
      const text = ta.value.trim();
      if (!text && !notes[d]) { nbStatus(''); return; }
      try {
        await api(`/api/notes/${d}`, { method: 'PUT', body: JSON.stringify({ note: text }) });
        if (text) notes[d] = text; else { pushUndo(`Deleted day note (${fmtDate(d)})`, [{ kind: 'day_note', id: d }]); delete notes[d]; }
        nbStatus('Saved'); reList();
      } catch (ex) { nbStatus(`Not saved: ${ex.message}. Reload the page.`, false); }
    }));
    ta?.addEventListener('blur', nbFlush);
  }
  if (nbSel?.kind === 'note') {
    const id = nbSel.id;
    const title = document.getElementById('nb-title');
    const body = document.getElementById('nb-body');
    const folder = document.getElementById('nb-folder');
    if (!title) return;
    const save = () => nbSchedule(async () => {
      try {
        const saved = await api(`/api/notebook/notes/${id}`, { method: 'PUT', body: JSON.stringify({ title: title.value, body: cleanHTML(body.innerHTML), folder_id: folder.value }) });
        const i = nb.notes.findIndex((x) => x.id === id);
        if (i >= 0) nb.notes[i] = saved;
        nb.notes.sort((a, z) => z.updated_at.localeCompare(a.updated_at) || z.id - a.id);
        nbStatus('Saved'); reList();
      } catch (ex) { nbStatus(`Not saved: ${ex.message}. Reload the page.`, false); }
    });
    title.addEventListener('input', save);
    body.addEventListener('input', save);
    folder.addEventListener('change', save);
    [title, body].forEach((el) => el.addEventListener('blur', nbFlush));
    // Dán chữ: chỉ lấy chữ thuần, không mang theo định dạng lạ
    body.addEventListener('paste', (e) => {
      e.preventDefault();
      document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    app.querySelectorAll('[data-cmd]').forEach((b) => {
      b.addEventListener('mousedown', (e) => e.preventDefault()); // giữ vùng chữ đang chọn
      b.addEventListener('click', () => {
        body.focus();
        document.execCommand(b.dataset.cmd, false, b.dataset.arg || null);
        save();
      });
    });
  }
}

// ---------- Khung giải thích cho icon (i) và nhãn biểu đồ ----------
let tipEl = null; let tipFor = null;
function hideTip() { tipEl?.remove(); tipEl = null; tipFor = null; }
function showTip(el) {
  if (tipFor === el) return;
  hideTip();
  tipFor = el;
  tipEl = document.createElement('div');
  tipEl.className = 'tip-pop'; tipEl.setAttribute('role', 'tooltip');
  tipEl.textContent = el.dataset.tip;
  document.body.append(tipEl);
  const r = el.getBoundingClientRect(); const w = tipEl.offsetWidth; const h = tipEl.offsetHeight;
  const left = Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8));
  const top = r.bottom + 8 + h > innerHeight ? r.top - h - 8 : r.bottom + 8;
  tipEl.style.left = `${left}px`; tipEl.style.top = `${top}px`;
}
document.addEventListener('mouseover', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); else if (tipFor && !e.target.closest('.tip-pop')) hideTip(); });
document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
document.addEventListener('focusout', (e) => { if (e.target.closest('[data-tip]')) hideTip(); });
// Bấm vào icon thì luôn hiện (máy cảm ứng không có rê chuột); bấm chỗ khác thì ẩn
document.addEventListener('click', (e) => { const el = e.target.closest('[data-tip]'); if (el) { e.preventDefault(); showTip(el); } else hideTip(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
window.addEventListener('scroll', hideTip, { passive: true });

// ---------- Điều hướng ----------
let onPaste = null;
document.addEventListener('paste', (e) => onPaste && onPaste(e));

// Breadcrumb ("Overview / Dashboard") và mục menu đang chọn
function setChrome(nav, crumbs) {
  document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav));
  const home = '<a href="#/" aria-label="Dashboard home"><svg viewBox="0 0 24 24"><path d="M4 11l8-7 8 7v9H4z"/></svg></a>';
  document.getElementById('crumbs').innerHTML = home + crumbs
    .map(([label, href], i) => (i === crumbs.length - 1 ? `<b>${esc(label)}</b>` : `<a href="${href}">${esc(label)}</a><span>/</span>`))
    .join('');
}

// Ô tìm kiếm ở thanh trên: Enter để tìm, kết quả hiện ở trang Trades
document.getElementById('search').addEventListener('submit', (e) => {
  e.preventDefault();
  searchText = e.target.querySelector('input').value.trim();
  if (location.hash === '#/trades') renderGallery(); else location.hash = '#/trades';
});

let lastRoute = null;
async function route() {
  const hash0 = location.hash || '#/';
  const sameRoute = hash0 === lastRoute;
  const keepY = window.scrollY;
  if (!sameRoute) prevRouteHash = lastRoute;
  lastRoute = hash0;
  await renderRoute();
  window.scrollTo(0, sameRoute ? keepY : 0);
}
async function renderRoute() {
  closeDayModal();
  await nbFlush();
  onPaste = null;
  try {
    await loadTrades();
    const hash = location.hash || '#/';
    let m;
    if ((m = hash.match(/^#\/new(?:\?date=(\d{4}-\d{2}-\d{2}))?$/))) {
      trades = allTrades;
      setChrome('trades', [['Trades', '#/trades'], ['New trade']]);
      return renderForm(null, m[1]);
    }
    if ((m = hash.match(/^#\/trade\/(\d+)(\/edit)?$/))) {
      trades = allTrades;
      const t = trades.find((x) => x.id === Number(m[1]));
      const name = t ? `${fmtDate(t.date)} ${t.symbol || ''}`.trim() : 'Not found';
      setChrome('trades', m[2] && t ? [['Trades', '#/trades'], [name, `#/trade/${t.id}`], ['Edit']] : [['Trades', '#/trades'], [name]]);
      if (!t) { app.innerHTML = '<div class="empty">Trade not found.</div>'; return; }
      return m[2] ? renderForm(t) : renderDetail(t);
    }
    if (hash === '#/settings') {
      setChrome('settings', [['Overview', '#/'], ['Settings']]);
      return renderSettings();
    }
    if (hash === '#/accounts') {
      setChrome('accounts', [['Overview', '#/'], ['Accounts']]);
      return renderAccounts();
    }
    trades = applyScope(allTrades); // Dashboard, Calendar, Mindset, Trades xem theo công tắc tài khoản
    // Trang cũ đã bỏ (Calendar, Progress Tracker, Review, Mindset) → về Dashboard
    if (['#/calendar', '#/progress', '#/mindset'].includes(hash)) { location.replace('#/'); return; }
    if (hash === '#/daily') {
      setChrome('daily', [['Overview', '#/'], ['Daily Journal']]);
      return renderDaily();
    }
    if (hash === '#/notebook') {
      setChrome('notebook', [['Overview', '#/'], ['Notebook']]);
      await loadNotebook();
      return renderNotebook();
    }
    if (hash === '#/trades') {
      setChrome('trades', [['Overview', '#/'], ['Trades']]);
      return renderGallery();
    }
    if (hash === '#/models') { location.replace('#/strategies'); return; } // tên cũ
    if (hash === '#/strategies') {
      setChrome('strategies', [['Overview', '#/'], ['Strategies']]);
      modelsMode = 'strategies';
      return renderModels();
    }
    if (hash === '#/review') {
      setChrome('review', [['Overview', '#/'], ['Review']]);
      modelsMode = 'review';
      return renderModels();
    }
    setChrome('dashboard', [['Overview', '#/'], ['Dashboard']]);
    renderDashboard();
  } catch (err) {
    app.innerHTML = `<div class="empty">Can't reach the journal server. Check that the Terminal window is still open.<br><span class="error">${esc(err.message)}</span></div>`;
  }
}
window.addEventListener('hashchange', route);
let wasNarrow = window.innerWidth < 600;
window.addEventListener('resize', () => {
  const nowNarrow = window.innerWidth < 600;
  if (nowNarrow !== wasNarrow && (location.hash || '#/') === '#/') renderDashboard();
  wasNarrow = nowNarrow;
});
route();
