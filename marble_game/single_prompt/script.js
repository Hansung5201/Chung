class Marble {
  constructor(x, y, radius, color, controllable = false) {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.controllable = controllable;
    this.vx = 0;
    this.vy = 0;
    this.active = true;
  }

  draw(ctx) {
    ctx.save();
    const gradient = ctx.createRadialGradient(
      this.x - this.radius * 0.4,
      this.y - this.radius * 0.4,
      this.radius * 0.2,
      this.x,
      this.y,
      this.radius
    );
    gradient.addColorStop(0, "#ffffff");
    gradient.addColorStop(1, this.color);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    if (this.controllable) {
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.7)";
      ctx.stroke();
    }

    ctx.restore();
  }
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const remainingEl = document.getElementById("remaining");
const resetBtn = document.getElementById("resetBtn");

const state = {
  marbles: [],
  player: null,
  dragStart: null,
  score: 0,
  aimVector: null,
  round: 1,
};

const COLORS = ["#38bdf8", "#f97316", "#a855f7", "#22c55e", "#facc15", "#fb7185"];
const PLAYER_COLOR = "#2563eb";
const PLAYER_RADIUS = 16;
const ENEMY_RADIUS = 14;
const FRICTION = 0.992;
const MIN_SPEED = 0.02;

function resetGame() {
  state.marbles = [];
  state.score = 0;
  state.round = 1;
  spawnPlayer();
  spawnEnemies(5);
  updateHUD();
}

function spawnPlayer() {
  const player = new Marble(canvas.width * 0.5, canvas.height * 0.8, PLAYER_RADIUS, PLAYER_COLOR, true);
  player.vx = 0;
  player.vy = 0;
  state.player = player;
  state.marbles.unshift(player);
}

function spawnEnemies(count) {
  const padding = 60;
  for (let i = 0; i < count; i += 1) {
    const x = padding + Math.random() * (canvas.width - padding * 2);
    const y = padding + Math.random() * (canvas.height * 0.5 - padding * 0.5);
    const marble = new Marble(x, y, ENEMY_RADIUS, COLORS[i % COLORS.length]);
    marble.vx = (Math.random() - 0.5) * 0.3;
    marble.vy = (Math.random() - 0.5) * 0.3;
    state.marbles.push(marble);
  }
  updateHUD();
}

