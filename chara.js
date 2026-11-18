"use strict";
// 案内役のキャラクター（チャイナドレスの少女）。表情は data-mood で切り替える
// normal / happy / joy（連続正解）/ sad / angry / listen
const CHARA_SVG = `
<svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <!-- 後ろ髪（長め） -->
  <path d="M24 60 C22 30 40 17 60 17 C80 17 98 30 96 60 L98 98 C93 104 87 101 85 96 L35 96 C33 101 27 104 22 98 Z" fill="#2a2321"/>
  <!-- お団子とリボン -->
  <circle cx="27" cy="25" r="13" fill="#2a2321"/><circle cx="93" cy="25" r="13" fill="#2a2321"/>
  <path d="M31 36 l-9 -2 l2 8 Z M31 36 l4 -8 l5 6 Z" fill="#e0344a"/><circle cx="31.5" cy="36" r="2.2" fill="#f5c451"/>
  <path d="M89 36 l9 -2 l-2 8 Z M89 36 l-4 -8 l-5 6 Z" fill="#e0344a"/><circle cx="88.5" cy="36" r="2.2" fill="#f5c451"/>
  <!-- チャイナドレス -->
  <path d="M16 140 C18 114 36 104 60 104 C84 104 102 114 104 140 Z" fill="#e0344a"/>
  <g fill="#f7b6c2" opacity=".9">
    <circle cx="30" cy="128" r="2.4"/><circle cx="34" cy="125" r="2.4"/><circle cx="35" cy="130" r="2.4"/><circle cx="29" cy="132" r="2.4"/>
    <circle cx="90" cy="124" r="2.4"/><circle cx="94" cy="128" r="2.4"/><circle cx="89" cy="130" r="2.4"/>
    <circle cx="70" cy="132" r="2"/><circle cx="73" cy="135" r="2"/><circle cx="67" cy="136" r="2"/>
  </g>
  <g fill="#f5c451"><circle cx="32" cy="128.5" r="1.4"/><circle cx="91" cy="127" r="1.4"/><circle cx="70" cy="134.5" r="1.2"/></g>
  <rect x="54" y="88" width="12" height="16" rx="5" fill="#f1c7a6"/>
  <!-- 立ち襟・斜めの合わせ・チャイナボタン -->
  <path d="M47 99 L73 99 L75 109 Q60 113 45 109 Z" fill="#e0344a" stroke="#f5c451" stroke-width="2" stroke-linejoin="round"/>
  <path d="M60 111 Q75 114 90 110" fill="none" stroke="#f5c451" stroke-width="2.4" stroke-linecap="round"/>
  <g stroke="#f5c451" stroke-width="2" stroke-linecap="round"><path d="M72 109 l6 0"/><path d="M83 108 l6 0"/></g>
  <g fill="#f5c451"><circle cx="71" cy="109" r="1.8"/><circle cx="82" cy="108" r="1.8"/></g>
  <!-- 顔 -->
  <ellipse cx="60" cy="63" rx="29" ry="30" fill="#f8d8bf"/>
  <!-- 横髪 -->
  <path d="M31 46 C25 62 27 80 31 94 L38 92 C35 78 35 62 38 49 Z" fill="#2a2321"/>
  <path d="M89 46 C95 62 93 80 89 94 L82 92 C85 78 85 62 82 49 Z" fill="#2a2321"/>
  <!-- ぱっつん前髪 -->
  <path d="M30 52 C30 30 45 23 60 23 C75 23 90 30 90 52 L84 49 L77 53 L69 49 L61 53 L53 49 L45 53 L37 49 Z" fill="#2a2321"/>
  <path d="M44 30 Q52 26 60 27" fill="none" stroke="#5a4a44" stroke-width="2" stroke-linecap="round" opacity=".6"/>
  <!-- ほっぺ -->
  <g class="cheeks"><ellipse cx="41" cy="76" rx="6" ry="3.4" fill="#f59aa5"/><ellipse cx="79" cy="76" rx="6" ry="3.4" fill="#f59aa5"/></g>

  <!-- ふつう -->
  <g class="m m-normal">
    <path d="M41 56 Q46 54 51 55" class="ln thin"/><path d="M69 55 Q74 54 79 56" class="ln thin"/>
    <ellipse cx="46" cy="66" rx="4.6" ry="6" fill="#2a2321"/><ellipse cx="74" cy="66" rx="4.6" ry="6" fill="#2a2321"/>
    <circle cx="47.6" cy="63.4" r="1.9" fill="#fff"/><circle cx="75.6" cy="63.4" r="1.9" fill="#fff"/>
    <path d="M41.5 61 l-2.4 -2" class="ln thin"/><path d="M78.5 61 l2.4 -2" class="ln thin"/>
    <path d="M55.5 80 Q60 83.5 64.5 80" class="ln"/>
  </g>
  <!-- にっこり -->
  <g class="m m-happy m-joy">
    <path d="M41 55 Q46 52 51 54" class="ln thin"/><path d="M69 54 Q74 52 79 55" class="ln thin"/>
    <path d="M41 67 Q46 60 51 67" class="ln thick"/><path d="M69 67 Q74 60 79 67" class="ln thick"/>
    <path d="M53 78 Q60 76.5 67 78 Q65.5 88 60 88 Q54.5 88 53 78 Z" fill="#8c2b2f"/>
    <path d="M56 85 Q60 82.5 64 85 Q62 88 60 88 Q58 88 56 85 Z" fill="#ef8a8a"/>
  </g>
  <!-- 大喜び（きらきら） -->
  <g class="m m-joy">
    <path d="M10 52 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3 Z" fill="#f5c451"/>
    <path d="M108 50 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" fill="#f5c451"/>
    <path d="M104 78 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5 Z" fill="#f5c451"/>
  </g>
  <!-- がっかり -->
  <g class="m m-sad">
    <path d="M41 57 Q45 55 51 52" class="ln thin"/><path d="M69 52 Q75 55 79 57" class="ln thin"/>
    <path d="M42 67 Q46 70.5 50 67" class="ln thick"/><path d="M70 67 Q74 70.5 78 67" class="ln thick"/>
    <path d="M55 84 Q60 79 65 84" class="ln"/>
    <path d="M79 71 Q82.5 77 79 80 Q75.5 77 79 71 Z" fill="#7cc4f2"/>
  </g>
  <!-- ぷんぷん -->
  <g class="m m-angry">
    <ellipse cx="60" cy="68" rx="27" ry="20" fill="#ff5a5a" opacity=".12"/>
    <path d="M40 53 L51 58" class="ln thick"/><path d="M80 53 L69 58" class="ln thick"/>
    <ellipse cx="46" cy="66" rx="4.2" ry="4.6" fill="#2a2321"/><ellipse cx="74" cy="66" rx="4.2" ry="4.6" fill="#2a2321"/>
    <circle cx="47.3" cy="64.4" r="1.4" fill="#fff"/><circle cx="75.3" cy="64.4" r="1.4" fill="#fff"/>
    <path d="M54 83 Q57 80 60 82.5 Q63 80 66 83" class="ln"/>
    <path d="M57 83.5 Q60 87 63 83.5" fill="#ef8a8a"/>
    <g transform="translate(88 33)" stroke="#e23b3b" stroke-width="3.2" stroke-linecap="round" fill="none">
      <path d="M-7 -2 Q-2 -2 -2 -7"/><path d="M2 -7 Q2 -2 7 -2"/><path d="M7 2 Q2 2 2 7"/><path d="M-2 7 Q-2 2 -7 2"/>
    </g>
  </g>
  <!-- 聞いている -->
  <g class="m m-listen">
    <path d="M41 55 Q46 53 51 54" class="ln thin"/><path d="M69 54 Q74 53 79 55" class="ln thin"/>
    <ellipse cx="46" cy="66" rx="4.6" ry="6" fill="#2a2321"/><ellipse cx="74" cy="66" rx="4.6" ry="6" fill="#2a2321"/>
    <circle cx="47.6" cy="63.4" r="1.9" fill="#fff"/><circle cx="75.6" cy="63.4" r="1.9" fill="#fff"/>
    <ellipse cx="60" cy="82" rx="3.2" ry="3.8" fill="#8c2b2f"/>
    <path d="M102 60 q6 6 0 12 M108 55 q10 11 0 22" stroke="#2f45b5" stroke-width="2.6" fill="none" stroke-linecap="round" opacity=".7"/>
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
