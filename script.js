const STORAGE_KEY = "pm_neon_v1";
let state = {
  tasks:
    [] /* each: {id,title,category,priority,subtasks:[{id,text,done}],done,created,dueDate,calendarDate} */,
  goals: [] /* {id,text,target,current} */,
  notes: "",
  pomodoro: {
    mode: "work",
    cycle: 0,
    timeLeft: 25 * 60,
    running: false,
    workMinutes: 25,
    shortBreak: 5,
    longBreak: 15,
  },
  ui: {
    selectedDate: new Date().toISOString().slice(0, 10),
    theme: "dark",
  },
  stats: { dailyCompleted: 0, streak: 0, lastCompletedDate: null },
};

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function loadState() {
  const s = localStorage.getItem(STORAGE_KEY);
  if (s)
    try {
      state = JSON.parse(s);
    } catch (e) {
      console.error("Load error", e);
    }
}
loadState();

/* ===================== Utilities ===================== */
function uid(prefix = "id") {
  return prefix + "_" + Math.random().toString(36).slice(2, 9);
}
function el(tag, opts = {}) {
  const e = document.createElement(tag);
  for (let k in opts) e[k] = opts[k];
  return e;
}
function fmtTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ===================== Calendar ===================== */
const calendarGrid = document.getElementById("calendarGrid");
const monthLabel = document.getElementById("monthLabel");
const todayLabel = document.getElementById("todayLabel");
const selectedDateEl = document.getElementById("selectedDate");
let calDate = new Date(state.ui.selectedDate);

function renderCalendar(date = new Date()) {
  const year = date.getFullYear(),
    month = date.getMonth();
  monthLabel.textContent = date.toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });
  todayLabel.textContent = new Date().toLocaleDateString();
  calendarGrid.innerHTML = "";
  const first = new Date(year, month, 1);
  const startDay = first.getDay(); // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  // fill blanks
  for (let i = 0; i < startDay; i++) {
    const blank = el("div");
    blank.className = "day";
    calendarGrid.appendChild(blank);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(year, month, d);
    const box = el("div");
    box.className = "day";
    box.textContent = d;
    const iso = dt.toISOString().slice(0, 10);
    if (iso === new Date().toISOString().slice(0, 10))
      box.classList.add("today");
    if (iso === state.ui.selectedDate) box.classList.add("selected");
    box.addEventListener("click", () => {
      state.ui.selectedDate = iso;
      selectedDateEl.textContent = dt.toDateString();
      saveState();
      renderCalendar(date);
      renderTasks();
    });
    calendarGrid.appendChild(box);
  }
}
renderCalendar(calDate);
selectedDateEl.textContent = new Date(state.ui.selectedDate).toDateString();

document.getElementById("prevMonth").addEventListener("click", () => {
  calDate.setMonth(calDate.getMonth() - 1);
  renderCalendar(calDate);
});
document.getElementById("nextMonth").addEventListener("click", () => {
  calDate.setMonth(calDate.getMonth() + 1);
  renderCalendar(calDate);
});

/* ===================== TASKS UI ===================== */
const tasksList = document.getElementById("tasksList");
const searchInput = document.getElementById("search");
const filterCategory = document.getElementById("filterCategory");
const filterPriority = document.getElementById("filterPriority");

