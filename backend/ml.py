# Lightweight ml.py: numpy only (no torch / sklearn / sentence-transformers).
# Lexical (hashed character n-gram) similarity + keyword classifier, English + Hinglish.
import re
import zlib
import numpy as np

DIM = 384
ROUTING = {"Electrical": "Electrical", "Wi-Fi / Network": "IT Department", "Water leakage": "Plumbing",
           "Sanitation": "Sanitation", "Hostel issue": "Hostel Warden",
           "Classroom equipment": "Infrastructure", "Security": "Security"}
BASE = {"Security": 4, "Electrical": 3, "Water leakage": 3, "Hostel issue": 2,
        "Sanitation": 2, "Classroom equipment": 1, "Wi-Fi / Network": 1}
DANGER = ["spark", "short circuit", "shock", "flood", "fire", "wire", "theft", "chingari", "current"]
CRITICAL = ["lab", "hostel", "exam", "library"]
KEYWORDS = {
    "Electrical": ["light", "bulb", "fan", "switch", "wir", "power", "socket", "electric", "tubelight", "bijli", "spark"],
    "Wi-Fi / Network": ["wifi", "internet", "network", "router", "lan", "bandwidth"],
    "Water leakage": ["water", "leak", "pipe", "tap", "paani", "pani", "flood", "seepage"],
    "Sanitation": ["toilet", "washroom", "dirty", "garbage", "clean", "smell", "dustbin", "gandagi"],
    "Hostel issue": ["hostel", "mess", "warden", "bed"],
    "Classroom equipment": ["projector", "bench", "desk", "board", "chair", "classroom", "mic"],
    "Security": ["theft", "stol", "stranger", "lock", "cctv", "unsafe", "harass", "chori"],
}


def _tokens(text):
    return re.findall(r"[a-z0-9]+", text.lower().replace("-", ""))


def embed(text):
    v = np.zeros(DIM, dtype=np.float32)
    for w in _tokens(text):
        v[zlib.crc32(("w:" + w).encode()) % DIM] += 2.0
        p = f"#{w}#"
        for i in range(len(p) - 2):
            v[zlib.crc32(p[i:i + 3].encode()) % DIM] += 1.0
    n = np.linalg.norm(v)
    return v / n if n else v


def classify(text):
    toks = _tokens(text)
    scores = {c: sum(any(t.startswith(k) for k in ks) for t in toks) for c, ks in KEYWORDS.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Unclassified"


def flags(text):
    t = text.lower()
    return any(k in t for k in DANGER), any(k in t for k in CRITICAL)


def priority(cat, danger, crit, n):
    b = BASE.get(cat, 1)
    score = b + 3 * danger + 2 * crit + min(n - 1, 5)
    level = "High" if score >= 8 else "Medium" if score >= 4 else "Low"
    why = (f"category base {b}" + (" +3 safety keyword" if danger else "")
           + (" +2 critical location" if crit else "")
           + (f" +{min(n - 1, 5)} repeat reports" if n > 1 else ""))
    return score, level, why


def find_duplicate(vec, cands, thr=0.35):
    best, sim = None, 0.0
    for c in cands:
        s = float(np.dot(vec, np.array(c["embedding"])))
        if s > sim:
            best, sim = c, s
    return (best, sim) if sim >= thr else (None, sim)