function updateHUD() {
  const remaining = state.marbles.filter((m) => m !== state.player && m.active).length;
  scoreEl.textContent = state.score;
  remainingEl.textContent = remaining;
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function resolveCollision(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return;
  const overlap = a.radius + b.radius - dist;
  if (overlap > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    const separation = overlap / 2;
    a.x -= nx * separation;
    a.y -= ny * separation;
    b.x += nx * separation;
    b.y += ny * separation;

    const dvx = b.vx - a.vx;
    const dvy = b.vy - a.vy;
    const impulse = dvx * nx + dvy * ny;

    if (impulse > 0) {
      const impulseStrength = impulse;
      a.vx += impulseStrength * nx;
      a.vy += impulseStrength * ny;
      b.vx -= impulseStrength * nx;
      b.vy -= impulseStrength * ny;
    }
  }
}

function updatePhysics() {
  state.marbles.forEach((marble) => {
    if (!marble.active) return;
    marble.x += marble.vx;
    marble.y += marble.vy;

    marble.vx *= FRICTION;
    marble.vy *= FRICTION;

    if (Math.abs(marble.vx) < MIN_SPEED) marble.vx = 0;
    if (Math.abs(marble.vy) < MIN_SPEED) marble.vy = 0;

    const bounceDamping = 0.85;
    if (marble.x - marble.radius < 0) {
      marble.x = marble.radius;
      marble.vx = Math.abs(marble.vx) * bounceDamping;
    } else if (marble.x + marble.radius > canvas.width) {
      marble.x = canvas.width - marble.radius;
      marble.vx = -Math.abs(marble.vx) * bounceDamping;
    }

    if (marble.y - marble.radius < 0) {
      marble.y = marble.radius;
      marble.vy = Math.abs(marble.vy) * bounceDamping;
    } else if (marble.y + marble.radius > canvas.height) {
      marble.y = canvas.height - marble.radius;
      marble.vy = -Math.abs(marble.vy) * bounceDamping;
    }
  });

  for (let i = 0; i < state.marbles.length; i += 1) {
    const a = state.marbles[i];
    if (!a.active) continue;
    for (let j = i + 1; j < state.marbles.length; j += 1) {
      const b = state.marbles[j];
      if (!b.active) continue;
      if (distance(a, b) < a.radius + b.radius) {
        resolveCollision(a, b);
      }
    }
  }

  // Remove marbles that exit the arena (for scoring)
  state.marbles.forEach((marble) => {
    if (marble === state.player || !marble.active) return;
    const outside =
      marble.x + marble.radius < -10 ||
      marble.x - marble.radius > canvas.width + 10 ||
      marble.y + marble.radius < -10 ||
      marble.y - marble.radius > canvas.height + 10;
    if (outside) {
      marble.active = false;
      state.score += 100;
    }
  });

  const remaining = state.marbles.filter((m) => m !== state.player && m.active).length;
  if (remaining === 0) {
    state.round += 1;
    spawnEnemies(Math.min(5 + state.round, 12));
  }

  updateHUD();
}

function drawAimLine() {
  if (!state.aimVector || !state.dragStart) return;
  const { x, y } = state.player;
  const { dx, dy } = state.aimVector;

  ctx.save();
  ctx.strokeStyle = "rgba(37, 99, 235, 0.7)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - dx, y - dy);
  ctx.stroke();

  ctx.fillStyle = "rgba(37, 99, 235, 0.2)";
  ctx.beginPath();
  ctx.arc(x, y, Math.min(Math.hypot(dx, dy), 120), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "rgba(226, 232, 240, 0.9)");
  gradient.addColorStop(1, "rgba(148, 163, 184, 0.8)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(15, 23, 42, 0.15)";
  ctx.lineWidth = 2;
  ctx.strokeRect(8, 8, canvas.width - 16, canvas.height - 16);
  ctx.restore();

  drawAimLine();
  state.marbles.forEach((marble) => {
    if (marble.active) {
      marble.draw(ctx);
    }
  });
}

function gameLoop() {
  updatePhysics();
  draw();
  requestAnimationFrame(gameLoop);
}

function setAimVector(currentX, currentY) {
  if (!state.dragStart) return;
  const dx = currentX - state.dragStart.x;
  const dy = currentY - state.dragStart.y;
  const clamp = 14;
  state.aimVector = {
    dx: Math.max(-clamp * 10, Math.min(clamp * 10, dx)),
    dy: Math.max(-clamp * 10, Math.min(clamp * 10, dy)),
  };
}

canvas.addEventListener("mousedown", (event) => {
  const rect = canvas.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const player = state.player;
  if (!player) return;

  if (distance({ x, y }, player) <= player.radius + 6) {
    state.dragStart = { x, y };
    state.aimVector = { dx: 0, dy: 0 };
    player.vx = 0;
    player.vy = 0;
  }
});

canvas.addEventListener("mousemove", (event) => {
  if (!state.dragStart) return;
  const rect = canvas.getBoundingClientRect();
  setAimVector(event.clientX - rect.left, event.clientY - rect.top);
});

function releaseShot(currentX, currentY) {
  if (!state.dragStart || !state.player) return;
  setAimVector(currentX, currentY);
  const { dx, dy } = state.aimVector;
  state.player.vx = -dx * 0.08;
  state.player.vy = -dy * 0.08;
  state.dragStart = null;
  state.aimVector = null;
}

canvas.addEventListener("mouseup", (event) => {
  const rect = canvas.getBoundingClientRect();
  releaseShot(event.clientX - rect.left, event.clientY - rect.top);
});

canvas.addEventListener("mouseleave", () => {
  state.dragStart = null;
  state.aimVector = null;
});

canvas.addEventListener("touchstart", (event) => {
  const touch = event.touches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  const x = touch.clientX - rect.left;
  const y = touch.clientY - rect.top;
  const player = state.player;
  if (distance({ x, y }, player) <= player.radius + 10) {
    event.preventDefault();
    state.dragStart = { x, y };
    state.aimVector = { dx: 0, dy: 0 };
    player.vx = 0;
    player.vy = 0;
  }
});

canvas.addEventListener("touchmove", (event) => {
  if (!state.dragStart) return;
  const touch = event.touches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  setAimVector(touch.clientX - rect.left, touch.clientY - rect.top);
});

canvas.addEventListener("touchend", (event) => {
  const touch = event.changedTouches[0];
  if (!touch) return;
  const rect = canvas.getBoundingClientRect();
  releaseShot(touch.clientX - rect.left, touch.clientY - rect.top);
});

resetBtn.addEventListener("click", () => {
  state.marbles = state.marbles.filter((m) => m === state.player);
  state.player.x = canvas.width * 0.5;
  state.player.y = canvas.height * 0.8;
  state.player.vx = 0;
  state.player.vy = 0;
  spawnEnemies(5);
  updateHUD();
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") {
    resetGame();
  }
});

resetGame();
gameLoop();
