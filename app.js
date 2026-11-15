"use strict";

// ===== レベルと単語 =====
// words.js が window.HSK_WORDS = { 1: [[漢字, ピンイン("/"で別解), 日本語, 音声の別表記(","区切り・省略可)], ...], ... } を定義する
const LEVEL_META = [
  { lv: 1, name: "入門", desc: "あいさつ・数字・身の回りの単語" },
  { lv: 2, name: "初級", desc: "買い物・趣味・日常の動作" },
  { lv: 3, name: "初中級", desc: "日常生活をひととおり" },
  { lv: 4, name: "中級", desc: "幅広い話題で会話できる" },
  { lv: 5, name: "中上級", desc: "新聞・映画が分かる" },
  { lv: 6, name: "上級", desc: "自然な表現で意見を述べる" },
];
const LEVELS = LEVEL_META.map((m) => ({
  ...m,
  items: (window.HSK_WORDS?.[m.lv] || []).map(([hanzi, py, ja, alt]) => ({
    hanzi, ja, answers: py.split("/"), alt: alt ? alt.split(",") : [],
  })),
}));

// ===== ピンイン処理 =====
const MARKS = { a: "āáǎà", e: "ēéěè", i: "īíǐì", o: "ōóǒò", u: "ūúǔù", "ü": "ǖǘǚǜ" };

