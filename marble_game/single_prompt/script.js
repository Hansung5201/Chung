const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const nextCanvas = document.getElementById("nextCanvas");
const nextCtx = nextCanvas.getContext("2d");
const scoreElement = document.getElementById("score");

const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;
const SHOOTER_Y = CANVAS_HEIGHT - 70;
const POINTER_MIN = 20 * (Math.PI / 180);
const POINTER_MAX = 160 * (Math.PI / 180);
const BUBBLE_RADIUS = 16;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const VERTICAL_SPACING = Math.sqrt(3) * BUBBLE_RADIUS;
const COLUMNS = 14;
const LEFT_OFFSET = (CANVAS_WIDTH - COLUMNS * BUBBLE_DIAMETER) / 2;
const TOP_MARGIN = 80;
const LAUNCH_SPEED = 460;
const COLORS = ["#ff6b6b", "#f7b801", "#8ac926", "#1982c4", "#6a4c93", "#ff9770"];

let grid = [];
let pointerAngle = Math.PI / 2;
let currentBubble = null;
let nextBubble = null;
let movingBubble = null;
let keys = new Set();
let lastTime = 0;
let score = 0;
let gameOver = false;
let message = "";

function init() {
  grid = [];
  pointerAngle = Math.PI / 2;
  currentBubble = null;
  nextBubble = null;
  movingBubble = null;
  keys.clear();
  lastTime = 0;
  score = 0;
  gameOver = false;
  message = "";
  scoreElement.textContent = score;

  createInitialGrid();
  currentBubble = createShooterBubble();
  nextBubble = createShooterBubble();
  drawNextBubble();
  requestAnimationFrame(loop);
}

function createInitialGrid() {
  const initialRows = 8;
  for (let row = 0; row < initialRows; row++) {
    ensureRow(row);
    const limit = COLUMNS - (row % 2 ? 1 : 0);
    for (let col = 0; col < limit; col++) {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)];
      const bubble = makeGridBubble(row, col, color);
      grid[row][col] = bubble;
    }
  }
}

function ensureRow(row) {
  if (!grid[row]) {
    grid[row] = new Array(COLUMNS).fill(null);
  }
}

function makeGridBubble(row, col, color) {
  const { x, y } = gridToPixel(row, col);
  return { row, col, x, y, color };
}

function gridToPixel(row, col) {
  const offset = row % 2 ? BUBBLE_RADIUS : 0;
  const x = LEFT_OFFSET + col * BUBBLE_DIAMETER + BUBBLE_RADIUS + offset;
  const y = TOP_MARGIN + row * VERTICAL_SPACING + BUBBLE_RADIUS;
  return { x, y };
}

function pixelToGrid(x, y) {
  const row = Math.max(0, Math.round((y - TOP_MARGIN) / VERTICAL_SPACING));
  const offset = row % 2 ? BUBBLE_RADIUS : 0;
  const col = Math.max(
    0,
    Math.round((x - LEFT_OFFSET - offset) / BUBBLE_DIAMETER)
  );
  return { row, col: Math.min(col, COLUMNS - 1) };
}

function createShooterBubble() {
  const availableColors = getColorsInPlay();
  const colorPool = availableColors.length ? availableColors : COLORS;
  return {
    x: CANVAS_WIDTH / 2,
    y: SHOOTER_Y,
    color: colorPool[Math.floor(Math.random() * colorPool.length)],
    dx: 0,
    dy: 0,
    active: false,
  };
}

function getColorsInPlay() {
  const colorSet = new Set();
  for (const row of grid) {
    if (!row) continue;
    for (const bubble of row) {
      if (bubble) colorSet.add(bubble.color);
    }
  }
  return Array.from(colorSet.values());
}

function loop(timestamp) {
  if (gameOver) {
    draw();
    return;
  }
  const delta = (timestamp - lastTime) / 1000;
  lastTime = timestamp;
  update(delta);
  draw();
  requestAnimationFrame(loop);
}

function update(delta) {
  handlePointer(delta);
  updateMovingBubble(delta);
}

function handlePointer(delta) {
  const rotationSpeed = 220 * (Math.PI / 180);
  if (keys.has("ArrowLeft")) {
    pointerAngle = Math.min(pointerAngle + rotationSpeed * delta, POINTER_MAX);
  }
  if (keys.has("ArrowRight")) {
    pointerAngle = Math.max(pointerAngle - rotationSpeed * delta, POINTER_MIN);
  }
}

