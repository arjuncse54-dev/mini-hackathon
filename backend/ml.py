import numpy as np
from sentence_transformers import SentenceTransformer

model = SentenceTransformer("paraphrase-multilingual-MiniLM-L12-v2")

CATEGORIES = {
    "Electrical": "light bulb fan switch wiring power electricity socket",
    "Wi-Fi / Network": "wifi internet network router connection slow",
    "Water leakage": "water leak pipe tap flooding seepage",
    "Sanitation": "toilet washroom dirty garbage cleaning smell",
    "Hostel issue": "hostel room mess warden bed",
    "Classroom equipment": "projector bench desk board classroom chair",
    "Security": "theft stranger lock cctv unsafe harassment",
}
ROUTING = {"Electrical": "Electrical", "Wi-Fi / Network": "IT Department", "Water leakage": "Plumbing",
           "Sanitation": "Sanitation", "Hostel issue": "Hostel Warden",
           "Classroom equipment": "Infrastructure", "Security": "Security"}
BASE = {"Security": 4, "Electrical": 3, "Water leakage": 3, "Hostel issue": 2,
        "Sanitation": 2, "Classroom equipment": 1, "Wi-Fi / Network": 1}
DANGER = ["spark", "short circuit", "shock", "flood", "fire", "wire", "theft", "chingari", "current"]
CRITICAL = ["lab", "hostel", "exam", "library"]

NAMES = list(CATEGORIES)
VECS = model.encode(list(CATEGORIES.values()), normalize_embeddings=True)


def embed(text):
    return model.encode(text, normalize_embeddings=True)


def classify(vec):
    sims = VECS @ vec
    i = int(sims.argmax())
    return NAMES[i] if sims[i] >= 0.25 else "Unclassified"


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


def find_duplicate(vec, cands, thr=0.75):
    best, sim = None, 0.0
    for c in cands:
        s = float(np.dot(vec, np.array(c["embedding"])))
        if s > sim:
            best, sim = c, s
    return (best, sim) if sim >= thr else (None, sim)
