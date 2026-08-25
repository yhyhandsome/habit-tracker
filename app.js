"use strict";

/* ============================================================
   颜浩宇 · 习惯打卡 — 应用逻辑
   ============================================================ */

var CONFIG = window.APP_CONFIG || {};
var HABITS = CONFIG.HABITS || [];
var SUPABASE_URL = String(CONFIG.SUPABASE_URL || "").replace(/\/+$/, "");
var SUPABASE_ANON_KEY = String(CONFIG.SUPABASE_ANON_KEY || "");
var IS_CLOUD = !!(SUPABASE_URL && SUPABASE_ANON_KEY);

/* ---------- 工具函数 ---------- */

function pad2(n) { return n < 10 ? "0" + n : "" + n; }

function toDateKey(d) {
  return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
}

function parseDateKey(key) {
  var parts = key.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function toKey(y, m, day) {
  return y + "-" + pad2(m + 1) + "-" + pad2(day);
}

function emptyRec() {
  var rec = {};
  HABITS.forEach(function (h) { rec[h.id] = false; });
  return rec;
}

function countDone(rec) {
  if (!rec) return 0;
  var n = 0;
  HABITS.forEach(function (h) { if (rec[h.id]) n++; });
  return n;
}

function pickHabits(rec) {
  var out = {};
  HABITS.forEach(function (h) { out[h.id] = !!rec[h.id]; });
  return out;
}

var WEEKDAY_NAMES = ["一", "二", "三", "四", "五", "六", "日"];

/* ---------- 状态 ---------- */

var state = {
  unlocked: sessionStorage.getItem("yh_unlocked") === "1",
  pin: CONFIG.DEFAULT_PIN || "8888",
  cloud: IS_CLOUD ? null : false,
  records: new Map(),
  month: { y: 0, m: 0 },
  selectedKey: null,
  pendingHabitId: null,
  todayKey: ""
};
/* ---------- 本地缓存 ---------- */

var LS = {
  recKey: "yh_records_v1",
  pinKey: "yh_pin_v1",
  loadRecords: function () {
    try {
      var raw = localStorage.getItem(this.recKey);
      var obj = raw ? JSON.parse(raw) : {};
      var map = new Map();
      Object.keys(obj).forEach(function (k) { map.set(k, obj[k]); });
      return map;
    } catch (e) { return new Map(); }
  },
  saveRecords: function (map) {
    var obj = {};
    map.forEach(function (v, k) { obj[k] = v; });
    try { localStorage.setItem(this.recKey, JSON.stringify(obj)); } catch (e) {}
  },
  loadPin: function () {
    try { return localStorage.getItem(this.pinKey); } catch (e) { return null; }
  },
  savePin: function (pin) {
    try { localStorage.setItem(this.pinKey, pin); } catch (e) {}
  }
};

/* ---------- 云端（Supabase REST） ---------- */

var DB = {
  authHeaders: function () {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json"
    };
  },
  fetchRecords: function () {
    var url = SUPABASE_URL + "/rest/v1/records?select=date,accounting,english,violin&order=date.asc";
    return fetch(url, { headers: this.authHeaders() }).then(function (res) {
      if (!res.ok) throw new Error("records " + res.status);
      return res.json();
    });
  },
  upsertRecord: function (dateKey, data) {
    var url = SUPABASE_URL + "/rest/v1/records?on_conflict=date";
    return fetch(url, {
      method: "POST",
      headers: Object.assign(this.authHeaders(), { Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify(Object.assign({ date: dateKey }, data))
    }).then(function (res) {
      if (!res.ok) throw new Error("upsert " + res.status);
      return res.json();
    });
  },
  fetchSettings: function () {
    var url = SUPABASE_URL + "/rest/v1/settings?select=pin&id=eq.1&limit=1";
    return fetch(url, { headers: this.authHeaders() }).then(function (res) {
      if (!res.ok) throw new Error("settings " + res.status);
      return res.json();
    }).then(function (rows) {
      return rows && rows.length ? rows[0] : null;
    });
  },
  upsertSettings: function (pin) {
    var url = SUPABASE_URL + "/rest/v1/settings?on_conflict=id";
    return fetch(url, {
      method: "POST",
      headers: Object.assign(this.authHeaders(), { Prefer: "resolution=merge-duplicates,return=representation" }),
      body: JSON.stringify({ id: 1, pin: pin })
    }).then(function (res) {
      if (!res.ok) throw new Error("settings upsert " + res.status);
      return res.json();
    });
  }
};
/* ---------- SVG 图标 ---------- */

var LOCK_SVG = "<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='4' y='11' width='16' height='10' rx='2'/><path d='M8 11V7a4 4 0 0 1 8 0v4'/></svg>";
var OPEN_LOCK_SVG = "<svg width='15' height='15' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><rect x='4' y='11' width='16' height='10' rx='2'/><path d='M8 11V7a4 4 0 0 1 7.9-1.7'/></svg>";
var CHECK_SVG = "<svg width='18' height='18' viewBox='0 0 24 24' fill='none' stroke='#fff' stroke-width='3.2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 12.5l4.5 4.5L19 7.5'/></svg>";

/* ---------- DOM ---------- */

function $(sel) { return document.querySelector(sel); }

var els = {
  greeting: $("#greeting"),
  subdate: $("#subdate"),
  lockBtn: $("#lockBtn"),
  lockIcon: $("#lockIcon"),
  lockLabel: $("#lockLabel"),
  todayProgress: $("#todayProgress"),
  habitList: $("#habitList"),
  streakNum: $("#streakNum"),
  habitStats: $("#habitStats"),
  statsTitle: $("#statsTitle"),
  calTitle: $("#calTitle"),
  calGrid: $("#calGrid"),
  calWeekdays: $("#calWeekdays"),
  prevMonth: $("#prevMonth"),
  nextMonth: $("#nextMonth"),
  dayDetail: $("#dayDetail"),
  cloudBanner: $("#cloudBanner"),
  cloudBannerText: $("#cloudBannerText"),
  cloudStatus: $("#cloudStatus"),
  settingsBtn: $("#settingsBtn"),
  settingsOverlay: $("#settingsOverlay"),
  settingsClose: $("#settingsClose"),
  changePinBtn: $("#changePinBtn"),
  changePinForm: $("#changePinForm"),
  curPinInput: $("#curPinInput"),
  newPinInput: $("#newPinInput"),
  savePinBtn: $("#savePinBtn"),
  pinSaveErr: $("#pinSaveErr"),
  savedHint: $("#savedHint"),
  pinOverlay: $("#pinOverlay"),
  pinInput: $("#pinInput"),
  pinErr: $("#pinErr"),
  pinOk: $("#pinOk"),
  pinCancel: $("#pinCancel")
};
/* ---------- 渲染 ---------- */

function greetingText() {
  var h = new Date().getHours();
  if (h < 6) return "夜深了，颜浩宇";
  if (h < 12) return "早上好，颜浩宇";
  if (h < 18) return "下午好，颜浩宇";
  return "晚上好，颜浩宇";
}

function renderHeader() {
  var d = new Date();
  var week = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
  els.greeting.textContent = greetingText();
  els.subdate.textContent = (d.getMonth() + 1) + "月" + d.getDate() + "日 · 星期" + week;
  els.lockLabel.textContent = state.unlocked ? "编辑中" : "锁定";
  els.lockBtn.classList.toggle("active", state.unlocked);
  els.lockIcon.innerHTML = state.unlocked ? OPEN_LOCK_SVG : LOCK_SVG;
}

var habitRowEls = {};

function buildHabitRows() {
  els.habitList.innerHTML = "";
  HABITS.forEach(function (h) {
    var li = document.createElement("li");
    li.className = "habit-row";
    li.setAttribute("data-id", h.id);
    li.innerHTML = "<span class='check'>" + CHECK_SVG + "</span>" +
      "<span class='h-text'><span class='h-name'></span><span class='h-note'></span></span>" +
      "<span class='h-emoji'></span>";
    li.querySelector(".h-name").textContent = h.name;
    li.querySelector(".h-note").textContent = h.note;
    li.querySelector(".h-emoji").textContent = h.emoji;
    li.addEventListener("click", function () { onHabitTap(h.id); });
    els.habitList.appendChild(li);
    habitRowEls[h.id] = li;
  });
}

function updateHabitRows() {
  var rec = state.records.get(state.todayKey) || emptyRec();
  var done = countDone(rec);
  els.todayProgress.textContent = done + " / " + HABITS.length;
  els.todayProgress.classList.toggle("all", done === HABITS.length);
  HABITS.forEach(function (h) {
    habitRowEls[h.id].classList.toggle("done", !!rec[h.id]);
  });
}
function renderStats() {
  var y = state.month.y, mo = state.month.m;
  var daysInMonth = new Date(y, mo + 1, 0).getDate();
  var dNow = new Date();
  var isCur = y === dNow.getFullYear() && mo === dNow.getMonth();
  var denom = isCur ? dNow.getDate() : daysInMonth;
  els.statsTitle.textContent = "统计 · " + (mo + 1) + "月";

  var streak = calcStreak();
  els.streakNum.textContent = String(streak);
  els.streakNum.classList.toggle("done", streak > 0);

  els.habitStats.innerHTML = "";
  HABITS.forEach(function (h) {
    var n = 0;
    for (var day = 1; day <= daysInMonth; day++) {
      var rec = state.records.get(toKey(y, mo, day));
      if (rec && rec[h.id]) n++;
    }
    var pct = denom > 0 ? Math.round((n / denom) * 100) : 0;

    var row = document.createElement("div");
    row.className = "hstat";
    var top = document.createElement("div");
    top.className = "hstat-top";
    var name = document.createElement("span");
    name.className = "hstat-name";
    name.textContent = h.emoji + "  " + h.name;
    var count = document.createElement("span");
    count.className = "hstat-count";
    count.textContent = n + " / " + denom + " 天";
    top.appendChild(name);
    top.appendChild(count);
    var bar = document.createElement("div");
    bar.className = "hstat-bar";
    var fill = document.createElement("div");
    fill.className = "hstat-fill";
    fill.style.width = pct + "%";
    bar.appendChild(fill);
    row.appendChild(top);
    row.appendChild(bar);
    els.habitStats.appendChild(row);
  });
}

function calcStreak() {
  var streak = 0;
  var d = new Date();
  var recToday = state.records.get(toDateKey(d));
  if (!recToday || countDone(recToday) === 0) {
    d.setDate(d.getDate() - 1);
  }
  while (true) {
    var rec = state.records.get(toDateKey(d));
    if (rec && countDone(rec) > 0) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
function renderCalendar() {
  var y = state.month.y, m = state.month.m;
  var first = new Date(y, m, 1);
  var lead = (first.getDay() + 6) % 7;
  var daysInMonth = new Date(y, m + 1, 0).getDate();
  var dNow = new Date();
  var curKey = toDateKey(dNow);

  els.calTitle.textContent = y + "年" + (m + 1) + "月";
  els.prevMonth.disabled = false;
  els.nextMonth.disabled = y === dNow.getFullYear() && m === dNow.getMonth();

  els.calGrid.innerHTML = "";
  var i;
  for (i = 0; i < lead; i++) {
    var blank = document.createElement("div");
    blank.className = "cal-cell blank";
    els.calGrid.appendChild(blank);
  }
  for (var day = 1; day <= daysInMonth; day++) {
    var key = toKey(y, m, day);
    var rec = state.records.get(key);
    var cell = document.createElement("div");
    cell.className = "cal-cell";
    if (key === curKey) cell.classList.add("today");
    if (key === state.selectedKey) cell.classList.add("selected");

    var num = document.createElement("div");
    num.className = "cal-num";
    num.textContent = String(day);
    cell.appendChild(num);

    var dots = document.createElement("div");
    dots.className = "cal-dots";
    HABITS.forEach(function (h) {
      if (rec && rec[h.id]) {
        var dot = document.createElement("span");
        dot.className = "cal-dot";
        dots.appendChild(dot);
      }
    });
    cell.appendChild(dots);

    cell.addEventListener("click", (function (k) {
      return function () { selectDay(k); };
    })(key));
    els.calGrid.appendChild(cell);
  }
  renderDayDetail();
}

function selectDay(key) {
  state.selectedKey = key;
  renderCalendar();
}

function renderDayDetail() {
  if (!state.selectedKey) {
    els.dayDetail.classList.add("hidden");
    return;
  }
  var rec = state.records.get(state.selectedKey) || emptyRec();
  var d = parseDateKey(state.selectedKey);
  els.dayDetail.innerHTML = "";
  var title = document.createElement("div");
  title.className = "detail-title";
  title.textContent = (d.getMonth() + 1) + "月" + d.getDate() + "日";
  els.dayDetail.appendChild(title);
  HABITS.forEach(function (h) {
    var row = document.createElement("div");
    row.className = "detail-row";
    var name = document.createElement("span");
    name.textContent = h.emoji + "  " + h.name;
    var st = document.createElement("span");
    st.className = "detail-state " + (rec[h.id] ? "ok" : "no");
    st.textContent = rec[h.id] ? "已完成" : "未完成";
    row.appendChild(name);
    row.appendChild(st);
    els.dayDetail.appendChild(row);
  });
  els.dayDetail.classList.remove("hidden");
}
/* ---------- 交互 ---------- */

function onHabitTap(habitId) {
  if (!state.unlocked) {
    openPin(habitId);
    return;
  }
  var rec = state.records.get(state.todayKey) || emptyRec();
  rec[habitId] = !rec[habitId];
  state.records.set(state.todayKey, rec);
  LS.saveRecords(state.records);
  renderAll();
  if (state.cloud) {
    DB.upsertRecord(state.todayKey, pickHabits(rec)).catch(function () {
      showBanner("云端保存失败，记录已保存在本机");
    });
  }
}

function openPin(pendingHabitId) {
  state.pendingHabitId = pendingHabitId;
  els.pinInput.value = "";
  els.pinErr.classList.add("hidden");
  els.pinOverlay.classList.remove("hidden");
  setTimeout(function () { els.pinInput.focus(); }, 60);
}

function closePin() {
  els.pinOverlay.classList.add("hidden");
  state.pendingHabitId = null;
}

function confirmPin() {
  var v = els.pinInput.value.trim();
  if (v === state.pin) {
    state.unlocked = true;
    sessionStorage.setItem("yh_unlocked", "1");
    var pending = state.pendingHabitId;
    closePin();
    renderHeader();
    if (pending) onHabitTap(pending);
  } else {
    els.pinErr.classList.remove("hidden");
    els.pinInput.value = "";
    els.pinInput.focus();
  }
}

function changeMonth(delta) {
  var d = new Date(state.month.y, state.month.m + delta, 1);
  state.month = { y: d.getFullYear(), m: d.getMonth() };
  var dNow = new Date();
  if (state.month.y === dNow.getFullYear() && state.month.m === dNow.getMonth()) {
    state.selectedKey = state.todayKey;
  } else {
    state.selectedKey = null;
  }
  renderCalendar();
}

var bannerTimer = null;

function showBanner(msg) {
  els.cloudBannerText.textContent = msg;
  els.cloudBanner.classList.remove("hidden");
  if (bannerTimer) clearTimeout(bannerTimer);
  bannerTimer = setTimeout(function () {
    if (state.cloud === true) els.cloudBanner.classList.add("hidden");
  }, 4000);
}
/* ---------- 设置 ---------- */

function openSettings() {
  els.settingsOverlay.classList.remove("hidden");
  els.cloudStatus.textContent = state.cloud === true ? "已连接云端" : (state.cloud === false ? "仅本机保存" : "连接中…");
}

function closeSettings() {
  els.settingsOverlay.classList.add("hidden");
  els.changePinForm.classList.add("hidden");
  els.pinSaveErr.classList.add("hidden");
}

function showPinSaveErr(msg) {
  els.pinSaveErr.textContent = msg;
  els.pinSaveErr.classList.remove("hidden");
}

function saveNewPin() {
  var cur = els.curPinInput.value.trim();
  var next = els.newPinInput.value.trim();
  els.pinSaveErr.classList.add("hidden");
  if (cur !== state.pin) {
    showPinSaveErr("当前密码不正确");
    return;
  }
  if (!/^\d{4,6}$/.test(next)) {
    showPinSaveErr("新密码请用 4–6 位数字");
    return;
  }
  state.pin = next;
  LS.savePin(next);
  var done = function () {
    els.curPinInput.value = "";
    els.newPinInput.value = "";
    els.changePinForm.classList.add("hidden");
    els.savedHint.classList.remove("hidden");
    setTimeout(function () { els.savedHint.classList.add("hidden"); }, 2200);
  };
  if (state.cloud) {
    DB.upsertSettings(next).then(done).catch(function () {
      showPinSaveErr("云端保存失败，密码已保存在本机");
    });
  } else {
    done();
  }
}

/* ---------- 云端刷新 ---------- */

function updateCloudUI() {
  if (state.cloud === true) {
    els.cloudBanner.classList.add("hidden");
    els.cloudStatus.textContent = "已连接云端";
  } else {
    els.cloudBanner.classList.remove("hidden");
    els.cloudBannerText.textContent = IS_CLOUD ? "云端连接失败，当前数据仅保存在此设备" : "未连接云端，数据仅保存在此设备";
    els.cloudStatus.textContent = "仅本机保存";
  }
}

function refreshFromCloud() {
  return Promise.all([DB.fetchRecords(), DB.fetchSettings()]).then(function (results) {
    var rows = results[0];
    var settings = results[1];
    var map = new Map();
    rows.forEach(function (r) {
      map.set(r.date, { accounting: !!r.accounting, english: !!r.english, violin: !!r.violin });
    });
    state.records = map;
    LS.saveRecords(map);
    if (settings && settings.pin) {
      state.pin = settings.pin;
      LS.savePin(settings.pin);
    }
    state.cloud = true;
    renderAll();
    updateCloudUI();
  }).catch(function () {
    state.cloud = false;
    renderAll();
    updateCloudUI();
  });
}

function renderAll() {
  renderHeader();
  updateHabitRows();
  renderStats();
  renderCalendar();
}
/* ---------- 事件与初始化 ---------- */

function buildCalWeekdays() {
  els.calWeekdays.innerHTML = "";
  WEEKDAY_NAMES.forEach(function (w) {
    var s = document.createElement("span");
    s.textContent = w;
    els.calWeekdays.appendChild(s);
  });
}

function bindEvents() {
  els.lockBtn.addEventListener("click", function () {
    if (state.unlocked) {
      state.unlocked = false;
      sessionStorage.removeItem("yh_unlocked");
      renderHeader();
    } else {
      openPin(null);
    }
  });

  els.settingsBtn.addEventListener("click", openSettings);
  els.settingsClose.addEventListener("click", closeSettings);
  els.settingsOverlay.addEventListener("click", function (e) {
    if (e.target === els.settingsOverlay) closeSettings();
  });
  els.changePinBtn.addEventListener("click", function () {
    els.changePinForm.classList.toggle("hidden");
  });
  els.savePinBtn.addEventListener("click", saveNewPin);
  els.curPinInput.addEventListener("keydown", function (e) { if (e.key === "Enter") saveNewPin(); });
  els.newPinInput.addEventListener("keydown", function (e) { if (e.key === "Enter") saveNewPin(); });

  els.pinCancel.addEventListener("click", closePin);
  els.pinOk.addEventListener("click", confirmPin);
  els.pinInput.addEventListener("keydown", function (e) { if (e.key === "Enter") confirmPin(); });
  els.pinOverlay.addEventListener("click", function (e) {
    if (e.target === els.pinOverlay) closePin();
  });

  els.prevMonth.addEventListener("click", function () { changeMonth(-1); });
  els.nextMonth.addEventListener("click", function () { changeMonth(1); });

  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && IS_CLOUD) refreshFromCloud();
  });

  window.addEventListener("storage", function (e) {
    if (e.key === LS.recKey) {
      state.records = LS.loadRecords();
      renderAll();
    }
  });

  setInterval(function () {
    if (toDateKey(new Date()) !== state.todayKey) {
      window.location.reload();
    }
  }, 60000);
}

function init() {
  var d = new Date();
  state.pin = LS.loadPin() || CONFIG.DEFAULT_PIN || "8888";
  state.records = LS.loadRecords();
  state.month = { y: d.getFullYear(), m: d.getMonth() };
  state.todayKey = toDateKey(d);
  state.selectedKey = state.todayKey;

  buildCalWeekdays();
  buildHabitRows();
  bindEvents();
  renderAll();

  if (!IS_CLOUD) {
    state.cloud = false;
    updateCloudUI();
  } else {
    refreshFromCloud();
  }
}

init();
