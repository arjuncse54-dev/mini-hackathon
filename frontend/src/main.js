import { db } from "./firebase.js";

import {
  collection,
  onSnapshot,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
  serverTimestamp
} from "firebase/firestore";

// =========================
// CONFIG
// =========================

const API = "http://127.0.0.1:8000";

const CATS = [
  "Electrical",
  "Wi-Fi / Network",
  "Water leakage",
  "Sanitation",
  "Hostel issue",
  "Classroom equipment",
  "Security"
];

const DEPTS = [
  "Electrical",
  "IT Department",
  "Plumbing",
  "Sanitation",
  "Hostel Warden",
  "Infrastructure",
  "Security",
  "Admin"
];

const STATUS = [
  "Acknowledged",
  "In Progress",
  "Resolved"
];

// Cache global state
let issues = [];
let cachedReportsDocs = null;

// =========================
// HELPERS
// =========================

const $ = s => document.querySelector(s);

const opts = (el, arr) => {
  if (!el) return;
  el.innerHTML = arr.map(x => `<option>${x}</option>`).join("");
};

const esc = s =>
  String(s ?? "").replace(/[&<>"]/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;"
  }[c]));

// =========================
// INITIALIZE FORM DROPDOWNS
// =========================

if ($("#cat")) opts($("#cat"), ["Auto-detect", ...CATS]);
if ($("#building")) opts($("#building"), ["CS Block", "Main Block", "Hostel A", "Library"]);
if ($("#floor")) opts($("#floor"), ["Ground", "1", "2", "3"]);
if ($("#dept")) opts($("#dept"), DEPTS);

// =========================
// STUDENT NAME / ID
// =========================

if ($("#student")) {
  $("#student").value = localStorage.getItem("student") || "";
}

// =========================
// NAVIGATION
// =========================

document.querySelectorAll("nav button").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll("nav button").forEach(x =>
      x.classList.toggle("on", x === b)
    );

    document.querySelectorAll("section").forEach(s =>
      s.hidden = s.id !== b.dataset.t
    );

    if (b.dataset.t === "mine") {
      loadMine();
    }
  };
});

// =========================
// IMAGE → JPEG
// =========================

const toJpeg = file => new Promise(resolve => {
  if (!file) {
    resolve(null);
    return;
  }

  const img = new Image();

  img.onload = () => {
    const k = Math.min(1, 480 / img.width);
    const canvas = document.createElement("canvas");

    canvas.width = img.width * k;
    canvas.height = img.height * k;

    canvas
      .getContext("2d")
      .drawImage(img, 0, 0, canvas.width, canvas.height);

    resolve(canvas.toDataURL("image/jpeg", 0.6));
  };

  img.src = URL.createObjectURL(file);
});

// =========================
// SUBMIT CAMPUS ISSUE
// =========================

