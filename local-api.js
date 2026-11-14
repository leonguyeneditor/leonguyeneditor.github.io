// Reset Journal · DEMO
// ------------------------------------------------------------
// Bản demo không có server. File này đóng vai "server" ngay trong trình duyệt:
// mọi lệnh gọi fetch('/api/...') của script.js được trả lời tại đây,
// và dữ liệu (kể cả ảnh chart) được lưu vào IndexedDB của trình duyệt.
//
// - Mỗi người mở link có một journal riêng, ban đầu trống.
// - Không có dữ liệu nào gửi lên mạng.
// - Xoá dữ liệu trình duyệt (hoặc dùng tab ẩn danh) là mất journal demo.
//
// Logic kiểm tra dữ liệu được chép từ server.js của bản đầy đủ, để demo chạy giống hệt.
(function () {
  'use strict';

  // ---------- Lưu trữ: một bản ghi duy nhất trong IndexedDB ----------
  const DB_NAME = 'reset-journal-demo';
  const STORE = 'state';
  const KEY = 'v1';
  const now = () => new Date().toISOString().slice(0, 19).replace('T', ' '); // "YYYY-MM-DD HH:MM:SS" (UTC), giống SQLite
  const empty = () => ({
    seq: { trades: 0, accounts: 0, folders: 0, notes: 0 },
    trades: [], accounts: [], settings: {}, reviews: {}, dayNotes: {}, folders: [], notes: [],
  });

  function openDb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  let db = null;
  let state = empty();
  let memoryOnly = false; // trình duyệt chặn IndexedDB (ví dụ một số chế độ riêng tư): vẫn chạy, nhưng không lưu lại

  async function load() {
    try {
      db = await openDb();
      const saved = await new Promise((resolve, reject) => {
        const req = db.transaction(STORE).objectStore(STORE).get(KEY);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      if (saved) state = Object.assign(empty(), saved);
    } catch {
      memoryOnly = true;
    }
    purgeOld();
  }
  function save() {
    if (memoryOnly || !db) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(state, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }
  const ready = load();

  // ---------- Trả lời giống server ----------
  class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }
  const bad = (msg) => { throw new HttpError(400, msg); };
  const notFound = (msg) => { throw new HttpError(404, msg); };
  const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const noContent = () => new Response(null, { status: 204 });
  const nextId = (k) => { state.seq[k] += 1; return state.seq[k]; };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- Lệnh (trades) ----------
  const TEXT_FIELDS = {
    date: 10, time: 5, session: 40, symbol: 20, setup_name: 80,
    market_context: 500, area_of_interest: 500, lesson: 1000, plan_break_reason: 500,
    news_note: 80, hindsight: 1000,
  };
  const IMG_SLOTS = ['img_htf', 'img_ltf', 'img_after'];
  const MODEL_ITEM_RE = /^[a-z0-9]{1,8}:.{1,36}$/;
  const MAX_IMAGES = 20;
  // Nét vẽ trên ảnh (chép từ server.js). Toạ độ là tỉ lệ 0–1 theo ảnh.
  const MARK_TYPES = ['line', 'hline', 'arrow', 'box', 'text'];
  const MARK_NAMED = ['teal', 'red', 'yellow', 'white'];
  function cleanMarkList(arr) {
    if (!Array.isArray(arr)) return [];
    const n = (x) => (Number.isFinite(Number(x)) ? Math.min(1, Math.max(0, Math.round(Number(x) * 10000) / 10000)) : null);
    const style = (m) => {
      const st = { c: MARK_NAMED.includes(m.c) || /^#[0-9a-f]{6}$/i.test(m.c || '') ? m.c : 'teal' };
      if (Number.isFinite(Number(m.a))) st.a = Math.min(1, Math.max(0.05, Math.round(Number(m.a) * 100) / 100));
      if (Number.isFinite(Number(m.w))) st.w = Math.min(8, Math.max(1, Math.round(Number(m.w))));
      return st;
    };
    const list = [];
    for (const m of arr.slice(0, 200)) {
      if (!m || !MARK_TYPES.includes(m.t)) continue;
      if (m.t === 'hline') { const y = n(m.y); if (y !== null) list.push({ t: 'hline', y, ...style(m) }); continue; }
      if (m.t === 'text') {
        const x = n(m.x); const y = n(m.y); const txt = typeof m.s === 'string' ? m.s.trim().slice(0, 120) : '';
        if (x === null || y === null || !txt) continue;
        const o = { t: 'text', x, y, s: txt, ...style(m) };
        if (Number.isFinite(Number(m.z))) o.z = Math.min(96, Math.max(8, Math.round(Number(m.z))));
        if (m.b) o.b = true; if (m.i) o.i = true;
        list.push(o);
        continue;
      }
      const p = [n(m.x1), n(m.y1), n(m.x2), n(m.y2)];
      if (!p.every((x) => x !== null)) continue;
      const o = { t: m.t, x1: p[0], y1: p[1], x2: p[2], y2: p[3], ...style(m) };
      if (m.t === 'box' && m.st === false) o.st = false;
      list.push(o);
    }
    return list;
  }
  // Danh sách ảnh linh động: [{ f: ảnh dạng data:image/..., m: [nét vẽ] }]. Demo giữ thẳng ảnh trong dữ liệu.
  function resolveImages(v, oldList) {
    const oldNames = new Set(oldList.map((x) => x.f));
    const out = [];
    for (const it of (Array.isArray(v) ? v : []).slice(0, MAX_IMAGES)) {
      const src = typeof it?.src === 'string' ? it.src : '';
      const isNew = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(src);
      if (isNew || oldNames.has(src)) out.push({ f: src, m: cleanMarkList(it.m) });
    }
    return out;
  }
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function cleanTrade(body) {
    const t = {};
    for (const [key, max] of Object.entries(TEXT_FIELDS)) {
      const v = typeof body[key] === 'string' ? body[key].trim().slice(0, max) : '';
      t[key] = v || null;
    }
    if (!t.date || !DATE_RE.test(t.date)) bad('Invalid date');
    if (t.time && !/^\d{2}:\d{2}$/.test(t.time)) bad('Invalid time');
    t.direction = ['long', 'short'].includes(body.direction) ? body.direction : null;
    t.conditions_met = ['yes', 'no'].includes(body.conditions_met) ? body.conditions_met : null;
    t.followed_plan = ['yes', 'no'].includes(body.followed_plan) ? body.followed_plan : null;
    t.htf_bias = ['bullish', 'bearish', 'undecided'].includes(body.htf_bias) ? body.htf_bias : null;
    t.news_today = ['yes', 'no'].includes(body.news_today) ? body.news_today : null;
    const num = (v, label) => {
      if (v === '' || v == null) return null;
      const n = Number(v);
      if (!Number.isFinite(n)) bad(`Invalid ${label}`);
      return n;
    };
    t.risk_usd = num(body.risk_usd, 'risk');
    if (t.risk_usd !== null && t.risk_usd <= 0) bad('Risk must be greater than $0');
    t.pnl_usd = num(body.pnl_usd, 'P&L');
    // R = P&L ÷ Risk (2 số lẻ). Thiếu $ thì nhận R nhập thẳng.
    t.result_r = t.risk_usd !== null && t.pnl_usd !== null
      ? Math.round((t.pnl_usd / t.risk_usd) * 100) / 100
      : num(body.result_r, 'R');
    const acc = body.account_id === '' || body.account_id == null ? null : Number(body.account_id);
    if (acc !== null && !state.accounts.some((a) => a.id === acc)) bad('Account not found');
    t.account_id = acc;
    const c = body.contracts === '' || body.contracts == null ? null : Number(body.contracts);
    if (c !== null && !(Number.isInteger(c) && c > 0)) bad('Invalid number of contracts');
    t.contracts = c;
    const list = (v) => (Array.isArray(v) ? v : [])
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => x.trim().slice(0, 40))
      .slice(0, 20);
    t.confirmations = list(body.confirmations);
    t.mistakes = list(body.mistakes);
    t.emotions = list(body.emotions);
    t.dols = list(body.dols);
    // Model chỉ còn là tên (10/11); điều kiện kiểu cũ vẫn được giữ nếu có
    const mid = body.model_id === '' || body.model_id == null ? null : Number(body.model_id);
    if (mid !== null && !(Number.isInteger(mid) && mid > 0)) bad('Invalid model');
    const mItems = mid === null ? [] : list(body.model_items).filter((x) => MODEL_ITEM_RE.test(x) && !x.includes(':@'));
    t.model_id = mid;
    t.model_name = mid === null ? null : (typeof body.model_name === 'string' && body.model_name.trim().slice(0, 40)) || 'Model';
    t.model_items = mItems;
    const seen = Array.isArray(body.seen)
      ? [...new Set(body.seen.filter((x) => typeof x === 'string' && MODEL_ITEM_RE.test(x.trim())).map((x) => x.trim()))].slice(0, 60)
      : list(body.model_checks).filter((x) => mItems.includes(x));
    t.seen = seen;
    t.model_checks = mItems.filter((x) => seen.includes(x));
    t.htf_tf = (seen.find((x) => x.startsWith('htf:@')) || '').slice(5) || null;
    t.pdas = list(body.pdas);
    t.pda_tf = list(body.pda_tf).filter((x) => x.length <= 8 && !x.includes(':')); // khung giờ tuỳ chọn
    t.m15_structure = ['bullish', 'bearish', 'sideways'].includes(body.m15_structure) ? body.m15_structure : null;
    t.entry_tf = typeof body.entry_tf === 'string' && body.entry_tf.trim() && body.entry_tf.trim().length <= 8 && !body.entry_tf.includes(':') ? body.entry_tf.trim() : null;
    t.quick = body.quick ? 1 : 0;
    const tc = body.trade_count === '' || body.trade_count == null ? null : Number(body.trade_count);
    if (tc !== null && !(Number.isInteger(tc) && tc >= 1 && tc <= 100)) bad('Trades must be a whole number from 1 to 100');
    t.trade_count = t.quick ? tc : null;
    if (t.quick && t.pnl_usd === null && t.result_r === null) bad('Enter a $ amount or an R result');
    if (t.followed_plan !== 'no') t.plan_break_reason = null;
    return t;
  }
  // Ảnh: bản demo giữ thẳng ảnh dạng "data:image/..." trong lệnh (không có thư mục ảnh)
  function resolveImage(value, old) {
    if (value === undefined) return old ?? null;
    if (value === null || value === '') return null;
    if (value === old) return old;
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) return value;
    bad('Invalid image');
  }
  const liveTrades = () => state.trades.filter((t) => !t.deleted_at);
  const sortTrades = (rows) => [...rows].sort((a, b) =>
    b.date.localeCompare(a.date) || (b.time || '').localeCompare(a.time || '') || b.id - a.id);

  // ---------- Tài khoản ----------
  const ACC_TYPES = ['personal', 'demo', 'prop_eval', 'prop_funded'];
  const ACC_STATUS = ['active', 'passed', 'failed', 'closed'];
  function cleanAccount(b) {
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 60) : '';
    if (!name) bad('Account name is required');
    if (!ACC_TYPES.includes(b.type)) bad('Pick an account type');
    const money = (v, label) => {
      if (v === '' || v == null) return null;
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0) bad(`Invalid ${label}`);
      return n;
    };
    return {
      name, type: b.type,
      firm: typeof b.firm === 'string' ? b.firm.trim().slice(0, 60) || null : null,
      starting_balance: money(b.starting_balance, 'starting balance'),
      cost_usd: money(b.cost_usd, 'cost'),
      profit_target: money(b.profit_target, 'profit target'),
      max_loss: money(b.max_loss, 'max loss'),
      daily_loss: money(b.daily_loss, 'daily loss'),
      status: ACC_STATUS.includes(b.status) ? b.status : 'active',
    };
  }

  // ---------- Cài đặt ----------
  const listOf = (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 40)))].slice(0, 60) : null);
  const SETTING_RULES = {
    max_losses: (v) => (Number.isInteger(v) && v >= 1 && v <= 10 ? v : null),
    confirmations: listOf, mistakes: listOf, emotions: listOf, dols: listOf, sessions: listOf, symbols: listOf, pdas: listOf,
    checklist: (v) => (Array.isArray(v) ? [...new Set(v.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim().slice(0, 80)))].slice(0, 20) : null),
    pda_htf: listOf, struct_m15: listOf, entry_m1: listOf, pda_tfs: listOf, entry_tfs: listOf,
    steps: (v) => {
      if (!Array.isArray(v) || !v.length || v.length > 5) return null;
      const out = []; const ids = new Set();
      for (const st of v) {
        const id = typeof st?.id === 'string' ? st.id : '';
        const name = typeof st?.name === 'string' ? st.name.trim().slice(0, 24) : '';
        const tfs = listOf(st?.tfs); const items = listOf(st?.items);
        if (!/^[a-z0-9]{1,8}$/.test(id) || ids.has(id) || !name || !tfs || !items) return null;
        ids.add(id);
        out.push({ id, name, tfs: tfs.map((x) => x.slice(0, 6)).filter((x) => !x.includes(':')).slice(0, 8),
          items: items.filter((x) => !x.includes(':') && !x.startsWith('@')).slice(0, 30) });
      }
      return out;
    },
    models: (v) => {
      if (!Array.isArray(v) || v.length > 20) return null;
      const out = [];
      for (const m of v) {
        const id = Number(m?.id);
        const name = typeof m?.name === 'string' ? m.name.trim().slice(0, 40) : '';
        const items = listOf(m?.items ?? []);
        if (!Number.isInteger(id) || id < 1 || !name || !items) return null;
        let recipe;
        if (m?.recipe && typeof m.recipe === 'object') {
          const rl = (k) => (listOf(m.recipe[k] ?? []) || []).filter((x) => !x.includes(':')).slice(0, 20);
          const r = { dols: rl('dols'), pdas: rl('pdas'), pda_tf: rl('pda_tf').map((x) => x.slice(0, 8)),
            structure: rl('structure').filter((x) => ['bullish', 'bearish', 'sideways'].includes(x)),
            confirmations: rl('confirmations'), entry_tf: rl('entry_tf').map((x) => x.slice(0, 8)) };
          if (Object.values(r).some((a) => a.length)) recipe = r;
        }
        const good = items.filter((x) => MODEL_ITEM_RE.test(x)).slice(0, 20);
        out.push(recipe ? { id, name, items: good, recipe } : { id, name, items: good });
      }
      return out;
    },
  };

  // ---------- Thùng rác: giữ 30 ngày ----------
  function purgeOld() {
    const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
    const old = (x) => x.deleted_at && x.deleted_at < cutoff;
    state.trades = state.trades.filter((t) => !old(t));
    state.notes = state.notes.filter((n) => !old(n));
    for (const [d, n] of Object.entries(state.dayNotes)) if (old(n)) delete state.dayNotes[d];
  }

  // ---------- Bộ định tuyến: đường dẫn → xử lý ----------
  const routes = [];
  const on = (method, pattern, fn) => routes.push({ method, re: new RegExp(`^${pattern}$`), fn });

  on('GET', '/api/version', () => json({ version: 3, trash: true, test: false, demo: true }));

  on('GET', '/api/trades', () => json(clone(sortTrades(liveTrades()))));
  on('GET', '/api/trades/(\\d+)', ([id]) => {
    const t = state.trades.find((x) => x.id === Number(id));
    if (!t) notFound('Trade not found');
    return json(clone(t));
  });
  on('POST', '/api/trades', async (_, body) => {
    const t = cleanTrade(body);
    for (const slot of IMG_SLOTS) t[slot] = null; // 3 ô cũ không dùng nữa
    t.marks = {};
    t.images = resolveImages(body.images, []);
    Object.assign(t, { id: nextId('trades'), created_at: now(), updated_at: now(), deleted_at: null });
    state.trades.push(t);
    await save();
    return json(clone(t), 201);
  });
  // Chỉ đổi ngày của lệnh (chuyển sang ngày khác trên lịch)
  on('PUT', '/api/trades/(\\d+)/date', async ([id], body) => {
    const old = state.trades.find((x) => x.id === Number(id));
    if (!old || old.deleted_at) notFound('Trade not found');
    const date = body?.date;
    if (typeof date !== 'string' || !DATE_RE.test(date) || Number.isNaN(Date.parse(date))) bad('Invalid date');
    old.date = date; old.updated_at = now();
    await save();
    return json(clone(old));
  });
  // Chỉ sửa kết quả ($ và/hoặc R) của 1 lệnh (khung ngày). Giống server.js.
  on('PUT', '/api/trades/(\\d+)/result', async ([id], body) => {
    const old = state.trades.find((x) => x.id === Number(id));
    if (!old || old.deleted_at) notFound('Trade not found');
    const b = body || {};
    const num = (v, label) => { if (v === '' || v == null) return null; const n = Number(v); if (!Number.isFinite(n)) bad(`Invalid ${label}`); return n; };
    const hasP = 'pnl_usd' in b; const hasR = 'result_r' in b;
    let pnl = old.pnl_usd ?? null; let r = old.result_r ?? null;
    if (hasP) pnl = num(b.pnl_usd, 'P&L');
    if (hasR) r = num(b.result_r, 'R');
    if (hasP && !hasR && old.risk_usd > 0 && pnl !== null) r = Math.round((pnl / old.risk_usd) * 100) / 100;
    if (pnl === null && r === null) bad('Enter a $ amount or an R result');
    old.pnl_usd = pnl; old.result_r = r; old.updated_at = now();
    await save();
    return json(clone(old));
  });
  // Chỉ đổi strategy của 1 lệnh. Giống server.js.
  on('PUT', '/api/trades/(\\d+)/strategy', async ([id], body) => {
    const old = state.trades.find((x) => x.id === Number(id));
    if (!old || old.deleted_at) notFound('Trade not found');
    const b = body || {};
    const mid = b.model_id === '' || b.model_id == null ? null : Number(b.model_id);
    if (mid !== null && !(Number.isInteger(mid) && mid > 0)) bad('Invalid strategy');
    const strs = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(0, 60) : []);
    old.model_id = mid;
    old.model_name = mid === null ? null : (typeof b.model_name === 'string' && b.model_name.trim().slice(0, 40)) || 'Strategy';
    old.model_items = mid === null ? [] : strs(b.model_items);
    old.model_checks = mid === null ? [] : strs(b.model_checks).filter((x) => old.model_items.includes(x));
    old.updated_at = now();
    await save();
    return json(clone(old));
  });
  on('PUT', '/api/trades/(\\d+)/marks', async ([id], body) => {
    const old = state.trades.find((x) => x.id === Number(id));
    if (!old || old.deleted_at) notFound('Trade not found');
    const imgs = old.images || []; const i = Number(body?.index);
    if (!Number.isInteger(i) || !imgs[i]) bad('Image not found');
    imgs[i] = { ...imgs[i], m: cleanMarkList(body?.marks) };
    old.images = imgs; old.updated_at = now();
    await save();
    return json(clone(old));
  });
  on('DELETE', '/api/trades/(\\d+)/images/(\\d+)', async ([id, idx]) => {
    const old = state.trades.find((x) => x.id === Number(id));
    if (!old || old.deleted_at) notFound('Trade not found');
    const imgs = old.images || []; const i = Number(idx);
    if (!imgs[i]) notFound('Image not found');
    imgs.splice(i, 1); old.updated_at = now();
    await save();
    return json(clone(old));
  });
  on('PUT', '/api/trades/(\\d+)', async ([id], body) => {
    const old = state.trades.find((x) => x.id === Number(id));
    if (!old) notFound('Trade not found');
    const t = cleanTrade(body);
    for (const slot of IMG_SLOTS) t[slot] = old[slot] ?? null;
    t.marks = old.marks || {};
    // Không gửi images (VD sửa kết quả nhanh trên lịch) thì giữ nguyên ảnh cũ
    t.images = body.images === undefined ? (old.images || []) : resolveImages(body.images, old.images || []);
    Object.assign(old, t, { updated_at: now() });
    await save();
    return json(clone(old));
  });
  on('DELETE', '/api/trades', async (_, body) => {
    if (body?.confirm !== 'DELETE') bad('Type DELETE to confirm');
    const rows = liveTrades();
    rows.forEach((t) => { t.deleted_at = now(); });
    await save();
    return json({ deleted: rows.length, ids: rows.map((t) => t.id) });
  });
  on('DELETE', '/api/trades/(\\d+)', async ([id]) => {
    const t = state.trades.find((x) => x.id === Number(id));
    if (!t) notFound('Trade not found');
    t.deleted_at = now();
    await save();
    return noContent();
  });

  on('GET', '/api/accounts', () => json(clone([...state.accounts].sort((a, b) =>
    (b.status === 'active') - (a.status === 'active') || a.name.localeCompare(b.name)))));
  on('POST', '/api/accounts', async (_, body) => {
    const a = cleanAccount(body);
    if (state.accounts.some((x) => x.name === a.name)) bad('An account with this name already exists');
    Object.assign(a, { id: nextId('accounts'), created_at: now() });
    state.accounts.push(a);
    await save();
    return json(clone(a), 201);
  });
  on('PUT', '/api/accounts/(\\d+)', async ([id], body) => {
    const old = state.accounts.find((x) => x.id === Number(id));
    if (!old) notFound('Account not found');
    const a = cleanAccount(body);
    if (state.accounts.some((x) => x.name === a.name && x.id !== old.id)) bad('An account with this name already exists');
    Object.assign(old, a);
    await save();
    return json(clone(old));
  });
  on('DELETE', '/api/accounts/(\\d+)', async ([id]) => {
    const old = state.accounts.find((x) => x.id === Number(id));
    if (!old) notFound('Account not found');
    const used = state.trades.filter((t) => t.account_id === old.id).length;
    if (used) bad(`This account has ${used} trade(s). Set its status to Closed instead.`);
    state.accounts = state.accounts.filter((x) => x.id !== old.id);
    await save();
    return noContent();
  });

  on('GET', '/api/settings', () => json(clone(state.settings)));
  on('PUT', '/api/settings', async (_, body) => {
    for (const [key, val] of Object.entries(body || {})) {
      if (!SETTING_RULES[key]) bad(`Unknown setting: ${key}`);
      const v = SETTING_RULES[key](val);
      if (v === null) bad(`Invalid value for ${key}`);
      state.settings[key] = v;
    }
    await save();
    return noContent();
  });

  on('GET', '/api/reviews/(\\d{4}-\\d{2}-\\d{2})', ([week]) => json({ week_start: week, answers: clone(state.reviews[week] || {}) }));

  on('PUT', '/api/reviews/(\\d{4}-\\d{2}-\\d{2})', async ([week], body) => {
    const answers = {};
    for (const k of ['rule', 'notes', 'kept', 'ai', 'followed', 'mistakes', 'improve']) {
      const v = body?.answers?.[k];
      if (typeof v === 'string') answers[k] = v.slice(0, 2000);
    }
    state.reviews[week] = answers;
    await save();
    return noContent();
  });
  on('GET', '/api/checklist', () => json(clone(state.checklist || {})));
  on('PUT', '/api/checklist/(\\d{4}-\\d{2}-\\d{2})', async ([date], body) => {
    const done = SETTING_RULES.checklist(body?.done) || [];
    state.checklist = state.checklist || {};
    if (!done.length) delete state.checklist[date]; else state.checklist[date] = done;
    await save();
    return noContent();
  });
  on('GET', '/api/notes', () => {
    const out = {};
    for (const [d, n] of Object.entries(state.dayNotes)) if (!n.deleted_at) out[d] = n.note;
    return json(out);
  });
  on('PUT', '/api/notes/(\\d{4}-\\d{2}-\\d{2})', async ([date], body) => {
    const note = typeof body?.note === 'string' ? body.note.trim().slice(0, 2000) : '';
    const cur = state.dayNotes[date];
    if (!note) { if (cur && !cur.deleted_at) cur.deleted_at = now(); }
    else state.dayNotes[date] = { note, updated_at: now(), deleted_at: null };
    await save();
    return noContent();
  });

  // Notebook
  const folderOk = (id) => id === null || state.folders.some((f) => f.id === id);
  const toFolderId = (v) => (v === '' || v == null ? null : Number(v));
  const cleanName = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  on('GET', '/api/notebook', () => json({
    folders: clone([...state.folders].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))),
    notes: clone(state.notes.filter((n) => !n.deleted_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at) || b.id - a.id)),
  }));
  on('POST', '/api/notebook/folders', async (_, body) => {
    const name = cleanName(body?.name, 60);
    if (!name) bad('Folder name is required');
    const f = { id: nextId('folders'), name, created_at: now() };
    state.folders.push(f);
    await save();
    return json(clone(f), 201);
  });
  on('PUT', '/api/notebook/folders/(\\d+)', async ([id], body) => {
    const name = cleanName(body?.name, 60);
    if (!name) bad('Folder name is required');
    const f = state.folders.find((x) => x.id === Number(id));
    if (f) f.name = name;
    await save();
    return noContent();
  });
  on('DELETE', '/api/notebook/folders/(\\d+)', async ([id]) => {
    const fid = Number(id);
    state.notes.forEach((n) => { if (n.folder_id === fid) n.folder_id = null; }); // ghi chú không bị xoá
    state.folders = state.folders.filter((f) => f.id !== fid);
    await save();
    return noContent();
  });
  on('POST', '/api/notebook/notes', async (_, body) => {
    const folder = toFolderId(body?.folder_id);
    if (!folderOk(folder)) bad('Folder not found');
    const n = { id: nextId('notes'), folder_id: folder, title: cleanName(body?.title, 200),
      body: typeof body?.body === 'string' ? body.body.slice(0, 100000) : '', created_at: now(), updated_at: now(), deleted_at: null };
    state.notes.push(n);
    await save();
    return json(clone(n), 201);
  });
  on('PUT', '/api/notebook/notes/(\\d+)', async ([id], body) => {
    const old = state.notes.find((x) => x.id === Number(id));
    if (!old) notFound('Note not found');
    const folder = 'folder_id' in (body || {}) ? toFolderId(body.folder_id) : old.folder_id;
    if (!folderOk(folder)) bad('Folder not found');
    if (typeof body?.title === 'string') old.title = cleanName(body.title, 200);
    if (typeof body?.body === 'string') old.body = body.body.slice(0, 100000);
    old.folder_id = folder;
    old.updated_at = now();
    await save();
    return json(clone(old));
  });
  on('DELETE', '/api/notebook/notes/(\\d+)', async ([id]) => {
    const n = state.notes.find((x) => x.id === Number(id));
    if (n && !n.deleted_at) n.deleted_at = now();
    await save();
    return noContent();
  });

  // Thùng rác
  on('GET', '/api/trash', () => json({
    trades: clone(state.trades.filter((t) => t.deleted_at).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at))),
    day_notes: Object.entries(state.dayNotes).filter(([, n]) => n.deleted_at)
      .map(([date, n]) => ({ date, note: n.note, deleted_at: n.deleted_at })).sort((a, b) => b.deleted_at.localeCompare(a.deleted_at)),
    notes: state.notes.filter((n) => n.deleted_at).map(({ id, title, body, deleted_at }) => ({ id, title, body, deleted_at }))
      .sort((a, b) => b.deleted_at.localeCompare(a.deleted_at)),
  }));
  on('POST', '/api/trash/restore', async (_, body) => {
    let n = 0;
    for (const it of Array.isArray(body?.items) ? body.items.slice(0, 1000) : []) {
      if (it.kind === 'trade') { const t = state.trades.find((x) => x.id === Number(it.id) && x.deleted_at); if (t) { t.deleted_at = null; n += 1; } }
      if (it.kind === 'note') { const x = state.notes.find((y) => y.id === Number(it.id) && y.deleted_at); if (x) { x.deleted_at = null; n += 1; } }
      if (it.kind === 'day_note') { const x = state.dayNotes[String(it.id)]; if (x && x.deleted_at) { x.deleted_at = null; n += 1; } }
    }
    await save();
    return json({ restored: n });
  });
  on('POST', '/api/trash/purge', async (_, body) => {
    if (body?.all === true) {
      state.trades = state.trades.filter((t) => !t.deleted_at);
      state.notes = state.notes.filter((x) => !x.deleted_at);
      for (const [d, x] of Object.entries(state.dayNotes)) if (x.deleted_at) delete state.dayNotes[d];
    } else {
      for (const it of Array.isArray(body?.items) ? body.items : []) {
        if (it.kind === 'trade') state.trades = state.trades.filter((t) => !(t.id === Number(it.id) && t.deleted_at));
        if (it.kind === 'note') state.notes = state.notes.filter((x) => !(x.id === Number(it.id) && x.deleted_at));
        if (it.kind === 'day_note' && state.dayNotes[String(it.id)]?.deleted_at) delete state.dayNotes[String(it.id)];
      }
    }
    await save();
    return noContent();
  });

  // ---------- Chặn fetch('/api/...') và trả lời từ đây ----------
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (input, options = {}) {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.origin !== location.origin || !url.pathname.startsWith('/api/')) return realFetch(input, options);
    await ready;
    const method = (options.method || 'GET').toUpperCase();
    let body = null;
    if (options.body) { try { body = JSON.parse(options.body); } catch { return json({ error: 'Invalid JSON' }, 400); } }
    for (const r of routes) {
      if (r.method !== method) continue;
      const m = r.re.exec(url.pathname);
      if (!m) continue;
      try {
        return await r.fn(m.slice(1), body);
      } catch (err) {
        if (err instanceof HttpError) return json({ error: err.message }, err.status);
        // Hết chỗ lưu trong trình duyệt (thường do quá nhiều ảnh lớn)
        if (err && /quota/i.test(String(err.name || err.message))) return json({ error: 'Browser storage is full. Delete some trades with large chart images.' }, 507);
        return json({ error: String(err?.message || err) }, 500);
      }
    }
    return json({ error: 'Not found' }, 404);
  };
}());
