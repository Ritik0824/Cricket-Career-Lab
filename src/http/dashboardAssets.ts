export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="description" content="Private local cricket training and development review">
    <title>Cricket Career Lab</title>
    <link rel="stylesheet" href="/assets/styles.css">
  </head>
  <body>
    <a class="skip-link" href="#main-content">Skip to review</a>
    <header class="site-header">
      <div>
        <p class="eyebrow">Private development workspace</p>
        <h1>Cricket Career Lab</h1>
        <p class="lede">Training evidence, goals, and workload patterns on this computer.</p>
      </div>
      <p class="privacy-badge" aria-label="Privacy status">Loopback only · notes omitted</p>
    </header>

    <main id="main-content" tabindex="-1">
      <section class="control-panel" aria-labelledby="review-controls-title">
        <div>
          <p class="eyebrow">Review window</p>
          <h2 id="review-controls-title">Choose the evidence period</h2>
        </div>
        <form id="review-form" class="review-form">
          <label>
            Week ending
            <input id="week-ending" name="week-ending" type="date" required>
          </label>
          <label>
            Review month
            <input id="review-month" name="review-month" type="month" required>
          </label>
          <button id="refresh-button" type="submit">Refresh review</button>
        </form>
        <p id="load-status" class="status-message" role="status" aria-live="polite"></p>
      </section>

      <section aria-labelledby="overview-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">At a glance</p>
            <h2 id="overview-title">Current training picture</h2>
          </div>
        </div>
        <div class="metric-grid" aria-label="Current training metrics">
          <article class="metric-card">
            <p>Weekly minutes</p>
            <strong id="weekly-minutes">—</strong>
            <span id="weekly-change">Awaiting journal data</span>
          </article>
          <article class="metric-card">
            <p>Active days</p>
            <strong id="active-days">—</strong>
            <span>in the selected week</span>
          </article>
          <article class="metric-card">
            <p>Active goals</p>
            <strong id="active-goals">—</strong>
            <span id="goal-outcomes">Evidence-backed progress</span>
          </article>
          <article class="metric-card">
            <p>Journal entries</p>
            <strong id="journal-count">—</strong>
            <span>matching the local review</span>
          </article>
        </div>
      </section>

      <section aria-labelledby="goals-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Development goals</p>
            <h2 id="goals-title">Progress linked to exact evidence</h2>
          </div>
          <p>Progress is recalculated from the journal; counters are not stored.</p>
        </div>
        <div id="goals-grid" class="goal-grid"></div>
        <p id="goals-empty" class="empty-state" hidden>No development goals have been created yet.</p>
      </section>

      <section aria-labelledby="workload-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Descriptive review</p>
            <h2 id="workload-title">Workload patterns</h2>
          </div>
          <p>Recorded practice only—not a health, readiness, or injury-risk assessment.</p>
        </div>
        <div class="review-grid">
          <article id="weekly-review" class="review-card" aria-labelledby="weekly-title">
            <h3 id="weekly-title">Selected week</h3>
          </article>
          <article id="monthly-review" class="review-card" aria-labelledby="monthly-title">
            <h3 id="monthly-title">Selected month</h3>
          </article>
        </div>
      </section>

      <section aria-labelledby="journal-title">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Recent evidence</p>
            <h2 id="journal-title">Training journal</h2>
          </div>
          <p>Session and drill notes stay in private files and are not sent to this page.</p>
        </div>
        <div class="table-shell" tabindex="0" aria-label="Scrollable journal results">
          <table>
            <thead>
              <tr>
                <th scope="col">Completed</th>
                <th scope="col">Session</th>
                <th scope="col">Status</th>
                <th scope="col">Minutes</th>
                <th scope="col">Effort</th>
                <th scope="col">Adherence</th>
              </tr>
            </thead>
            <tbody id="journal-body"></tbody>
          </table>
        </div>
        <p id="journal-empty" class="empty-state" hidden>The journal has no matching entries.</p>
      </section>
    </main>

    <footer>
      <p>Cricket Career Lab runs offline and reads owner-selected local repositories.</p>
    </footer>
    <script type="module" src="/assets/app.js"></script>
  </body>
</html>`;

export const DASHBOARD_CSS = `:root {
  color-scheme: light;
  --ink: #17211b;
  --muted: #5d6962;
  --surface: #f8faf7;
  --panel: #ffffff;
  --line: #dce4dd;
  --accent: #176b45;
  --accent-strong: #0c4d30;
  --accent-soft: #e3f3e9;
  --warm: #f4a340;
  --shadow: 0 16px 40px rgb(31 54 40 / 8%);
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background: var(--surface);
  color: var(--ink);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  min-width: 20rem;
  background:
    radial-gradient(circle at 90% -10%, rgb(23 107 69 / 12%), transparent 26rem),
    var(--surface);
  line-height: 1.55;
}

