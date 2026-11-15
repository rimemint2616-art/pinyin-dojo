"""data/hsk1.txt と data/out*.txt（level|漢字|ピンイン|日本語[|音声別表記]）から words.js を作る。"""
import re, json, sys, glob, collections, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PY_OK = re.compile(r"^[a-zA-ZāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜüńňǹḿĀÁǍÀĒÉĚÈŌÓǑÒ' /]+$")
levels = collections.defaultdict(list)
problems = []
files = [os.path.join(ROOT, "data/hsk1.txt")] + sorted(glob.glob(os.path.join(ROOT, "data/out*.txt")))
for path in files:
    lines = [l for l in open(path, encoding="utf-8").read().split("\n") if l.strip()]
    inp = path.replace("out", "in").replace(".txt", ".tsv")
    if os.path.exists(inp):
        src = [l.split("\t")[1] for l in open(inp, encoding="utf-8").read().split("\n") if l.strip()]
        got = [l.split("|")[1] for l in lines]
        if src != got: problems.append(f"{path}: 漢字の並びが入力と違う")
    for l in lines:
        f = l.split("|")
        if len(f) not in (4, 5): problems.append(f"{path}: 欄の数 {l}"); continue
        lv, hz, py, ja = f[:4]
        alt = f[4] if len(f) == 5 else ""
        py = py.strip(); ja = ja.strip()
        if not PY_OK.match(py): problems.append(f"ピンインの文字: {l}")
        if re.search(r"[a-z]{2,}\d", ja) or re.search(r"[āáǎàēéěèīíǐìōóǒòūúǔù]", ja): problems.append(f"問題文にピンイン: {l}")
        levels[int(lv)].append([hz, py, ja] + ([alt] if alt else []))
out = {}
for lv in sorted(levels):
    seen, items = set(), []
    for it in levels[lv]:
        if it[0] in seen: print(f"重複した漢字を1つにまとめた: {lv}級 {it[0]}"); continue
        seen.add(it[0]); items.append(it)
    c = collections.Counter(it[2] for it in items)
    for ja, n in c.items():
        if n > 1: problems.append(f"{lv}級 同じ問題文 {ja}: " + ",".join(it[0] for it in items if it[2] == ja))
    out[lv] = items
    print(f"{lv}級: {len(items)}語")
for p in problems: print("要確認:", p)
if "--write" in sys.argv:
    with open(os.path.join(ROOT, "words.js"), "w", encoding="utf-8") as fp:
        fp.write("// tools/build_words.py で生成。直接編集しないでください\n")
        fp.write("window.HSK_WORDS = " + json.dumps(out, ensure_ascii=False, separators=(",", ":")) + ";\n")
    print("words.js を書き出しました")
