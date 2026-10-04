import { db } from "./firebase.js";
import { collection, onSnapshot, doc, updateDoc, arrayUnion, serverTimestamp } from "firebase/firestore";
import { $, esc, opts, DEPTS, STEPS, renderNav, stepper, when, dbError } from "./common.js";
renderNav("auth");
opts($("#dept"), DEPTS);
$("#dept").value = localStorage.getItem("dept") || DEPTS[0];
let issues = [];

onSnapshot(collection(db, "issues"), s => {
  issues = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.score - a.score);
  draw();
}, e => ($("#list").innerHTML = dbError(e)));

$("#dept").onchange = () => { localStorage.setItem("dept", $("#dept").value); draw(); };
$("#flt").onchange = draw;

function draw() {
  const mine = issues.filter(i => i.department === $("#dept").value);
  const open = mine.filter(i => i.status !== "Resolved");
  const f = $("#flt").value;
  const shown = f === "open" ? open : f === "done" ? mine.filter(i => i.status === "Resolved") : mine;
  $("#stats").innerHTML = [["Open", open.length], ["High priority", open.filter(i => i.priority === "High").length], ["Resolved", mine.length - open.length]]
    .map(([t, n]) => `<div class="panel stat"><b>${n}</b><span>${t}</span></div>`).join("");
  $("#list").innerHTML = shown.map(i => `<div class="card ${i.priority}">
    <span class="badge ${i.priority}">${i.priority}</span><span class="badge">${esc(i.category)}</span><span class="badge">${i.reportCount} report(s)</span>
    <p><b>${esc(i.building)} · Floor ${esc(i.floor)} ${esc(i.room)}</b></p>
    <div class="meta">Why this priority: ${esc(i.reason)} · Last update ${when(i.updatedAt)}</div>
    ${stepper(i.status)}
    <div class="acts">${STEPS.slice(1).map(s => `<button class="${i.status === s ? "cur" : ""}" ${i.status === s ? "disabled" : ""} data-id="${i.id}" data-s="${s}">${s}</button>`).join("")}</div></div>`).join("")
    || `<div class="empty">No issues here.</div>`;
}

document.addEventListener("click", async e => {
  const b = e.target.closest("[data-s]");
  if (!b) return;
  b.disabled = true;
  await updateDoc(doc(db, "issues", b.dataset.id), {
    status: b.dataset.s, updatedAt: serverTimestamp(), history: arrayUnion({ status: b.dataset.s, at: Date.now() }) });
});