function updateMovingBubble(delta) {
  if (!movingBubble) return;

  movingBubble.x += movingBubble.dx * delta;
  movingBubble.y += movingBubble.dy * delta;

  if (movingBubble.x <= BUBBLE_RADIUS || movingBubble.x >= CANVAS_WIDTH - BUBBLE_RADIUS) {
    movingBubble.dx *= -1;
    movingBubble.x = clamp(movingBubble.x, BUBBLE_RADIUS, CANVAS_WIDTH - BUBBLE_RADIUS);
  }

  if (movingBubble.y <= TOP_MARGIN + BUBBLE_RADIUS) {
    snapMovingBubble();
    return;
  }

  for (const row of grid) {
    if (!row) continue;
    for (const bubble of row) {
      if (!bubble) continue;
      const dist = distance(bubble.x, bubble.y, movingBubble.x, movingBubble.y);
      if (dist <= BUBBLE_DIAMETER - 2) {
        snapMovingBubble();
        return;
      }
    }
  }

  if (movingBubble.y > CANVAS_HEIGHT - BUBBLE_RADIUS) {
    endGame(false);
  }
}

function snapMovingBubble() {
  const { row, col } = findClosestSlot(movingBubble.x, movingBubble.y);
  ensureRow(row);
  const bubble = makeGridBubble(row, col, movingBubble.color);
  bubble.row = row;
  bubble.col = col;
  grid[row][col] = bubble;

  resolveMatches(row, col);
  checkForFloating();
  if (isBoardEmpty()) {
    endGame(true);
  } else if (hasReachedLimit()) {
    endGame(false);
  }
  currentBubble = nextBubble;
  currentBubble.x = CANVAS_WIDTH / 2;
  currentBubble.y = SHOOTER_Y;
  currentBubble.dx = 0;
  currentBubble.dy = 0;
  currentBubble.active = false;
  nextBubble = createShooterBubble();
  drawNextBubble();
  movingBubble = null;
}

function findClosestSlot(x, y) {
  const approx = pixelToGrid(x, y);
  let best = null;
  for (let row = Math.max(0, approx.row - 1); row <= approx.row + 1; row++) {
    ensureRow(row);
    for (let col = Math.max(0, approx.col - 1); col <= Math.min(COLUMNS - 1, approx.col + 1); col++) {
      if (grid[row][col]) continue;
      const center = gridToPixel(row, col);
      const dist = distance(center.x, center.y, x, y);
      if (!best || dist < best.dist) {
        best = { row, col, dist };
      }
    }
  }
  if (!best) {
    const { row, col } = approx;
    ensureRow(row);
    if (!grid[row][col]) {
      return { row, col };
    }
    for (const { row: nr, col: nc } of getNeighbors(approx.row, approx.col)) {
      ensureRow(nr);
      if (!grid[nr][nc]) return { row: nr, col: nc };
    }
    return approx;
  }
  return { row: best.row, col: best.col };
}

function resolveMatches(row, col) {
  const origin = grid[row][col];
  if (!origin) return;
  const cluster = collectCluster(row, col, origin.color);
  if (cluster.length >= 3) {
    removeCluster(cluster);
    score += cluster.length * 100;
    scoreElement.textContent = score;
  }
}

function collectCluster(row, col, color) {
  const visited = new Set();
  const stack = [{ row, col }];
  const matched = [];

  while (stack.length) {
    const current = stack.pop();
    const key = `${current.row},${current.col}`;
    if (visited.has(key)) continue;
    visited.add(key);
    const bubble = getBubble(current.row, current.col);
    if (!bubble || bubble.color !== color) continue;
    matched.push(bubble);
    for (const neighbor of getNeighbors(current.row, current.col)) {
      stack.push(neighbor);
    }
  }

  return matched;
}

function getBubble(row, col) {
  if (row < 0 || col < 0 || row >= grid.length || col >= COLUMNS) return null;
  ensureRow(row);
  return grid[row][col];
}

