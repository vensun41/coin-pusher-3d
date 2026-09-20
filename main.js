import * as THREE from 'three';
import * as CANNON from 'cannon-es';

/* ==================== 常量 ==================== */
const TABLE_W = 8;            // 桌面宽（X）
const TABLE_D = 9;            // 桌面深（Z）：-5 到 +4
const FRONT_Z = 4.0;          // 前端边缘（硬币从这里掉落）
const BACK_Z = -5.0;          // 后端墙

const COIN_R = 0.35;          // 硬币半径
const COIN_H = 0.12;          // 硬币厚度

const PUSHER_W = 7.6;         // 推板宽
const PUSHER_H = 1.0;         // 推板高
const PUSHER_D = 1.4;         // 推板厚（Z）
const PUSHER_Z_MIN = -3.5;    // 推板后限
const PUSHER_Z_MAX = 1.5;     // 推板前限
const PUSHER_SPEED = 2.0;     // 推板速度（单位/秒）

const MAX_COINS = 130;        // 硬币上限

const SLOT_SYMBOLS = ['🍒', '🍋', '🍊', '🍉', '⭐', '💎', '7️⃣'];
const SLOT_REWARDS = { '🍒': 20, '🍋': 20, '🍊': 20, '🍉': 25, '⭐': 30, '💎': 40, '7️⃣': 50 };
const WIN_CHANCE = 0.3;

/* ==================== DOM ==================== */
const canvas = document.getElementById('game');
const scoreEl = document.getElementById('score');
const collectedEl = document.getElementById('collected');
const dropBtn = document.getElementById('drop-btn');
const slotResultEl = document.getElementById('slot-result');
const winPopup = document.getElementById('win-popup');
const winTitle = document.getElementById('win-title');
const winMsg = document.getElementById('win-msg');
const hintEl = document.getElementById('hint');
const reelEls = [
  document.getElementById('reel1'),
  document.getElementById('reel2'),
  document.getElementById('reel3'),
];

/* ==================== Three.js ==================== */
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(canvas.clientWidth, canvas.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x08140c);

const camera = new THREE.PerspectiveCamera(
  50, canvas.clientWidth / canvas.clientHeight, 0.1, 100
);
camera.position.set(0, 7.5, 9.5);
camera.lookAt(0, 0, -1);

// 灯光
scene.add(new THREE.HemisphereLight(0xd8ffe0, 0x08220f, 0.9));
const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
keyLight.position.set(4, 10, 6);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -8;
keyLight.shadow.camera.right = 8;
keyLight.shadow.camera.top = 8;
keyLight.shadow.camera.bottom = -8;
keyLight.shadow.camera.far = 40;
scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffd9a0, 0.7);
fillLight.position.set(-5, 4, -3);
scene.add(fillLight);

/* ==================== 材质 ==================== */
const greenMat = new THREE.MeshStandardMaterial({ color: 0x1fa84f, roughness: 0.45, metalness: 0.25 });
const greenDarkMat = new THREE.MeshStandardMaterial({ color: 0x0f6b30, roughness: 0.55, metalness: 0.2 });
const goldMat = new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.28, metalness: 0.85 });
const tableMat = new THREE.MeshStandardMaterial({ color: 0x0c5c2a, roughness: 0.7, metalness: 0.1 });
const pusherMat = new THREE.MeshStandardMaterial({ color: 0xb14eff, roughness: 0.35, metalness: 0.55 });
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffc107, roughness: 0.22, metalness: 0.95, emissive: 0x332200, emissiveIntensity: 0.4 });

/* ==================== cannon-es 物理世界 ==================== */
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.allowSleep = true;

const tablePhysMat = new CANNON.Material('table');
const coinPhysMat = new CANNON.Material('coin');
world.addContactMaterial(new CANNON.ContactMaterial(tablePhysMat, coinPhysMat, {
  friction: 0.45, restitution: 0.05,
}));
world.addContactMaterial(new CANNON.ContactMaterial(coinPhysMat, coinPhysMat, {
  friction: 0.4, restitution: 0.08,
}));

// 工具：创建一个静态盒体（物理 + 网格）
function addStaticBox(w, h, d, x, y, z, mat) {
  const body = new CANNON.Body({
    mass: 0,
    shape: new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2)),
    position: new CANNON.Vec3(x, y, z),
    material: tablePhysMat,
  });
  world.addBody(body);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { body, mesh };
}

