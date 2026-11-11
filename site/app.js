// Still Hiring? - the page. No build step and no dependencies.
//
// Everything that comes from the data files or from HN is inserted with
// textContent or as a text node, never as HTML.

import { diffWords, similarity } from "./diff.js";
import { shardOf } from "./shard.js";

const PAGE_SIZE = 30;
const MAX_POSTS_PER_SIDE = 6; // posts fetched per thread when comparing
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const HN_ITEM = "https://news.ycombinator.com/item?id=";
const POST_SOURCES = [
  [(id) => `https://hn.algolia.com/api/v1/items/${id}`, (item) => item?.text],
  [
    (id) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
    (item) => (item && !item.deleted && !item.dead ? item.text : null),
  ],
];
const SVG = "http://www.w3.org/2000/svg";

const $ = (id) => document.getElementById(id);
const number = (value) => value.toLocaleString("en-US");
const companies = (count) => `${number(count)} ${count === 1 ? "company" : "companies"}`;
const percent = (share) => `${Math.round(share * 100)}%`;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

/** Create an element. Strings among the children become text nodes. */
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "dataset") Object.assign(node.dataset, value);
    else if (key in node) node[key] = value;
    else node.setAttribute(key, value);
  }
  node.append(...children.filter((child) => child !== null && child !== undefined));
  return node;
}

function svgEl(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text;
  return node;
}

const state = {
  meta: null,
  rows: [],
  byId: new Map(),
  shards: new Map(),
  posts: new Map(),
  list: { filter: "all", sort: "run", query: "", pages: 1 },
  remembered: new Map(), // list hash -> {pages, scroll}
  lastListHash: "",
};

const monthLabel = (index) => {
  const month = state.meta.threads[index].m;
  return `${MONTHS[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`;
};

// --- Tooltip ---------------------------------------------------------------
//
// One tooltip for the whole page. A mouse shows it by hovering. A finger shows
// it by touching or dragging across a strip, a calendar or a chart, and it
// stays until the next touch elsewhere or a scroll. Nothing is only in the
// tooltip: the legend, the company page and the chart tables say the same.

const tip = $("tip");
let marked = null;

function mark(node) {
  if (marked === node) return;
  marked?.classList.remove("at");
  marked = node ?? null;
  marked?.classList.add("at");
}

/** Show the tooltip next to `anchor`, a box in viewport coordinates. */
function showTip(anchor, strong, rest, { above = false, touch = false } = {}) {
  tip.replaceChildren();
  if (strong) tip.append(el("b", {}, strong), " ");
  tip.append(rest);
  tip.hidden = false;
  const box = tip.getBoundingClientRect();
  const centre = (anchor.left + anchor.right) / 2;
  const left = clamp(centre - box.width / 2, 4, window.innerWidth - box.width - 4);
  const gap = touch ? 28 : 8; // a finger covers what it points at
  let top = above || touch ? anchor.top - box.height - gap : anchor.bottom + gap;
  if (top < 4) top = anchor.bottom + gap;
  if (top + box.height > window.innerHeight - 4) top = anchor.top - box.height - gap;
  tip.style.left = `${Math.max(4, left)}px`;
  tip.style.top = `${Math.max(4, top)}px`;
}

function clearTip() {
  tip.hidden = true;
  mark(null);
}

/**
 * Make a container answer to the pointer. `find(event)` returns what is under
 * it as {node, anchor, strong, rest, above} or null.
 */
function tipsOn(host, find) {
  host.dataset.tips = "";
  const update = (event) => {
    const touch = event.pointerType !== "mouse";
    const found = find(event);
    if (!found) {
      if (!touch) clearTip();
      return;
    }
    mark(found.node);
    showTip(found.anchor, found.strong, found.rest, { above: found.above, touch });
  };
  host.addEventListener("pointermove", update);
  host.addEventListener("pointerdown", update);
  host.addEventListener("pointerleave", (event) => {
    if (event.pointerType === "mouse") clearTip();
  });
}

/** The element matching `selector` under the pointer. A dragged finger keeps its first target, so ask the document. */
const under = (event, selector) => document.elementFromPoint(event.clientX, event.clientY)?.closest(selector) ?? null;

// --- Strip and calendar cells ----------------------------------------------

/** CSS class for a similarity in percent, or for the strip's one-character code. */
function cellClass(code) {
  if (code === "." || code === null || code === undefined) return "";
  if (code === "+") return "first";
  const tenths = typeof code === "number" ? Math.floor(code / 10) : Number(code);
  if (tenths >= 9) return "s3";
  return tenths >= 5 ? "s2" : "s1";
}

function describeCode(code) {
  if (code === ".") return "no post";
  if (code === "+") return "first post";
  const low = Number(code) * 10;
  return `${low}–${code === "9" ? 100 : low + 9}% the same as the previous post`;
}

