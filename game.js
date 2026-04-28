import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js";
import { api } from "./api.js";
import { ui } from "./ui.js";

const canvas = document.getElementById("gameCanvas");
const joystickBase = document.getElementById("joystickBase");
const joystickStick = document.getElementById("joystickStick");
const collectBtn = document.getElementById("collectBtn");

const keys = new Set();
const trashObjects = [];
const workerObjects = [];
const mapSize = 58;

let scene;
let camera;
let renderer;
let player;
let van;
let clock;
let paused = false;
let soundEnabled = true;
let lastAutoSave = 0;
let joystick = { x: 0, y: 0 };
let state = defaultState();

function defaultState() {
  return {
    money: 0,
    reputation: 0,
    workers: 1,
    vanCapacity: 10,
    vanSpeed: 1,
    workerEfficiency: 1,
    reputationMultiplier: 1,
    vanLoad: 0,
    playerX: 0,
    playerZ: 0,
    trashSeed: Date.now()
  };
}

function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

function showToast(text) {
  ui.toast(text);
}

function makeBox(w, h, d, color) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

function makeCylinder(radius, height, color) {
  const geo = new THREE.CylinderGeometry(radius, radius, height, 18);
  const mat = new THREE.MeshStandardMaterial({ color });
  return new THREE.Mesh(geo, mat);
}

function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101820);
  scene.fog = new THREE.Fog(0x101820, 45, 90);

  camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 200);
  camera.position.set(0, 22, 24);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);

  const hemi = new THREE.HemisphereLight(0xb8d8ff, 0x182018, 1.6);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(18, 35, 12);
  scene.add(sun);

  const groundGeo = new THREE.PlaneGeometry(mapSize, mapSize);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x243326 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  addRoads();
  addDumpZone();
  addPlayer();
  addVan();
  spawnTrashBatch(30);
  createWorkers();

  clock = new THREE.Clock();

  window.addEventListener("resize", onResize);
}

function addRoads() {
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x25282c });

  const road1 = new THREE.Mesh(new THREE.BoxGeometry(mapSize, 0.05, 6), roadMat);
  road1.position.y = 0.03;
  scene.add(road1);

  const road2 = new THREE.Mesh(new THREE.BoxGeometry(6, 0.05, mapSize), roadMat);
  road2.position.y = 0.04;
  scene.add(road2);

  for (let i = -24; i <= 24; i += 12) {
    const house = makeBox(5, randRange(3, 7), 5, 0x334155);
    house.position.set(i, house.geometry.parameters.height / 2, -20);
    scene.add(house);

    const house2 = makeBox(5, randRange(3, 7), 5, 0x3b3a30);
    house2.position.set(i, house2.geometry.parameters.height / 2, 20);
    scene.add(house2);
  }
}

function addDumpZone() {
  const zone = makeCylinder(4, 0.18, 0x1f8f5f);
  zone.position.set(-22, 0.09, -22);
  scene.add(zone);

  const sign = makeBox(4, 2, 0.25, 0xffcf70);
  sign.position.set(-22, 2, -26);
  scene.add(sign);
}

function addPlayer() {
  player = makeCylinder(0.75, 1.8, 0xfff3a3);
  player.position.set(state.playerX, 0.9, state.playerZ);
  scene.add(player);
}

function addVan() {
  van = makeBox(3.4, 1.7, 5.2, 0x22c55e);
  van.position.set(3, 0.85, 3);
  scene.add(van);

  const cab = makeBox(3.2, 1.4, 1.8, 0x16a34a);
  cab.position.set(3, 1.7, 5.1);
  scene.add(cab);
  van.userData.cab = cab;
}

function spawnTrashBatch(count) {
  for (let i = 0; i < count; i++) spawnTrash();
}

function spawnTrash() {
  const item = makeBox(0.8, 0.45, 0.8, 0x8b5a2b);
  item.position.set(randRange(-26, 26), 0.24, randRange(-26, 26));
  item.userData.value = Math.floor(randRange(5, 13));
  scene.add(item);
  trashObjects.push(item);
}