// 桌面（架子）
addStaticBox(TABLE_W, 0.3, TABLE_D, 0, -0.15, -0.5, tableMat);
// 后墙
addStaticBox(TABLE_W + 0.8, 3.2, 0.3, 0, 1.45, BACK_Z - 0.15, greenMat);
// 侧墙
addStaticBox(0.3, 3.2, TABLE_D, -TABLE_W / 2 - 0.15, 1.45, -0.5, greenMat);
addStaticBox(0.3, 3.2, TABLE_D, TABLE_W / 2 + 0.15, 1.45, -0.5, greenMat);
// 机柜底座（桌面下方）
addStaticBox(TABLE_W + 0.8, 1.6, TABLE_D + 0.6, 0, -1.1, -0.5, greenDarkMat);
// 金色饰条（顶部边缘）
addStaticBox(TABLE_W + 0.8, 0.18, 0.3, 0, 3.15, BACK_Z - 0.15, goldMat);
addStaticBox(0.18, 0.18, TABLE_D, -TABLE_W / 2 - 0.15, 3.15, -0.5, goldMat);
addStaticBox(0.18, 0.18, TABLE_D, TABLE_W / 2 + 0.15, 3.15, -0.5, goldMat);

/* ==================== 推板 ==================== */
const pusherBody = new CANNON.Body({
  mass: 0,
  type: CANNON.Body.KINEMATIC,
  shape: new CANNON.Box(new CANNON.Vec3(PUSHER_W / 2, PUSHER_H / 2, PUSHER_D / 2)),
  position: new CANNON.Vec3(0, PUSHER_H / 2, PUSHER_Z_MIN),
  material: tablePhysMat,
});
world.addBody(pusherBody);

const pusherMesh = new THREE.Mesh(new THREE.BoxGeometry(PUSHER_W, PUSHER_H, PUSHER_D), pusherMat);
pusherMesh.castShadow = true;
pusherMesh.receiveShadow = true;
scene.add(pusherMesh);

let pusherDir = 1;

/* ==================== 硬币管理 ==================== */
const coins = []; // { body, mesh }
const coinGeo = new THREE.CylinderGeometry(COIN_R, COIN_R, COIN_H, 24);

function spawnCoin(x, y, z) {
  if (coins.length >= MAX_COINS) {
    // 移除最旧的一枚
    const oldest = coins.shift();
    world.removeBody(oldest.body);
    scene.remove(oldest.mesh);
  }
  const body = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Cylinder(COIN_R, COIN_R, COIN_H, 20),
    position: new CANNON.Vec3(x, y, z),
    material: coinPhysMat,
  });
  body.angularDamping = 0.4;
  body.linearDamping = 0.06;
  body.sleepSpeedLimit = 0.25;
  body.sleepTimeLimit = 0.6;
  world.addBody(body);

  const mesh = new THREE.Mesh(coinGeo, coinMat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  coins.push({ body, mesh });
  return body;
}

// 初始铺币（让机器看起来有一堆币）
function fillInitialCoins() {
  const count = 48;
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * (TABLE_W - 1.2);
    const z = -2.5 + Math.random() * 5.5; // -2.5 ~ +3.0
    const y = 0.15 + Math.random() * 0.1;
    spawnCoin(x, y, z);
  }
}

/* ==================== 游戏状态 ==================== */
let score = 0;
let collected = 0;
let isSpinning = false;

/* ==================== 老虎机 ==================== */
function pickSlotResult() {
  const isWin = Math.random() < WIN_CHANCE;
  if (isWin) {
    const s = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    return { symbols: [s, s, s], win: true, reward: SLOT_REWARDS[s] };
  }
  // 随机，但避免三连
  let a, b, c;
  do {
    a = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    b = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
    c = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
  } while (a === b && b === c);
  return { symbols: [a, b, c], win: false, reward: 0 };
}

function spinSlot() {
  if (isSpinning) return;
  isSpinning = true;
  slotResultEl.textContent = 'SPINNING…';

  const result = pickSlotResult();
  reelEls.forEach((r) => r.classList.add('spinning'));

  reelEls.forEach((reel, i) => {
    const totalTicks = 6 + i * 3;
    let tick = 0;
    const interval = setInterval(() => {
      reel.textContent = SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];
      tick++;
      if (tick >= totalTicks) {
        clearInterval(interval);
        reel.textContent = result.symbols[i];
        reel.classList.remove('spinning');

        if (i === 2) {
          // 最后一格停下后结算
          setTimeout(() => finishSlot(result), 150);
        }
      }
    }, 85 + i * 25);
  });
}