function legend(lead) {
  const item = (cls, label) => el("span", {}, el("i", { className: cls }), label);
  return [
    lead ? el("span", {}, lead) : null,
    item("", "no post"),
    item("first", "first post"),
    item("s1", "rewritten"),
    item("s2", "edited"),
    item("s3", "same text"),
  ].filter(Boolean);
}

function strip(row) {
  const posted = [...row.strip].filter((code) => code !== ".").length;
  const node = el("span", { className: "strip", role: "img" });
  node.style.setProperty("--cells", row.strip.length);
  node.setAttribute("aria-label", `Posted in ${posted} of the last ${row.strip.length} months`);
  [...row.strip].forEach((code, offset) => {
    node.append(el("i", { className: cellClass(code), dataset: { offset } }));
  });
  return node;
}

// --- Charts ----------------------------------------------------------------

function niceMax(value) {
  const power = 10 ** Math.floor(Math.log10(value));
  return [1, 2, 5, 10].map((step) => step * power).find((candidate) => candidate >= value);
}

function roundedColumn(x, top, width, height, radius) {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  const bottom = top + height;
  return (
    `M${x},${bottom}V${top + r}Q${x},${top} ${x + r},${top}` +
    `H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${bottom}Z`
  );
}

/**
 * A column chart of one series over the threads.
 * spec: {title, note, unit, points: [{index, value, extra}], max, format, annotate: [positions]}
 */
function columnChart(host, spec) {
  const svg = svgEl("svg", { role: "img", tabindex: "0", "aria-label": `${spec.title}. ${spec.note}` });
  const rows = [...spec.points].reverse().map((point) =>
    el("tr", {}, el("td", {}, monthLabel(point.index)), el("td", {}, spec.format(point.value))),
  );
  const table = el(
    "details",
    { className: "tableview" },
    el("summary", {}, "table"),
    el(
      "div",
      { className: "scroll" },
      el(
        "table",
        {},
        el("thead", {}, el("tr", {}, el("th", { scope: "col" }, "thread"), el("th", { scope: "col" }, spec.unit))),
        el("tbody", {}, ...rows),
      ),
    ),
  );
  host.append(
    el(
      "figure",
      { className: "chart" },
      el("figcaption", {}, spec.title, " ", el("span", { className: "sub" }, spec.note)),
      svg,
      table,
    ),
  );

  let geometry = null;
  let active = -1;

  /** What the tooltip says about one column. `pointerY` keeps it clear of a finger. */
  const describe = (position, pointerY = Infinity) => {
    const point = spec.points[position];
    const box = svg.getBoundingClientRect();
    const x = box.left + geometry.center(position);
    return {
      node: svg.querySelectorAll(".col")[position],
      anchor: { left: x, right: x, top: Math.min(box.top + geometry.y(point.value), pointerY), bottom: box.bottom },
      strong: spec.format(point.value),
      rest: [monthLabel(point.index), point.extra].filter(Boolean).join(" · "),
      above: true,
    };
  };

  const draw = () => {
    const box = svg.getBoundingClientRect();
    const width = Math.round(box.width);
    const height = Math.round(box.height);
    if (!width || !height) return; // not on screen yet; the observer calls again
    if (svg.contains(marked)) clearTip();
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.replaceChildren();

    const measure = (label, cls = "") => {
      const probe = svgEl("text", { class: cls }, label);
      svg.append(probe);
      const size = probe.getComputedTextLength();
      probe.remove();
      return size;
    };
    const ticks = [0, spec.max / 2, spec.max];
    const margin = { left: Math.ceil(measure(spec.format(spec.max))) + 10, right: 8, top: 20, bottom: 24 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    const band = innerWidth / spec.points.length;
    const columnWidth = clamp(band - 2, 1, 24);
    const baseline = margin.top + innerHeight;
    const y = (value) => margin.top + innerHeight * (1 - value / spec.max);
    const center = (position) => margin.left + band * (position + 0.5);
    geometry = { center, y, band, left: margin.left };

    for (const tick of ticks) {
      svg.append(
        svgEl("line", { class: "grid", x1: margin.left, x2: width - margin.right, y1: y(tick), y2: y(tick) }),
        svgEl("text", { x: margin.left - 6, y: y(tick) + 4, "text-anchor": "end" }, spec.format(tick)),
      );
    }

    spec.points.forEach((point, position) => {
      const top = y(point.value);
      svg.append(
        svgEl("path", {
          class: "col",
          d: roundedColumn(center(position) - columnWidth / 2, top, columnWidth, baseline - top, 4),
        }),
      );
    });

    // One label per year, thinned out when the columns get narrow.
    const yearEvery = Math.max(1, Math.ceil((measure("2000") + 10) / (band * 12)));
    spec.points.forEach((point, position) => {
      const month = state.meta.threads[point.index].m;
      const year = Number(month.slice(0, 4));
      if (month.endsWith("-01") && year % yearEvery === 0) {
        svg.append(svgEl("text", { x: center(position), y: height - 5, "text-anchor": "middle" }, String(year)));
      }
    });

    // Direct labels on the few points worth reading without hovering.
    const placed = [];
    for (const position of spec.annotate) {
      const point = spec.points[position];
      const label = spec.format(point.value);
      const half = measure(label, "value") / 2;
      const x = clamp(center(position), margin.left + half, width - margin.right - half);
      // Sit above every column the label spans, so it never lands on a taller neighbour.
      const covered = spec.points.filter((_, other) => Math.abs(center(other) - x) <= half + columnWidth);
      const labelY = y(Math.max(point.value, ...covered.map((other) => other.value))) - 5;
      if (placed.some((other) => Math.abs(other.x - x) < other.half + half + 6 && Math.abs(other.y - labelY) < 14)) {
        continue;
      }
      placed.push({ x, y: labelY, half });
      svg.append(svgEl("text", { class: "value", x, y: labelY, "text-anchor": "middle" }, label));
    }
  };

  // The pointer only has to be over a column's band, not on the painted column.
  tipsOn(svg, (event) => {
    if (!geometry) return null;
    const box = svg.getBoundingClientRect();
    const position = Math.floor((event.clientX - box.left - geometry.left) / geometry.band);
    if (position < 0 || position >= spec.points.length) return null;
    active = position;
    return describe(position, event.pointerType === "mouse" ? Infinity : event.clientY);
  });

  const select = (position) => {
    if (!geometry) return;
    active = clamp(position, 0, spec.points.length - 1);
    const found = describe(active);
    mark(found.node);
    showTip(found.anchor, found.strong, found.rest, { above: true });
  };
  svg.addEventListener("focus", () => {
    if (svg.matches(":focus-visible")) select(active >= 0 ? active : spec.points.length - 1);
  });
  svg.addEventListener("blur", clearTip);
  svg.addEventListener("keydown", (event) => {
    const moves = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: spec.points.length - 1 };
    if (!(event.key in moves)) return;
    event.preventDefault();
    select(moves[event.key]);
  });
  new ResizeObserver(draw).observe(svg);
}