function getNeighbors(row, col) {
  const offsetsEven = [
    { row: -1, col: 0 },
    { row: -1, col: -1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: -1 },
  ];
  const offsetsOdd = [
    { row: -1, col: 0 },
    { row: -1, col: 1 },
    { row: 0, col: -1 },
    { row: 0, col: 1 },
    { row: 1, col: 0 },
    { row: 1, col: 1 },
  ];
  const offsets = row % 2 ? offsetsOdd : offsetsEven;
  const neighbors = [];
  for (const offset of offsets) {
    const nr = row + offset.row;
    const nc = col + offset.col;
    if (nr < 0 || nc < 0 || nc >= COLUMNS) continue;
    ensureRow(nr);
    neighbors.push({ row: nr, col: nc });
  }
  return neighbors;
}

function removeCluster(cluster) {
  for (const bubble of cluster) {
    if (grid[bubble.row]) {
      grid[bubble.row][bubble.col] = null;
    }
  }
}

function checkForFloating() {
  const visited = new Set();
  const connected = new Set();
  const queue = [];

  if (!grid.length) return;

  for (let col = 0; col < COLUMNS; col++) {
    const bubble = getBubble(0, col);
    if (bubble) {
      queue.push({ row: 0, col });
      const key = `0,${col}`;
      visited.add(key);
      connected.add(key);
    }
  }

  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of getNeighbors(current.row, current.col)) {
      const key = `${neighbor.row},${neighbor.col}`;
      if (visited.has(key)) continue;
      const bubble = getBubble(neighbor.row, neighbor.col);
      if (!bubble) continue;
      visited.add(key);
      connected.add(key);
      queue.push(neighbor);
    }
  }

  let removed = 0;
  for (let row = 0; row < grid.length; row++) {
    ensureRow(row);
    for (let col = 0; col < COLUMNS; col++) {
      const bubble = grid[row][col];
      if (!bubble) continue;
      const key = `${row},${col}`;
      if (!connected.has(key)) {
        grid[row][col] = null;
        removed++;
      }
    }
  }

  if (removed) {
    score += removed * 150;
    scoreElement.textContent = score;
  }
}

function isBoardEmpty() {
  for (const row of grid) {
    if (!row) continue;
    for (const bubble of row) {
      if (bubble) return false;
    }
  }
  return true;
}

function hasReachedLimit() {
  for (const row of grid) {
    if (!row) continue;
    for (const bubble of row) {
      if (!bubble) continue;
      if (bubble.y + BUBBLE_RADIUS >= SHOOTER_Y - 20) {
        return true;
      }
    }
  }
  return false;
}

function launchBubble() {
  if (gameOver || movingBubble || !currentBubble) return;
  const angle = pointerAngle;
  const dx = Math.cos(angle) * LAUNCH_SPEED;
  const dy = -Math.sin(angle) * LAUNCH_SPEED;
  movingBubble = {
    x: currentBubble.x,
    y: currentBubble.y,
    color: currentBubble.color,
    dx,
    dy,
  };
  currentBubble.active = true;
}