function createWorkers() {
  for (const worker of workerObjects) {
    scene.remove(worker);
  }
  workerObjects.length = 0;

  for (let i = 0; i < state.workers; i++) {
    const worker = makeCylinder(0.55, 1.4, 0x60a5fa);
    worker.position.set(randRange(-5, 5), 0.7, randRange(-5, 5));
    worker.userData.target = null;
    scene.add(worker);
    workerObjects.push(worker);
  }
}

function collectNearestByPlayer() {
  if (state.vanLoad >= state.vanCapacity) {
    showToast("Van full. Return to the green dump zone.");
    return;
  }

  let nearest = null;
  let nearestDist = Infinity;

  for (const item of trashObjects) {
    const dist = item.position.distanceTo(player.position);
    if (dist < nearestDist) {
      nearest = item;
      nearestDist = dist;
    }
  }

  if (nearest && nearestDist < 2.1) {
    collectTrash(nearest, true);
  }
}

function collectTrash(item, isPlayer) {
  const index = trashObjects.indexOf(item);
  if (index >= 0) trashObjects.splice(index, 1);

  scene.remove(item);

  const gain = item.userData.value;
  state.vanLoad = clamp(state.vanLoad + 1, 0, state.vanCapacity);
  state.money += gain;
  state.reputation += isPlayer ? 1 * state.reputationMultiplier : 0.45 * state.reputationMultiplier;

  spawnTrash();

  if (soundEnabled) beep(180, 0.05);
}

function depositIfAtDump() {
  const dump = new THREE.Vector3(-22, 0, -22);
  const dist = player.position.distanceTo(dump);

  if (dist < 4.5 && state.vanLoad > 0) {
    const bonus = Math.floor(state.vanLoad * state.reputationMultiplier * 2);
    state.money += bonus;
    state.reputation += state.vanLoad * state.reputationMultiplier;
    state.vanLoad = 0;
    showToast(`Dump run complete. Bonus £${bonus}.`);
    if (soundEnabled) beep(320, 0.08);
  }
}

function updateWorkers(dt) {
  for (const worker of workerObjects) {
    if (!worker.userData.target || !trashObjects.includes(worker.userData.target)) {
      worker.userData.target = trashObjects[Math.floor(Math.random() * trashObjects.length)] || null;
    }

    const target = worker.userData.target;
    if (!target) continue;

    const dir = target.position.clone().sub(worker.position);
    const dist = dir.length();

    if (dist < 1.2 && state.vanLoad < state.vanCapacity) {
      collectTrash(target, false);
      worker.userData.target = null;
      continue;
    }

    if (dist > 0.01) {
      dir.normalize();
      const speed = 2.2 * state.workerEfficiency;
      worker.position.addScaledVector(dir, speed * dt);
    }
  }
}

function updateMovement(dt) {
  const move = new THREE.Vector3();

  if (keys.has("KeyW") || keys.has("ArrowUp")) move.z -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) move.z += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) move.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) move.x += 1;

  move.x += joystick.x;
  move.z += joystick.y;

  if (move.lengthSq() > 0.01) {
    move.normalize();
    player.position.addScaledVector(move, 6 * state.vanSpeed * dt);
    player.position.x = clamp(player.position.x, -28, 28);
    player.position.z = clamp(player.position.z, -28, 28);
    player.lookAt(player.position.clone().add(move));
  }

  van.position.lerp(new THREE.Vector3(player.position.x + 3, 0.85, player.position.z + 3), 0.04);
  if (van.userData.cab) {
    van.userData.cab.position.lerp(new THREE.Vector3(van.position.x, 1.7, van.position.z + 2.1), 0.04);
  }

  state.playerX = player.position.x;
  state.playerZ = player.position.z;
}

function updateCamera() {
  camera.position.lerp(new THREE.Vector3(player.position.x, 24, player.position.z + 25), 0.08);
  camera.lookAt(player.position.x, 0, player.position.z);
}

function buy(cost, fn, text) {
  if (state.money < cost) {
    showToast("Not enough money. Story of my ranked teammates.");
    return;
  }

  state.money -= cost;
  fn();
  showToast(text);
  ui.updateHud(state);
}

