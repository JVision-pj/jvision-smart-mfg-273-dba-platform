(function industrySystemDemo() {
const config = window.DEMO_CONFIG;
const preset = window.SYSTEM_PRESET;
const storageKey = "jvision-industry-system-" + config.id;
const $ = (selector) => document.querySelector(selector);
let logs = ["系統已載入範例資料，AI 已完成今日營運摘要。"];

function cloneRecords() {
  return JSON.parse(JSON.stringify(config.records));
}

function loadRecords() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    return Array.isArray(saved) ? saved : cloneRecords();
  } catch {
    return cloneRecords();
  }
}

let records = loadRecords();

function saveRecords() {
  localStorage.setItem(storageKey, JSON.stringify(records));
}

function dueDays(value) {
  const match = String(value || "").match(/D\+(\d+)/i);
  return match ? Number(match[1]) : 99;
}

function getStats() {
  const total = records.length;
  const open = records.filter((record) => !record.done).length;
  const done = total - open;
  const highRisk = records.filter((record) => !record.done && record.priority === "high").length;
  const mediumRisk = records.filter((record) => !record.done && record.priority === "medium").length;
  const lowRisk = records.filter((record) => !record.done && record.priority === "low").length;
  const urgent = records.filter((record) => !record.done && dueDays(record.due) <= 3).length;
  const doneRate = total ? Math.round((done / total) * 100) : 0;
  const avgScore = total ? Math.round(records.reduce((sum, record) => sum + Number(record.score || 0), 0) / total) : 0;
  const impactValue = Math.max(18, Math.round((open * 1.8 + highRisk * 3.2 + urgent * 2.4 + avgScore / 8)));
  return { total, open, done, highRisk, mediumRisk, lowRisk, urgent, doneRate, avgScore, impactValue };
}

function generateInsight() {
  const openRecords = records.filter((record) => !record.done).sort((a, b) => b.score - a.score);
  if (!openRecords.length) return "目前所有項目已完成，建議匯出今日摘要，形成下次會議的改善清單。";
  const top = openRecords[0];
  const riskMap = openRecords.reduce((acc, record) => {
    acc[record.risk] = (acc[record.risk] || 0) + 1;
    return acc;
  }, {});
  const mainRisk = Object.entries(riskMap).sort((a, b) => b[1] - a[1])[0];
  const urgent = openRecords.filter((record) => dueDays(record.due) <= 3).length;
  return `AI 建議先處理「${top.title}」，目前 ${mainRisk[0]} 累積 ${mainRisk[1]} 筆，另有 ${urgent} 筆急件。可由 ${top.owner} 先確認資料，再把下一步派給現場負責人。`;
}

function priorityText(value) {
  if (value === "high") return "高風險";
  if (value === "medium") return "中風險";
  return "低風險";
}

function filteredRecords() {
  const keyword = ($("#searchInput")?.value || "").trim().toLowerCase();
  if (!keyword) return records;
  return records.filter((record) => [record.title, record.target, record.owner, record.risk, record.stage].join(" ").toLowerCase().includes(keyword));
}

function renderKpis() {
  const stats = getStats();
  $("#openCount").textContent = stats.open;
  $("#sidebarOpen").textContent = stats.open;
  $("#riskCount").textContent = stats.highRisk;
  $("#doneRate").textContent = `${stats.doneRate}%`;
  $("#impactValue").textContent = `${stats.impactValue}h`;
  $("#queueLabel").textContent = `${stats.total} items`;
  $("#recordCount").textContent = `${filteredRecords().length} shown`;
  $("#aiInsight").textContent = generateInsight();
}

function renderStages() {
  const board = $("#stageBoard");
  board.innerHTML = "";
  const total = Math.max(records.length, 1);
  config.profile.stages.forEach((stage) => {
    const stageRecords = records.filter((record) => record.stage === stage);
    const high = stageRecords.filter((record) => record.priority === "high").length;
    const percent = Math.max(8, Math.round((stageRecords.length / total) * 100));
    const card = document.createElement("article");
    card.className = "stage";
    card.innerHTML = `<strong>${stage}<span>${stageRecords.length}</span></strong><small>高風險 ${high}｜AI 排序 ${percent}%</small><i style="width:${percent}%"></i>`;
    board.append(card);
  });
}

