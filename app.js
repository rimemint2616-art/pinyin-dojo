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
let streak = 0, missStreak = 0; // 連続正解・連続不正解（キャラクターの反応に使う）

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
  pos = 0; results = []; streak = 0; missStreak = 0;
  $("levelChip").textContent = `HSK ${level.lv}級`;
  showScreen("quiz");
  render();
}

function render() {
  const q = deck[pos];
  answered = false; hintStep = 0; voiceTries = 0;
  $("count").textContent = `${pos + 1}/${deck.length}`;
  $("bar").style.width = `${(pos / deck.length) * 100}%`;
  $("reviewChip").hidden = !q.review;
  $("question").textContent = q.ja;
  $("hintHz").textContent = ""; $("hintPy").textContent = "";
  $("hintBtn").disabled = false; $("hintBtn").textContent = "ヒントを見る（漢字）";
  $("skipBtn").disabled = false;
  $("answer").value = ""; $("answer").disabled = false;
  $("heard").textContent = ""; $("heard").classList.remove("partial");
  $("voiceNote").hidden = true; $("voiceNote").classList.remove("retry");
  $("micBtn").disabled = false;
  $("sheet").classList.remove("show", "ok", "ng");
  $("react").hidden = true;
  setMood($("charaQuiz"), "normal");
  updatePreview();
  renderMode();
}

