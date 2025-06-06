const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// Variables globales
let keys = {};
let mouse = { x: 0, y: 0 };
let mouseDown = false;
let showShop = false;
let showDevMenu = false;
let gamePaused = false;

let score = 0, kills = 0;
let player = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  r: 18,
  speed: 3,
  damage: 1,
  vidas: 3,
  doubleGun: false,
  immortal: 0
};

let bullets = [];
let enemies = [];
let lastShot = 0;
const SHOT_DELAY = 150;
let enemyCap = 3;

let cheatPoints = false;
let cheatVidas = false;
let cheatImmortal = false;

// Patrullaje
function randomPoint() {
  return {
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height
  };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Eventos
let lastShiftTime = 0;
document.addEventListener("keydown", e => {
  keys[e.key.toLowerCase()] = true;

  if (e.key === "t" || e.key === "T") {
    showShop = !showShop;
    gamePaused = showShop || showDevMenu;
  }

  if (e.key === "Shift") {
    let now = Date.now();
    if (now - lastShiftTime < 300) {
      showDevMenu = !showDevMenu;
      gamePaused = showShop || showDevMenu;
    }
    lastShiftTime = now;
  }

  if (showDevMenu) {
    if (e.key === "1") cheatPoints = !cheatPoints;
    if (e.key === "2") cheatVidas = !cheatVidas;
    if (e.key === "3") cheatImmortal = !cheatImmortal;
  }
});

document.addEventListener("keyup", e => {
  keys[e.key.toLowerCase()] = false;
});

canvas.addEventListener("mousedown", () => mouseDown = true);
canvas.addEventListener("mouseup", () => mouseDown = false);
canvas.addEventListener("mousemove", e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

// Disparos
function tryShoot() {
  if (Date.now() - lastShot < SHOT_DELAY) return;
  lastShot = Date.now();
  const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
  shootBullet(angle);
  if (player.doubleGun) {
    const off = Math.PI / 16;
    shootBullet(angle + off);
    shootBullet(angle - off);
  }
}

function shootBullet(angle) {
  const speed = 6;
  bullets.push({
    x: player.x,
    y: player.y,
    dx: Math.cos(angle) * speed,
    dy: Math.sin(angle) * speed
  });
}

// Zombis
function spawnEnemy(isBoss = false) {
  let ex = Math.random() * canvas.width;
  let ey = Math.random() * canvas.height;
  const dist = Math.hypot(ex - player.x, ey - player.y);
  if (dist < 150) {
    ex = (ex + 200) % canvas.width;
    ey = (ey + 200) % canvas.height;
  }
  enemies.push({
    x: ex,
    y: ey,
    r: isBoss ? 40 : 20,
    hp: isBoss ? (20 + Math.floor(kills / 2)) : 4,
    speed: isBoss ? 0.7 : (1 + Math.random() * 0.5),
    boss: isBoss,
    angle: 0,
    patrol: randomPoint()
  });
}

// Update
function update() {
  // Cheats
  if (cheatPoints) score += 10;
  if (cheatVidas) player.vidas = 999;
  if (cheatImmortal) player.immortal = 9999;

  if (showShop) {
    if (keys["1"] && score >= 100) { player.speed += 0.5; score -= 100; }
    if (keys["2"] && score >= 150) { player.damage++; score -= 150; }
    if (keys["3"] && score >= 200) { player.vidas++; score -= 200; }
    if (keys["4"] && score >= 250) { player.immortal = 600; score -= 250; }
    if (keys["5"] && score >= 300) { player.doubleGun = true; score -= 300; }
  }

  if (gamePaused) return;

  const up = keys["w"] || keys["arrowup"],
        down = keys["s"] || keys["arrowdown"],
        left = keys["a"] || keys["arrowleft"],
        right = keys["d"] || keys["arrowright"];

  if (up) player.y -= player.speed;
  if (down) player.y += player.speed;
  if (left) player.x -= player.speed;
  if (right) player.x += player.speed;

  player.x = clamp(player.x, player.r, canvas.width - player.r);
  player.y = clamp(player.y, player.r, canvas.height - player.r);

  if (mouseDown || keys[" "]) tryShoot();

  bullets = bullets.filter(b => {
    b.x += b.dx;
    b.y += b.dy;
    return b.x > -5 && b.x < canvas.width + 5 && b.y > -5 && b.y < canvas.height + 5;
  });

  while (enemies.length < enemyCap) spawnEnemy();

  enemies.forEach((e, ei) => {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy);
    const visionAngle = Math.atan2(dy, dx);
    e.angle = visionAngle;

    const inVision = d < 200 && Math.abs(visionAngle - e.angle) < Math.PI / 3;

    if (inVision) {
      // Persigue al jugador
      if (d > 0) {
        e.x += dx / d * e.speed;
        e.y += dy / d * e.speed;
      }
    } else {
      // Patrulla
      const pdx = e.patrol.x - e.x;
      const pdy = e.patrol.y - e.y;
      const pdist = Math.hypot(pdx, pdy);
      if (pdist < 5) e.patrol = randomPoint();
      else {
        e.x += pdx / pdist * e.speed * 0.5;
        e.y += pdy / pdist * e.speed * 0.5;
      }
    }

    if (d < e.r + player.r && player.immortal === 0) {
      player.vidas--;
      player.immortal = 120;
      if (player.vidas <= 0) {
        alert("¡GAME OVER!\nPuntos: " + score);
        location.reload();
      }
    }

    bullets.forEach((b, bi) => {
      if (Math.hypot(b.x - e.x, b.y - e.y) < e.r) {
        e.hp -= player.damage;
        bullets.splice(bi, 1);
      }
    });

    if (e.hp <= 0) {
      enemies.splice(ei, 1);
      score += e.boss ? 50 : 10;
      kills++;
      const maxCap = 10;
      enemyCap = Math.min(maxCap, enemyCap + 1);
      let toSpawn = enemyCap - enemies.length;
      if (enemyCap < maxCap) toSpawn++;
      for (let n = 0; n < toSpawn; n++) spawnEnemy();
      if (kills % 20 === 0) spawnEnemy(true);
    }
  });

  if (player.immortal > 0) player.immortal--;
}

// Dibujar
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#0ff";
  bullets.forEach(b => ctx.fillRect(b.x - 3, b.y - 3, 6, 6));

  ctx.fillStyle = player.immortal > 0 ? "#ff0" : "#fff";
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.r, 0, Math.PI * 2);
  ctx.fill();

  enemies.forEach(e => {
    ctx.fillStyle = e.boss ? "#800" : "#0a0";
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
    ctx.fill();

    // Ojos (dirección)
    const eyeOffset = e.r / 2;
    const eyeAngle = e.angle;
    const eyeX = e.x + Math.cos(eyeAngle) * eyeOffset;
    const eyeY = e.y + Math.sin(eyeAngle) * eyeOffset;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Barra de vida
    ctx.fillStyle = "#f00";
    ctx.fillRect(e.x - e.r, e.y - e.r - 6, (e.hp / (e.boss ? 20 + kills / 2 : 4)) * e.r * 2, 4);
  });

  ctx.fillStyle = "#fff";
  ctx.font = "16px Arial";
  ctx.fillText(`Puntos: ${score}`, 10, 20);
  ctx.fillText(`Vidas: ${player.vidas}`, 10, 40);
  ctx.fillText(`Bajas: ${kills}`, 10, 60);

  if (showShop) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(100, 100, 600, 400);
    ctx.fillStyle = "#fff";
    ctx.font = "28px Arial";
    ctx.fillText(`TIENDA – Puntos: ${score}`, 170, 150);
    ctx.font = "22px Arial";
    ctx.fillText("[1] Velocidad +0.5  (100)", 140, 220);
    ctx.fillText("[2] Daño +1        (150)", 140, 260);
    ctx.fillText("[3] Vida extra     (200)", 140, 300);
    ctx.fillText("[4] Inmortal 10 s  (250)", 140, 340);
    ctx.fillText("[5] Doble arma     (300)", 140, 380);
    ctx.fillText("Pulsa T para cerrar", 280, 430);
  }

  if (showDevMenu) {
    ctx.fillStyle = "rgba(0,0,0,0.9)";
    ctx.fillRect(200, 150, 400, 300);
    ctx.fillStyle = "#fff";
    ctx.font = "24px Arial";
    ctx.fillText("MENÚ DE DESARROLLADOR", 240, 190);
    ctx.font = "18px Arial";
    ctx.fillText(`[1] Puntos infinitos: ${cheatPoints ? "Activado" : "Desactivado"}`, 230, 240);
    ctx.fillText(`[2] Vida infinita:     ${cheatVidas ? "Activado" : "Desactivado"}`, 230, 280);
    ctx.fillText(`[3] Inmortalidad:      ${cheatImmortal ? "Activado" : "Desactivado"}`, 230, 320);
    ctx.fillText("Pulsa Shift dos veces para cerrar", 230, 360);
  }
}

// Bucle principal
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

// Inicializar
for (let i = 0; i < enemyCap; i++) spawnEnemy();
loop();