function finishSlot(result) {
  if (result.win) {
    slotResultEl.textContent = `🎉 ${result.symbols[0]}${result.symbols[1]}${result.symbols[2]}  中奖！`;
    showWin(result.symbols[0], result.reward);
    dropRewardCoins(result.reward);
  } else {
    slotResultEl.textContent = `${result.symbols.join(' ')}  再接再厉！`;
  }
  isSpinning = false;
}

function dropRewardCoins(amount) {
  for (let i = 0; i < amount; i++) {
    setTimeout(() => {
      const x = (Math.random() - 0.5) * (TABLE_W - 2);
      spawnCoin(x, 2.0, 1.0 + Math.random() * 1.5);
    }, i * 25);
  }
}

function showWin(symbol, reward) {
  winTitle.textContent = `🎰 ${symbol}${symbol}${symbol} 🎰`;
  winMsg.textContent = `中奖！额外掉落 ${reward} 枚硬币！`;
  winPopup.classList.add('show');
  setTimeout(() => winPopup.classList.remove('show'), 2600);
}

/* ==================== 音频（程序合成） ==================== */
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
  }
}
function tone(freq, dur, type = 'sine', vol = 0.15) {
  if (!audioCtx) return;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(vol, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  o.connect(g).connect(audioCtx.destination);
  o.start();
  o.stop(audioCtx.currentTime + dur);
}
function playDrop() { tone(520, 0.08, 'square', 0.08); }
function playCollect() { tone(880, 0.12, 'sine', 0.16); tone(1320, 0.14, 'sine', 0.1); }
function playWin() {
  [660, 830, 990, 1320].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.14), i * 110));
}

/* ==================== 投币 ==================== */
function dropCoin(x) {
  ensureAudio();
  const cx = Math.max(-3.3, Math.min(3.3, x));
  const z = 1.2 + Math.random() * 1.6;
  spawnCoin(cx, 1.8, z);
  playDrop();
  spinSlot();
  hintEl.style.opacity = '0';
}

dropBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  dropCoin((Math.random() - 0.5) * 3.6);
});

// 点击画布 → 瞄准 X 位置投币
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
canvas.addEventListener('pointerdown', (e) => {
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(tablePlane, hit)) {
    dropCoin(hit.x);
  }
});

/* ==================== 主循环 ==================== */
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;

  world.step(1 / 60, dt, 3);

  // 推板往复运动
  const pz = pusherBody.position.z + pusherDir * PUSHER_SPEED * dt;
  if (pz >= PUSHER_Z_MAX) pusherDir = -1;
  if (pz <= PUSHER_Z_MIN) pusherDir = 1;
  pusherBody.position.z = pusherDir === -1 ? Math.min(pz, PUSHER_Z_MAX) : Math.max(pz, PUSHER_Z_MIN);
  pusherMesh.position.set(pusherBody.position.x, pusherBody.position.y, pusherBody.position.z);

  // 同步硬币 + 检测掉落
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    const p = c.body.position;
    c.mesh.position.set(p.x, p.y, p.z);
    c.mesh.quaternion.set(
      c.body.quaternion.x, c.body.quaternion.y,
      c.body.quaternion.z, c.body.quaternion.w
    );

    // 从前端掉落 → 收集
    if (p.z > FRONT_Z + 0.3 && p.y < -0.2) {
      collected++;
      score++;
      world.removeBody(c.body);
      scene.remove(c.mesh);
      coins.splice(i, 1);
      playCollect();
      continue;
    }
    // 掉出侧边/后端/过深 → 清理
    if (Math.abs(p.x) > TABLE_W / 2 + 3 || p.z < BACK_Z - 3 || p.y < -8) {
      world.removeBody(c.body);
      scene.remove(c.mesh);
      coins.splice(i, 1);
    }
  }

  // 更新 UI（节流）
  scoreEl.textContent = score;
  collectedEl.textContent = collected;

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

/* ==================== 窗口缩放 ==================== */
function onResize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', onResize);

/* ==================== 启动 ==================== */
fillInitialCoins();
requestAnimationFrame(loop);