/** A filled silhouette of a series, for a tile. Decorative: the tile states the number. */
function sparkline(values, max) {
  const step = 100 / (values.length - 1);
  const points = values.map((value, i) => `${(i * step).toFixed(1)},${(22 - (20 * value) / max).toFixed(1)}`);
  const svg = svgEl("svg", { class: "spark", viewBox: "0 0 100 22", preserveAspectRatio: "none", "aria-hidden": "true" });
  svg.append(svgEl("path", { d: `M0,22L${points.join("L")}L100,22Z` }));
  return svg;
}

/** The headline numbers. The two with a series open the full chart below when pressed. */
function renderTiles() {
  const { threads, totals } = state.meta;
  const newest = threads.length - 1;
  const posts = threads.map((thread, index) => ({ index, value: thread.posts, extra: companies(thread.companies) }));
  const peak = posts.reduce((best, point, position) => (point.value > posts[best].value ? position : best), 0);
  const repeat = threads
    .map((thread, index) => ({ index, value: thread.repeat === null ? null : Math.round(thread.repeat * 100) }))
    .filter((point) => point.value !== null);
  const charts = [
    {
      label: `Posts in ${monthLabel(newest)}`,
      value: number(threads[newest].posts),
      spec: {
        title: "Posts per month",
        note: "top-level comments in each monthly thread",
        unit: "posts",
        points: posts,
        max: niceMax(posts[peak].value),
        format: number,
        annotate: [posts.length - 1, peak],
      },
    },
    {
      label: "Also posted the month before",
      value: repeat.length ? `${repeat[repeat.length - 1].value}%` : "–",
      spec: {
        title: "Also posted the month before",
        note: "share of the companies in each month's thread",
        unit: "share",
        points: repeat,
        max: 100,
        format: (value) => `${value}%`,
        annotate: [repeat.length - 1],
      },
    },
  ];

  const panel = $("tile-panel");
  let open = -1;
  const buttons = charts.map((chart, position) => {
    const button = el(
      "button",
      { className: "tile", type: "button", "aria-expanded": "false", "aria-controls": "tile-panel" },
      el("span", { className: "label" }, chart.label, " ", el("span", { "aria-hidden": "true" }, "▾")),
      el("span", { className: "value" }, chart.value),
      sparkline(chart.spec.points.map((point) => point.value), chart.spec.max),
    );
    button.addEventListener("click", () => {
      open = open === position ? -1 : position;
      buttons.forEach((other, at) => other.setAttribute("aria-expanded", String(at === open)));
      clearTip();
      panel.replaceChildren();
      panel.hidden = open < 0;
      if (open >= 0) columnChart(panel, chart.spec);
    });
    return button;
  });
  $("tiles").replaceChildren(
    ...buttons,
    el(
      "div",
      { className: "tile" },
      el("span", { className: "label" }, `Companies since ${monthLabel(0)}`),
      el("span", { className: "value" }, number(totals.companies)),
      el("span", { className: "label" }, `${number(totals.posts)} posts`),
    ),
  );
}