function renderRisks() {
  const stats = getStats();
  const rows = [
    ["高風險", stats.highRisk, "high"],
    ["中風險", stats.mediumRisk, "medium"],
    ["低風險", stats.lowRisk, "low"],
    ["急件", stats.urgent, "urgent"],
  ];
  const max = Math.max(...rows.map((row) => row[1]), 1);
  $("#riskBars").innerHTML = rows.map(([label, count, key]) => {
    const width = Math.max(8, Math.round((count / max) * 100));
    return `<div class="risk-row" data-risk="${key}"><span>${label}</span><div class="risk-track"><i class="risk-fill" style="width:${width}%"></i></div><b>${count}</b></div>`;
  }).join("");
}

function renderTasks() {
  const list = $("#taskList");
  const rows = filteredRecords().sort((a, b) => Number(a.done) - Number(b.done) || b.score - a.score);
  list.innerHTML = "";
  rows.forEach((record) => {
    const card = document.createElement("article");
    card.className = "task-card";
    card.classList.toggle("done", record.done);
    card.innerHTML = `
      <header>
        <h3>${record.title}</h3>
        <span class="pill ${record.priority}">${priorityText(record.priority)}</span>
      </header>
      <p>${record.target}</p>
      <div class="task-meta">
        <span>${config.profile.fields[1]}：${record.due}</span>
        <span>${config.profile.fields[2]}：${record.risk}</span>
        <span>${config.profile.fields[3]}：${record.owner}</span>
        <span>AI 分數：${record.score}</span>
      </div>
      <button type="button" data-id="${record.id}">${record.done ? "改回待辦" : "標記完成"}</button>
    `;
    list.append(card);
  });
}

function renderLogs() {
  $("#logList").innerHTML = logs.slice(0, 6).map((log) => `<p>${log}</p>`).join("");
}

function render() {
  renderKpis();
  renderStages();
  renderRisks();
  renderTasks();
  renderLogs();
}

function addLog(text) {
  logs.unshift(text);
  renderLogs();
}

function runAi() {
  records = records.map((record) => {
    if (record.done) return record;
    const nextScore = Math.min(99, Number(record.score || 50) + Math.floor(Math.random() * 8));
    return { ...record, score: nextScore, priority: nextScore >= 78 ? "high" : nextScore >= 55 ? "medium" : "low" };
  });
  saveRecords();
  addLog(`${preset.primaryAction}完成：系統已更新風險分數與優先順序。`);
  render();
}

document.querySelectorAll("[data-action='run-ai']").forEach((button) => button.addEventListener("click", runAi));

$("[data-action='simulate']").addEventListener("click", () => {
  const target = records.find((record) => !record.done) || records[0];
  if (!target) return;
  records = records.map((record) => record.id === target.id ? { ...record, stage: config.profile.stages[Math.min(2, config.profile.stages.length - 1)] } : record);
  saveRecords();
  addLog(`主管已審核「${target.title}」，狀態推進到下一個流程。`);
  render();
});

$("[data-action='reset']").addEventListener("click", () => {
  records = cloneRecords();
  saveRecords();
  logs = ["已還原範例資料，方便重新展示完整流程。", ...logs];
  render();
});

$("#taskForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const score = 60 + Math.floor(Math.random() * 30);
  const item = {
    id: `${config.id}-${Date.now()}`,
    title: String(form.get("title")).trim(),
    target: String(form.get("target")).trim(),
    owner: config.profile.owner,
    due: "D+3",
    risk: String(form.get("risk")),
    stage: config.profile.stages[0],
    score,
    priority: score >= 78 ? "high" : "medium",
    done: false,
  };
  records.unshift(item);
  event.currentTarget.reset();
  saveRecords();
  addLog(`新增「${item.title}」，AI 已自動放入待處理佇列。`);
  render();
});

$("#taskList").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  const target = records.find((record) => record.id === button.dataset.id);
  records = records.map((record) => record.id === button.dataset.id ? {
    ...record,
    done: !record.done,
    stage: !record.done ? config.profile.stages.at(-1) : config.profile.stages[0],
  } : record);
  saveRecords();
  addLog(`「${target.title}」狀態已更新，統計與 AI 摘要同步刷新。`);
  render();
});

$("#searchInput").addEventListener("input", render);

render();
})();