function renderMode() {
  const voice = mode === "voice";
  $("typePanel").hidden = voice;
  $("voicePanel").hidden = !voice;
  $("checkBtn").hidden = voice;
  $("promptLabel").textContent = voice ? "中国語で発音してください" : "中国語のピンインで答えてください";
  $("voiceTip").hidden = !(voice && deck[pos] && [...deck[pos].hanzi].length === 1);
  if (voice) { $("answer").blur(); refreshMic(); }
  else { if (listening) endListening(); $("answer").focus({ preventScroll: true }); }
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

// ===== 発音の判定 =====
// 音声認識は漢字で返ってくるので、ピンインに直して比べる（同音の別の字に聞き取られても正解にできる）
// 単語1つの発音では声調の聞き取りが不安定なため、音（声調抜き）が合えば正解にし、声調の違いは添え書きにとどめる
const ZH_DIGITS = "零一二三四五六七八九";
function numToZh(n) {
  if (n < 10) return ZH_DIGITS[n];
  if (n < 20) return "十" + (n % 10 ? ZH_DIGITS[n % 10] : "");
  if (n < 100) return ZH_DIGITS[Math.floor(n / 10)] + "十" + (n % 10 ? ZH_DIGITS[n % 10] : "");
  return String(n).split("").map((d) => ZH_DIGITS[d]).join("");
}
const digitsToZh = (s) => s.replace(/\d+/g, (d) => numToZh(Number(d)));

function heardPinyin(text) {
  const P = window.pinyinPro;
  if (!P) return "";
  try {
    return P.pinyin(digitsToZh(normZh(text)), { toneType: "symbol", type: "array", nonZh: "removed" }).join(" ");
  } catch { return ""; }
}

function matchVoice(text, q) {
  const hz = normZh(digitsToZh(text));
  if (!hz) return null;
  if ([q.hanzi, ...q.alt].map(normZh).some((t) => hz === t || hz.includes(t))) return { ok: true, tone: true, py: heardPinyin(text) };
  const py = heardPinyin(text);
  if (!py) return null;
  const heard = compact(py), heardBare = stripTones(heard);
  // 語尾の「儿」（r化）は認識で落ちやすいので、r なしでも認める
  const variants = q.answers.flatMap((a) => q.hanzi.endsWith("儿") ? [a, a.replace(/r$/, "")] : [a]);
  for (const a of variants) {
    const ans = compact(a);
    if (heard.includes(ans)) return { ok: true, tone: true, py };
    if (heardBare.includes(stripTones(ans))) return { ok: true, tone: false, py };
  }
  return { ok: false, py };
}

function judgeVoice(text, alts) {
  const q = deck[pos];
  let best = null;
  for (const c of [text, ...alts]) {
    const m = matchVoice(c, q);
    if (m?.ok && m.tone) { best = m; break; }
    if (m?.ok && !best?.ok) best = m;
    if (!best) best = m;
  }
  const py = best?.py || heardPinyin(text);
  if (best?.ok) return { ok: true, py, note: best.tone ? "" : `声調が「${py}」に聞こえたかも。お手本で確認しよう` };
  return { ok: false, py, note: "正解とは違う音に聞こえました。お手本を聞いてみましょう" };
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
    how === "voice" ? `聞き取り結果：<span class="${r.ok ? "" : "bad"}">${esc(input)}${r.py ? `（${esc(r.py)}）` : ""}</span>`
    : how === "type" && !r.ok ? `あなたの答え：<span class="bad">${esc(input)}</span>` : "";
  $("fbNote").textContent = r.ok ? r.note : [r.note, "この単語は、しばらく出やすくなります"].filter(Boolean).join("。");
  $("nextBtn").textContent = pos + 1 < deck.length ? "次へ" : "結果を見る";
  $("sheet").classList.remove("ok", "ng");
  $("sheet").classList.add("show", r.ok ? "ok" : "ng");
  $("nextBtn").focus({ preventScroll: true });
  react(how, r.ok);
  if (how !== "voice") speak(q.hanzi);
}

// 正解でにっこり、不正解でがっかり。続けて間違えたり「わからない」だと怒る
function react(how, ok) {
  let mood, line;
  if (ok) { streak++; missStreak = 0; mood = streak >= 3 ? "joy" : "happy"; line = pickLine(mood === "joy" ? "joy" : "happy"); }
  else {
    streak = 0; missStreak++;
    mood = how === "skip" || missStreak >= 2 ? "angry" : "sad";
    line = pickLine(how === "skip" ? "skip" : mood);
  }
  setMood($("charaQuiz"), mood);
  const el = $("react");
  el.className = "react" + (ok ? "" : " ng");
  el.innerHTML = `${esc(line[0])}<small>${esc(line[1])}</small>`;
  el.hidden = false;
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
  const [mood, zh, ja] =
    rate === 1 ? ["joy", "全对！太厉害了！", "全問正解！すばらしい！"] :
    rate >= 0.8 ? ["happy", "做得很好！", "よくできました！"] :
    rate >= 0.5 ? ["normal", "继续加油！", "その調子！間違えた単語はまた出すからね。"] :
    rate >= 0.2 ? ["sad", "再复习一下吧…", "もう一度復習しようか…"] :
                  ["angry", "要好好学习！", "しっかり勉強しなさい！"];
  $("resultZh").textContent = zh; $("resultJa").textContent = ja;
  requestAnimationFrame(() => setMood($("charaResult"), mood));
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
const SILENCE_MS = 1200;  // 何か聞き取れた後、これだけ声が途切れたら自動で終える
const MAX_LISTEN_MS = 8000;
const VOICE_TRIES = 2;     // 聞き違いに備えて、不正解にする前にもう1回言い直せる
let listening = false, rec = null, buf = [], alts = [], interimText = "", silenceTimer = 0, maxTimer = 0;
let heardAll = new Set(); // 話している間に出た候補（途中結果・別候補も含む）
let voiceTries = 0;

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
  $("micBtn").setAttribute("aria-label", state === "listening" ? "やめる" : "話す");
  $("micState").textContent =
    state === "starting" ? "準備しています…" :
    state === "listening" ? "聞いています…はっきり言ってみて" :
    "タップして中国語で話してください";
}

function showHeard(text, partial) {
  const py = text ? heardPinyin(text) : "";
  $("heard").textContent = text ? (py ? `${text}（${py}）` : text) : "";
  $("heard").classList.toggle("partial", partial);
}

function clearTimers() { clearTimeout(silenceTimer); clearTimeout(maxTimer); }

function startListening() {
  buf = []; alts = []; interimText = ""; heardAll = new Set();
  showHeard("", false);
  $("voiceNote").hidden = true;
  listening = true;
  setMicUi("starting");
  let errCode = "";
  const r0 = new Recognition();
  rec = r0;
  r0.lang = "zh-CN"; r0.interimResults = true; r0.maxAlternatives = 5; r0.continuous = false;
  r0.onstart = () => {
    if (rec !== r0) return;
    setMicUi("listening"); setMood($("charaQuiz"), "listen");
    maxTimer = setTimeout(stopListening, MAX_LISTEN_MS);
  };
  r0.onresult = (e) => {
    if (rec !== r0 || answered) return;
    interimText = "";
    const fresh = [];
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) { buf.push(r[0].transcript); for (let j = 1; j < r.length; j++) alts.push(r[j].transcript); }
      else interimText += r[0].transcript;
      for (let j = 0; j < r.length; j++) { fresh.push(r[j].transcript); heardAll.add(r[j].transcript); }
    }
    const text = (buf.join("") + interimText).trim();
    showHeard(text, !!interimText);
    // 正解が聞こえた時点ですぐ判定する（話し終わりを待たない）
    if (deck[pos] && [text, ...fresh].some((t) => matchVoice(t, deck[pos])?.ok)) {
      if (text) heardAll.add(text);
      const res = judgeVoice(text, [...fresh, ...heardAll]);
      endListening();
      finish("voice", text, res);
      return;
    }
    clearTimeout(silenceTimer);
    if (text) silenceTimer = setTimeout(stopListening, SILENCE_MS);
  };
  r0.onerror = (e) => { errCode = e.error; };
  r0.onend = () => { if (rec === r0) onListenEnd(errCode); };
  try { r0.start(); } catch { onListenEnd("start-failed"); }
}