// --- List ------------------------------------------------------------------

const FILTERS = {
  now: { sort: "run", test: (row) => row.run > 0 },
  same: { sort: "same", test: (row) => row.same >= state.meta.thresholds.long_run },
  stopped: { sort: "last", test: (row) => row.stopped >= state.meta.thresholds.stopped_min_run },
  new: { sort: "name", test: (row) => row.threads === 1 && row.first === state.meta.threads.length - 1 },
  all: { sort: "run", test: () => true },
};

const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" }) || (a.id < b.id ? -1 : 1);
const SORTS = {
  run: (a, b) => b.run - a.run || b.same - a.same || b.threads - a.threads || byName(a, b),
  same: (a, b) => b.same - a.same || b.run - a.run || byName(a, b),
  threads: (a, b) => b.threads - a.threads || b.run - a.run || byName(a, b),
  last: (a, b) => b.last - a.last || b.stopped - a.stopped || b.run - a.run || byName(a, b),
  name: byName,
};

function listHash(list) {
  const params = new URLSearchParams();
  if (list.filter !== "now") params.set("f", list.filter);
  if (list.sort !== FILTERS[list.filter].sort) params.set("s", list.sort);
  if (list.query) params.set("q", list.query);
  const text = params.toString();
  return text ? `#${text}` : "#";
}

/** How a company stands now, in words: {num, unit, note}. Used by the list and the company page. */
function standing(row) {
  if (row.run === 0) {
    return {
      num: "",
      unit: `last ${monthLabel(row.last)}`,
      note: row.stopped >= 2 ? `after ${row.stopped} months in a row` : "",
    };
  }
  let unit = "months in a row";
  if (row.run === 1) unit = row.threads === 1 ? "month, first post" : "month";
  let note = "";
  if (row.same >= 2) note = `same text for the last ${row.same}`;
  else if (row.sim !== null) note = `text changed last time (${row.sim}% same)`;
  return { num: String(row.run), unit, note };
}

function nowCell(row) {
  const { num, unit, note } = standing(row);
  const big = el("div", { className: "big" });
  if (num) big.append(el("span", { className: "num" }, num), " ");
  big.append(el("span", { className: "unit" }, unit));
  const cell = el("td", { className: "now" }, big);
  if (note) cell.append(el("div", { className: "sub" }, note));
  return cell;
}

function listRow(row) {
  const total = state.meta.threads.length;
  const where =
    row.threads === 1
      ? `one post · ${monthLabel(row.first)}`
      : `since ${monthLabel(row.first)} · in ${row.threads} of ${total} months`;
  return el(
    "tr",
    { dataset: { id: row.id } },
    el(
      "td",
      { className: "who" },
      el("a", { className: "name", href: `#c=${encodeURIComponent(row.id)}` }, row.name),
      el("div", { className: "sub" }, where),
    ),
    el("td", { className: "strip-cell" }, strip(row)),
    nowCell(row),
  );
}

function countLine(count, list) {
  const { thresholds, threads } = state.meta;
  const newest = monthLabel(threads.length - 1);
  const about = {
    now: " posting now",
    same: ` have posted nearly the same text ${thresholds.long_run} or more months in a row`,
    stopped: ` posted ${thresholds.stopped_min_run} or more months in a row and are not in ${newest}`,
    new: ` posted for the first time in ${newest}`,
    all: ` since ${monthLabel(0)}`,
  }[list.filter];
  return `${companies(count)}${about}${list.query ? `, matching “${list.query}”` : ""}`;
}

function renderList() {
  const list = state.list;
  const query = list.query.trim().toLowerCase();
  const rows = state.rows
    .filter(FILTERS[list.filter].test)
    .filter((row) => !query || row.name.toLowerCase().includes(query) || row.id.includes(query))
    .sort(SORTS[list.sort]);
  const shown = rows.slice(0, list.pages * PAGE_SIZE);
  const body = $("rows");
  clearTip();
  body.replaceChildren(...shown.map(listRow));
  if (!rows.length) {
    body.append(el("tr", { className: "empty-row" }, el("td", { className: "empty", colSpan: 3 }, "Nothing matches.")));
  }
  $("count").textContent = countLine(rows.length, list);
  $("more").parentElement.hidden = shown.length >= rows.length;
  $("more").textContent = `More (${number(rows.length - shown.length)} left)`;
  document.querySelectorAll("#sort a").forEach((link) => {
    const on = link.dataset.sort === list.sort;
    link.classList.toggle("on", on);
    if (on) link.setAttribute("aria-current", "true");
    else link.removeAttribute("aria-current");
  });
  if ($("q").value !== list.query) $("q").value = list.query;
}

/** Change the list without adding a history entry: typing and sorting are not pages. */
function updateList(change) {
  state.list = { ...state.list, ...change, pages: 1 };
  history.replaceState(null, "", listHash(state.list));
  state.lastListHash = location.hash;
  markFilter(state.list.filter);
  renderList();
}