function renderTasks() {
  tasksList.innerHTML = "";
  const q = searchInput.value.toLowerCase();
  const cat = filterCategory.value;
  const pr = filterPriority.value;
  // get tasks for selectedDate
  const sdate = state.ui.selectedDate;
  const tasks = state.tasks
    .filter((t) => {
      if (t.calendarDate && t.calendarDate !== sdate) return false;
      if (cat !== "all" && t.category !== cat) return false;
      if (pr !== "all" && t.priority !== pr) return false;
      if (
        q &&
        !(
          (t.title || "").toLowerCase().includes(q) ||
          (t.subtasks || []).some((st) => st.text.toLowerCase().includes(q))
        )
      )
        return false;
      return true;
    })
    .sort((a, b) => b.priority.localeCompare(a.priority)); // simple sort

  tasks.forEach((t) => {
    const card = el("div");
    card.className = "task-card";
    card.draggable = true;
    card.dataset.id = t.id;

    const left = el("div");
    left.className = "task-left";
    const title = el("div");
    title.className = "task-title";
    title.textContent = t.title;
    const meta = el("div");
    meta.className = "task-meta";
    meta.innerHTML = `${t.category} • created ${new Date(
      t.created
    ).toLocaleDateString()}`;
    left.appendChild(title);
    left.appendChild(meta);

    const subt = el("div");
    subt.className = "subtasks";
    (t.subtasks || []).forEach((st) => {
      const sdiv = el("div");
      sdiv.className = "subtask";
      const chk = el("input");
      chk.type = "checkbox";
      chk.checked = !!st.done;
      chk.addEventListener("change", () => {
        st.done = chk.checked;
        saveAndRender();
      });
      sdiv.appendChild(chk);
      const txt = el("div");
      txt.textContent = st.text;
      sdiv.appendChild(txt);
      subt.appendChild(sdiv);
    });
    left.appendChild(subt);

    const right = el("div");
    right.className = "task-right";
    const chip = el("div");
    chip.className = "chip";
    chip.textContent = t.category;
    const prio = el("div");
    prio.className =
      "priority " +
      (t.priority === "high"
        ? "prio-high"
        : t.priority === "medium"
        ? "prio-medium"
        : "prio-low");
    prio.textContent = t.priority.toUpperCase();
    const actions = el("div");
    actions.style.display = "flex";
    actions.style.gap = "8px";
    const btnDone = el("button");
    btnDone.className = "icon-btn-ghost";
    btnDone.textContent = t.done ? "Undo" : "Done";
    btnDone.addEventListener("click", () => {
      t.done = !t.done;
      if (t.done) markComplete();
      saveAndRender();
    });
    const btnEdit = el("button");
    btnEdit.className = "icon-btn-ghost";
    btnEdit.textContent = "Edit";
    btnEdit.addEventListener("click", () => openEdit(t.id));
    const btnDelete = el("button");
    btnDelete.className = "icon-btn-ghost";
    btnDelete.textContent = "Del";
    btnDelete.addEventListener("click", () => {
      if (confirm("Delete task?")) {
        state.tasks = state.tasks.filter((x) => x.id !== t.id);
        saveAndRender();
      }
    });
    actions.appendChild(btnDone);
    actions.appendChild(btnEdit);
    actions.appendChild(btnDelete);

    right.appendChild(chip);
    right.appendChild(prio);
    right.appendChild(actions);

    card.appendChild(left);
    card.appendChild(right);
    tasksList.appendChild(card);

    // drag/drop handlers
    card.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", t.id);
      card.style.opacity = "0.5";
    });
    card.addEventListener("dragend", () => {
      card.style.opacity = "1";
    });
  });

  // allow dropping to set calendar date - drop zone is calendar selected date in sidebar (already selected)
  // allow reordering - simple: when dropped on another task, swap created timestamps
  tasksList.addEventListener("dragover", (e) => e.preventDefault());
  tasksList.addEventListener("drop", (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    const targetCard = e.target.closest(".task-card");
    if (!id || !targetCard) return;
    const tid = targetCard.dataset.id;
    const a = state.tasks.find((x) => x.id === id);
    const b = state.tasks.find((x) => x.id === tid);
    if (a && b) {
      const tmp = a.created;
      a.created = b.created;
      b.created = tmp;
      saveAndRender();
    }
  });
}

/* quick edit modal (simple prompt-based to keep single file) */
function openEdit(id) {
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return;
  const newTitle = prompt("Edit title", t.title);
  if (newTitle === null) return;
  t.title = newTitle;
  // edit subtasks: quick comma-separated
  const subs = prompt(
    "Subtasks (comma separated)",
    (t.subtasks || []).map((s) => s.text).join(", ")
  );
  t.subtasks = subs
    ? subs
        .split(",")
        .map((s) => ({ id: uid("st"), text: s.trim(), done: false }))
    : [];
  saveAndRender();
}

/* ===================== Add Task ===================== */
document.getElementById("addBtn").addEventListener("click", () => {
  const title = document.getElementById("newTitle").value.trim();
  if (!title) return alert("Enter a task title");
  const cat = document.getElementById("newCategory").value;
  const pr = document.getElementById("newPriority").value;
  const t = {
    id: uid("t"),
    title,
    category: cat,
    priority: pr,
    subtasks: [],
    done: false,
    created: Date.now(),
    calendarDate: state.ui.selectedDate,
  };
  state.tasks.push(t);
  document.getElementById("newTitle").value = "";
  saveAndRender();
});

