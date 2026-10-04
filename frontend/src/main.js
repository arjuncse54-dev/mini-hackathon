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

const STATUS = ["Acknowledged", "In Progress", "Resolved"];

let issues = [];
let cachedReportsDocs = null;

const $ = selector => document.querySelector(selector);

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));

const opts = (element, values) => {
  if (!element) return;

  element.innerHTML = values
    .map(value => `<option value="${esc(value)}">${esc(value)}</option>`)
    .join("");
};

// Initialize dropdowns
if ($("#cat")) opts($("#cat"), ["Auto-detect", ...CATS]);
if ($("#building")) {
  opts($("#building"), ["CS Block", "Main Block", "Hostel A", "Library"]);
}
if ($("#floor")) opts($("#floor"), ["Ground", "1", "2", "3"]);
if ($("#dept")) opts($("#dept"), DEPTS);

// Restore the saved student name
if ($("#student")) {
  $("#student").value = localStorage.getItem("student") || "";
}

// Navigation
document.querySelectorAll("nav button[data-t]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("nav button[data-t]").forEach(item => {
      item.classList.toggle("on", item === button);
    });

    document.querySelectorAll("section").forEach(section => {
      section.hidden = section.id !== button.dataset.t;
    });

    if (button.dataset.t === "mine") {
      loadMine();
    }
  });
});

// Convert an uploaded image to a smaller JPEG
const toJpeg = file => new Promise((resolve, reject) => {
  if (!file) {
    resolve(null);
    return;
  }

  const image = new Image();
  const objectUrl = URL.createObjectURL(file);

  image.onload = () => {
    const scale = Math.min(1, 480 / image.width);
    const canvas = document.createElement("canvas");

    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const context = canvas.getContext("2d");

    if (!context) {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Could not process the selected image."));
      return;
    }

    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(objectUrl);

    resolve(canvas.toDataURL("image/jpeg", 0.6));
  };

  image.onerror = () => {
    URL.revokeObjectURL(objectUrl);
    reject(new Error("Could not read the selected image."));
  };

  image.src = objectUrl;
});