function markFilter(current) {
  document.querySelectorAll("#filters a").forEach((link) => {
    const on = link.dataset.view === current;
    link.classList.toggle("on", on);
    if (on) {
      link.setAttribute("aria-current", "page");
      link.scrollIntoView({ block: "nearest", inline: "nearest" }); // the row of filters scrolls on a phone
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

/** Grey bars where the rows will be, while the company list downloads. */
function showSkeleton() {
  const bar = (width) => el("div", { style: `width:${width}%` });
  $("rows").replaceChildren(
    ...[62, 48, 70, 55, 66, 44].map((width) =>
      el("tr", { className: "skeleton" }, el("td", { colSpan: 3 }, bar(width), bar(100), bar(width / 2))),
    ),
  );
  $("count").textContent = "Loading companies…";
  $("more").parentElement.hidden = true;
}

function setupList() {
  const { threads, strip_len: stripLength } = state.meta;
  $("strip-from").textContent = monthLabel(Math.max(0, threads.length - stripLength));
  $("strip-to").textContent = monthLabel(threads.length - 1);

  // The strips answer to a finger or a mouse, which nothing on screen gives away:
  // say so until the visitor has done it once.
  const hint = el("span", { id: "hint" }, "· touch or hover a square for its month");
  $("legend").replaceChildren(...legend(`last ${stripLength} months:`), hint);
  try {
    hint.hidden = localStorage.getItem("strip-hint") === "seen";
  } catch {
    // Storage can be blocked; the hint then simply stays.
  }

  document.querySelectorAll("#filters a").forEach((link) => {
    link.querySelector("span").textContent = number(state.rows.filter(FILTERS[link.dataset.view].test).length);
  });

  let timer = 0;
  $("q").addEventListener("input", (event) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const query = event.target.value;
      // A search looks through every company, not only the ones posting now.
      const filter = query && state.list.filter === "now" ? "all" : state.list.filter;
      updateList({ query, filter });
    }, 120);
  });
  $("controls").addEventListener("submit", (event) => {
    event.preventDefault();
    $("q").blur(); // closes the on-screen keyboard
  });
  $("sort").addEventListener("click", (event) => {
    const link = event.target.closest("a[data-sort]");
    if (!link) return;
    event.preventDefault();
    updateList({ sort: link.dataset.sort });
  });
  $("more").addEventListener("click", (event) => {
    event.preventDefault();
    state.list.pages += 1;
    renderList();
  });

  // The whole row opens the company, except the strip, which shows months.
  $("rows").addEventListener("click", (event) => {
    if (event.target.closest("a, .strip")) return;
    const row = event.target.closest("tr[data-id]");
    if (row) location.hash = `c=${encodeURIComponent(row.dataset.id)}`;
  });

  // One listener serves every strip in the list.
  tipsOn($("rows"), (event) => {
    const cell = under(event, "#rows .strip i");
    if (!cell) return null;
    const row = state.byId.get(cell.closest("tr").dataset.id);
    const offset = Number(cell.dataset.offset);
    const index = threads.length - row.strip.length + offset;
    if (!hint.hidden && hint.style.visibility !== "hidden") {
      // Hidden without giving up its space: the rows must not move under the finger.
      hint.style.visibility = "hidden";
      try {
        localStorage.setItem("strip-hint", "seen");
      } catch {
        // Not remembered, then.
      }
    }
    return {
      node: cell,
      anchor: cell.getBoundingClientRect(),
      strong: index >= 0 ? monthLabel(index) : "",
      rest: describeCode(row.strip[offset]),
    };
  });
}

// --- Company page ----------------------------------------------------------

async function loadShard(id) {
  const shard = shardOf(id);
  if (!state.shards.has(shard)) {
    state.shards.set(
      shard,
      fetch(`data/c/${shard}.json`).then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      }),
    );
  }
  return (await state.shards.get(shard))[id];
}

