"use strict";
// 先生役のキャラクター「李老师（リー先生）」。表情は data-mood で切り替える
// normal / happy / joy（連続正解）/ sad / angry / listen
const CHARA_SVG = `
<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- 体：赤いチャイナカラーの上着 -->
  <path d="M18 140 C20 113 38 103 60 103 C82 103 100 113 102 140 Z" fill="#d6363f"/>
  <path d="M46 103 C50 110 55 113 60 113 C65 113 70 110 74 103" fill="none" stroke="#f2c14e" stroke-width="3" stroke-linecap="round"/>
  <path d="M60 113 L60 140" stroke="#b02a32" stroke-width="2"/>
  <circle cx="60" cy="121" r="2.6" fill="#f2c14e"/><circle cx="60" cy="131" r="2.6" fill="#f2c14e"/>
  <rect x="53" y="90" width="14" height="15" rx="5" fill="#f1c7a6"/>
  <!-- 髪（後ろ）とお団子 -->
  <circle cx="60" cy="57" r="39" fill="#2a2321"/>
  <circle cx="60" cy="15" r="13" fill="#2a2321"/>
  <path d="M49 22 Q60 28 71 22" fill="none" stroke="#d6363f" stroke-width="4" stroke-linecap="round"/>
  <!-- 顔 -->
  <ellipse cx="60" cy="62" rx="31" ry="32" fill="#f6d3b6"/>
  <ellipse cx="29.5" cy="64" rx="4" ry="6" fill="#f1c7a6"/><ellipse cx="90.5" cy="64" rx="4" ry="6" fill="#f1c7a6"/>
  <!-- 前髪 -->
  <path d="M28 58 C27 32 46 22 60 23 C76 22 94 33 92 58 C86 46 77 40 66 41 C62 44 56 45 50 43 C42 45 33 50 28 58 Z" fill="#2a2321"/>
  <!-- ほっぺ -->
  <g class="cheeks"><ellipse cx="41" cy="75" rx="6" ry="3.6" fill="#f29b9b"/><ellipse cx="79" cy="75" rx="6" ry="3.6" fill="#f29b9b"/></g>

  <!-- ふつう -->
  <g class="m m-normal">
    <path d="M40 55 Q46 52 52 54" class="ln"/><path d="M68 54 Q74 52 80 55" class="ln"/>
    <ellipse cx="46" cy="64" rx="3.6" ry="4.6" fill="#2a2321"/><ellipse cx="74" cy="64" rx="3.6" ry="4.6" fill="#2a2321"/>
    <circle cx="47.2" cy="62.4" r="1.2" fill="#fff"/><circle cx="75.2" cy="62.4" r="1.2" fill="#fff"/>
    <path d="M53 78 Q60 84 67 78" class="ln"/>
  </g>
  <!-- にっこり -->
  <g class="m m-happy m-joy">
    <path d="M40 53 Q46 49 52 52" class="ln"/><path d="M68 52 Q74 49 80 53" class="ln"/>
    <path d="M41 66 Q46 59 51 66" class="ln thick"/><path d="M69 66 Q74 59 79 66" class="ln thick"/>
    <path d="M50 76 Q60 74 70 76 Q68 90 60 90 Q52 90 50 76 Z" fill="#8c2b2f"/>
    <path d="M54 86 Q60 82 66 86 Q63 90 60 90 Q57 90 54 86 Z" fill="#ef8a8a"/>
  </g>
  <!-- 大喜び（きらきら） -->
  <g class="m m-joy">
    <path d="M14 30 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#f2c14e"/>
    <path d="M104 22 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#f2c14e"/>
    <path d="M100 48 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 Z" fill="#f2c14e"/>
  </g>
  <!-- がっかり -->
  <g class="m m-sad">
    <path d="M40 56 Q45 53 51 50" class="ln"/><path d="M69 50 Q75 53 80 56" class="ln"/>
    <path d="M42 66 Q46 69 50 66" class="ln thick"/><path d="M70 66 Q74 69 78 66" class="ln thick"/>
    <path d="M53 83 Q60 77 67 83" class="ln"/>
    <path d="M80 70 Q83 76 80 79 Q77 76 80 70 Z" fill="#7cc4f2"/>
  </g>
  <!-- ぷんぷん -->
  <g class="m m-angry">
    <ellipse cx="60" cy="66" rx="29" ry="22" fill="#ff5a5a" opacity=".12"/>
    <path d="M39 51 L51 57" class="ln thick"/><path d="M81 51 L69 57" class="ln thick"/>
    <ellipse cx="46" cy="64" rx="3.4" ry="3.8" fill="#2a2321"/><ellipse cx="74" cy="64" rx="3.4" ry="3.8" fill="#2a2321"/>
    <path d="M52 82 Q56 78 60 81 Q64 78 68 82" class="ln"/>
    <g transform="translate(90 30)" stroke="#e23b3b" stroke-width="3.2" stroke-linecap="round" fill="none">
      <path d="M-7 -2 Q-2 -2 -2 -7"/><path d="M2 -7 Q2 -2 7 -2"/><path d="M7 2 Q2 2 2 7"/><path d="M-2 7 Q-2 2 -7 2"/>
    </g>
  </g>
  <!-- 聞いている -->
  <g class="m m-listen">
    <path d="M40 54 Q46 51 52 53" class="ln"/><path d="M68 53 Q74 51 80 54" class="ln"/>
    <ellipse cx="46" cy="64" rx="3.6" ry="4.6" fill="#2a2321"/><ellipse cx="74" cy="64" rx="3.6" ry="4.6" fill="#2a2321"/>
    <circle cx="47.2" cy="62.4" r="1.2" fill="#fff"/><circle cx="75.2" cy="62.4" r="1.2" fill="#fff"/>
    <ellipse cx="60" cy="81" rx="3.5" ry="4" fill="#8c2b2f"/>
    <path d="M100 58 q6 6 0 12 M106 53 q10 11 0 22" stroke="#2f45b5" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>
  </g>
</svg>`;

const CHARA_LINES = {
  happy: [["太棒了！", "すごい！"], ["对了！", "正解！"], ["很好！", "いいね！"], ["没错！", "その通り！"]],
  joy: [["你真厉害！", "本当にすごい！"], ["完美！", "完璧！"], ["继续保持！", "その調子！"]],
  sad: [["差一点…", "おしい…"], ["没关系，再来！", "大丈夫、次いこう！"], ["哎…", "あぁ…"]],
  angry: [["哎呀！", "もう！"], ["认真点儿！", "ちゃんと覚えて！"], ["又错了！", "また間違えた！"]],
  skip: [["要记住哦！", "覚えてね！"], ["下次加油！", "次はがんばって！"]],
};

function pickLine(kind) {
  const a = CHARA_LINES[kind];
  return a[Math.floor(Math.random() * a.length)];
}

function setMood(el, mood) {
  if (!el) return;
  if (!el.firstElementChild) el.innerHTML = CHARA_SVG;
  el.dataset.mood = mood;
  // 動きをやり直す
  el.classList.remove("anim");
  void el.offsetWidth;
  el.classList.add("anim");
}

for (const el of document.querySelectorAll(".chara")) setMood(el, el.dataset.mood || "normal");