function setupEvents() {
  window.addEventListener("keydown", (event) => {
    keys.add(event.code);
    if (event.code === "Space") collectNearestByPlayer();
    if (event.code === "KeyE") depositIfAtDump();
  });

  window.addEventListener("keyup", (event) => {
    keys.delete(event.code);
  });

  collectBtn.addEventListener("click", () => {
    collectNearestByPlayer();
    depositIfAtDump();
  });

  window.addEventListener("trash:pause", () => {
    paused = true;
  });

  window.addEventListener("trash:resume", () => {
    paused = false;
  });

  window.addEventListener("trash:sound", (event) => {
    soundEnabled = Boolean(event.detail.enabled);
  });

  window.addEventListener("trash:save", async () => {
    await saveNow();
  });

  window.addEventListener("trash:buyWorker", () => {
    buy(100, () => {
      state.workers = clamp(state.workers + 1, 1, 6);
      createWorkers();
    }, "Worker hired. Slightly better than solo queue.");
  });

  window.addEventListener("trash:upgradeCapacity", () => {
    buy(75, () => {
      state.vanCapacity += 5;
    }, "Van capacity upgraded.");
  });

  window.addEventListener("trash:upgradeSpeed", () => {
    buy(90, () => {
      state.vanSpeed = Number((state.vanSpeed + 0.12).toFixed(2));
    }, "Van speed upgraded.");
  });

  window.addEventListener("trash:upgradeWorkers", () => {
    buy(120, () => {
      state.workerEfficiency = Number((state.workerEfficiency + 0.15).toFixed(2));
    }, "Workers became less useless.");
  });

  window.addEventListener("trash:upgradeRep", () => {
    buy(150, () => {
      state.reputationMultiplier = Number((state.reputationMultiplier + 0.2).toFixed(2));
    }, "Reputation multiplier upgraded.");
  });

  setupJoystick();
}

function setupJoystick() {
  let active = false;
  const rectCenter = () => {
    const rect = joystickBase.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2
    };
  };

  function moveStick(clientX, clientY) {
    const center = rectCenter();
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    const max = 38;
    const len = Math.hypot(dx, dy);
    const scale = len > max ? max / len : 1;
    const sx = dx * scale;
    const sy = dy * scale;

    joystickStick.style.transform = `translate(${sx}px, ${sy}px)`;
    joystick.x = sx / max;
    joystick.y = sy / max;
  }

  joystickBase.addEventListener("pointerdown", (event) => {
    active = true;
    joystickBase.setPointerCapture(event.pointerId);
    moveStick(event.clientX, event.clientY);
  });

  joystickBase.addEventListener("pointermove", (event) => {
    if (active) moveStick(event.clientX, event.clientY);
  });

  joystickBase.addEventListener("pointerup", () => {
    active = false;
    joystick = { x: 0, y: 0 };
    joystickStick.style.transform = "translate(0, 0)";
  });
}

function beep(freq, duration) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const ctx = new AudioContextClass();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.frequency.value = freq;
  gain.gain.value = 0.03;

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

async function saveNow() {
  try {
    await api.saveGame(state);
    showToast("Saved.");
    await loadLeaderboard();
  } catch (err) {
    showToast(err.message);
  }
}

async function loadSave() {
  try {
    const result = await api.loadSave();
    if (result.save) {
      state = { ...defaultState(), ...result.save };
    }
  } catch {
    state = defaultState();
  }
}

async function loadLeaderboard() {
  try {
    const result = await api.leaderboard();
    ui.setLeaderboard(result.rows);
  } catch {
    ui.setLeaderboard([]);
  }
}

function onResize() {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
}

function animate(time) {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  if (!paused) {
    updateMovement(dt);
    updateWorkers(dt);
    depositIfAtDump();
    updateCamera();
  }

  ui.updateHud(state);
  renderer.render(scene, camera);

  if (time - lastAutoSave > 30000) {
    lastAutoSave = time;
    saveNow();
  }
}

async function boot() {
  setupEvents();

  try {
    await api.me();
    ui.showGame();
    await loadSave();
    initThree();
    await loadLeaderboard();
    animate(0);
  } catch {
    window.addEventListener("trash:authed", async () => {
      await loadSave();
      initThree();
      await loadLeaderboard();
      animate(0);
    }, { once: true });
  }
}

boot();
