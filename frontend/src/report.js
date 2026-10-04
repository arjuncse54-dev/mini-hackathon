import { $, opts, CATS, renderNav } from "./common.js";
const API = "http://127.0.0.1:8000";
renderNav("report");
opts($("#cat"), ["Auto-detect", ...CATS]);
opts($("#building"), ["CS Block", "Main Block", "Hostel A", "Library"]);
opts($("#floor"), ["Ground", "1", "2", "3"]);
$("#student").value = localStorage.getItem("student") || "";

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
const show = (cls, t) => ($("#msg").innerHTML = `<p class="alert ${cls}">${t}</p>`);

$("#form").onsubmit = async e => {
  e.preventDefault();
  const student = $("#student").value.trim();
  localStorage.setItem("student", student);
  $("#go").disabled = true; show("ok", "Submitting...");
  try {
    const body = { student, category: $("#cat").value, building: $("#building").value, floor: $("#floor").value,
      room: $("#room").value, description: $("#desc").value, photo: await toJpeg($("#photo").files[0]) };
    const res = await fetch(API + "/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error("server returned " + res.status);
    const r = await res.json();
    show("ok", r.duplicate
      ? `Grouped with an existing issue (similarity ${r.similarity}). Priority: <b>${r.priority}</b>. <a href="/my-reports.html">Track it</a>`
      : `Sent to <b>${r.department}</b>. Priority: <b>${r.priority}</b>. <a href="/my-reports.html">Track it</a>`);
    e.target.reset(); $("#student").value = student;
  } catch (err) { show("err", "Failed: " + err.message); }
  $("#go").disabled = false;
};