/* ===================== Filters/Search events ===================== */
searchInput.addEventListener("input", renderTasks);
filterCategory.addEventListener("change", renderTasks);
filterPriority.addEventListener("change", renderTasks);

/* ===================== Goals ===================== */
function renderGoals() {
  const gList = document.getElementById("goalsList");
  gList.innerHTML = "";
  state.goals.forEach((g) => {
    const gEl = el("div");
    gEl.className = "goal";
    const left = el("div");
    left.textContent = g.text;
    const right = el("div");
    right.style.display = "flex";
    right.style.gap = "8px";
    const percent = Math.min(100, Math.round((g.current / g.target) * 100));
    const pb = el("div");
    pb.style.width = "120px";
    pb.className = "progress-bar";
    const bar = el("i");
    bar.style.width = percent + "%";
    pb.appendChild(bar);
    const btnInc = el("button");
    btnInc.className = "icon-btn";
    btnInc.textContent = "+";
    btnInc.addEventListener("click", () => {
      g.current = Math.min(g.target, g.current + 1);
      saveAndRender();
    });
    const btnRem = el("button");
    btnRem.className = "icon-btn";
    btnRem.textContent = "-";
    btnRem.addEventListener("click", () => {
      if (confirm("Remove goal?")) {
        state.goals = state.goals.filter((x) => x.id !== g.id);
        saveAndRender();
      }
    });
    right.appendChild(pb);
    right.appendChild(btnInc);
    right.appendChild(btnRem);
    gEl.appendChild(left);
    gEl.appendChild(right);
    gList.appendChild(gEl);
  });
}

document.getElementById("addGoalBtn").addEventListener("click", () => {
  const text = prompt("Goal text (e.g. Solve 30 problems)");
  if (!text) return;
  const target = parseInt(prompt("Target count (number)", "5")) || 1;
  state.goals.push({ id: uid("g"), text, target, current: 0 });
  saveAndRender();
});

/* ===================== Pomodoro ===================== */
const pomTimeEl = document.getElementById("pomTime");
const progressCircle = document.getElementById("progressCircle");
const pomCycleEl = document.getElementById("pomCycle");
const pomModeEl = document.getElementById("pomMode");

let pomInterval = null;

function renderPom() {
  const p = state.pomodoro;
  pomTimeEl.textContent = fmtTime(p.timeLeft);
  pomCycleEl.textContent = p.cycle;
  pomModeEl.textContent = p.mode.charAt(0).toUpperCase() + p.mode.slice(1);
  // update circle dashoffset
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  let total =
    p.mode === "work"
      ? p.workMinutes * 60
      : p.mode === "short"
      ? p.shortBreak * 60
      : p.longBreak * 60;
  const offset = circumference * (1 - p.timeLeft / total);
  progressCircle.style.strokeDasharray = circumference;
  progressCircle.style.strokeDashoffset = circumference - offset;
}

function pomTick() {
  if (!state.pomodoro.running) return;
  if (state.pomodoro.timeLeft > 0) {
    state.pomodoro.timeLeft--;
    renderPom();
    saveState();
  } else {
    // transition
    if (state.pomodoro.mode === "work") {
      state.pomodoro.cycle++;
      // increment daily completed
      state.stats.dailyCompleted++;
      state.stats.lastCompletedDate = new Date().toISOString().slice(0, 10);
      // after 4 cycles -> long break
      if (state.pomodoro.cycle >= 4) {
        state.pomodoro.mode = "long";
        state.pomodoro.timeLeft = state.pomodoro.longBreak * 60;
        state.pomodoro.cycle = 0; // reset cycle count after long break
      } else {
        state.pomodoro.mode = "short";
        state.pomodoro.timeLeft = state.pomodoro.shortBreak * 60;
      }
    } else {
      state.pomodoro.mode = "work";
      state.pomodoro.timeLeft = state.pomodoro.workMinutes * 60;
    }
    // simple notification (visual)
    flashMode();
    renderPom();
    saveState();
  }
}

