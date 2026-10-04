import { db } from "./firebase.js";
import { collection, onSnapshot, getDocs, query, where, doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";

const API = "http://localhost:8000";
const CATS = ["Electrical", "Wi-Fi / Network", "Water leakage", "Sanitation", "Hostel issue", "Classroom equipment", "Security"];
const DEPTS = ["Electrical", "IT Department", "Plumbing", "Sanitation", "Hostel Warden", "Infrastructure", "Security", "Admin"];
const STATUS = ["Acknowledged", "In Progress", "Resolved"];
const $ = s => document.querySelector(s);
const opts = (el, a) => (el.innerHTML = a.map(x => `<option>${x}</option>`).join(""));
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

opts($("#cat"), ["Auto-detect", ...CATS]);
opts($("#building"), ["CS Block", "Main Block", "Hostel A", "Library"]);
opts($("#floor"), ["Ground", "1", "2", "3"]);
opts($("#dept"), DEPTS);
$("#student").value = localStorage.getItem("student") || "";

document.querySelectorAll("nav button").forEach(b => (b.onclick = () => {
  document.querySelectorAll("nav button").forEach(x => x.classList.toggle("on", x === b));
  document.querySelectorAll("section").forEach(s => (s.hidden = s.id !== b.dataset.t));
  if (b.dataset.t === "mine") loadMine();
}));

const toJpeg = file => new Promise(res => {
  if (!file) return res(null);
  const img = new Image();
  img.onload = () => {
    const k = Math.min(1, 480 / img.width), c = document.createElement("canvas");
    c.width = img.width * k; c.height = img.height * k;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    res(c.toDataURL("image/jpeg", 0.6));
  };
  img.src = URL.createObjectURL(file);
});

$("#form").onsubmit = async e => {
  e.preventDefault();
  const student = $("#student").value.trim();
  localStorage.setItem("student", student);
  const body = { student, category: $("#cat").value, building: $("#building").value, floor: $("#floor").value,
                 room: $("#room").value, description: $("#desc").value, photo: await toJpeg($("#photo").files[0]) };
  $("#msg").textContent = "Submitting...";
  try {
    const r = await (await fetch(API + "/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })).json();
    $("#msg").textContent = r.duplicate
      ? `Grouped with an existing issue (similarity ${r.similarity}). Priority: ${r.priority}`
      : `New issue sent to ${r.department}. Priority: ${r.priority}`;
    e.target.reset(); $("#student").value = student;
  } catch { $("#msg").textContent = "Backend not reachable"; }
};

let issues = [];
onSnapshot(collection(db, "issues"), s => {
  issues = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.score - a.score);
  renderAuth(); renderAdmin();
});

const card = (i, ctl = "") => `<div class="card p-${i.priority}"><b>${esc(i.category)}</b> · ${esc(i.building)} ${esc(i.floor)} ${esc(i.room)}
  <span class="tag">${i.priority}</span><span class="tag">${i.status}</span><br>${i.reportCount} report(s) · ${esc(i.department)}
  <br><small>${esc(i.reason)}</small><div>${ctl}</div></div>`;

function renderAuth() {
  const d = $("#dept").value;
  $("#authList").innerHTML = issues.filter(i => d === "Admin" || i.department === d).map(i =>
    card(i, STATUS.map(s => `<button data-id="${i.id}" data-s="${s}">${s}</button>`).join(""))).join("") || "No issues";
}
$("#dept").onchange = renderAuth;

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-s]");
  if (!b) return;
  await updateDoc(doc(db, "issues", b.dataset.id), {
    status: b.dataset.s, updatedAt: serverTimestamp(), history: arrayUnion({ status: b.dataset.s, at: Date.now() }) });
});

function renderAdmin() {
  const tally = k => Object.entries(issues.reduce((m, i) => ((m[i[k]] = (m[i[k]] || 0) + i.reportCount), m), {}))
    .map(([n, c]) => `<div class="bar"><span>${esc(n)}</span><i style="width:${c * 30}px"></i>${c}</div>`).join("");
  $("#admin").innerHTML = `<h3>Reports by building</h3>${tally("building")}<h3>Reports by category</h3>${tally("category")}<h3>All issues</h3>${issues.map(i => card(i)).join("")}`;
}

async function loadMine() {
  const s = localStorage.getItem("student") || "";
  const snap = await getDocs(query(collection(db, "reports"), where("student", "==", s)));
  $("#mine").innerHTML = snap.docs.map(d => {
    const r = d.data(), i = issues.find(x => x.id === r.issueId) || {};
    return `<div class="card"><p>${esc(r.description)}</p>${r.photo ? `<img src="${r.photo}">` : ""}
      <div>Status: <b>${i.status}</b> · Priority: ${i.priority} · ${esc(i.department)}<br>
      <small>${(i.history || []).map(h => h.status).join(" → ")}</small></div></div>`;
  }).join("") || "No reports yet";
}