// Submit a campus issue
if ($("#form")) {
  $("#form").addEventListener("submit", async event => {
    event.preventDefault();

    const studentElement = $("#student");
    const message = $("#msg");
    const student = studentElement?.value.trim() || "";

    if (!student) {
      if (message) message.textContent = "Please enter your name / ID.";
      return;
    }

    localStorage.setItem("student", student);

    try {
      const body = {
        student,
        category: $("#cat")?.value || "Auto-detect",
        building: $("#building")?.value || "",
        floor: $("#floor")?.value || "",
        room: $("#room")?.value.trim() || "",
        description: $("#desc")?.value.trim() || "",
        photo: await toJpeg($("#photo")?.files?.[0] || null)
      };

      if (message) message.textContent = "Submitting...";

      const response = await fetch(`${API}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          result.error ||
          result.message ||
          `Backend returned ${response.status}`
        );
      }

      if (message) {
        message.textContent = result.duplicate
          ? `Grouped with an existing issue. Priority: ${result.priority || "Pending"}`
          : `Issue submitted. Department: ${result.department || "Not assigned"}. Priority: ${result.priority || "Pending"}`;
      }

      event.target.reset();

      if (studentElement) {
        studentElement.value = student;
      }

      if ($("#cat")) {
        $("#cat").value = "Auto-detect";
      }
    } catch (error) {
      console.error("Submit error:", error);

      if (message) {
        message.textContent = `Could not submit report: ${error.message}`;
      }
    }
  });
}

// Issue card template
const card = (issue, controls = "") => `
  <div class="card p-${esc(issue.priority)}">
    <b>${esc(issue.category || "Campus Issue")}</b>
    · ${esc(issue.building || "")}
    ${esc(issue.floor || "")}
    ${esc(issue.room || "")}

    <span class="tag">${esc(issue.priority || "Pending")}</span>
    <span class="tag">${esc(issue.status || "Submitted")}</span>

    <br>
    ${esc(issue.reportCount || 0)} report(s)
    · ${esc(issue.department || "Not assigned")}

    ${issue.reason ? `<br><small>${esc(issue.reason)}</small>` : ""}

    <div>${controls}</div>
  </div>
`;

// Authority dashboard
function renderAuth() {
  const authList = $("#authList");
  const departmentSelect = $("#dept");

  if (!authList || !departmentSelect) return;

  const department = departmentSelect.value;

  const filtered = issues.filter(issue =>
    department === "Admin" || issue.department === department
  );

  authList.innerHTML = filtered.map(issue => {
    const controls = STATUS.map(status => `
      <button
        type="button"
        data-id="${esc(issue.id)}"
        data-s="${esc(status)}"
      >
        ${esc(status)}
      </button>
    `).join("");

    return card(issue, controls);
  }).join("") || "No issues";

  departmentSelect.onchange = renderAuth;
}

// Admin dashboard
function renderAdmin() {
  const admin = $("#admin");

  if (!admin) return;

  const tally = key => {
    const counts = issues.reduce((result, issue) => {
      const name = issue[key] || "Unknown";

      result[name] =
        (result[name] || 0) + (Number(issue.reportCount) || 0);

      return result;
    }, {});

    return Object.entries(counts).map(([name, count]) => `
      <div class="bar">
        <span>${esc(name)}</span>
        <i style="width:${Math.min(count * 30, 600)}px"></i>
        ${count}
      </div>
    `).join("") || "<p>No data yet.</p>";
  };

  admin.innerHTML = `
    <h3>Reports by building</h3>
    ${tally("building")}

    <h3>Reports by category</h3>
    ${tally("category")}

    <h3>All issues</h3>
    ${issues.map(issue => card(issue)).join("") || "<p>No issues yet.</p>"}
  `;
}

// Listen for Firestore issue updates
onSnapshot(
  collection(db, "issues"),

  snapshot => {
    console.log("Firestore issues received:", snapshot.size);

    issues = snapshot.docs
      .map(document => ({
        id: document.id,
        ...document.data()
      }))
      .sort((a, b) =>
        (Number(b.score) || 0) - (Number(a.score) || 0)
      );

    renderAuth();
    renderAdmin();

    const output = $("#list") || $("#mine");

    if (output && cachedReportsDocs) {
      renderMyReports(cachedReportsDocs, output);
    }
  },

  error => {
    console.error("Firestore issues listener error:", error);

    document.body.insertAdjacentHTML(
      "afterbegin",
      `<p style="color:red;padding:10px;background:#ffe5e5">
        Firestore issues error: ${esc(error.code || error.message)}
      </p>`
    );
  }
);

// Update issue status
document.addEventListener("click", async event => {
  const button = event.target.closest("button[data-s][data-id]");

  if (!button) return;

  button.disabled = true;

  try {
    await updateDoc(doc(db, "issues", button.dataset.id), {
      status: button.dataset.s,
      updatedAt: serverTimestamp(),
      history: arrayUnion({
        status: button.dataset.s,
        at: Date.now()
      })
    });

    console.log("Issue status updated:", button.dataset.id);
  } catch (error) {
    console.error("Status update failed:", error);
    alert(`Could not update status: ${error.message}`);
  } finally {
    button.disabled = false;
  }
});

// Fetch reports belonging to a student
async function loadMine(studentInput = null) {
  const output = $("#list") || $("#mine");

  if (!output) {
    console.warn("My Reports output element was not found.");
    return;
  }

  const student = (
    studentInput !== null
      ? studentInput
      : localStorage.getItem("student") || ""
  ).trim();

  if (!student) {
    cachedReportsDocs = null;
    output.textContent = "Please enter your name / ID.";
    return;
  }

  localStorage.setItem("student", student);
  output.textContent = "Loading reports...";

  try {
    console.log(
      "Searching Firestore reports for student:",
      JSON.stringify(student)
    );

    // First, try an exact match.
    const reportsQuery = query(
      collection(db, "reports"),
      where("student", "==", student)
    );

    const snapshot = await getDocs(reportsQuery);

    let matchingDocs = snapshot.docs;

    // If exact matching finds nothing, try case-insensitive matching.
    if (matchingDocs.length === 0) {
      const allReports = await getDocs(collection(db, "reports"));

      const normalizedStudent = student
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      matchingDocs = allReports.docs.filter(document => {
        const data = document.data();

        const storedStudent = String(data.student || "")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

        return storedStudent === normalizedStudent;
      });
    }

    console.log("Reports found:", matchingDocs.length);

    console.log(
      "Matching report data:",
      matchingDocs.map(document => ({
        id: document.id,
        ...document.data()
      }))
    );

    if (matchingDocs.length === 0) {
      cachedReportsDocs = null;

      output.innerHTML = `
        <div class="card">
          No reports found for <b>${esc(student)}</b>.
          <br>
          <small>
            Check Firestore → reports and verify the student field.
          </small>
        </div>
      `;

      return;
    }

    cachedReportsDocs = matchingDocs;
    renderMyReports(matchingDocs, output);
  } catch (error) {
    console.error(
      "Error fetching reports:",
      error.code,
      error.message,
      error
    );

    output.innerHTML = `
      <div class="card" style="color:red">
        <b>Failed to fetch reports</b><br>
        ${esc(error.code || error.message || "Unknown Firebase error")}
        <br>
        <small>Check the browser console and Firestore security rules.</small>
      </div>
    `;
  }
}

// Display the student's reports
function renderMyReports(reportDocs, output) {
  output.innerHTML = reportDocs.map(document => {
    const report = document.data();

    const issue = issues.find(
      item => item.id === report.issueId
    ) || {};

    const history = Array.isArray(issue.history)
      ? issue.history
      : [];

    return `
      <div class="card">
        <h3>${esc(report.category || issue.category || "Campus Issue")}</h3>

        <p>${esc(report.description || "")}</p>

        <p>
          <b>Location:</b>
          ${esc(report.building || issue.building || "Not specified")}
          · ${esc(report.floor || issue.floor || "")}
          ${
            report.room || issue.room
              ? ` · ${esc(report.room || issue.room)}`
              : ""
          }
        </p>

        ${
          report.photo
            ? `<img
                src="${esc(report.photo)}"
                alt="Issue photo"
                style="max-width:300px;border-radius:10px"
              >`
            : ""
        }

        <p>
          <b>Status:</b>
          ${esc(issue.status || report.status || "Submitted")}
        </p>

        <p>
          <b>Priority:</b>
          ${esc(issue.priority || report.priority || "Pending")}
          ·
          <b>Department:</b>
          ${esc(issue.department || report.department || "Not assigned")}
        </p>

        ${
          history.length
            ? `<small>${history.map(item => esc(item.status)).join(" → ")}</small>`
            : ""
        }
      </div>
    `;
  }).join("");
}

// My Reports form
if ($("#lookup")) {
  $("#lookup").addEventListener("submit", event => {
    event.preventDefault();

    const student = $("#student")?.value.trim() || "";

    if (!student) {
      if ($("#list")) {
        $("#list").textContent = "Please enter your name / ID.";
      }

      return;
    }

    loadMine(student);
  });
}

// Automatically load reports if a student name is already saved
document.addEventListener("DOMContentLoaded", () => {
  const studentInput = $("#student");

  if (
    studentInput &&
    studentInput.value.trim() &&
    ($("#lookup") || $("#list") || $("#mine"))
  ) {
    loadMine(studentInput.value.trim());
  }
});