function startPom() {
  state.pomodoro.running = true;
  if (!pomInterval) pomInterval = setInterval(pomTick, 1000);
  saveState();
  renderPom();
}
function pausePom() {
  state.pomodoro.running = false;
  clearInterval(pomInterval);
  pomInterval = null;
  saveState();
  renderPom();
}
function resetPom() {
  pausePom();
  state.pomodoro.mode = "work";
  state.pomodoro.timeLeft = state.pomodoro.workMinutes * 60;
  state.pomodoro.cycle = 0;
  saveState();
  renderPom();
}

document.getElementById("pomStart").addEventListener("click", () => startPom());
document.getElementById("pomPause").addEventListener("click", () => pausePom());
document.getElementById("pomReset").addEventListener("click", () => resetPom());

function flashMode() {
  const el = document.getElementById("pomMode");
  el.animate([{ transform: "scale(1.1)" }, { transform: "scale(1)" }], {
    duration: 360,
  });
}

/* ===================== Notes with Markdown preview ===================== */
const notesText = document.getElementById("notesText");
const notesPreview = document.getElementById("notesPreview");
const mdToggle = document.getElementById("mdToggle");

notesText.value = state.notes || "";

function simpleMarkdownToHTML(md) {
  // very basic: escapes then convert headings, bold, italic, links, lists
  if (!md) return "";
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/^### (.*$)/gim, "<h3>$1</h3>")
    .replace(/^## (.*$)/gim, "<h2>$1</h2>")
    .replace(/^# (.*$)/gim, "<h1>$1</h1>")
    .replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/gim, "<em>$1</em>")
    .replace(
      /\[(.*?)\]\((.*?)\)/gim,
      '<a href="$2" target="_blank" rel="noopener">$1</a>'
    )
    .replace(/^\s*\n\*/gm, "<ul>\n*")
    .replace(/^\* (.*)/gm, "<li>$1</li>")
    .replace(/<\/li>\n<li>/g, "</li>\n<li>")
    .replace(/(<li>.*<\/li>)/gms, "<ul>$1</ul>")
    .replace(/\n$/g, "<br/>");
  return html;
}

mdToggle.addEventListener("click", () => {
  if (notesPreview.style.display === "none") {
    notesPreview.innerHTML = simpleMarkdownToHTML(notesText.value);
    notesPreview.style.display = "block";
    notesText.style.display = "none";
    mdToggle.textContent = "Edit";
  } else {
    notesPreview.style.display = "none";
    notesText.style.display = "block";
    mdToggle.textContent = "Preview";
  }
});
document.getElementById("saveNotesBtn").addEventListener("click", () => {
  state.notes = notesText.value;
  saveAndRender();
  alert("Notes saved");
});

notesText.addEventListener("input", () => {
  state.notes = notesText.value;
  saveState();
});

/* ===================== Quick actions ===================== */
document.getElementById("clearCompleted").addEventListener("click", () => {
  if (confirm("Clear all completed tasks?")) {
    state.tasks = state.tasks.filter((t) => !t.done);
    saveAndRender();
  }
});

document.getElementById("exportBtn").addEventListener("click", () => {
  const data = JSON.stringify(state, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pm-export.json";
  a.click();
  URL.revokeObjectURL(url);
});

document
  .getElementById("importBtn")
  .addEventListener("click", () =>
    document.getElementById("importFile").click()
  );
document.getElementById("importFile").addEventListener("change", (ev) => {
  const f = ev.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);
      if (confirm("Replace current data with imported?")) {
        state = imported;
        saveState();
        loadState();
        saveAndRender();
      }
    } catch (e) {
      alert("Invalid JSON");
    }
  };
  reader.readAsText(f);
});

