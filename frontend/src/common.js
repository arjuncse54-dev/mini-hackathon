export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const CATS = ["Electrical", "Wi-Fi / Network", "Water leakage", "Sanitation", "Hostel issue", "Classroom equipment", "Security"];
export const DEPTS = ["Electrical", "IT Department", "Plumbing", "Sanitation", "Hostel Warden", "Infrastructure", "Security"];
export const STEPS = ["Reported", "Acknowledged", "In Progress", "Resolved"];
export const opts = (el, a) => (el.innerHTML = a.map(x => `<option>${x}</option>`).join(""));
export const when = t => (t && t.toDate ? t.toDate().toLocaleString() : "");
export const stepper = s => {
  const n = STEPS.indexOf(s);
  return `<div class="steps">${STEPS.map((x, k) => `<span class="${k <= n ? "done" : ""}">${x}</span>`).join("")}</div>`;
};
export function renderNav(active) {
  const L = [["report", "/index.html", "Report Issue"], ["mine", "/my-reports.html", "My Reports"], ["auth", "/authority.html", "Authority"]];
  $("#nav").innerHTML = `<header><a class="brand" href="/index.html">🏫 CampusCare</a><nav>${L.map(([k, h, t]) => `<a href="${h}" class="${k === active ? "on" : ""}">${t}</a>`).join("")}</nav></header>`;
}
export const dbError = e => `<p class="alert err">Could not load data (${esc(e.code || e.message)}). Check the ad blocker, Firestore rules and frontend/.env.</p>`;