function markSyllable(syl, tone) {
  if (tone < 1 || tone > 4) return syl; // 0・5 は軽声
  let idx = -1;
  if (syl.includes("a")) idx = syl.indexOf("a");
  else if (syl.includes("e")) idx = syl.indexOf("e");
  else if (syl.includes("ou")) idx = syl.indexOf("o");
  else for (let i = syl.length - 1; i >= 0; i--) if ("iouü".includes(syl[i])) { idx = i; break; }
  if (idx < 0) return syl;
  return syl.slice(0, idx) + MARKS[syl[idx]][tone - 1] + syl.slice(idx + 1);
}
// 数字入力・記号入力のどちらでも、声調記号つきの表記にそろえる
function toMarked(input) {
  return input.toLowerCase().normalize("NFC")
    .replace(/u:/g, "ü").replace(/v/g, "ü")
    .replace(/([a-zü]+)([0-5])/g, (_, s, t) => markSyllable(s, Number(t)));
}
const compact = (s) => toMarked(s).replace(/[\s'’\-·]/g, "");
const stripTones = (s) => s.normalize("NFD").replace(/[\u0304\u0301\u030C\u0300]/g, "").normalize("NFC");
const normZh = (s) => s.replace(/[\s，。！？、,.!?「」"'“”…～~]/g, "");

// ===== 端末内の記録 =====
const store = {
  get(k, fallback) { try { const v = localStorage.getItem(k); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
// 級ごとの記録：seen = 今の周回で出題済みの漢字、weak = 間違えた単語の重み（0になるまで出やすい）
function loadProgress(L) {
  const p = store.get(`progress-${L.lv}`, {});
  return { seen: new Set(p.seen || []), weak: p.weak || {} };
}
function saveProgress(L, p) {
  store.set(`progress-${L.lv}`, { seen: [...p.seen], weak: p.weak });
}
const WEAK_ON_MISS = 2;   // 間違えると重み+2（最大4）。正解するたびに-1
const WEAK_MAX = 4;
const REVIEW_SHARE = 0.4; // 1回のうち最大4割を復習に使う

function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

function drawDeck(L, n) {
  n = Math.min(n, L.items.length);
  const p = loadProgress(L);
  const picked = new Set();
  const deck = [];

  // 1) 間違えた単語（重みが大きいものほど先に）
  const weak = shuffle(L.items.filter((it) => p.weak[it.hanzi] > 0))
    .sort((a, b) => p.weak[b.hanzi] - p.weak[a.hanzi])
    .slice(0, Math.ceil(n * REVIEW_SHARE));
  for (const it of weak) { deck.push({ ...it, review: true }); picked.add(it.hanzi); }

  // 2) 今の周回でまだ出ていない単語
  let fresh = shuffle(L.items.filter((it) => !p.seen.has(it.hanzi) && !picked.has(it.hanzi)));
  if (fresh.length < n - deck.length) {
    // 一巡した：残りを出したうえで新しい周回から補う
    for (const it of fresh) { deck.push(it); picked.add(it.hanzi); }
    p.seen = new Set();
    fresh = shuffle(L.items.filter((it) => !picked.has(it.hanzi)));
  }
  for (const it of fresh.slice(0, n - deck.length)) { deck.push(it); picked.add(it.hanzi); }

  for (const it of deck) p.seen.add(it.hanzi);
  saveProgress(L, p);
  return shuffle(deck);
}

function recordAnswer(L, hanzi, ok) {
  const p = loadProgress(L);
  const w = p.weak[hanzi] || 0;
  const next = ok ? Math.max(0, w - 1) : Math.min(WEAK_MAX, w + WEAK_ON_MISS);
  if (next > 0) p.weak[hanzi] = next; else delete p.weak[hanzi];
  saveProgress(L, p);
}

function levelStats(L) {
  const p = loadProgress(L);
  const has = new Set(L.items.map((it) => it.hanzi));
  return {
    seen: [...p.seen].filter((h) => has.has(h)).length,
    weak: Object.keys(p.weak).filter((h) => has.has(h)).length,
  };
}

// ===== 状態 =====
const $ = (id) => document.getElementById(id);
const settings = store.get("settings", {});
let mode = settings.mode === "voice" ? "voice" : "type";
let size = settings.size === 30 ? 30 : 20;
$("optTone").checked = settings.tone !== false;
let level = LEVELS[0];
let deck = [], pos = 0, results = [], hintStep = 0, answered = false;

function saveSettings() { store.set("settings", { mode, size, tone: $("optTone").checked }); }

function showScreen(id) {
  for (const s of document.querySelectorAll(".screen")) s.hidden = s.id !== id;
  if (id !== "quiz") $("sheet").classList.remove("show");
  if (id === "home") renderLevels();
  window.scrollTo(0, 0);
}
function esc(s) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ===== ホーム =====
function renderLevels() {
  $("levels").innerHTML = LEVELS.map((L) => {
    const st = levelStats(L);
    const total = L.items.length;
    const pct = total ? Math.round((st.seen / total) * 100) : 0;
    return `
    <button type="button" class="level" data-lv="${L.lv}" ${total ? "" : "disabled"}>
      <span class="level-badge"><small>HSK</small><b>${L.lv}</b></span>
      <span class="level-body">
        <span class="level-name">${L.lv}級　${L.name}</span>
        <span class="level-desc">${L.desc}・${total.toLocaleString()}語</span>
        <span class="level-stats">
          <span class="meter" aria-hidden="true"><i style="width:${pct}%"></i></span>
          <span>${st.seen.toLocaleString()}/${total.toLocaleString()}</span>
          ${st.weak ? `<span class="pill">復習 ${st.weak}語</span>` : ""}
        </span>
      </span>
    </button>`;
  }).join("");
}
$("levels").addEventListener("click", (e) => {
  const b = e.target.closest(".level");
  if (!b) return;
  level = LEVELS.find((L) => L.lv === Number(b.dataset.lv));
  startSession();
});

function setMode(m) {
  mode = m;
  saveSettings();
  for (const b of document.querySelectorAll("[data-mode]")) b.setAttribute("aria-pressed", String(b.dataset.mode === m));
  $("toneSetting").hidden = m === "voice";
  if (!$("quiz").hidden && !answered) renderMode();
}
for (const b of document.querySelectorAll("[data-mode]")) b.addEventListener("click", () => setMode(b.dataset.mode));

function setSize(n) {
  size = n;
  saveSettings();
  for (const b of document.querySelectorAll("[data-size]")) b.setAttribute("aria-pressed", String(Number(b.dataset.size) === n));
}
for (const b of document.querySelectorAll("[data-size]")) b.addEventListener("click", () => setSize(Number(b.dataset.size)));
$("optTone").addEventListener("change", saveSettings);

// ===== 問題 =====
function startSession(customDeck) {
  deck = customDeck || drawDeck(level, size);
  pos = 0; results = [];
  $("levelChip").textContent = `HSK ${level.lv}級`;
  showScreen("quiz");
  render();
}

function render() {
  const q = deck[pos];
  answered = false; hintStep = 0;
  $("count").textContent = `${pos + 1}/${deck.length}`;
  $("bar").style.width = `${(pos / deck.length) * 100}%`;
  $("reviewChip").hidden = !q.review;
  $("question").textContent = q.ja;
  $("hintHz").textContent = ""; $("hintPy").textContent = "";
  $("hintBtn").disabled = false; $("hintBtn").textContent = "ヒントを見る（漢字）";
  $("skipBtn").disabled = false;
  $("answer").value = ""; $("answer").disabled = false;
  $("heard").textContent = ""; $("heard").classList.remove("partial");
  $("voiceNote").hidden = true;
  $("micBtn").disabled = false;
  $("sheet").classList.remove("show", "ok", "ng");
  updatePreview();
  renderMode();
}

function renderMode() {
  const voice = mode === "voice";
  $("typePanel").hidden = voice;
  $("voicePanel").hidden = !voice;
  $("checkBtn").hidden = voice;
  $("promptLabel").textContent = voice ? "中国語で発音してください" : "中国語のピンインで答えてください";
  if (voice) { $("answer").blur(); refreshMic(); }
  else { if (listening) stopListening(); $("answer").focus({ preventScroll: true }); }
}

function updatePreview() {
  const v = $("answer").value;
  $("checkBtn").disabled = !v.trim() || answered;
  $("preview").innerHTML = v.trim() ? esc(toMarked(v)) : '<span class="muted">入力すると声調記号つきで表示されます</span>';
}

function insertTone(t) {
  const el = $("answer");
  if (el.disabled) return;
  const s = el.selectionStart ?? el.value.length, e = el.selectionEnd ?? el.value.length;
  const add = t === "v" ? "ü" : t;
  el.value = el.value.slice(0, s) + add + el.value.slice(e);
  el.selectionStart = el.selectionEnd = s + add.length;
  el.focus(); updatePreview();
}

function judgeTyped(raw) {
  const q = deck[pos];
  const user = compact(raw);
  if (q.answers.some((a) => compact(a) === user)) return { ok: true, note: "" };
  const spelling = q.answers.some((a) => stripTones(compact(a)) === stripTones(user));
  if (spelling && !$("optTone").checked) return { ok: true, note: "声調は判定していません" };
  if (spelling) return { ok: false, note: "綴りは合っています。声調を確認しましょう" };
  return { ok: false, note: "" };
}

function judgeVoice(text, alts) {
  const q = deck[pos];
  const targets = [q.hanzi, ...q.alt].map(normZh);
  const ok = [text, ...alts].map(normZh).some((c) => targets.includes(c));
  return { ok, note: ok ? "" : "聞き取られた中国語が正解と違いました。お手本を聞いてみましょう" };
}

// how: "type" | "voice" | "skip"
function finish(how, input, r) {
  if (answered) return;
  answered = true;
  const q = deck[pos];
  results.push({ q, ok: r.ok, how, input, hint: hintStep > 0 });
  recordAnswer(level, q.hanzi, r.ok);

  $("answer").disabled = true;
  $("checkBtn").disabled = true;
  $("hintBtn").disabled = true; $("skipBtn").disabled = true;
  $("micBtn").disabled = true;

  $("fbTitle").textContent = r.ok ? "正解！" : how === "skip" ? "答え" : "おしい…";
  $("fbHanzi").textContent = q.hanzi;
  $("fbPinyin").textContent = q.answers.join(" / ");
  $("fbJa").textContent = q.ja;
  $("fbYours").innerHTML =
    how === "voice" ? `聞き取り結果：<span class="${r.ok ? "" : "bad"}">${esc(input)}</span>`
    : how === "type" && !r.ok ? `あなたの答え：<span class="bad">${esc(input)}</span>` : "";
  $("fbNote").textContent = r.ok ? r.note : [r.note, "この単語は、しばらく出やすくなります"].filter(Boolean).join("。");
  $("nextBtn").textContent = pos + 1 < deck.length ? "次へ" : "結果を見る";
  $("sheet").classList.remove("ok", "ng");
  $("sheet").classList.add("show", r.ok ? "ok" : "ng");
  $("nextBtn").focus({ preventScroll: true });
  if (how !== "voice") speak(q.hanzi);
}

function next() {
  pos++;
  if (pos < deck.length) render(); else showResult();
}

function showResult() {
  const n = results.filter((r) => r.ok).length;
  const misses = results.filter((r) => !r.ok);
  $("resultLevel").textContent = `HSK ${level.lv}級　${level.name}`;
  $("score").innerHTML = `${n}<small> / ${results.length}</small>`;
  const rate = n / results.length;
  $("resultMsg").textContent = rate === 1 ? "全問正解！すばらしい！" : rate >= 0.8 ? "よくできました！" : rate >= 0.5 ? "その調子！" : "繰り返して覚えましょう";
  $("review").innerHTML = results.map((r) => `
    <li>
      <div class="main"><div>${esc(r.q.hanzi)}　${esc(r.q.answers[0])}</div>
        <div class="sub">${esc(r.q.ja)}${r.hint ? "・ヒント使用" : ""}</div></div>
      <div class="r"><div class="${r.ok ? "mark-ok" : "mark-ng"}">${r.ok ? "○" : "×"}</div>
        ${!r.ok && r.input ? `<div class="sub">${esc(r.input)}</div>` : ""}</div>
    </li>`).join("");
  $("continueBtn").textContent = `続ける（次の${Math.min(size, level.items.length)}問）`;
  $("retryMissBtn").hidden = misses.length === 0;
  $("retryMissBtn").textContent = `間違えた${misses.length}語をもう一度`;
  showScreen("result");
}

// ===== お手本の発音 =====
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "zh-CN"; u.rate = 0.85;
    const zh = speechSynthesis.getVoices().find((v) => /^zh[-_]CN/i.test(v.lang));
    if (zh) u.voice = zh;
    speechSynthesis.speak(u);
  } catch {}
}
if (!("speechSynthesis" in window)) $("speakBtn").hidden = true;

// ===== 発音で答える（ブラウザ標準の音声認識） =====
// Chrome（PC・Android）、iPhone/iPad の Safari（iOS 14.5 以降）で使える。https で開く必要がある
const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let listening = false, rec = null, buf = [], alts = [];

function refreshMic() {
  if (listening) return;
  if (!Recognition) {
    $("micBtn").disabled = true;
    $("micState").textContent = "このブラウザでは音声認識が使えません";
    $("voiceNote").hidden = false;
    $("voiceNote").textContent = "Chrome か Safari で開いてください。上の「入力」に切り替えて答えることもできます。";
    return;
  }
  $("micBtn").disabled = answered;
  setMicUi("idle");
}

function setMicUi(state) {
  $("micBtn").classList.toggle("listening", state === "listening");
  $("micBtn").setAttribute("aria-label", state === "listening" ? "話し終えた" : "話す");
  $("micState").textContent =
    state === "starting" ? "準備しています…" :
    state === "listening" ? "聞いています…話し終えたらもう一度タップ" :
    "タップして中国語で話してください";
}

function showHeard(text, partial) {
  $("heard").textContent = text;
  $("heard").classList.toggle("partial", partial);
}

function startListening() {
  buf = []; alts = [];
  showHeard("", false);
  $("voiceNote").hidden = true;
  listening = true;
  setMicUi("starting");
  let errCode = "";
  rec = new Recognition();
  rec.lang = "zh-CN"; rec.interimResults = true; rec.maxAlternatives = 5; rec.continuous = false;
  rec.onstart = () => setMicUi("listening");
  rec.onresult = (e) => {
    let interim = "";
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) { buf.push(r[0].transcript); for (let j = 1; j < r.length; j++) alts.push(r[j].transcript); }
      else interim += r[0].transcript;
    }
    showHeard(buf.join("") + interim, !!interim);
  };
  rec.onerror = (e) => { errCode = e.error; };
  rec.onend = () => onListenEnd(errCode);
  try { rec.start(); } catch { onListenEnd("start-failed"); }
}

function stopListening() {
  if (rec) try { rec.stop(); } catch {}
}
function abortListening() {
  listening = false;
  if (rec) try { rec.abort(); } catch {}
  rec = null;
}

const VOICE_ERRORS = {
  "not-allowed": "マイクが許可されていません。ブラウザの設定でマイクを許可するか、入力で答えてください。",
  "service-not-allowed": "この端末では音声認識が使えません。入力で答えてください。",
  "language-not-supported": "この端末では中国語の音声認識が使えません。入力で答えてください。",
  "audio-capture": "マイクが見つかりません。",
  "network": "音声認識に接続できませんでした。通信状況を確認してください。",
  "no-speech": "聞き取れませんでした。もう一度どうぞ。",
};

function onListenEnd(reason) {
  if (!listening) return;
  listening = false; rec = null;
  setMicUi("idle");
  if (answered) return;
  const text = buf.join("").trim();
  if (text) { finish("voice", text, judgeVoice(text, alts)); return; }
  showHeard("", false);
  const msg = VOICE_ERRORS[reason] || (reason && reason !== "aborted" ? "うまく聞き取れませんでした。もう一度どうぞ。" : "");
  if (msg) { $("voiceNote").textContent = msg; $("voiceNote").hidden = false; }
}

$("micBtn").addEventListener("click", () => {
  if (answered) return;
  if (listening) stopListening(); else startListening();
});

// ===== イベント =====
$("answer").addEventListener("input", updatePreview);
$("answer").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.isComposing && $("answer").value.trim()) { e.preventDefault(); submitTyped(); }
});
function submitTyped() {
  const raw = $("answer").value;
  if (!raw.trim() || answered) return;
  finish("type", toMarked(raw), judgeTyped(raw));
}
$("checkBtn").addEventListener("click", submitTyped);
$("skipBtn").addEventListener("click", () => { abortListening(); finish("skip", "", { ok: false, note: "" }); });
$("hintBtn").addEventListener("click", () => {
  const q = deck[pos];
  hintStep++;
  if (hintStep === 1) { $("hintHz").textContent = q.hanzi; $("hintBtn").textContent = "ヒントを見る（ピンイン）"; }
  else { $("hintPy").textContent = q.answers[0]; $("hintBtn").disabled = true; }
});
for (const b of document.querySelectorAll("#tones button")) {
  b.addEventListener("mousedown", (e) => e.preventDefault()); // 入力欄のカーソルを保つ
  b.addEventListener("click", () => insertTone(b.dataset.t));
}
$("nextBtn").addEventListener("click", next);
$("speakBtn").addEventListener("click", () => speak(deck[pos].hanzi));
$("quitBtn").addEventListener("click", () => { abortListening(); showScreen("home"); });
$("continueBtn").addEventListener("click", () => startSession());
$("retryMissBtn").addEventListener("click", () => {
  startSession(shuffle(results.filter((r) => !r.ok).map((r) => ({ ...r.q, review: true }))));
});
$("homeBtn").addEventListener("click", () => showScreen("home"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && answered && !$("quiz").hidden && document.activeElement !== $("nextBtn")) next();
});

setMode(mode);
setSize(size);
showScreen("home");