a, button, input { font: inherit; }

.skip-link {
  position: fixed;
  top: 0.75rem;
  left: 0.75rem;
  z-index: 10;
  padding: 0.65rem 0.9rem;
  color: white;
  background: var(--accent-strong);
  border-radius: 0.4rem;
  transform: translateY(-180%);
}

.skip-link:focus { transform: translateY(0); }

.site-header,
main,
footer {
  width: min(76rem, calc(100% - 2rem));
  margin-inline: auto;
}

.site-header {
  display: flex;
  justify-content: space-between;
  gap: 2rem;
  align-items: flex-start;
  padding: 3.5rem 0 2rem;
}

h1, h2, h3, p { margin-top: 0; }
h1 { margin-bottom: 0.45rem; font-size: clamp(2rem, 5vw, 3.7rem); letter-spacing: -0.045em; line-height: 1; }
h2 { margin-bottom: 0.25rem; font-size: clamp(1.45rem, 3vw, 2.1rem); letter-spacing: -0.025em; }
h3 { margin-bottom: 1rem; font-size: 1.15rem; }

.eyebrow {
  margin-bottom: 0.4rem;
  color: var(--accent);
  font-size: 0.75rem;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.lede,
.section-heading > p,
footer,
.status-message { color: var(--muted); }

.privacy-badge {
  flex: 0 0 auto;
  padding: 0.55rem 0.8rem;
  border: 1px solid #b9d8c6;
  border-radius: 999px;
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-size: 0.82rem;
  font-weight: 700;
}

main { display: grid; gap: 3.5rem; padding-bottom: 4rem; }

.control-panel {
  display: grid;
  grid-template-columns: minmax(13rem, 1fr) minmax(26rem, 1.7fr);
  gap: 1rem 2rem;
  padding: 1.5rem;
  border: 1px solid var(--line);
  border-radius: 1rem;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.review-form {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.75rem;
  align-items: end;
}

label { display: grid; gap: 0.35rem; color: var(--muted); font-size: 0.82rem; font-weight: 700; }

input,
button {
  min-height: 2.75rem;
  border-radius: 0.55rem;
}

input {
  width: 100%;
  border: 1px solid #bdc9c0;
  padding: 0.55rem 0.7rem;
  color: var(--ink);
  background: white;
}

button {
  border: 1px solid var(--accent-strong);
  padding: 0.55rem 1rem;
  color: white;
  background: var(--accent);
  font-weight: 750;
  cursor: pointer;
}

button:hover { background: var(--accent-strong); }
button:disabled { cursor: wait; opacity: 0.65; }
button:focus-visible, input:focus-visible, .table-shell:focus-visible { outline: 3px solid rgb(244 163 64 / 70%); outline-offset: 2px; }

.status-message { grid-column: 1 / -1; min-height: 1.5rem; margin: 0; }
.status-message[data-state="error"] { color: #a12d2d; font-weight: 700; }

.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: end;
  gap: 2rem;
  margin-bottom: 1.2rem;
}

.section-heading > p { max-width: 34rem; margin-bottom: 0.3rem; text-align: right; }

.metric-grid,
.goal-grid,
.review-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 1rem;
}

.metric-card,
.goal-card,
.review-card {
  border: 1px solid var(--line);
  border-radius: 0.9rem;
  background: var(--panel);
  box-shadow: 0 8px 28px rgb(31 54 40 / 5%);
}

.metric-card { padding: 1.25rem; }
.metric-card p { margin-bottom: 0.25rem; color: var(--muted); font-size: 0.85rem; font-weight: 700; }
.metric-card strong { display: block; font-size: 2rem; line-height: 1.15; }
.metric-card span { color: var(--muted); font-size: 0.78rem; }

.goal-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.goal-card { padding: 1.25rem; }
.goal-card header { display: flex; justify-content: space-between; gap: 1rem; align-items: flex-start; }
.goal-card h3 { margin-bottom: 0.2rem; }
.goal-card p { color: var(--muted); }

.status-pill {
  padding: 0.25rem 0.55rem;
  border-radius: 999px;
  color: var(--accent-strong);
  background: var(--accent-soft);
  font-size: 0.72rem;
  font-weight: 800;
  white-space: nowrap;
}

.progress-row { display: flex; justify-content: space-between; gap: 1rem; margin-top: 1rem; font-size: 0.82rem; font-weight: 700; }
progress { width: 100%; height: 0.65rem; accent-color: var(--accent); }
.evidence-line { margin: 0.6rem 0 0; font-size: 0.78rem; }

.review-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.review-card { padding: 1.35rem; }
.review-card dl { display: grid; grid-template-columns: 1fr auto; gap: 0.55rem 1rem; margin: 0; }
.review-card dt { color: var(--muted); }
.review-card dd { margin: 0; font-weight: 750; text-align: right; }
.review-card .context { margin: 1rem 0 0; padding-top: 0.9rem; border-top: 1px solid var(--line); color: var(--muted); font-size: 0.82rem; }

.table-shell { overflow-x: auto; border: 1px solid var(--line); border-radius: 0.9rem; background: var(--panel); }
table { width: 100%; min-width: 48rem; border-collapse: collapse; }
th, td { padding: 0.85rem 1rem; border-bottom: 1px solid var(--line); text-align: left; }
th { color: var(--muted); background: #f1f5f1; font-size: 0.75rem; letter-spacing: 0.04em; text-transform: uppercase; }
tbody tr:last-child td { border-bottom: 0; }
td:nth-child(n + 4) { font-variant-numeric: tabular-nums; }

.empty-state { padding: 1.5rem; border: 1px dashed #b8c4bb; border-radius: 0.8rem; color: var(--muted); text-align: center; }
footer { padding: 1.5rem 0 2.5rem; border-top: 1px solid var(--line); font-size: 0.82rem; }

@media (max-width: 56rem) {
  .control-panel { grid-template-columns: 1fr; }
  .metric-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .goal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 40rem) {
  .site-header, .section-heading { display: grid; }
  .site-header { padding-top: 2.25rem; }
  .privacy-badge { justify-self: start; }
  .section-heading > p { text-align: left; }
  .review-form, .metric-grid, .goal-grid, .review-grid { grid-template-columns: 1fr; }
  button { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; transition: none !important; }
}

@media (prefers-color-scheme: dark) {
  :root {
    color-scheme: dark;
    --ink: #edf5ef;
    --muted: #aebbb2;
    --surface: #101713;
    --panel: #17211b;
    --line: #314037;
    --accent: #6fd39d;
    --accent-strong: #a1e6bd;
    --accent-soft: #1d4932;
  }
  input { color: var(--ink); background: #111a15; border-color: #435248; }
  button { color: #0c2a1a; background: var(--accent); }
  th { background: #1d2922; }
}`;

export const DASHBOARD_JAVASCRIPT = `const byId = (id) => document.getElementById(id);

const elements = {
  form: byId("review-form"),
  weekEnding: byId("week-ending"),
  month: byId("review-month"),
  refresh: byId("refresh-button"),
  status: byId("load-status"),
  weeklyMinutes: byId("weekly-minutes"),
  weeklyChange: byId("weekly-change"),
  activeDays: byId("active-days"),
  activeGoals: byId("active-goals"),
  goalOutcomes: byId("goal-outcomes"),
  journalCount: byId("journal-count"),
  goalsGrid: byId("goals-grid"),
  goalsEmpty: byId("goals-empty"),
  weeklyReview: byId("weekly-review"),
  monthlyReview: byId("monthly-review"),
  journalBody: byId("journal-body"),
  journalEmpty: byId("journal-empty"),
};

const now = new Date();
elements.weekEnding.value = now.toISOString().slice(0, 10);
elements.month.value = now.toISOString().slice(0, 7);

function textElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) element.className = className;
  return element;
}

function formatDateTime(value) {
  if (!value) return "No contribution yet";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatStatus(value) {
  return value.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function signed(value, suffix = "") {
  return \`\${value >= 0 ? "+" : ""}\${value}\${suffix}\`;
}

async function readJson(path) {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body?.error?.message || \`Request failed with \${response.status}\`);
  }
  return body.data;
}

function renderGoals(goals) {
  const cards = goals.map((goal) => {
    const card = document.createElement("article");
    card.className = "goal-card";
    const header = document.createElement("header");
    const heading = document.createElement("div");
    heading.append(
      textElement("h3", goal.title),
      textElement("p", goal.goalId),
    );
    header.append(heading, textElement("span", formatStatus(goal.status), "status-pill"));

    const progressRow = document.createElement("div");
    progressRow.className = "progress-row";
    progressRow.append(
      textElement("span", \`\${goal.currentValue} of \${goal.target}\`),
      textElement("span", \`\${goal.progressPercentage}%\`),
    );
    const progress = document.createElement("progress");
    progress.max = 100;
    progress.value = goal.progressPercentage;
    progress.setAttribute("aria-label", \`\${goal.title}: \${goal.progressPercentage}% complete\`);
    const evidence = textElement(
      "p",
      \`\${goal.evidence.length} evidence \${goal.evidence.length === 1 ? "entry" : "entries"} · \${formatDateTime(goal.latestContributionAt)}\`,
      "evidence-line",
    );
    card.append(header, progressRow, progress, evidence);
    return card;
  });

  elements.goalsGrid.replaceChildren(...cards);
  elements.goalsEmpty.hidden = goals.length !== 0;
  elements.activeGoals.textContent = String(goals.filter((goal) => goal.status === "in-progress").length);
  const achieved = goals.filter((goal) => goal.status === "achieved").length;
  elements.goalOutcomes.textContent = \`\${achieved} achieved · \${goals.length} total\`;
}

function definitionList(rows) {
  const list = document.createElement("dl");
  for (const [term, detail] of rows) {
    list.append(textElement("dt", term), textElement("dd", detail));
  }
  return list;
}

function replaceReview(container, title, rows, context) {
  const heading = textElement("h3", title);
  const headingId = container.getAttribute("aria-labelledby");
  if (headingId) heading.id = headingId;
  container.replaceChildren(
    heading,
    definitionList(rows),
    textElement("p", context, "context"),
  );
}

function renderWorkload(week, month) {
  const minuteComparison = week.comparison.completedMinutes;
  const percentage = minuteComparison.percentageChange === null
    ? "No prior baseline"
    : \`\${signed(minuteComparison.percentageChange, "%")} from previous week\`;

  elements.weeklyMinutes.textContent = String(week.current.completedMinutes);
  elements.weeklyChange.textContent = percentage;
  elements.activeDays.textContent = String(week.current.activeDays);

  replaceReview(
    elements.weeklyReview,
    \`\${week.current.startDate} to \${week.current.endDate}\`,
    [
      ["Completed time", \`\${week.current.completedMinutes} min\`],
      ["Performed sessions", String(week.current.performedSessionCount)],
      ["Active days", String(week.current.activeDays)],
      ["Average effort", week.current.averageEffort === null ? "Not available" : \`\${week.current.averageEffort}/10\`],
      ["Effort load", \`\${week.current.effortLoad} points\`],
    ],
    \`\${formatStatus(minuteComparison.trend)} · \${signed(minuteComparison.delta)} minutes compared with the prior week.\`,
  );

  const busiest = month.busiestTrainingDay;
  replaceReview(
    elements.monthlyReview,
    month.month,
    [
      ["Completed time", \`\${month.current.completedMinutes} min\`],
      ["Performed sessions", String(month.current.performedSessionCount)],
      ["Active days", String(month.current.activeDays)],
      ["Longest streak", \`\${month.longestActiveDayStreak.days} \${month.longestActiveDayStreak.days === 1 ? "day" : "days"}\`],
      ["Busiest day", busiest ? \`\${busiest.date} · \${busiest.completedMinutes} min\` : "No activity"],
    ],
    \`\${month.segments.length} complete calendar segments · \${formatStatus(month.comparison.completedMinutes.trend)} from the prior month.\`,
  );
}

function renderJournal(entries) {
  const rows = entries.map((entry) => {
    const row = document.createElement("tr");
    row.append(
      textElement("td", formatDateTime(entry.completedAt)),
      textElement("td", entry.planTitle),
      textElement("td", formatStatus(entry.status)),
      textElement("td", \`\${entry.completedMinutes}/\${entry.plannedMinutes}\`),
      textElement("td", entry.averageEffort === null ? "—" : \`\${entry.averageEffort}/10\`),
      textElement("td", \`\${entry.adherencePercentage}%\`),
    );
    return row;
  });

  elements.journalBody.replaceChildren(...rows);
  elements.journalEmpty.hidden = entries.length !== 0;
  elements.journalCount.textContent = String(entries.length);
}

async function loadDashboard() {
  elements.refresh.disabled = true;
  elements.status.dataset.state = "loading";
  elements.status.textContent = "Loading private local review data…";

  try {
    const asOf = elements.weekEnding.value;
    const month = elements.month.value;
    const [journal, goals, week, monthly] = await Promise.all([
      readJson("/api/journal?limit=25"),
      readJson(\`/api/goals?asOf=\${encodeURIComponent(asOf)}\`),
      readJson(\`/api/workload/week?ending=\${encodeURIComponent(asOf)}\`),
      readJson(\`/api/workload/month?month=\${encodeURIComponent(month)}\`),
    ]);

    renderJournal(journal);
    renderGoals(goals);
    renderWorkload(week, monthly);
    elements.status.dataset.state = "ready";
    elements.status.textContent = \`Review updated for \${asOf}. Private notes remain omitted.\`;
  } catch (error) {
    elements.status.dataset.state = "error";
    elements.status.textContent = error instanceof Error
      ? \`Review could not be loaded: \${error.message}\`
      : "Review could not be loaded.";
  } finally {
    elements.refresh.disabled = false;
  }
}

elements.form.addEventListener("submit", (event) => {
  event.preventDefault();
  void loadDashboard();
});

void loadDashboard();`;