/* ===================== Theme Toggle (light mode minimal) ===================== */
document.getElementById("toggleTheme").addEventListener("click", () => {
  if (state.ui.theme === "dark") {
    state.ui.theme = "light";
    applyTheme();
  } else {
    state.ui.theme = "dark";
    applyTheme();
  }
  saveState();
});
function applyTheme() {
  if (state.ui.theme === "light") {
    document.documentElement.style.setProperty("--bg", "#f6f7fb");
    document.documentElement.style.setProperty("--panel", "#ffffff");
    document.documentElement.style.setProperty("--muted", "#66657a");
    document.documentElement.style.setProperty("--neon2", "#1760ff");
    document.documentElement.style.setProperty("--neon1", "#7b36ff");
    document.body.style.color = "#111";
  } else {
    document.documentElement.style.setProperty("--bg", "#0b0710");
    document.documentElement.style.setProperty("--panel", "#0f0b16");
    document.documentElement.style.setProperty("--muted", "#a8a0b3");
    document.documentElement.style.setProperty("--neon1", "#8a3cff");
    document.documentElement.style.setProperty("--neon2", "#3ce0ff");
    document.body.style.color = "#e7e5ee";
  }
}
applyTheme();

/* ===================== Stats: daily completed and streak ===================== */
function updateStats() {
  const today = new Date().toISOString().slice(0, 10);
  document.getElementById("dailyCompleted").textContent =
    state.stats.dailyCompleted || 0;
  // streak logic: if lastCompletedDate is yesterday or today, increment else reset
  const last = state.stats.lastCompletedDate;
  let streak = state.stats.streak || 0;
  if (last) {
    const lastDate = new Date(last);
    const todayDate = new Date(today);
    const diff = (new Date(today) - new Date(last)) / (1000 * 60 * 60 * 24);
    // don't auto-change streak here; user-driven after marking tasks
    // just display
  }
  document.getElementById("streak").textContent =
    (state.stats.streak || 0) + " days";
}

/* When user marks a task complete, update dailyCompleted */
function markComplete() {
  const today = new Date().toISOString().slice(0, 10);
  if (state.stats.lastCompletedDate !== today) {
    state.stats.dailyCompleted = (state.stats.dailyCompleted || 0) + 1;
    // streak update: if lastCompletedDate is yesterday increment streak else set to 1
    const last = state.stats.lastCompletedDate;
    if (last) {
      const lastD = new Date(last);
      const tD = new Date(today);
      const dt = (tD - lastD) / (1000 * 60 * 60 * 24);
      if (Math.round(dt) === 1)
        state.stats.streak = (state.stats.streak || 0) + 1;
      else if (Math.round(dt) === 0) {
      } else state.stats.streak = 1;
    } else {
      state.stats.streak = 1;
    }
    state.stats.lastCompletedDate = today;
    saveState();
    updateStats();
  } else {
    state.stats.dailyCompleted = (state.stats.dailyCompleted || 0) + 0; // already counted
  }
}

/* ===================== Save & Render helper ===================== */
function saveAndRender() {
  saveState();
  renderAll();
}

/* ===================== Initial renderAll ===================== */
function renderAll() {
  renderCalendar(calDate);
  renderTasks();
  renderGoals();
  renderPom();
  updateStats();
  // notes
  notesText.value = state.notes || "";
  document.getElementById("dateNow").textContent =
    new Date().toLocaleDateString();
}
renderAll();

/* initial event: markComplete used elsewhere via toggles */
function saveAndRender() {
  saveState();
  renderAll();
}

/* ===================== Initialize sample content if empty ===================== */
if (state.tasks.length === 0 && state.goals.length === 0 && !state.notes) {
  state.tasks.push({
    id: uid("t"),
    title: "Finish portfolio README",
    category: "Work",
    priority: "high",
    subtasks: [
      { id: uid("s"), text: "Write intro", done: false },
      { id: uid("s2"), text: "Add screenshots", done: false },
    ],
    done: false,
    created: Date.now() - 86400000,
    calendarDate: new Date().toISOString().slice(0, 10),
  });
  state.tasks.push({
    id: uid("t"),
    title: "Study algorithms",
    category: "Study",
    priority: "medium",
    subtasks: [],
    done: false,
    created: Date.now() - 3600000,
    calendarDate: new Date().toISOString().slice(0, 10),
  });
  state.goals.push({
    id: uid("g"),
    text: "Workout",
    target: 1,
    current: 0,
  });
  state.notes = "# Daily plan\n- Focus session: Algorithms\n- Read 1 chapter";
  saveState();
  renderAll();
}

/* Accessibility: keyboard shortcuts */
document.addEventListener("keydown", (e) => {
  if (e.key === "p" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    startPom();
  }
  if (e.key === "n" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.getElementById("newTitle").focus();
  }
});