/** HN comment HTML to plain text, the same way the pipeline does it. */
function htmlToText(markup) {
  const out = [];
  const walk = (parent) => {
    for (const node of parent.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) out.push(node.nodeValue);
      if (node.nodeType !== Node.ELEMENT_NODE) continue;
      const tag = node.tagName;
      if (tag === "P" || tag === "PRE") out.push("\n\n");
      if (tag === "BR") out.push("\n");
      if (tag === "A") {
        const href = (node.getAttribute("href") ?? "").trim();
        const label = node.textContent;
        const isLink = /^https?:\/\//i.test(href);
        out.push(isLink && (/^https?:\/\//i.test(label) || !label.trim()) ? href : label);
      } else {
        walk(node);
      }
      if (tag === "P" || tag === "PRE") out.push("\n\n");
    }
  };
  walk(new DOMParser().parseFromString(markup, "text/html").body);
  return out
    .join("")
    .replace(/\r/g, "")
    .replace(/ /g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The text of a post, fetched from HN, or null if it is gone. */
function fetchPost(id) {
  if (!state.posts.has(id)) {
    state.posts.set(
      id,
      (async () => {
        for (const [address, pick] of POST_SOURCES) {
          try {
            const response = await fetch(address(id));
            if (!response.ok) continue;
            const markup = pick(await response.json());
            if (markup) return htmlToText(markup);
          } catch {
            // Try the next source.
          }
        }
        return null;
      })(),
    );
  }
  return state.posts.get(id);
}

async function renderDiff(panel, current, previous, previousLabel) {
  panel.replaceChildren("Fetching both posts from HN…");
  const [now, before] = await Promise.all(
    [current, previous].map((ids) => Promise.all(ids.slice(0, MAX_POSTS_PER_SIDE).map(fetchPost))),
  );
  const earlier = before.filter(Boolean);
  const later = now.filter(Boolean);
  if (!earlier.length || !later.length) {
    panel.replaceChildren("Could not fetch both posts from HN. They may have been removed.");
    return;
  }
  panel.replaceChildren();
  later.forEach((text, position) => {
    // A company can post several times in a thread: compare with the closest earlier post.
    const base = earlier.reduce((best, other) => (similarity(other, text) > similarity(best, text) ? other : best));
    const result = diffWords(base, text);
    const which = later.length > 1 ? `Post ${position + 1}: ` : "";
    const against = earlier.length > 1 ? `closest ${previousLabel} post` : `${previousLabel} post`;
    if (result.parts.every((part) => part.type === "same")) {
      panel.append(el("div", { className: "sub" }, `${which}No changes: word for word the same as the ${against}.`));
      return;
    }
    const body = el("p", { className: "text" });
    result.parts.forEach((part, at) => {
      if (part.type === "same") return body.append(part.text);
      // Keep a removed word from running into the word that replaced it.
      const before = result.parts[at - 1];
      if (part.type === "ins" && before?.type === "del" && !/\s$/.test(before.text)) body.append(" ");
      body.append(el(part.type, {}, part.text));
    });
    panel.append(
      el(
        "div",
        { className: "sub" },
        `${which}${percent(result.ratio)} the same as the ${against} · `,
        el("del", {}, "removed"),
        " ",
        el("ins", {}, "added"),
      ),
      body,
    );
  });
}

function calendar(detail, row) {
  const threads = state.meta.threads;
  const cells = new Map(detail.t.map((entry) => [entry[0], entry]));
  const indexOf = new Map(threads.map((thread, index) => [thread.m, index]));
  const grid = el("div", { className: "calendar", role: "img" });
  grid.setAttribute("aria-label", `Posted in ${row.threads} of ${threads.length} months. The list below has every post.`);
  grid.append(el("span"));
  for (const month of MONTHS) grid.append(el("span", { className: "month", "aria-hidden": "true" }, month[0]));
  const firstYear = Number(threads[0].m.slice(0, 4));
  const lastYear = Number(threads[threads.length - 1].m.slice(0, 4));
  for (let year = firstYear; year <= lastYear; year++) {
    grid.append(el("span", { className: "year" }, String(year)));
    for (let month = 1; month <= 12; month++) {
      const index = indexOf.get(`${year}-${String(month).padStart(2, "0")}`);
      if (index === undefined) {
        grid.append(el("i", { className: "off" }));
        continue;
      }
      const entry = cells.get(index);
      let cls = "";
      if (entry) cls = entry[2] === null ? (index === row.first ? "first" : "s1") : cellClass(entry[2]);
      grid.append(el("i", { className: cls, dataset: { index } }));
    }
  }
  // The caption repeats what the tooltip says, so the month stays readable after the finger lifts.
  const caption = el("p", { className: "cal-caption sub" }, "Touch or hover a square to see the month.");
  tipsOn(grid, (event) => {
    const cell = under(event, ".calendar i[data-index]");
    if (!cell || !grid.contains(cell)) return null;
    const index = Number(cell.dataset.index);
    const entry = cells.get(index);
    let text = "no post";
    if (entry) text = entry[2] === null ? "first post" : `${entry[2]}% the same as the previous post`;
    caption.textContent = `${monthLabel(index)}: ${text}`;
    return { node: cell, anchor: cell.getBoundingClientRect(), strong: monthLabel(index), rest: text };
  });
  return el("div", { className: "calendar-wrap" }, grid, caption, el("div", { className: "legend" }, ...legend()));
}

/** Roles, place and pay of one month, as one line of text. */
function factsLine(entry) {
  const [, , , roles, location, remote, pay] = entry;
  const policy = remote && !new RegExp(remote, "i").test(location ?? "") ? remote : "";
  return [roles.join(", "), location, policy, pay].filter(Boolean).join(" · ");
}

function historyItem(entry, previous) {
  const [index, ids, similar] = entry;
  let compared = "first post";
  if (previous) compared = similar === null ? "not compared" : `${similar}% the same as ${monthLabel(previous[0])}`;
  const item = el("li", {}, el("div", { className: "when" }, el("b", {}, monthLabel(index)), ` · ${compared}`));
  const line = factsLine(entry);
  if (line) item.append(el("div", { className: "facts-line" }, line));

  const actions = el("div", { className: "actions" });
  ids.forEach((id, position) => {
    const label = ids.length > 1 ? `post ${position + 1} on HN` : "post on HN";
    actions.append(el("a", { href: HN_ITEM + id, rel: "noopener" }, label));
  });
  item.append(actions);

  if (previous) {
    const panel = el("div", { className: "diff", hidden: true });
    const label = `compare with ${monthLabel(previous[0])}`;
    const button = el("button", { className: "link", type: "button", "aria-expanded": "false" }, label);
    let loaded = false;
    button.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
      button.textContent = panel.hidden ? label : "hide comparison";
      if (!loaded) {
        loaded = true;
        renderDiff(panel, ids, previous[1], monthLabel(previous[0]));
      }
    });
    actions.append(button);
    item.append(panel);
  }
  return item;
}

/** Several months in a row with the same text and roles, folded into one entry. */
function historyRun(entries, from, to) {
  const count = to - from + 1;
  const item = el(
    "li",
    { className: "run" },
    el(
      "div",
      { className: "when" },
      el("b", {}, `${monthLabel(entries[from][0])} – ${monthLabel(entries[to][0])}`),
      ` · ${count} months, same text as ${monthLabel(entries[from - 1][0])}`,
    ),
  );
  const line = factsLine(entries[to]);
  if (line) item.append(el("div", { className: "facts-line" }, line));
  const inner = el("ol", { className: "history", reversed: true, hidden: true });
  const label = `show all ${count}`;
  const button = el("button", { className: "link", type: "button", "aria-expanded": "false" }, label);
  button.addEventListener("click", () => {
    if (!inner.childElementCount) {
      for (let at = to; at >= from; at--) inner.append(historyItem(entries[at], entries[at - 1]));
    }
    inner.hidden = !inner.hidden;
    button.setAttribute("aria-expanded", String(!inner.hidden));
    button.textContent = inner.hidden ? label : "show fewer";
  });
  item.append(el("div", { className: "actions" }, button), inner);
  return item;
}

function historyList(detail) {
  const entries = detail.t;
  const same = Math.round(state.meta.thresholds.same_text * 100);
  const repeats = (at) =>
    entries[at][2] !== null &&
    entries[at][2] >= same &&
    entries[at][0] === entries[at - 1][0] + 1 &&
    entries[at][3].join("|") === entries[at - 1][3].join("|");
  const items = [];
  let at = 0;
  while (at < entries.length) {
    let end = at + 1;
    while (end < entries.length && repeats(end)) end++;
    // entries[at] starts a stretch; at+1 .. end-1 repeat it.
    items.push(historyItem(entries[at], at ? entries[at - 1] : null));
    if (end - 1 - at >= 3) items.push(historyRun(entries, at + 1, end - 1));
    else for (let one = at + 1; one < end; one++) items.push(historyItem(entries[one], entries[one - 1]));
    at = end;
  }
  return el("ol", { className: "history", reversed: true }, ...items.reverse());
}

function shareButton() {
  const button = el("button", { className: "chip", type: "button" }, "Share");
  button.addEventListener("click", async () => {
    const url = location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: document.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      button.textContent = "Link copied";
    } catch (error) {
      if (error?.name === "AbortError") return; // the share sheet was closed
      button.textContent = "Copy the address bar";
    }
    setTimeout(() => (button.textContent = "Share"), 2500);
  });
  return button;
}

