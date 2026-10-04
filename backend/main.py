import time
import numpy as np
import firebase_admin
from firebase_admin import credentials, firestore
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import ml

firebase_admin.initialize_app(credentials.Certificate("serviceAccountKey.json"))
db = firestore.client()
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


class Report(BaseModel):
    student: str
    category: str | None = None
    building: str
    floor: str
    room: str = ""
    description: str
    photo: str | None = None


@app.post("/report")
def report(r: Report):
    vec = ml.embed(r.description)
    cat = r.category if r.category and r.category != "Auto-detect" else ml.classify(vec)
    q = (db.collection("issues").where("building", "==", r.building)
         .where("floor", "==", r.floor).where("category", "==", cat))
    cands = [{"id": d.id, **d.to_dict()} for d in q.stream() if d.to_dict()["status"] != "Resolved"]
    dup, sim = ml.find_duplicate(vec, cands)
    danger, crit = ml.flags(f"{r.description} {r.room} {r.building}")
    now = int(time.time() * 1000)

    if dup:
        n = dup["reportCount"] + 1
        danger, crit = danger or dup["danger"], crit or dup["critical"]
        mean = np.array(dup["embedding"]) * dup["reportCount"] + vec
        score, level, why = ml.priority(cat, danger, crit, n)
        db.collection("issues").document(dup["id"]).update({
            "reportCount": n, "embedding": (mean / np.linalg.norm(mean)).tolist(),
            "danger": danger, "critical": crit, "score": score, "priority": level,
            "reason": why, "updatedAt": firestore.SERVER_TIMESTAMP})
        issue_id, dept = dup["id"], dup["department"]
    else:
        score, level, why = ml.priority(cat, danger, crit, 1)
        dept = ml.ROUTING.get(cat, "Admin")
        ref = db.collection("issues").document()
        ref.set({"category": cat, "building": r.building, "floor": r.floor, "room": r.room,
                 "department": dept, "status": "Reported", "priority": level, "score": score,
                 "reason": why, "reportCount": 1, "danger": danger, "critical": crit,
                 "embedding": vec.tolist(), "history": [{"status": "Reported", "at": now}],
                 "createdAt": firestore.SERVER_TIMESTAMP, "updatedAt": firestore.SERVER_TIMESTAMP})
        issue_id = ref.id

    db.collection("reports").add({"issueId": issue_id, "student": r.student,
                                  "description": r.description, "photo": r.photo,
                                  "createdAt": firestore.SERVER_TIMESTAMP})
    return {"issueId": issue_id, "duplicate": bool(dup), "similarity": round(sim, 2),
            "category": cat, "priority": level, "department": dept}
