# Offline evaluation of duplicate matching. No Firebase needed. Run: python evaluate.py
# label 1 = same underlying issue, 0 = different issues (same building/floor/category, so SQL filter would not separate them)
import ml

THR = 0.35  # same default as ml.find_duplicate
PAIRS = [  # (room_a, text_a, room_b, text_b, label)
    ("204", "light outside lab 204 not working", "204", "lab 204 ke bahar bulb nahi jal raha", 1),
    ("204", "tubelight flickering near lab 204", "204", "lab 204 corridor light is off", 1),
    ("112", "wifi very slow in room", "112", "internet not working in 112", 1),
    ("112", "Wi-Fi not connecting since morning", "112", "wifi disconnecting again and again", 1),
    ("", "water leaking from pipe near washroom", "", "pipe leakage near the washroom floor is wet", 1),
    ("", "water leaking from tap in corridor", "", "tap in corridor is leaking water", 1),
    ("301", "fan not working in classroom 301", "301", "classroom 301 fan is off", 1),
    ("301", "projector not turning on", "301", "projector in 301 is not working", 1),
    ("", "toilet is dirty and smells", "", "washroom very dirty, bad smell", 1),
    ("110", "socket sparking in room 110", "110", "sparks coming from switch board in room 110", 1),
    ("", "bench broken in seminar hall", "", "seminar hall bench is broken", 1),
    ("", "gate lock broken", "", "lock of main gate is not working", 1),
    ("204", "light outside lab 204 not working", "204", "fan in lab 204 making loud noise", 0),
    ("112", "wifi very slow in room", "112", "router missing from the corridor", 0),
    ("", "water leaking from pipe near washroom", "", "water cooler is not cooling", 0),
    ("301", "fan not working", "301", "projector bulb has fused", 0),
    ("", "toilet is dirty", "", "garbage not collected from dustbin", 0),
    ("110", "socket sparking", "110", "tubelight not working", 0),
    ("", "bench broken in seminar hall", "", "projector screen torn in seminar hall", 0),
    ("", "gate lock broken", "", "cctv camera not working near gate", 0),
    ("204", "light not working", "204", "ceiling fan wobbling dangerously", 0),
    ("112", "wifi slow", "112", "water leaking from roof", 0),
    ("301", "fan not working", "301", "wifi not working", 0),
    ("", "tap leaking in corridor", "", "washroom door lock broken", 0),
]

def sim(p):
    ra, ta, rb, tb, _ = p
    return float(ml.embed(f"{ra} {ta}") @ ml.embed(f"{rb} {tb}"))

def scores(thr):
    tp = fp = fn = tn = 0
    for p in PAIRS:
        pred = sim(p) >= thr
        tp += pred and p[4]; fp += pred and not p[4]
        fn += (not pred) and p[4]; tn += (not pred) and not p[4]
    pr = tp / (tp + fp) if tp + fp else 0.0
    rc = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * pr * rc / (pr + rc) if pr + rc else 0.0
    return tp, fp, fn, tn, pr, rc, f1

print(f"{'sim':>5}  label  pred  pair")
for p in sorted(PAIRS, key=sim, reverse=True):
    s = sim(p)
    print(f"{s:5.2f}  {p[4]:>5}  {int(s >= THR):>4}  {p[1][:34]!r} vs {p[3][:34]!r}")

print("\nthreshold sweep")
print("thr   TP FP FN TN  precision recall  F1")
for t in (0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55):
    tp, fp, fn, tn, pr, rc, f1 = scores(t)
    print(f"{t:.2f}  {tp:>2} {fp:>2} {fn:>2} {tn:>2}  {pr:9.2f} {rc:6.2f} {f1:5.2f}")
tp, fp, fn, tn, pr, rc, f1 = scores(THR)
print(f"\nAt deployed threshold {THR}: precision {pr:.2f}, recall {rc:.2f}, F1 {f1:.2f}  ({len(PAIRS)} pairs)")