async function renderCompany(id) {
  const view = $("view-company");
  const row = state.byId.get(id);
  const back = el("p", { className: "back" }, el("a", { href: state.lastListHash || "#" }, "← all companies"));
  if (!row) {
    view.replaceChildren(back, el("p", {}, "No company with this address. It may have been merged into another one."));
    return;
  }
  document.title = `${row.name} – Still Hiring?`;
  view.replaceChildren(back, el("p", { className: "sub" }, "Loading…"));
  let detail;
  try {
    detail = await loadShard(id);
  } catch {
    detail = null;
  }
  if (!detail) {
    view.replaceChildren(back, el("p", {}, "Could not load this company's history."));
    return;
  }

  const total = state.meta.threads.length;
  const { num, unit, note } = standing(row);
  const hero = el("div", { className: "hero" });
  if (num) hero.append(el("span", { className: "num" }, num));
  hero.append(el("span", {}, num ? unit : `Not in ${monthLabel(total - 1)}, ${unit}`));

  const facts = [note, row.longest > row.run && row.longest > row.stopped ? `longest run: ${row.longest} months` : ""];
  const actions = el("div", { className: "company-actions" });
  for (const domain of detail.d.filter((name) => /^[a-z0-9.-]+$/.test(name)).slice(0, 2)) {
    actions.append(el("a", { className: "chip", href: `https://${domain}`, rel: "noopener" }, domain));
  }
  actions.append(shareButton());

  const header = [
    back,
    el("h1", {}, detail.n),
    el(
      "p",
      { className: "sub" },
      `since ${monthLabel(row.first)} · in ${row.threads} of ${total} months · last ${monthLabel(row.last)}`,
    ),
    hero,
  ];
  const line = facts.filter(Boolean).join(" · ");
  if (line) header.push(el("p", { className: "facts sub" }, line));
  header.push(actions);
  if (detail.names.length > 1) {
    const spellings = detail.names.map(([spelling, count]) => `${spelling} (${count})`).join(", ");
    header.push(el("p", { className: "sub" }, `Written as: ${spellings}`));
  }
  view.replaceChildren(...header, calendar(detail, row), historyList(detail));
}