function draw() {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawBackground();
  drawLimitLine();
  drawBubbles();
  drawMovingBubble();
  drawShooter();
  drawNextBubble();
  if (gameOver) drawGameOver();
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  gradient.addColorStop(0, "rgba(14, 35, 64, 0.85)");
  gradient.addColorStop(1, "rgba(3, 8, 16, 0.9)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

function drawLimitLine() {
  ctx.save();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(40, SHOOTER_Y - 30);
  ctx.lineTo(CANVAS_WIDTH - 40, SHOOTER_Y - 30);
  ctx.stroke();
  ctx.restore();
}

function drawBubbles() {
  for (const row of grid) {
    if (!row) continue;
    for (const bubble of row) {
      if (!bubble) continue;
      drawBubble(bubble.x, bubble.y, bubble.color, 1);
    }
  }
}

function drawBubble(x, y, color, opacity = 1) {
  ctx.save();
  ctx.globalAlpha = opacity;
  const highlight = lighten(color, 0.35);
  const shadow = darken(color, 0.45);
  const gradient = ctx.createRadialGradient(
    x - BUBBLE_RADIUS / 2,
    y - BUBBLE_RADIUS / 2,
    BUBBLE_RADIUS / 4,
    x,
    y,
    BUBBLE_RADIUS
  );
  gradient.addColorStop(0, highlight);
  gradient.addColorStop(0.6, color);
  gradient.addColorStop(1, shadow);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMovingBubble() {
  if (!movingBubble) return;
  drawBubble(movingBubble.x, movingBubble.y, movingBubble.color);
}

function drawShooter() {
  const baseX = CANVAS_WIDTH / 2;
  const baseY = SHOOTER_Y + 10;

  ctx.save();
  ctx.translate(baseX, SHOOTER_Y);
  ctx.rotate(pointerAngle - Math.PI / 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  ctx.fillRect(-6, -20, 12, 140);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.25)";
  ctx.beginPath();
  ctx.ellipse(baseX, baseY, 44, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  if (currentBubble) {
    drawBubble(currentBubble.x, currentBubble.y, currentBubble.color);
  }
}

function drawNextBubble() {
  if (!nextBubble) return;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  drawMiniBubble(nextCtx, nextCanvas.width / 2, nextCanvas.height / 2, nextBubble.color);
}

function drawMiniBubble(context, x, y, color) {
  const radius = 22;
  const highlight = lighten(color, 0.35);
  const shadow = darken(color, 0.45);
  const gradient = context.createRadialGradient(x - radius / 3, y - radius / 3, radius / 4, x, y, radius);
  gradient.addColorStop(0, highlight);
  gradient.addColorStop(0.6, color);
  gradient.addColorStop(1, shadow);
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
}

function drawGameOver() {
  ctx.save();
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.font = "bold 42px 'Noto Sans KR', sans-serif";
  ctx.fillText(message, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);
  ctx.font = "20px 'Noto Sans KR', sans-serif";
  ctx.fillText("Enter를 눌러 다시 시작", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 24);
  ctx.restore();
}

function lighten(color, amount) {
  const { r, g, b } = hexToRgb(color);
  return `rgb(${Math.min(255, Math.round(r + (255 - r) * amount))}, ${Math.min(
    255,
    Math.round(g + (255 - g) * amount)
  )}, ${Math.min(255, Math.round(b + (255 - b) * amount))})`;
}

function darken(color, amount) {
  const { r, g, b } = hexToRgb(color);
  return `rgb(${Math.max(0, Math.round(r * (1 - amount)))}, ${Math.max(
    0,
    Math.round(g * (1 - amount))
  )}, ${Math.max(0, Math.round(b * (1 - amount)))})`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function distance(x1, y1, x2, y2) {
  const dx = x1 - x2;
  const dy = y1 - y2;
  return Math.sqrt(dx * dx + dy * dy);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

function endGame(clear) {
  gameOver = true;
  message = clear ? "모든 버블 제거!" : "버블이 바닥에 닿았습니다";
}

function handleKeyDown(event) {
  if (event.repeat) return;
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    keys.add(event.key);
  }
  if (event.key === " " || event.key === "Spacebar") {
    event.preventDefault();
    launchBubble();
  }
  if (event.key === "Enter" && gameOver) {
    init();
  }
}

function handleKeyUp(event) {
  if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    keys.delete(event.key);
  }
}

function handlePointerMove(event) {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const angle = Math.atan2(SHOOTER_Y - y, x - CANVAS_WIDTH / 2);
  const clamped = clamp(angle, POINTER_MIN, POINTER_MAX);
  pointerAngle = clamped;
}

function handlePointerDown(event) {
  event.preventDefault();
  launchBubble();
}

canvas.addEventListener("mousemove", handlePointerMove);
canvas.addEventListener("click", handlePointerDown);
canvas.addEventListener("touchstart", (event) => {
  event.preventDefault();
  const touch = event.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const angle = Math.atan2(SHOOTER_Y - y, x - CANVAS_WIDTH / 2);
  pointerAngle = clamp(angle, POINTER_MIN, POINTER_MAX);
  launchBubble();
});
canvas.addEventListener("touchmove", (event) => {
  event.preventDefault();
  const touch = event.changedTouches[0];
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const angle = Math.atan2(SHOOTER_Y - y, x - CANVAS_WIDTH / 2);
  pointerAngle = clamp(angle, POINTER_MIN, POINTER_MAX);
});

document.addEventListener("keydown", handleKeyDown);
document.addEventListener("keyup", handleKeyUp);

init();