if ($("#form")) {
  $("#form").onsubmit = async e => {
    e.preventDefault();

    const student = $("#student").value.trim();
    localStorage.setItem("student", student);

    const body = {
      student,
      category: $("#cat").value,
      building: $("#building").value,
      floor: $("#floor").value,
      room: $("#room").value,
      description: $("#desc").value,
      photo: await toJpeg($("#photo").files[0])
    };

    $("#msg").textContent = "Submitting...";

    try {
      const response = await fetch(API + "/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (!response.ok) throw new Error(`Backend returned ${response.status}`);

      const r = await response.json();

      $("#msg").textContent = r.duplicate
        ? `Grouped with an existing issue (similarity ${r.similarity}). Priority: ${r.priority}`
        : `New issue sent to ${r.department}. Priority: ${r.priority}`;

      e.target.reset();
      $("#student").value = student;

    } catch (err) {
      console.error("Submit error:", err);
      $("#msg").textContent = "Backend not reachable";
    }
  };
}

// =========================
// FIRESTORE ISSUES LISTENER
// =========================

onSnapshot(
  collection(db, "issues"),

  snapshot => {
    console.log("issues received:", snapshot.size);

    issues = snapshot.docs
      .map(d => ({
        id: d.id,
        ...d.data()
      }))
      .sort((a, b) => (b.score || 0) - (a.score || 0));

    renderAuth();
    renderAdmin();

    // Re-render cached report docs with updated parent issue status
    // ✅ Corrected Code
  const output = $("#list") || $("#mine");
  if (output && cachedReportsDocs) {
    renderMyReports(cachedReportsDocs, output);
  }
  },

  err => {
    console.error("Firestore listener error:", err.code, err.message);

    document.body.insertAdjacentHTML(
      "afterbegin",
      `<p style="color:red; padding:10px; background:#ffe5e5;">
        Firestore error: ${esc(err.code)}
      </p>`
    );
  }
);

// =========================
// ISSUE CARD TEMPLATE
// =========================

const card = (issue, controls = "") => {
  return `
    <div class="card p-${esc(issue.priority)}">
      <b>${esc(issue.category)}</b>
      · ${esc(issue.building)} ${esc(issue.floor)} ${esc(issue.room)}

      <span class="tag">${esc(issue.priority)}</span>
      <span class="tag">${esc(issue.status)}</span>

      <br>
      ${esc(issue.reportCount || 0)} report(s) · ${esc(issue.department)}

      <br>
      <small>${esc(issue.reason)}</small>

      <div>${controls}</div>
    </div>
  `;
};

// =========================
// AUTHORITY DASHBOARD
// =========================

function renderAuth() {
  if (!$("#authList") || !$("#dept")) return;
  // ... rest of renderAuth function
}

  const department = $("#dept").value;

  const filtered = issues.filter(
    issue => department === "Admin" || issue.department === department
  );

  $("#authList").innerHTML =
    filtered
      .map(issue =>
        card(
          issue,
          STATUS.map(status => `
            <button
              data-id="${esc(issue.id)}"
              data-s="${esc(status)}"
            >
              ${esc(status)}
            </button>
          `).join("")
        )
      )
      .join("") || "No issues";


if ($("#dept")) {
  $("#dept").onchange = renderAuth;
}

// =========================
// UPDATE ISSUE STATUS
// =========================

document.addEventListener("click", async e => {
  const button = e.target.closest("[data-s]");
  if (!button) return;

  try {
    await updateDoc(doc(db, "issues", button.dataset.id), {
      status: button.dataset.s,
      updatedAt: serverTimestamp(),
      history: arrayUnion({
        status: button.dataset.s,
        at: Date.now()
      })
    });

    console.log("Issue status updated");
  } catch (err) {
    console.error("Status update failed:", err);
  }
});

// =========================
// ADMIN DASHBOARD
// =========================

function renderAdmin() {
  if (!$("#admin")) return;

  const tally = key => {
    const data = issues.reduce((map, issue) => {
      const name = issue[key] || "Unknown";
      map[name] = (map[name] || 0) + (issue.reportCount || 0);
      return map;
    }, {});

    return Object.entries(data)
      .map(
        ([name, count]) => `
          <div class="bar">
            <span>${esc(name)}</span>
            <i style="width:${count * 30}px"></i>
            ${count}
          </div>
        `
      )
      .join("");
  };

  $("#admin").innerHTML = `
    <h3>Reports by building</h3>
    ${tally("building")}

    <h3>Reports by category</h3>
    ${tally("category")}

    <h3>All issues</h3>
    ${issues.map(issue => card(issue)).join("")}
  `;
}

// =========================
// FETCH MY REPORTS
// =========================

async function loadMine(studentInput = null) {
  const output = $("#list") || $("#mine");
  if (!output) return;

  const student = studentInput !== null
    ? studentInput.trim()
    : localStorage.getItem("student") || "";

  if (!student) {
    output.innerHTML = "Please enter your name / ID.";
    return;
  }

  localStorage.setItem("student", student);
  output.innerHTML = "Loading reports...";

  try {
    console.log("Searching reports for student:", JSON.stringify(student));

    const reportsQuery = query(
      collection(db, "reports"),
      where("student", "==", student)
    );

    const snapshot = await getDocs(reportsQuery);

    if (snapshot.empty) {
      // Case-insensitive client-side fallback
      const allReports = await getDocs(collection(db, "reports"));
      const searchName = student.toLowerCase();

      const matchingDocs = allReports.docs.filter(d => {
        const data = d.data();
        return String(data.student || "").trim().toLowerCase() === searchName;
      });

      if (matchingDocs.length === 0) {
        cachedReportsDocs = null;
        output.innerHTML = `
          <div class="card">
            No reports found for <b>${esc(student)}</b>.
          </div>
        `;
        return;
      }

      cachedReportsDocs = matchingDocs;
      renderMyReports(matchingDocs, output);
      return;
    }

    cachedReportsDocs = snapshot.docs;
    renderMyReports(snapshot.docs, output);

  } catch (err) {
    console.error("Error fetching reports:", err.code, err.message);

    output.innerHTML = `
      <div class="card" style="color:red">
        <b>Failed to fetch reports</b><br>
        ${esc(err.code || err.message)}
      </div>
    `;
  }
}

// =========================
// RENDER MY REPORTS
// =========================

function renderMyReports(reportDocs, output) {
  output.innerHTML = reportDocs
    .map(d => {
      const report = d.data();
      const issue = issues.find(x => x.id === report.issueId) || {};

      return `
        <div class="card">
          <h3>${esc(report.category || issue.category || "Campus Issue")}</h3>
          <p>${esc(report.description || "")}</p>

          <p>
            <b>Location:</b>
            ${esc(report.building || issue.building || "")}
            ·
            ${esc(report.floor || issue.floor || "")}
            ${report.room || issue.room ? ` · ${esc(report.room || issue.room)}` : ""}
          </p>

          ${report.photo ? `<img src="${report.photo}" style="max-width:300px; border-radius:10px;">` : ""}

          <p><b>Status:</b> ${esc(issue.status || "Submitted")}</p>
          <p>
            <b>Priority:</b> ${esc(issue.priority || "Pending")}
            ·
            <b>Department:</b> ${esc(issue.department || "Not assigned")}
          </p>

          ${issue.history && issue.history.length
            ? `<small>${issue.history.map(h => esc(h.status)).join(" → ")}</small>`
            : ""
          }
        </div>
      `;
    })
    .join("");
}

// =========================
// MY REPORTS FORM LOOKUP
// =========================

if ($("#lookup")) {
  $("#lookup").onsubmit = e => {
    e.preventDefault();
    const student = $("#student").value.trim();

    if (!student) {
      if ($("#list")) $("#list").innerHTML = "Please enter your name / ID.";
      return;
    }

    loadMine(student);
  };
}

// Run lookup on page load if a name is pre-filled in the input
document.addEventListener("DOMContentLoaded", () => {
  if ($("#student") && $("#student").value.trim()) {
    loadMine($("#student").value.trim());
  }
});