// --- Routing ---------------------------------------------------------------

function show(name) {
  for (const view of ["list", "company", "about"]) $(`view-${view}`).hidden = view !== name;
  clearTip();
}

function route() {
  const hash = location.hash;
  const raw = hash.slice(1);
  if (!$("view-list").hidden) {
    state.remembered.set(state.lastListHash, { pages: state.list.pages, scroll: window.scrollY });
  }
  const about = document.querySelector('#top a[data-view="about"]');
  about.classList.toggle("on", raw === "about");

  if (raw === "about") {
    document.title = "About – Still Hiring?";
    show("about");
    window.scrollTo(0, 0);
    return;
  }
  const params = new URLSearchParams(raw);
  if (params.has("c")) {
    show("company");
    window.scrollTo(0, 0);
    renderCompany(params.get("c"));
    return;
  }

  const filter = params.get("f") in FILTERS ? params.get("f") : "now";
  const sort = params.get("s") in SORTS ? params.get("s") : FILTERS[filter].sort;
  const remembered = state.remembered.get(hash);
  state.list = { filter, sort, query: params.get("q") ?? "", pages: remembered?.pages ?? 1 };
  state.lastListHash = hash;
  document.title = "Still Hiring? – who keeps posting in HN “Who is hiring?”";
  show("list");
  markFilter(filter);
  renderList();
  window.scrollTo(0, remembered?.scroll ?? 0);
}

function setupAbout() {
  const { thresholds, strip_len: stripLength, threads } = state.meta;
  const first = threads[0].m;
  const long = new Date(Date.UTC(Number(first.slice(0, 4)), Number(first.slice(5)) - 1, 1));
  const values = {
    "first-month": long.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" }),
    "open-days": thresholds.open_days,
    "same-text": Math.round(thresholds.same_text * 100),
    "long-run": thresholds.long_run,
    "stopped-run": thresholds.stopped_min_run,
    "strip-len": stripLength,
  };
  document.querySelectorAll("[data-meta]").forEach((node) => {
    node.textContent = String(values[node.dataset.meta]);
  });

  const repository = document.querySelector('meta[name="repository"]')?.content.trim() ?? "";
  if (/^https:\/\/[\w.-]+\/[\w./-]+$/.test(repository)) {
    $("repo-links").append(" | ", el("a", { href: repository, rel: "noopener" }, "source"));
    $("corrections").replaceChildren(
      "If a company is split in two, merged with another one or misnamed, please ",
      el("a", { href: `${repository.replace(/\/$/, "")}/issues`, rel: "noopener" }, "open an issue"),
      ". Fixes go into a public overrides file and take effect with the next daily build.",
    );
  }
}

async function load(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function failed(error) {
  $("status").hidden = false;
  $("status").textContent =
    "Could not load the data. If you are running this yourself, build it first: python -m stillhiring build";
  $("view-list").hidden = true;
  console.error(error);
}

async function start() {
  // The small file first: the headline numbers show while the company list downloads.
  const pending = load("data/companies.json");
  pending.catch(() => {}); // reported below, once awaited
  try {
    state.meta = await load("data/meta.json");
  } catch (error) {
    return failed(error);
  }
  $("status").hidden = true;
  const built = new Date(state.meta.built_at);
  $("updated").textContent = `updated ${built.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}`;
  renderTiles();
  setupAbout();
  const raw = location.hash.slice(1);
  if (raw !== "about" && !new URLSearchParams(raw).has("c")) {
    showSkeleton();
    show("list");
  }
  $("to-contact").addEventListener("click", (event) => {
    event.preventDefault();
    $("foot").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  try {
    const { rows } = await pending;
    const columns = state.meta.columns;
    state.rows = rows.map((values) => Object.fromEntries(columns.map((name, i) => [name, values[i]])));
    state.byId = new Map(state.rows.map((row) => [row.id, row]));
  } catch (error) {
    return failed(error);
  }
  setupList();
  window.addEventListener("hashchange", route);
  // A tooltip opened by touch stays until the finger goes elsewhere or the page moves.
  window.addEventListener("scroll", clearTip, { passive: true });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest?.("[data-tips]")) clearTip();
  });
  route();
}

start();