function stopListening() {
  clearTimers();
  if (rec) try { rec.stop(); } catch {}
}
// 認識を捨てて、画面を待機の状態に戻す
function endListening() {
  clearTimers();
  const r = rec;
  listening = false; rec = null;
  if (r) try { r.abort(); } catch {}
  setMicUi("idle");
  if ($("charaQuiz").dataset.mood === "listen") setMood($("charaQuiz"), "normal");
}
const abortListening = endListening;

const VOICE_ERRORS = {
  "not-allowed": "マイクが許可されていません。ブラウザの設定でマイクを許可するか、入力で答えてください。",
  "service-not-allowed": "この端末では音声認識が使えません。iPhone は「設定 > 一般 > キーボード > 音声入力」をオンにしてください。",
  "language-not-supported": "この端末では中国語の音声認識が使えません。入力で答えてください。",
  "audio-capture": "マイクが見つかりません。",
  "network": "音声認識に接続できませんでした。通信状況を確認してください。",
  "no-speech": "聞き取れませんでした。マイクに近づいて、もう一度どうぞ。",
};

function onListenEnd(reason) {
  if (!listening) return;
  // iPhone では確定結果が来ないまま終わることがあるので、途中の結果も使う
  const text = (buf.join("") + interimText).trim();
  endListening();
  if (answered) return;
  if (text) {
    const res = judgeVoice(text, [...alts, ...heardAll]);
    voiceTries++;
    if (!res.ok && voiceTries < VOICE_TRIES) {
      // 1回目の聞き違いは不正解にせず、聞こえた内容を見せて言い直してもらう
      showHeard(text, false);
      $("voiceNote").textContent = "違う音に聞こえたよ。もう一回言ってみて！";
      $("voiceNote").classList.add("retry");
      $("voiceNote").hidden = false;
      return;
    }
    finish("voice", text, res);
    return;
  }
  showHeard("", false);
  const msg = VOICE_ERRORS[reason] || (reason && reason !== "aborted" ? "うまく聞き取れませんでした。もう一度どうぞ。" : "聞き取れませんでした。もう一度どうぞ。");
  $("voiceNote").classList.remove("retry");
  $("voiceNote").textContent = msg; $("voiceNote").hidden = false;
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
