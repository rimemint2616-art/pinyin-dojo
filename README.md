# ピンイン道場

日本語の問題を見て、中国語をピンイン入力か発音で答える HSK 単語練習サイト。ビルド不要の静的サイトです。

- HSK（旧6級制）1〜6級、計4,989語
- 1回20問か30問。毎回ランダムに出題し、一巡するまで同じ単語は出ない
- 間違えた単語は重みが付き、正解を重ねるまで出やすくなる（記録は端末のブラウザ内）
- 発音での回答はブラウザ標準の音声認識（Chrome、iOS 14.5 以降の Safari）。**https で開く必要がある**
- 発音は、聞き取った漢字をピンインに直して判定する（同音の別字・算用数字・r化の脱落も正解。声調の違いは添え書きのみ）

## ファイル

| ファイル | 内容 |
| --- | --- |
| index.html / style.css / app.js | 画面と処理 |
| words.js | 単語データ（生成物。直接編集しない） |
| data/hsk1.txt, data/out*.txt | 単語の元データ `級|漢字|ピンイン(/で別解)|日本語[|音声の別表記]` |
| tools/build_words.py | 元データを検査して words.js を作る |

単語を直したら `data/` を編集して `python3 tools/build_words.py --write`。

## 手元で動かす

```sh
python3 -m http.server 8000
# http://localhost:8000 を開く（localhost なら音声認識も動く）
```

## 公開（GitHub Pages）

リポジトリを GitHub に push し、Settings → Pages で「Deploy from a branch」→ `main` / `/ (root)` を選ぶ。

## クレジット

語彙リスト：[complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary)（MIT License）、元データ [CC-CEDICT](https://cc-cedict.org/)（CC BY-SA 4.0）。発音の判定に [pinyin-pro](https://github.com/zh-lx/pinyin-pro)（MIT License、CDN から読み込み）。日本語の問題文は本サイトで作成。
