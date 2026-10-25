(() => {
  "use strict";

  const MAP_NAMES = { rect: "Прямоугольник", classic: "Классический", random: "Произвольный" };
  const DIFF_NAMES = { easy: "Лёгкий", medium: "Средний", hard: "Сложный" };

  const BLUE = "#2563eb";
  const RED = "#dc2626";
  const PLAYER_COLORS = { 1: BLUE, 2: RED };

  const AI_DELAY = 600;
  const AI_CHAIN_DELAY = 300;
  const AUTO_STEP_DELAY = 120;

  // ---------- DOM ----------

  const $ = (id) => document.getElementById(id);

  const boardEl = $("board");
  const scoreEls = { 1: $("score1"), 2: $("score2") };
  const timeEls = { 1: $("time1"), 2: $("time2") };
  const cardEls = { 1: $("card1"), 2: $("card2") };
  const nameEls = { 1: $("name1"), 2: $("name2") };
  const tagEls = { 1: $("tag1"), 2: $("tag2") };
  const leftEl = $("leftCells");
  const midCapEl = $("midCap");

  const resultEl = $("result");
  const resultTitleEl = $("resultTitle");
  const resultScoreEl = $("resultScore");
  const resultTimeEl = $("resultTime");
  const aboutEl = $("about");
  const aboutBtn = $("aboutBtn");
  const aboutClose = $("aboutClose");
  const aboutCloseTop = $("aboutCloseTop");

  const startEl = $("start");
  const wizardStepLabel = $("wizardStepLabel");
  const wizardDots = $("wizardDots");
  const wizardMapInfo = $("wizardMapInfo");
  const stepPanels = [...document.querySelectorAll(".wizard__panel")];
  const startGameBtn = $("startGameBtn");

  const modePicks = [...document.querySelectorAll(".pick[data-mode]")];
  const mapPicks = [...document.querySelectorAll(".pick[data-map]")];
  const difficultyPicks = [...document.querySelectorAll(".pick[data-difficulty]")];
  const backBtns = [...document.querySelectorAll("[data-back]")];

  const mapPicker = $("mapPicker");
  const rectSizePicker = $("rectSizePicker");
  const sizeGrid = $("sizeGrid");
  const sizeLabel = $("sizeLabel");
  const sizeCount = $("sizeCount");
  const sizeHint = $("sizeHint");
  const sizeNext = $("sizeNext");
  const sizeBack = $("sizeBack");

  const badgeEl = $("badge");
  const subtitleEl = $("subtitle");

  const gameBar = $("gameBar");
  const chipMap = $("chipMap");
  const chipMode = $("chipMode");
  const chipDifficulty = $("chipDifficulty");
  const exitGameBtn = $("exitGame");

  const footerActions = $("footerActions");

  const resultExit = $("resultExit");

  const wizardDotsEls = [...wizardDots.children];

  // ---------- Состояние ----------

  let mapKind = "rect";
  let difficulty = "easy";
  let mode = null; // null | "pvp" | "ai"
  let pendingMode = null;

  let easyRows = 10;
  let easyCols = 10;

  let mapBoard = null; // выбранная карта (контур)
  let state = null;

  let cellEls = [];
  let edgeEls = [];
  let edgeMap = new Map();

  let autoFilling = false;
  let aiTimer = 0;
  let bonusTimer = 0;
  let endTimer = 0;
  let autoTimer = 0;

  let clockEnabled = false;
  let clockTimes = { 1: 0, 2: 0 };
  let clockStartedAt = 0;
  let clockInterval = 0;

  let sizeDragging = false;
  let sizeStart = null;
  let sizeEnd = null;
  let sizeCandidate = null;

  // ---------- Утилиты ----------

  function randInt(n) {
    return Math.floor(Math.random() * n);
  }

  function pick(arr) {
    return arr[randInt(arr.length)];
  }

  function cellWord(n) {
    const d = n % 10;
    const dd = n % 100;
    if (d === 1 && dd !== 11) return "клетка";
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "клетки";
    return "клеток";
  }

  function grayWord(n) {
    const d = n % 10;
    const dd = n % 100;
    if (d === 1 && dd !== 11) return "серая";
    if (d >= 2 && d <= 4 && (dd < 12 || dd > 14)) return "серые";
    return "серых";
  }

  function at(mask, r, c) {
    return r >= 0 && r < mask.length && c >= 0 && c < mask[0].length && mask[r][c];
  }

  function randomTurn() {
    return Math.random() < 0.5 ? 1 : 2;
  }

  // ---------- Формы карт ----------

  function fullMask(rows, cols) {
    return Array.from({ length: rows }, () => new Array(cols).fill(true));
  }

  function diamondMask() {
    const lens = [3, 5, 7, 9, 11, 11, 11, 9, 7, 5, 3];
    const cols = 11;
    return lens.map((len) => {
      const row = new Array(cols).fill(false);
      const start = (cols - len) / 2;
      for (let i = 0; i < len; i++) row[start + i] = true;
      return row;
    });
  }

  function fallbackHardMask() {
    return Math.random() < 0.5
      ? Array.from({ length: 10 }, () => new Array(8).fill(true))
      : Array.from({ length: 8 }, () => new Array(10).fill(true));
  }

  function normalizeMask(mask) {
    let minR = Infinity;
    let maxR = -1;
    let minC = Infinity;
    let maxC = -1;

    for (let r = 0; r < mask.length; r++) {
      for (let c = 0; c < mask[r].length; c++) {
        if (!mask[r][c]) continue;
        if (r < minR) minR = r;
        if (r > maxR) maxR = r;
        if (c < minC) minC = c;
        if (c > maxC) maxC = c;
      }
    }

    if (maxR === -1) return null;

    const out = [];
    for (let r = minR; r <= maxR; r++) out.push(mask[r].slice(minC, maxC + 1));
    return out;
  }

  function hasHole(mask) {
    const rows = mask.length;
    const cols = mask[0].length;
    const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
    const queue = [];

    const push = (r, c) => {
      if (r < 0 || r >= rows || c < 0 || c >= cols) return;
      if (mask[r][c] || seen[r][c]) return;
      seen[r][c] = true;
      queue.push([r, c]);
    };

    for (let r = 0; r < rows; r++) {
      push(r, 0);
      push(r, cols - 1);
    }
    for (let c = 0; c < cols; c++) {
      push(0, c);
      push(rows - 1, c);
    }

    for (let i = 0; i < queue.length; i++) {
      const [r, c] = queue[i];
      push(r - 1, c);
      push(r + 1, c);
      push(r, c - 1);
      push(r, c + 1);
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!mask[r][c] && !seen[r][c]) return true;
      }
    }
    return false;
  }

  function hasThinCell(mask) {
    const rows = mask.length;
    const cols = mask[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!mask[r][c]) continue;
        let neighbours = 0;
        if (at(mask, r - 1, c)) neighbours++;
        if (at(mask, r + 1, c)) neighbours++;
        if (at(mask, r, c - 1)) neighbours++;
        if (at(mask, r, c + 1)) neighbours++;
        if (neighbours < 2) return true;
      }
    }
    return false;
  }

  function growMask(target) {
    const grid = Array.from({ length: 10 }, () => new Array(10).fill(false));
    grid[randInt(10)][randInt(10)] = true;
    let count = 1;

    while (count < target) {
      const candidates = [];
      let totalWeight = 0;

      for (let r = 0; r < 10; r++) {
        for (let c = 0; c < 10; c++) {
          if (grid[r][c]) continue;

          let neighbours = 0;
          if (r > 0 && grid[r - 1][c]) neighbours++;
          if (r < 9 && grid[r + 1][c]) neighbours++;
          if (c > 0 && grid[r][c - 1]) neighbours++;
          if (c < 9 && grid[r][c + 1]) neighbours++;
          if (!neighbours) continue;

          const weight = neighbours * neighbours;
          candidates.push({ r, c, weight });
          totalWeight += weight;
        }
      }

      if (!candidates.length) return null;

      let ticket = Math.random() * totalWeight;
      let chosen = candidates[candidates.length - 1];
      for (const cand of candidates) {
        ticket -= cand.weight;
        if (ticket <= 0) {
          chosen = cand;
          break;
        }
      }

      grid[chosen.r][chosen.c] = true;
      count++;
    }

    return normalizeMask(grid);
  }

  function generateRandomShape() {
    for (let attempt = 0; attempt < 250; attempt++) {
      const target = 65 + randInt(21);
      const mask = growMask(target);
      if (!mask) continue;
      if (hasHole(mask)) continue;
      if (hasThinCell(mask)) continue;
      return mask;
    }
    return fallbackHardMask();
  }

  // ---------- Рёбра, контур ----------

  function hEdgeCells(present, r, c) {
    const rows = present.length;
    const cells = [];
    if (r > 0 && present[r - 1][c]) cells.push([r - 1, c]);
    if (r < rows && present[r][c]) cells.push([r, c]);
    return cells;
  }

  function vEdgeCells(present, r, c) {
    const cols = present[0].length;
    const cells = [];
    if (c > 0 && present[r][c - 1]) cells.push([r, c - 1]);
    if (c < cols && present[r][c]) cells.push([r, c]);
    return cells;
  }

  function edgeCellsOf(present, type, r, c) {
    return type === "h" ? hEdgeCells(present, r, c) : vEdgeCells(present, r, c);
  }

  function buildContour(present) {
    const rows = present.length;
    const cols = present[0].length;

    const existsH = Array.from({ length: rows + 1 }, () => new Array(cols).fill(false));
    const existsV = Array.from({ length: rows }, () => new Array(cols + 1).fill(false));
    const givenH = Array.from({ length: rows + 1 }, () => new Array(cols).fill(false));
    const givenV = Array.from({ length: rows }, () => new Array(cols + 1).fill(false));
    const counts = Array.from({ length: rows }, () => new Array(cols).fill(0));

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        const up = r > 0 && present[r - 1][c];
        const down = r < rows && present[r][c];
        if (!up && !down) continue;
        existsH[r][c] = true;
        if (up !== down) {
          givenH[r][c] = true;
          if (up) counts[r - 1][c] += 1;
          else counts[r][c] += 1;
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        const left = c > 0 && present[r][c - 1];
        const right = c < cols && present[r][c];
        if (!left && !right) continue;
        existsV[r][c] = true;
        if (left !== right) {
          givenV[r][c] = true;
          if (left) counts[r][c - 1] += 1;
          else counts[r][c] += 1;
        }
      }
    }

    return { rows, cols, existsH, existsV, givenH, givenV, counts };
  }

  function buildMap(kind) {
    const present =
      kind === "classic"
        ? diamondMask()
        : kind === "random"
          ? generateRandomShape()
          : fullMask(easyRows, easyCols);

    const contour = buildContour(present);
    return { kind, present, contour, rows: present.length, cols: present[0].length };
  }

  function mapPreviewState(map) {
    const contour = map.contour;
    const h = contour.givenH.map((row) => row.slice());
    const v = contour.givenV.map((row) => row.slice());
    let total = 0;
    for (const row of map.present) for (const cell of row) if (cell) total++;

    return {
      rows: map.rows,
      cols: map.cols,
      present: map.present,
      gray: Array.from({ length: map.rows }, () => new Array(map.cols).fill(false)),
      existsH: contour.existsH,
      existsV: contour.existsV,
      h,
      v,
      owner: Array.from({ length: map.rows }, () => new Array(map.cols).fill(0)),
      score: { 1: 0, 2: 0 },
      turn: 1,
      filled: 0,
      total,
      grayCount: 0,
      over: false,
      inner: 0,
    };
  }

  // ---------- Выбор серых клеток ----------

  function isInteriorCell(present, r, c) {
    return (
      present[r][c] &&
      at(present, r - 1, c) &&
      at(present, r + 1, c) &&
      at(present, r, c - 1) &&
      at(present, r, c + 1)
    );
  }

  function chooseGrayCells(map, count, baseCounts, baseGivenH, baseGivenV) {
    const present = map.present;
    const rows = map.rows;
    const cols = map.cols;
    const interior = [];

    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (isInteriorCell(present, r, c)) interior.push([r, c]);
      }
    }

    if (interior.length < count) return [];

    for (let i = interior.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [interior[i], interior[j]] = [interior[j], interior[i]];
    }

    const chosen = [];
    const key = (r, c) => r + ":" + c;
    const has = (r, c) => chosen.some(([rr, cc]) => rr === r && cc === c);
    const near = (r, c, dist = 1) =>
      chosen.some(([rr, cc]) => Math.abs(rr - r) <= dist && Math.abs(cc - c) <= dist);

    const sharedEdge = (nr, nc, gr, gc) => {
      if (gr === nr - 1) return ["h", nr, nc];
      if (gr === nr + 1) return ["h", nr + 1, nc];
      if (gc === nc - 1) return ["v", nr, nc];
      return ["v", nr, nc + 1];
    };

    // Серые клетки не должны делать соседнюю игровую клетку
    // «трёхсторонней» с учётом уже нарисованных рёбер.
    const patternOk = (cells) => {
      const newSet = new Set(cells.map(([r, c]) => key(r, c)));

      for (const [r, c] of cells) {
        for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
          if (!at(present, nr, nc)) continue;
          const k = key(nr, nc);
          if (newSet.has(k) || has(nr, nc)) continue;

          let add = 0;
          for (const [ar, ac] of [[nr - 1, nc], [nr + 1, nc], [nr, nc - 1], [nr, nc + 1]]) {
            if (!newSet.has(key(ar, ac)) && !has(ar, ac)) continue;
            const [type, er, ec] = sharedEdge(nr, nc, ar, ac);
            const given = type === "h" ? baseGivenH[er][ec] : baseGivenV[er][ec];
            if (!given) add++;
          }

          if (baseCounts[nr][nc] + add > 2) return false;
        }
      }

      return true;
    };

    const add = (r, c) => {
      if (has(r, c)) return false;
      chosen.push([r, c]);
      return true;
    };

    const single = (avoidNear = true) => {
      const pool = interior.filter(([r, c]) => {
        if (has(r, c)) return false;
        if (avoidNear && near(r, c, 1)) return false;
        return patternOk([[r, c]]);
      });
      if (!pool.length) return false;
      const [r, c] = pick(pool);
      return add(r, c);
    };

    const pair = () => {
      const pool = [];
      for (const [r, c] of interior) {
        if (has(r, c) || near(r, c, 1)) continue;
        for (const [nr, nc] of [[r + 1, c], [r, c + 1]]) {
          if (!at(present, nr, nc) || !isInteriorCell(present, nr, nc)) continue;
          if (has(nr, nc) || near(nr, nc, 1)) continue;
          const cells = [[r, c], [nr, nc]];
          if (!patternOk(cells)) continue;
          pool.push(cells);
        }
      }
      if (!pool.length) return false;
      const [[r1, c1], [r2, c2]] = pick(pool);
      add(r1, c1);
      add(r2, c2);
      return true;
    };

    const corner = () => {
      const pool = [];
      for (const [r, c] of interior) {
        // L из трёх клеток в квадрате 2×2
        for (const [dr, dc] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
          const cells = [
            [r, c],
            [r, c + 1],
            [r + 1, c],
            [r + 1, c + 1],
          ];
          const missing = cells[dr + dc * 2];
          const tri = cells.filter((cell) => cell !== missing);
          if (tri.some(([rr, cc]) => !isInteriorCell(present, rr, cc))) continue;
          if (tri.some(([rr, cc]) => has(rr, cc) || near(rr, cc, 1))) continue;
          if (!patternOk(tri)) continue;
          pool.push(tri);
        }
      }
      if (!pool.length) return false;
      const tri = pick(pool);
      for (const [r, c] of tri) add(r, c);
      return true;
    };

    if (count === 1) {
      single(false);
    } else if (count === 3) {
      if (Math.random() < 0.5) {
        single();
        single();
        single();
      } else {
        single();
        pair();
      }
    } else if (count === 7) {
      corner();
      pair();
      single();
      single();
    }

    // Если паттерн не поместился — добираем одиночными
    let guard = 0;
    while (chosen.length < count && guard < 200) {
      guard++;
      if (!single(false)) break;
    }

    return chosen.slice(0, count);
  }

  // ---------- Предзаполнение по уровню ----------

  function canAdd(present, counts, givenH, givenV, edges) {
    const inc = new Map();

    for (const [type, r, c] of edges) {
      const cells = edgeCellsOf(present, type, r, c);
      if (cells.length !== 2) return false;
      if (type === "h" ? givenH[r][c] : givenV[r][c]) return false;

      for (const [cr, cc] of cells) {
        const key = cr + ":" + cc;
        inc.set(key, (inc.get(key) || 0) + 1);
      }
    }

    for (const [key, n] of inc) {
      const [cr, cc] = key.split(":").map(Number);
      if (counts[cr][cc] + n > 2) return false;
    }

    return true;
  }

  function addEdges(present, counts, givenH, givenV, edges) {
    if (!canAdd(present, counts, givenH, givenV, edges)) return false;

    for (const [type, r, c] of edges) {
      if (type === "h") givenH[r][c] = true;
      else givenV[r][c] = true;

      for (const [cr, cc] of edgeCellsOf(present, type, r, c)) {
        counts[cr][cc] += 1;
      }
    }

    return true;
  }

  function collectZs(present, counts, givenH, givenV) {
    const out = [];
    const rows = present.length;
    const cols = present[0].length;

    for (let r = 1; r <= rows - 2; r++) {
      for (let c = 1; c <= cols - 1; c++) {
        const variants = [
          [["v", r, c], ["h", r, c], ["h", r + 1, c - 1]],
          [["v", r, c], ["h", r, c - 1], ["h", r + 1, c]],
        ];
        for (const edges of variants) {
          if (canAdd(present, counts, givenH, givenV, edges)) out.push(edges);
        }
      }
    }

    for (let r = 1; r <= rows - 1; r++) {
      for (let c = 1; c <= cols - 2; c++) {
        const variants = [
          [["h", r, c], ["v", r - 1, c], ["v", r, c + 1]],
          [["h", r, c], ["v", r, c], ["v", r - 1, c + 1]],
        ];
        for (const edges of variants) {
          if (canAdd(present, counts, givenH, givenV, edges)) out.push(edges);
        }
      }
    }

    return out;
  }

  function collectGs(present, counts, givenH, givenV) {
    const out = [];
    const rows = present.length;
    const cols = present[0].length;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!present[r][c]) continue;
        if (!at(present, r - 1, c)) continue;
        if (!at(present, r + 1, c)) continue;
        if (!at(present, r, c - 1)) continue;
        if (!at(present, r, c + 1)) continue;

        const variants = [
          [["h", r, c], ["v", r, c]],
          [["h", r, c], ["v", r, c + 1]],
          [["h", r + 1, c], ["v", r, c]],
          [["h", r + 1, c], ["v", r, c + 1]],
        ];

        for (const edges of variants) {
          if (canAdd(present, counts, givenH, givenV, edges)) out.push(edges);
        }
      }
    }

    return out;
  }

  function collectSingles(present, contour, counts, givenH, givenV) {
    const out = [];
    const rows = present.length;
    const cols = present[0].length;

    for (let r = 0; r <= rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!contour.existsH[r][c] || givenH[r][c]) continue;
        const edge = [["h", r, c]];
        if (canAdd(present, counts, givenH, givenV, edge)) out.push(edge);
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c <= cols; c++) {
        if (!contour.existsV[r][c] || givenV[r][c]) continue;
        const edge = [["v", r, c]];
        if (canAdd(present, counts, givenH, givenV, edge)) out.push(edge);
      }
    }

    return out;
  }

  function grayCountForMap(map) {
    if (map.kind !== "rect") return 7;
    const area = map.rows * map.cols;
    if (area <= 30) return 1;
    if (area <= 64) return 3;
    return 7;
  }

  function buildGameState(map, diff) {
    const present = map.present;
    const contour = map.contour;
    const rows = map.rows;
    const cols = map.cols;

    const givenH = contour.givenH.map((row) => row.slice());
    const givenV = contour.givenV.map((row) => row.slice());

    const counts = Array.from({ length: rows }, () => new Array(cols).fill(0));
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!present[r][c]) continue;
        counts[r][c] =
          (givenH[r][c] ? 1 : 0) +
          (givenH[r + 1][c] ? 1 : 0) +
          (givenV[r][c] ? 1 : 0) +
          (givenV[r][c + 1] ? 1 : 0);
      }
    }

    let inner = 0;

    if (diff !== "easy") {
      const target = diff === "medium" ? 10 + randInt(5) : 15 + randInt(4);

      if (diff === "hard") {
        for (let i = 0; i < 3; i++) {
          const candidates = collectZs(present, counts, givenH, givenV);
          if (!candidates.length) break;
          const edges = pick(candidates);
          if (!addEdges(present, counts, givenH, givenV, edges)) break;
          inner += edges.length;
        }
        for (let i = 0; i < 3; i++) {
          const candidates = collectGs(present, counts, givenH, givenV);
          if (!candidates.length) break;
          const edges = pick(candidates);
          if (!addEdges(present, counts, givenH, givenV, edges)) break;
          inner += edges.length;
        }
      }

      let guard = 0;
      while (inner < target && guard < 4000) {
        guard++;
        const candidates = collectSingles(present, contour, counts, givenH, givenV);
        if (!candidates.length) break;
        const edges = pick(candidates);
        if (!addEdges(present, counts, givenH, givenV, edges)) break;
        inner += 1;
      }
    }

    const gray = Array.from({ length: rows }, () => new Array(cols).fill(false));

    let grayCount = 0;
    if (diff === "hard") {
      const baseCounts = counts.map((row) => row.slice());
      const baseGivenH = givenH.map((row) => row.slice());
      const baseGivenV = givenV.map((row) => row.slice());
      const cells = chooseGrayCells(
        map,
        grayCountForMap(map),
        baseCounts,
        baseGivenH,
        baseGivenV
      );

      for (const [r, c] of cells) {
        gray[r][c] = true;
        givenH[r][c] = true;
        givenH[r + 1][c] = true;
        givenV[r][c] = true;
        givenV[r][c + 1] = true;
        grayCount++;
      }
    }

    const h = givenH.map((row) => row.slice());
    const v = givenV.map((row) => row.slice());
    const owner = Array.from({ length: rows }, () => new Array(cols).fill(0));
    let total = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!present[r][c]) continue;
        if (gray[r][c]) {
          owner[r][c] = 3;
        } else {
          total += 1;
        }
      }
    }

    return {
      rows,
      cols,
      present,
      gray,
      existsH: contour.existsH,
      existsV: contour.existsV,
      h,
      v,
      owner,
      score: { 1: 0, 2: 0 },
      turn: 1,
      filled: 0,
      total,
      grayCount,
      over: false,
      inner,
    };
  }

  // ---------- Отрисовка ----------

  function createEdge(type, r, c) {
    const edge = document.createElement("div");
    edge.className = "edge edge--" + type;
    edge.dataset.type = type;
    edge.dataset.r = r;
    edge.dataset.c = c;
    edge.style.setProperty("--r", r);
    edge.style.setProperty("--c", c);

    const line = document.createElement("span");
    line.className = "edge__line";
    edge.appendChild(line);
    return edge;
  }

  function renderBoard() {
    boardEl.innerHTML = "";
    boardEl.style.setProperty("--rows", state.rows);
    boardEl.style.setProperty("--cols", state.cols);

    cellEls = Array.from({ length: state.rows }, () => new Array(state.cols).fill(null));
    edgeEls = [];
    edgeMap = new Map();

    const frag = document.createDocumentFragment();

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = document.createElement("div");
        cell.style.setProperty("--r", r);
        cell.style.setProperty("--c", c);
        cell.dataset.r = r;
        cell.dataset.c = c;

        if (state.present[r][c]) {
          if (state.gray && state.gray[r][c]) {
            cell.className = "cell cell--gray";
          } else {
            cell.className = "cell";
            const fill = document.createElement("div");
            fill.className = "cell__fill";
            cell.appendChild(fill);
          }
          cellEls[r][c] = cell;
        } else {
          cell.className = "cell cell--void";
        }

        frag.appendChild(cell);
      }
    }

    for (let r = 0; r <= state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        if (!state.existsH[r][c]) continue;
        const edge = createEdge("h", r, c);
        if (state.h[r][c]) edge.classList.add("is-on", "is-given");
        edgeMap.set("h:" + r + ":" + c, edge);
        edgeEls.push(edge);
        frag.appendChild(edge);
      }
    }

    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c <= state.cols; c++) {
        if (!state.existsV[r][c]) continue;
        const edge = createEdge("v", r, c);
        if (state.v[r][c]) edge.classList.add("is-on", "is-given");
        edgeMap.set("v:" + r + ":" + c, edge);
        edgeEls.push(edge);
        frag.appendChild(edge);
      }
    }

    boardEl.appendChild(frag);
  }

  // ---------- Интерфейс ----------

  function updateNames() {
    const ai = mode === "ai";
    nameEls[1].textContent = ai ? "Вы" : "Игрок 1";
    nameEls[2].textContent = ai ? "ИИ" : "Игрок 2";
    tagEls[1].textContent = "ходит";
    tagEls[2].textContent = ai ? "думает" : "ходит";
  }

  function mapSubtitle() {
    if (mapKind === "rect") {
      return "Прямоугольник " + easyCols + " × " + easyRows;
    }
    if (mapKind === "classic") return "Классический ромб";
    return "Произвольная фигура";
  }

  function updateMapUI() {
    if (!state) return;

    const playable = state.total;
    badgeEl.textContent = playable + " " + cellWord(playable);

    const mapText = mapSubtitle();
    const grayText = state.grayCount
      ? " · " + state.grayCount + " " + grayWord(state.grayCount)
      : "";
    const diffText = mode ? " · уровень «" + DIFF_NAMES[difficulty] + "»" : "";
    subtitleEl.textContent = mapText + " · " + playable + " игровых" + grayText + diffText + ".";

    if (wizardMapInfo) {
      const mapName = MAP_NAMES[mapKind];
      const dims = mapKind === "rect" ? " " + easyCols + " × " + easyRows : "";
      wizardMapInfo.textContent = mapName + dims + " · " + playable + " " + cellWord(playable) + grayText;
    }
  }

  function updateChips() {
    chipMap.textContent = MAP_NAMES[mapKind];
    chipMode.textContent = mode === "ai" ? "С ИИ" : mode === "pvp" ? "2 игрока" : "—";
    chipDifficulty.textContent = DIFF_NAMES[difficulty];
  }

  function updateWizardPicks() {
    for (const el of modePicks) el.classList.toggle("is-active", el.dataset.mode === pendingMode);
    for (const el of mapPicks) el.classList.toggle("is-active", el.dataset.map === mapKind);
    for (const el of difficultyPicks) el.classList.toggle("is-active", el.dataset.difficulty === difficulty);
  }

  // ---------- Мастер старта ----------

  function showMapPicker() {
    mapPicker.hidden = false;
    rectSizePicker.hidden = true;
  }

  function showRectSizePicker() {
    mapPicker.hidden = true;
    rectSizePicker.hidden = false;
    initSizeSelection();
    updateWizardPicks();
  }

  function showWizard(step) {
    startEl.hidden = false;

    for (const panel of stepPanels) {
      panel.hidden = Number(panel.dataset.step) !== step;
    }

    wizardStepLabel.textContent = "Шаг " + step + " из 4";
    wizardDotsEls.forEach((dot, index) => {
      dot.classList.toggle("is-active", index + 1 === step);
      dot.classList.toggle("is-done", index + 1 < step);
    });

    if (step === 3) showMapPicker();

    updateWizardPicks();
  }

  // ---------- Размер прямоугольника ----------

  function buildSizeGrid() {
    for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        const cell = document.createElement("div");
        cell.className = "size-cell";
        cell.dataset.row = r;
        cell.dataset.col = c;
        sizeGrid.appendChild(cell);
      }
    }
  }

  function initSizeSelection() {
    sizeDragging = false;
    sizeStart = { r: 0, c: 0 };
    sizeEnd = { r: easyRows - 1, c: easyCols - 1 };
    updateSizeSelection();
  }

  function updateSizeSelection() {
    const cells = sizeGrid.querySelectorAll(".size-cell");

    if (!sizeStart || !sizeEnd) {
      cells.forEach((cell) => cell.classList.remove("is-selected"));
      sizeLabel.textContent = "—";
      sizeCount.textContent = "";
      sizeHint.textContent = "Выделите поле мышью";
      sizeNext.disabled = true;
      sizeCandidate = null;
      return;
    }

    const r1 = Math.min(sizeStart.r, sizeEnd.r);
    const r2 = Math.max(sizeStart.r, sizeEnd.r);
    const c1 = Math.min(sizeStart.c, sizeEnd.c);
    const c2 = Math.max(sizeStart.c, sizeEnd.c);

    cells.forEach((cell) => {
      const r = Number(cell.dataset.row);
      const c = Number(cell.dataset.col);
      cell.classList.toggle("is-selected", r >= r1 && r <= r2 && c >= c1 && c <= c2);
    });

    const rows = r2 - r1 + 1;
    const cols = c2 - c1 + 1;
    const total = rows * cols;
    const valid = (rows >= 4 && cols >= 5) || (rows >= 5 && cols >= 4);

    sizeLabel.textContent = cols + " × " + rows;
    sizeCount.textContent = total + " " + cellWord(total);
    sizeHint.textContent = valid ? "" : "Минимум 5 × 4 или 4 × 5";
    sizeNext.disabled = !valid;
    sizeCandidate = valid ? { rows, cols } : null;
  }

  sizeGrid.addEventListener("pointerdown", (ev) => {
    const cell = ev.target.closest(".size-cell");
    if (!cell) return;
    ev.preventDefault();
    sizeDragging = true;
    sizeStart = { r: Number(cell.dataset.row), c: Number(cell.dataset.col) };
    sizeEnd = { ...sizeStart };
    updateSizeSelection();
  });

  sizeGrid.addEventListener("pointerover", (ev) => {
    if (!sizeDragging) return;
    const cell = ev.target.closest(".size-cell");
    if (!cell) return;
    sizeEnd = { r: Number(cell.dataset.row), c: Number(cell.dataset.col) };
    updateSizeSelection();
  });

  document.addEventListener("pointerup", () => {
    if (!sizeDragging) return;
    sizeDragging = false;
    updateSizeSelection();
  });

  document.addEventListener("pointercancel", () => {
    if (!sizeDragging) return;
    sizeDragging = false;
    updateSizeSelection();
  });

  sizeNext.addEventListener("click", () => {
    if (!sizeCandidate) return;
    easyRows = sizeCandidate.rows;
    easyCols = sizeCandidate.cols;
    loadPreviewMap("rect");
    showWizard(4);
  });

  sizeBack.addEventListener("click", () => {
    showMapPicker();
    updateWizardPicks();
  });

  // ---------- Часы ----------

  function formatClock(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const m = String(Math.floor(totalSec / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return m + ":" + s;
  }

  function formatClockPrecise(ms) {
    const totalCent = Math.max(0, Math.floor(ms / 10));
    const m = String(Math.floor(totalCent / 6000)).padStart(2, "0");
    const s = String(Math.floor(totalCent / 100) % 60).padStart(2, "0");
    const cs = String(totalCent % 100).padStart(2, "0");
    return m + ":" + s + "." + cs;
  }

  function updateClockDisplay() {
    if (!state || !clockEnabled) {
      timeEls[1].hidden = true;
      timeEls[2].hidden = true;
      return;
    }

    const now = Date.now();
    for (const p of [1, 2]) {
      let ms = clockTimes[p];
      if (!state.over && state.turn === p && clockStartedAt) {
        ms += now - clockStartedAt;
      }
      timeEls[p].hidden = false;
      timeEls[p].textContent = formatClock(ms);
    }
  }

  function startClock() {
    stopClock(false);
    clockEnabled = mode === "pvp" && state.total % 2 === 0;
    clockTimes = { 1: 0, 2: 0 };
    clockStartedAt = clockEnabled ? Date.now() : 0;

    if (!clockEnabled) {
      updateClockDisplay();
      return;
    }

    clockInterval = window.setInterval(updateClockDisplay, 250);
    updateClockDisplay();
  }

  function switchClock(prevPlayer) {
    if (!clockEnabled) return;
    const now = Date.now();
    if (clockStartedAt) clockTimes[prevPlayer] += now - clockStartedAt;
    clockStartedAt = now;
    updateClockDisplay();
  }

  function stopClock(finalize) {
    if (clockEnabled && finalize && state && clockStartedAt) {
      clockTimes[state.turn] += Date.now() - clockStartedAt;
    }
    clockStartedAt = 0;
    if (clockInterval) {
      window.clearInterval(clockInterval);
      clockInterval = 0;
    }
    if (state) updateClockDisplay();
  }

  function isHumanTurn() {
    if (!mode || !state || state.over || autoFilling) return false;
    return mode === "pvp" || state.turn === 1;
  }

  // ---------- Ход ----------

  function isCellComplete(r, c) {
    return state.h[r][c] && state.h[r + 1][c] && state.v[r][c] && state.v[r][c + 1];
  }

  function sideCount(r, c) {
    let n = 0;
    if (state.h[r][c]) n++;
    if (state.h[r + 1][c]) n++;
    if (state.v[r][c]) n++;
    if (state.v[r][c + 1]) n++;
    return n;
  }

  function applyEdge(edge, fromAi = false) {
    if (!state || state.over || !mode || autoFilling) return;
    if (fromAi && mode !== "ai") return;
    if (!fromAi && mode === "ai" && state.turn !== 1) return;
    if (fromAi && state.turn !== 2) return;
    if (edge.classList.contains("is-on")) return;

    const type = edge.dataset.type;
    const r = Number(edge.dataset.r);
    const c = Number(edge.dataset.c);

    edge.classList.add("is-on");

    if (type === "h") state.h[r][c] = true;
    else state.v[r][c] = true;

    const around = edgeCellsOf(state.present, type, r, c);
    let closed = 0;

    for (const [cr, cc] of around) {
      if (state.owner[cr][cc]) continue;
      if (!isCellComplete(cr, cc)) continue;
      state.owner[cr][cc] = state.turn;
      state.filled += 1;
      state.score[state.turn] += 1;
      cellEls[cr][cc].classList.add("is-owned-" + state.turn);
      closed += 1;
    }

    if (closed > 0) {
      bumpScore(state.turn);
      showBonus();
    } else {
      switchClock(state.turn);
      state.turn = 3 - state.turn;
      resetCaption();
    }

    updateHud();

    if (state.filled === state.total) {
      endGame();
      return;
    }

    if (tryAutoFill()) return;
    scheduleAi(fromAi && closed > 0 ? AI_CHAIN_DELAY : AI_DELAY);
  }

  function endGame() {
    state.over = true;
    window.clearTimeout(aiTimer);
    window.clearTimeout(autoTimer);
    autoFilling = false;
    stopClock(true);
    resetCaption();
    updateHud();

    const s1 = state.score[1];
    const s2 = state.score[2];

    let title;
    let cls = "result__title";
    let winner = 0;
    let byTime = false;

    if (s1 !== s2) {
      winner = s1 > s2 ? 1 : 2;
    } else if (clockEnabled) {
      if (clockTimes[1] < clockTimes[2]) {
        winner = 1;
        byTime = true;
      } else if (clockTimes[2] < clockTimes[1]) {
        winner = 2;
        byTime = true;
      }
    }

    if (winner === 0) {
      title = "Ничья";
    } else {
      cls += winner === 1 ? " is-blue" : " is-red";
      title = mode === "ai"
        ? (winner === 1 ? "Вы победили" : "Победил ИИ")
        : "Победа Игрока " + winner;
      if (byTime) title += " по времени";
    }

    resultTitleEl.textContent = title;
    resultTitleEl.className = cls;
    resultScoreEl.innerHTML =
      '<span class="score-blue">' + s1 + "</span>" +
      '<span class="score-sep">:</span>' +
      '<span class="score-red">' + s2 + "</span>";

    if (clockEnabled) {
      resultTimeEl.hidden = false;
      resultTimeEl.textContent =
        "Время — " + formatClockPrecise(clockTimes[1]) + " : " + formatClockPrecise(clockTimes[2]) +
        (byTime ? " · решено по времени" : "");
    } else {
      resultTimeEl.hidden = true;
      resultTimeEl.textContent = "";
    }

    window.clearTimeout(endTimer);
    endTimer = window.setTimeout(() => {
      if (state.over) resultEl.hidden = false;
    }, 420);
  }

  // ---------- Авто-докрашивание ----------

  function planAutoFill() {
    if (!state || state.over || autoFilling || !mode) return null;
    if (state.total - state.filled < 2) return null;

    const rows = state.rows;
    const cols = state.cols;
    const present = state.present;
    const h = state.h.map((row) => row.slice());
    const v = state.v.map((row) => row.slice());
    const owner = state.owner.map((row) => row.slice());
    let filled = state.filled;
    const player = state.turn;
    const steps = [];

    const countSides = (r, c) =>
      (h[r][c] ? 1 : 0) +
      (h[r + 1][c] ? 1 : 0) +
      (v[r][c] ? 1 : 0) +
      (v[r][c + 1] ? 1 : 0);

    while (filled < state.total) {
      let target = null;

      for (let r = 0; r < rows && !target; r++) {
        for (let c = 0; c < cols; c++) {
          if (!present[r][c] || owner[r][c]) continue;
          if (countSides(r, c) === 3) {
            target = [r, c];
            break;
          }
        }
      }

      if (!target) break;

      const [r, c] = target;
      const sides = [
        ["h", r, c],
        ["h", r + 1, c],
        ["v", r, c],
        ["v", r, c + 1],
      ];
      const missing = sides.find(([type, er, ec]) => !(type === "h" ? h[er][ec] : v[er][ec]));
      if (!missing) break;

      const [type, er, ec] = missing;
      if (type === "h") h[er][ec] = true;
      else v[er][ec] = true;

      const completed = [];
      for (const [cr, cc] of edgeCellsOf(present, type, er, ec)) {
        if (owner[cr][cc]) continue;
        if (countSides(cr, cc) === 4) {
          owner[cr][cc] = player;
          filled += 1;
          completed.push([cr, cc]);
        }
      }

      if (!completed.length) break;
      steps.push({ edge: [type, er, ec], cells: completed });
    }

    if (filled !== state.total || steps.length < 2) return null;
    return steps;
  }

  function startAutoFill(steps) {
    if (!steps || steps.length < 2) return;

    autoFilling = true;
    window.clearTimeout(aiTimer);
    aiTimer = 0;
    showCaption("цепочка!", PLAYER_COLORS[state.turn]);
    updateHud();

    const player = state.turn;
    let index = 0;

    const step = () => {
      if (!autoFilling || !state || state.over) return;

      if (index >= steps.length) {
        autoFilling = false;
        updateHud();
        if (state.filled === state.total) endGame();
        return;
      }

      const item = steps[index++];
      const [type, r, c] = item.edge;
      const edge = edgeMap.get(type + ":" + r + ":" + c);
      if (edge) edge.classList.add("is-on");

      if (type === "h") state.h[r][c] = true;
      else state.v[r][c] = true;

      for (const [cr, cc] of item.cells) {
        if (state.owner[cr][cc]) continue;
        state.owner[cr][cc] = player;
        state.filled += 1;
        state.score[player] += 1;
        if (cellEls[cr] && cellEls[cr][cc]) {
          cellEls[cr][cc].classList.add("is-owned-" + player);
        }
      }

      updateHud();

      if (state.filled === state.total) {
        autoFilling = false;
        endGame();
        return;
      }

      autoTimer = window.setTimeout(step, AUTO_STEP_DELAY);
    };

    autoTimer = window.setTimeout(step, AUTO_STEP_DELAY);
  }

  function tryAutoFill() {
    if (!state || state.over || autoFilling || !mode) return false;
    const steps = planAutoFill();
    if (!steps) return false;
    startAutoFill(steps);
    return true;
  }

  // ---------- ИИ ----------

  function evaluateMove(type, r, c) {
    const around = edgeCellsOf(state.present, type, r, c);
    let completes = 0;
    let threes = 0;

    for (const [cr, cc] of around) {
      if (state.owner[cr][cc]) continue;
      const after = sideCount(cr, cc) + 1;
      if (after === 4) completes += 1;
      else if (after === 3) threes += 1;
    }

    return { completes, threes };
  }

  function chooseAiAction() {
    const moves = [];

    for (const edge of edgeEls) {
      if (edge.classList.contains("is-on")) continue;
      const info = evaluateMove(
        edge.dataset.type,
        Number(edge.dataset.r),
        Number(edge.dataset.c)
      );
      moves.push({ edge, ...info });
    }

    if (!moves.length) return null;

    const bestCompletes = Math.max(...moves.map((m) => m.completes));

    if (bestCompletes > 0) {
      const finishing = moves.filter((m) => m.completes === bestCompletes);
      const bestThrees = Math.max(...finishing.map((m) => m.threes));
      const pool = finishing.filter((m) => m.threes === bestThrees);
      return pick(pool).edge;
    }

    const safe = moves.filter((m) => m.threes === 0);
    if (safe.length) return pick(safe).edge;

    const leastBad = Math.min(...moves.map((m) => m.threes));
    const pool = moves.filter((m) => m.threes === leastBad);
    return pick(pool).edge;
  }

  function scheduleAi(delay = AI_DELAY) {
    window.clearTimeout(aiTimer);

    if (!state || state.over || mode !== "ai" || state.turn !== 2 || autoFilling) return;

    aiTimer = window.setTimeout(() => {
      if (!state || state.over || mode !== "ai" || state.turn !== 2 || autoFilling) return;
      const edge = chooseAiAction();
      if (!edge) return;
      applyEdge(edge, true);
    }, delay);
  }

  // ---------- Запуск/сброс ----------

  function clearTimers() {
    window.clearTimeout(aiTimer);
    window.clearTimeout(bonusTimer);
    window.clearTimeout(endTimer);
    window.clearTimeout(autoTimer);
    aiTimer = 0;
    bonusTimer = 0;
    endTimer = 0;
    autoTimer = 0;
    autoFilling = false;
  }

  function updateHud() {
    if (!state) return;

    scoreEls[1].textContent = state.score[1];
    scoreEls[2].textContent = state.score[2];
    leftEl.textContent = state.total - state.filled;

    const live = !!mode && !state.over;
    cardEls[1].classList.toggle("is-active", live && state.turn === 1);
    cardEls[2].classList.toggle("is-active", live && state.turn === 2);

    const canHumanPlay =
      live && (mode === "pvp" || state.turn === 1) && !autoFilling;
    boardEl.classList.toggle("is-locked", !canHumanPlay);

    updateCellReady();
    updateClockDisplay();
  }

  function updateCellReady() {
    if (!state) return;

    const human = isHumanTurn() && !autoFilling;
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const cell = cellEls[r][c];
        if (!cell) continue;
        const ready =
          human &&
          !state.gray[r][c] &&
          state.owner[r][c] === 0 &&
          sideCount(r, c) === 3;
        cell.classList.toggle("cell--ready", ready);
      }
    }
  }

  function bumpScore(player) {
    const el = scoreEls[player];
    el.classList.remove("is-bump");
    void el.offsetWidth;
    el.classList.add("is-bump");
  }

  function resetCaption() {
    window.clearTimeout(bonusTimer);
    midCapEl.textContent = "осталось";
    midCapEl.style.color = "";
  }

  function showCaption(text, color) {
    window.clearTimeout(bonusTimer);
    midCapEl.textContent = text;
    midCapEl.style.color = color;
    bonusTimer = window.setTimeout(resetCaption, 1100);
  }

  function showBonus() {
    showCaption("ещё ход!", PLAYER_COLORS[state.turn]);
  }

  // ---------- Превью и игра ----------

  function loadPreviewMap(kind) {
    clearTimers();
    stopClock(false);

    mapKind = kind;
    mode = null;
    mapBoard = buildMap(kind);
    state = mapPreviewState(mapBoard);

    renderBoard();

    startEl.hidden = false;
    resultEl.hidden = true;
    gameBar.hidden = true;
    footerActions.hidden = true;

    resultTitleEl.textContent = "Ничья";
    resultTitleEl.className = "result__title";
    resultScoreEl.textContent = "";
    resultTimeEl.hidden = true;
    resultTimeEl.textContent = "";

    scoreEls[1].classList.remove("is-bump");
    scoreEls[2].classList.remove("is-bump");

    clockEnabled = false;
    timeEls[1].hidden = true;
    timeEls[2].hidden = true;

    updateNames();
    updateMapUI();
    updateChips();
    resetCaption();
    updateHud();
    updateWizardPicks();
  }

  function startGame() {
    if (!mapBoard || !pendingMode) return;

    clearTimers();
    stopClock(false);

    mode = pendingMode;
    state = buildGameState(mapBoard, difficulty);

    const first = randomTurn();
    state.turn = first;

    startEl.hidden = true;
    resultEl.hidden = true;
    gameBar.hidden = false;
    footerActions.hidden = false;

    resultTitleEl.textContent = "Ничья";
    resultTitleEl.className = "result__title";
    resultScoreEl.textContent = "";
    resultTimeEl.hidden = true;
    resultTimeEl.textContent = "";

    scoreEls[1].classList.remove("is-bump");
    scoreEls[2].classList.remove("is-bump");

    clockEnabled = mode === "pvp" && state.total % 2 === 0;
    timeEls[1].hidden = !clockEnabled;
    timeEls[2].hidden = !clockEnabled;

    renderBoard();
    updateNames();
    updateMapUI();
    updateChips();
    resetCaption();
    updateHud();
    startClock();

    if (tryAutoFill()) return;
    if (mode === "ai" && state.turn === 2) scheduleAi();
  }

  function restartGame() {
    if (!mode) return;

    clearTimers();
    stopClock(false);

    mapBoard = buildMap(mapKind);
    state = buildGameState(mapBoard, difficulty);
    state.turn = randomTurn();

    startEl.hidden = true;
    resultEl.hidden = true;
    gameBar.hidden = false;
    footerActions.hidden = false;

    resultTitleEl.textContent = "Ничья";
    resultTitleEl.className = "result__title";
    resultScoreEl.textContent = "";
    resultTimeEl.hidden = true;
    resultTimeEl.textContent = "";

    scoreEls[1].classList.remove("is-bump");
    scoreEls[2].classList.remove("is-bump");

    clockEnabled = mode === "pvp" && state.total % 2 === 0;
    timeEls[1].hidden = !clockEnabled;
    timeEls[2].hidden = !clockEnabled;

    renderBoard();
    updateNames();
    updateMapUI();
    updateChips();
    resetCaption();
    updateHud();
    startClock();

    if (tryAutoFill()) return;
    if (mode === "ai" && state.turn === 2) scheduleAi();
  }

  function exitToWelcome() {
    clearTimers();
    stopClock(false);

    mode = null;
    pendingMode = null;
    mapKind = "rect";
    difficulty = "easy";
    easyRows = 10;
    easyCols = 10;

    mapBoard = buildMap("rect");
    state = mapPreviewState(mapBoard);

    renderBoard();

    startEl.hidden = false;
    resultEl.hidden = true;
    gameBar.hidden = true;
    footerActions.hidden = true;

    resultTitleEl.textContent = "Ничья";
    resultTitleEl.className = "result__title";
    resultScoreEl.textContent = "";
    resultTimeEl.hidden = true;
    resultTimeEl.textContent = "";

    scoreEls[1].classList.remove("is-bump");
    scoreEls[2].classList.remove("is-bump");

    clockEnabled = false;
    timeEls[1].hidden = true;
    timeEls[2].hidden = true;
    leftEl.textContent = state.total;

    updateNames();
    updateMapUI();
    updateChips();
    resetCaption();
    updateHud();
    updateWizardPicks();
    showWizard(1);
  }

  // ---------- События ----------

  function onBoardClick(ev) {
    if (autoFilling) return;

    const edge = ev.target.closest(".edge");
    if (edge) {
      applyEdge(edge, false);
      return;
    }

    const cell = ev.target.closest(".cell--ready");
    if (!cell) return;

    const r = Number(cell.dataset.r);
    const c = Number(cell.dataset.c);
    const sides = [
      ["h", r, c],
      ["h", r + 1, c],
      ["v", r, c],
      ["v", r, c + 1],
    ];
    const missing = sides.find(([type, er, ec]) => !(type === "h" ? state.h[er][ec] : state.v[er][ec]));
    if (!missing) return;
    const edgeEl = edgeMap.get(missing[0] + ":" + missing[1] + ":" + missing[2]);
    if (edgeEl) applyEdge(edgeEl, false);
  }

  boardEl.addEventListener("click", onBoardClick);

  startGameBtn.addEventListener("click", () => showWizard(2));

  for (const el of modePicks) {
    el.addEventListener("click", () => {
      pendingMode = el.dataset.mode;
      updateWizardPicks();
      showWizard(3);
    });
  }

  for (const el of mapPicks) {
    el.addEventListener("click", () => {
      const kind = el.dataset.map;
      if (!kind) return;

      if (kind === "rect") {
        loadPreviewMap("rect");
        showRectSizePicker();
        return;
      }

      loadPreviewMap(kind);
      showWizard(4);
    });
  }

  for (const el of difficultyPicks) {
    el.addEventListener("click", () => {
      const diff = el.dataset.difficulty;
      if (!diff) return;
      difficulty = diff;
      updateWizardPicks();
      startGame();
    });
  }

  for (const btn of backBtns) {
    btn.addEventListener("click", () => {
      const target = Number(btn.dataset.back);
      if (target === 1) {
        showWizard(1);
      } else if (target === 2) {
        showWizard(2);
      } else {
        showWizard(3);
      }
    });
  }

  exitGameBtn.addEventListener("click", exitToWelcome);
  resultExit.addEventListener("click", exitToWelcome);
  $("playAgain").addEventListener("click", restartGame);
  $("newGame").addEventListener("click", restartGame);

  function openAbout() {
    if (aboutEl) aboutEl.hidden = false;
  }

  function closeAbout() {
    if (aboutEl) aboutEl.hidden = true;
  }

  if (aboutBtn) aboutBtn.addEventListener("click", openAbout);
  if (aboutClose) aboutClose.addEventListener("click", closeAbout);
  if (aboutCloseTop) aboutCloseTop.addEventListener("click", closeAbout);
  if (aboutEl) {
    aboutEl.addEventListener("click", (ev) => {
      if (ev.target === aboutEl) closeAbout();
    });
  }

  document.addEventListener("keydown", (ev) => {
    if (ev.key === "Escape" && aboutEl && !aboutEl.hidden) closeAbout();
  });

  // ---------- Старт ----------

  buildSizeGrid();
  mapBoard = buildMap("rect");
  state = mapPreviewState(mapBoard);
  renderBoard();
  updateNames();
  updateMapUI();
  updateChips();
  startEl.hidden = false;
  updateHud();
  updateWizardPicks();
  showWizard(1);
})();
