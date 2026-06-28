import React, { useRef, useEffect, useState, useCallback } from "react";

/**
 * <HectorRunnerGame />
 * Endless runner easter-egg pour H€CTOR — "Course avec Hector".
 *
 * ── ASSETS ──────────────────────────────────────────────────────────
 * Place les PNG (fond transparent, Hector orienté à droite) dans :
 *   src/assets/game/
 *     hector_run_1.png … hector_run_4.png   (cycle de course)
 *     hector_jump.png  hector_fall.png  hector_land.png  hector_ko.png
 *     hector_idle.png
 *     obstacle_urssaf.png  obstacle_facture.png  obstacle_achat.png
 *
 * Adapte le chemin dans ASSET_BASE ci-dessous selon ton bundler (Vite : import.meta.url
 * ou imports statiques). Si une image manque, un fallback vectoriel prend le relais
 * → jamais d'écran cassé.
 *
 * ── PROPS ───────────────────────────────────────────────────────────
 *   onClose?         () => void
 *   initialBest?     number
 *   initialBestDist? number
 *   onScore?         ({best, bestDist}) => void   (remontée profil)
 *   assetBase?       string  (préfixe d'URL des sprites, défaut "/assets/game/")
 *
 * ── ÉVOLUTIONS PRÉVUES ──────────────────────────────────────────────
 *   CONFIG / TIERS / OBSTACLE_DEFS / DECOR_STAGES centralisés.
 *   audio = stub prêt à recevoir de vrais sons.
 *   Hooks onScore isolés pour leaderboard / défis plus tard.
 */

/* ================================================================== */
/* CONFIG                                                             */
/* ================================================================== */
const CONFIG = {
  width: 800,
  height: 360,
  ground: 300,
  gravity: 2400,
  jumpV: -790,
  holdBoost: -520,
  maxHold: 0.22,
  startLives: 3,
  coinPoints: 10,
  invuln: 1.2,
  hectorScreenH: 92, // hauteur d'affichage d'Hector en px
};

/* Paliers de difficulté selon la distance (m) ─ endless, jamais de fin. */
const TIERS = [
  { from: 0,    speed: 320, spawn: 1.6,  coin: 1.2 },
  { from: 500,  speed: 420, spawn: 1.35, coin: 1.1 },
  { from: 1500, speed: 540, spawn: 1.1,  coin: 1.0 },
  { from: 3000, speed: 680, spawn: 0.85, coin: 0.95 },
  { from: 5000, speed: 800, spawn: 0.7,  coin: 0.9 },
];
function tierFor(dist) {
  let t = TIERS[0];
  for (const x of TIERS) if (dist >= x.from) t = x;
  return t;
}

/* Décor évolutif : Paris simple → luxe doré. Interpolation entre paliers. */
const DECOR_STAGES = [
  { from: 0,    name: "toits de Paris",   skyTop: "#2E6FB0", skyMid: "#7FB6E0", skyLow: "#F4C98A", roofs: "#1C2F47", ground: "#3A3026", accent: null },
  { from: 800,  name: "beaux quartiers",  skyTop: "#345C9E", skyMid: "#8FA8D8", skyLow: "#F0C49A", roofs: "#27314E", ground: "#3D352B", accent: null },
  { from: 1800, name: "skyline chic",     skyTop: "#3B3F7A", skyMid: "#7E86C4", skyLow: "#E9B6C0", roofs: "#2C2A52", ground: "#332C3A", accent: "#5DCAA5" },
  { from: 3200, name: "rooftop premium",  skyTop: "#2A2350", skyMid: "#5E4F9E", skyLow: "#E59FB0", roofs: "#241E45", ground: "#2A2438", accent: "#7F77DD" },
  { from: 5000, name: "luxe total",       skyTop: "#1A1430", skyMid: "#3E2F6E", skyLow: "#E0A65E", roofs: "#171232", ground: "#241B33", accent: "#F0B429" },
];
function lerp(a, b, t) { return a + (b - a) * t; }
function hexLerp(h1, h2, t) {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const r = Math.round(lerp((a >> 16) & 255, (b >> 16) & 255, t));
  const g = Math.round(lerp((a >> 8) & 255, (b >> 8) & 255, t));
  const bl = Math.round(lerp(a & 255, b & 255, t));
  return `rgb(${r},${g},${bl})`;
}
function decorFor(dist) {
  let i = 0;
  for (let k = 0; k < DECOR_STAGES.length; k++) if (dist >= DECOR_STAGES[k].from) i = k;
  const cur = DECOR_STAGES[i], nxt = DECOR_STAGES[i + 1];
  if (!nxt) return { ...cur, neon: dist >= 5000 };
  const span = nxt.from - cur.from;
  const t = Math.min(1, (dist - cur.from) / span);
  return {
    name: t > 0.5 ? nxt.name : cur.name,
    skyTop: hexLerp(cur.skyTop, nxt.skyTop, t),
    skyMid: hexLerp(cur.skyMid, nxt.skyMid, t),
    skyLow: hexLerp(cur.skyLow, nxt.skyLow, t),
    roofs: hexLerp(cur.roofs, nxt.roofs, t),
    ground: hexLerp(cur.ground, nxt.ground, t),
    accent: nxt.accent,
    neon: false,
  };
}

/* Obstacles : galères administratives (sprites + fallback couleur). */
const OBSTACLE_DEFS = [
  { id: "urssaf",  sprite: "obstacle_urssaf.png",  label: "URSSAF",  color: "#D8453F", h: 58 },
  { id: "facture", sprite: "obstacle_facture.png", label: "FACTURE", color: "#E8E2D2", h: 60, dark: true },
  { id: "achat",   sprite: "obstacle_achat.png",   label: "ACHAT",   color: "#5FA83C", h: 56 },
];

/* Sprites Hector. */
const HECTOR_SPRITES = {
  run: ["hector_run_1.png", "hector_run_2.png", "hector_run_3.png", "hector_run_4.png"],
  jump: "hector_jump.png",
  fall: "hector_fall.png",
  land: "hector_land.png",
  ko: "hector_ko.png",
  idle: "hector_idle.png",
};

const RECORD_LINES = [
  "Wouaf ! On forme une sacrée équipe ❤️",
  "Je savais qu'on pouvait aller plus loin.",
  "Ça, c'est de la course ! 🐾",
  "Personne ne nous arrête aujourd'hui.",
  "Tu cours, je gère. Belle équipe.",
];

/* ── audio : architecture prête, sons à brancher ── */
function createAudio() {
  return {
    jump: () => {}, coin: () => {}, hit: () => {}, gameover: () => {},
    music: { play: () => {}, stop: () => {} },
  };
}

/* ── persistance locale ── */
const LS_KEY = "hector_runner_best_v1";
const loadLocal = () => { try { return JSON.parse(localStorage.getItem(LS_KEY)) || { best: 0, bestDist: 0 }; } catch { return { best: 0, bestDist: 0 }; } };
const saveLocal = (d) => { try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch {} };

/* ================================================================== */
/* COMPOSANT                                                          */
/* ================================================================== */
export default function HectorRunnerGame({
  onClose,
  onScore,
  initialBest = 0,
  initialBestDist = 0,
  assetBase = "/assets/game/",
}) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const audioRef = useRef(null);
  const imagesRef = useRef({});          // cache des HTMLImageElement chargés
  const gameRef = useRef(null);

  const [screen, setScreen] = useState("menu");
  const [hud, setHud] = useState({ dist: 0, score: 0, lives: CONFIG.startLives });
  const [result, setResult] = useState({ dist: 0, score: 0, isRecord: false, line: "" });
  const [loaded, setLoaded] = useState(false);

  const bestRef = useRef({
    best: Math.max(initialBest, loadLocal().best),
    bestDist: Math.max(initialBestDist, loadLocal().bestDist),
  });

  /* ---------- préchargement des sprites ---------- */
  useEffect(() => {
    audioRef.current = createAudio();
    const names = [
      ...HECTOR_SPRITES.run,
      HECTOR_SPRITES.jump, HECTOR_SPRITES.fall, HECTOR_SPRITES.land,
      HECTOR_SPRITES.ko, HECTOR_SPRITES.idle,
      ...OBSTACLE_DEFS.map((o) => o.sprite),
    ];
    let pending = names.length;
    const done = () => { if (--pending <= 0) setLoaded(true); };
    names.forEach((n) => {
      const img = new Image();
      img.onload = () => { imagesRef.current[n] = img; done(); };
      img.onerror = () => { done(); }; // manquant → fallback vectoriel
      img.src = assetBase + n;
    });
    // sécurité : démarre quand même après 4s si un asset traîne
    const to = setTimeout(() => setLoaded(true), 4000);
    return () => clearTimeout(to);
  }, [assetBase]);

  const getImg = (name) => imagesRef.current[name] || null;

  /* ---------- cycle de vie d'une partie ---------- */
  const newGame = useCallback(() => {
    gameRef.current = {
      t: 0, dist: 0, score: 0, lives: CONFIG.startLives,
      speed: TIERS[0].speed, invuln: 0, shake: 0, coinPulse: 0,
      hector: { x: 140, y: CONFIG.ground, vy: 0, onGround: true, holding: false, holdTime: 0, runFrame: 0, frameT: 0, landT: 0, squash: 1 },
      obstacles: [], coins: [], particles: [],
      spawnTimer: 1.2, coinTimer: 0.8, bgOffset: 0,
    };
  }, []);

  const jump = useCallback(() => {
    const g = gameRef.current; if (!g) return;
    const h = g.hector;
    if (h.onGround) { h.vy = CONFIG.jumpV; h.onGround = false; h.holding = true; h.holdTime = 0; h.squash = 0.78; audioRef.current?.jump(); }
  }, []);
  const release = useCallback(() => { const g = gameRef.current; if (g) g.hector.holding = false; }, []);

  const start = useCallback(() => { newGame(); setHud({ dist: 0, score: 0, lives: CONFIG.startLives }); setScreen("playing"); audioRef.current?.music.play(); }, [newGame]);
  const togglePause = useCallback(() => setScreen((s) => (s === "playing" ? "paused" : s === "paused" ? "playing" : s)), []);

  /* ---------- inputs ---------- */
  useEffect(() => {
    const kd = (e) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        if (screen === "menu" || screen === "over") { start(); return; }
        if (screen === "playing" && !e.repeat) jump();
      }
      if (e.code === "KeyP") togglePause();
      if (e.code === "Escape" && onClose) onClose();
    };
    const ku = (e) => { if (e.code === "Space" || e.code === "ArrowUp") release(); };
    window.addEventListener("keydown", kd);
    window.addEventListener("keyup", ku);
    return () => { window.removeEventListener("keydown", kd); window.removeEventListener("keyup", ku); };
  }, [screen, start, jump, release, togglePause, onClose]);

  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    if (screen === "menu" || screen === "over") { start(); return; }
    if (screen === "playing") jump();
  }, [screen, start, jump]);

  /* ================================================================ */
  /* BOUCLE                                                          */
  /* ================================================================ */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.033, (now - last) / 1000); last = now;
      const g = gameRef.current;
      if (g && screen === "playing") {
        update(g, dt);
        if (Math.floor(g.t * 10) !== Math.floor((g.t - dt) * 10))
          setHud({ dist: Math.floor(g.dist), score: g.score, lives: g.lives });
      }
      render(ctx, g);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [screen, loaded]);

  /* ---------- update ---------- */
  function update(g, dt) {
    g.t += dt;
    g.dist += (g.speed * dt) / 14;
    const tier = tierFor(g.dist);
    g.speed += (tier.speed - g.speed) * Math.min(1, dt * 0.6); // lissage vers la vitesse du palier
    g.bgOffset += g.speed * dt;
    if (g.invuln > 0) g.invuln -= dt;
    if (g.shake > 0) g.shake -= dt;
    if (g.coinPulse > 0) g.coinPulse -= dt;

    const h = g.hector;
    h.vy += CONFIG.gravity * dt;
    if (h.holding && h.holdTime < CONFIG.maxHold && h.vy < 0) { h.vy += CONFIG.holdBoost * dt; h.holdTime += dt; }
    h.y += h.vy * dt;
    if (h.y >= CONFIG.ground) {
      if (!h.onGround) { h.squash = 1.3; h.landT = 0.13; }
      h.y = CONFIG.ground; h.vy = 0; h.onGround = true; h.holding = false;
    }
    h.squash += (1 - h.squash) * Math.min(1, dt * 12);
    if (h.landT > 0) h.landT -= dt;
    // anim de course
    h.frameT += dt;
    const frameDur = Math.max(0.06, 0.16 - g.speed / 8000);
    if (h.frameT >= frameDur) { h.frameT = 0; h.runFrame = (h.runFrame + 1) % 4; }

    // spawn obstacles
    g.spawnTimer -= dt;
    if (g.spawnTimer <= 0) {
      const def = OBSTACLE_DEFS[(Math.random() * OBSTACLE_DEFS.length) | 0];
      const img = getImg(def.sprite);
      const h2 = def.h;
      const w2 = img ? (img.width / img.height) * h2 : h2 * 0.85;
      g.obstacles.push({ ...def, x: CONFIG.width + 40, y: CONFIG.ground, w: w2, dh: h2, wobble: Math.random() * 6 });
      g.spawnTimer = tier.spawn + Math.random() * 0.6;
    }
    // spawn pièces
    g.coinTimer -= dt;
    if (g.coinTimer <= 0) {
      const high = Math.random() < 0.45;
      const cluster = 1 + ((Math.random() * 3) | 0);
      for (let i = 0; i < cluster; i++)
        g.coins.push({ x: CONFIG.width + 40 + i * 36, y: high ? CONFIG.ground - 120 : CONFIG.ground - 54, got: false, spin: Math.random() * Math.PI });
      g.coinTimer = tier.coin + Math.random() * 0.8;
    }

    const hb = { x: h.x - 30, y: h.y - CONFIG.hectorScreenH + 14, w: 56, h: CONFIG.hectorScreenH - 20 };

    for (let i = g.obstacles.length - 1; i >= 0; i--) {
      const o = g.obstacles[i]; o.x -= g.speed * dt;
      if (o.x + o.w < -20) { g.obstacles.splice(i, 1); continue; }
      const ob = { x: o.x - o.w / 2 + 6, y: o.y - o.dh + 4, w: o.w - 12, h: o.dh - 8 };
      if (g.invuln <= 0 && aabb(hb, ob)) {
        g.lives -= 1; g.invuln = CONFIG.invuln; g.shake = 0.35;
        audioRef.current?.hit();
        for (let k = 0; k < 16; k++) g.particles.push(burst(h.x, h.y - 40, o.color));
        g.obstacles.splice(i, 1);
        if (g.lives <= 0) { endGame(g); return; }
      }
    }
    for (let i = g.coins.length - 1; i >= 0; i--) {
      const c = g.coins[i]; c.x -= g.speed * dt; c.spin += dt * 6;
      const dx = c.x - h.x, dy = c.y - (h.y - 44);
      if (!c.got && Math.hypot(dx, dy) < 38) {
        c.got = true; g.score += CONFIG.coinPoints; g.coinPulse = 0.18;
        audioRef.current?.coin();
        for (let k = 0; k < 8; k++) g.particles.push(burst(c.x, c.y, "#F0B429"));
      }
      if (c.x < -20 || c.got) g.coins.splice(i, 1);
    }
    for (let i = g.particles.length - 1; i >= 0; i--) {
      const p = g.particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 900 * dt; p.life -= dt;
      if (p.life <= 0) g.particles.splice(i, 1);
    }
    if (h.onGround && Math.random() < 0.4)
      g.particles.push({ x: h.x - 30, y: CONFIG.ground - 2, vx: -g.speed * 0.3 - 30, vy: -Math.random() * 60, life: 0.4, max: 0.4, color: "rgba(225,215,195,0.75)", r: 2 + Math.random() * 3 });
  }

  function endGame(g) {
    audioRef.current?.gameover(); audioRef.current?.music.stop();
    const dist = Math.floor(g.dist), score = g.score;
    const prev = bestRef.current;
    const isRecord = dist > prev.bestDist || score > prev.best;
    const next = { best: Math.max(prev.best, score), bestDist: Math.max(prev.bestDist, dist) };
    bestRef.current = next; saveLocal(next); onScore && onScore(next);
    setResult({ dist, score, isRecord, line: RECORD_LINES[(Math.random() * RECORD_LINES.length) | 0] });
    setScreen("over");
  }

  /* ================================================================ */
  /* RENDU                                                           */
  /* ================================================================ */
  function render(ctx, g) {
    const W = CONFIG.width, H = CONFIG.height;
    const dist = g ? g.dist : 0;
    const DC = decorFor(dist);
    ctx.save();
    if (g && g.shake > 0) { const s = g.shake * 14; ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s); }
    drawBackground(ctx, g, DC);
    if (g) {
      g.coins.forEach((c) => drawCoin(ctx, c, g));
      g.obstacles.forEach((o) => drawObstacle(ctx, o, g));
      drawParticles(ctx, g);
      drawHector(ctx, g);
    } else {
      drawHectorIdle(ctx);
    }
    ctx.restore();
  }

  function drawBackground(ctx, g, DC) {
    const W = CONFIG.width, GR = CONFIG.ground, t = g ? g.t : performance.now() / 1000;
    const sky = ctx.createLinearGradient(0, 0, 0, GR);
    sky.addColorStop(0, DC.skyTop); sky.addColorStop(0.55, DC.skyMid); sky.addColorStop(1, DC.skyLow);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, GR);

    // soleil / lune
    ctx.fillStyle = "rgba(255,225,170,0.5)";
    ctx.beginPath(); ctx.arc(W * 0.66, GR - 50, 46, 0, 7); ctx.fill();

    // néons en mode luxe
    if (DC.neon) {
      ctx.fillStyle = "rgba(240,180,41,0.15)";
      for (let i = 0; i < 5; i++) { const x = (i * 170 - (g ? g.bgOffset * 0.5 : 0) % 850 + 850) % 850; ctx.fillRect(x, 40, 3, GR - 60); }
    }

    // nuages
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    for (let i = 0; i < 4; i++) { const cx = (W + 200) - ((t * 16 + i * 230) % (W + 300)); cloud(ctx, cx, 50 + (i % 2) * 34, 26 + (i % 2) * 8); }

    // Tour Eiffel
    drawEiffel(ctx, W * 0.5, GR, DC.roofs);

    // toits (parallax)
    const off = g ? (g.bgOffset * 0.35) % 90 : 0;
    ctx.fillStyle = DC.roofs;
    for (let i = -1; i < 12; i++) { const x = i * 90 - off, bh = 50 + ((i * 53) % 60); ctx.fillRect(x, GR - bh, 56, bh); ctx.fillRect(x + 30, GR - bh - 16, 9, 16); }

    // accent doré/vert sur certains toits selon le palier
    if (DC.accent) {
      ctx.fillStyle = DC.accent; ctx.globalAlpha = 0.5;
      for (let i = -1; i < 12; i++) { const x = i * 90 - off, bh = 50 + ((i * 53) % 60); if (i % 3 === 0) ctx.fillRect(x, GR - bh, 56, 4); }
      ctx.globalAlpha = 1;
    }

    // sol
    ctx.fillStyle = DC.ground; ctx.fillRect(0, GR, W, CONFIG.height - GR);
    ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 2;
    const goff = g ? g.bgOffset % 44 : 0;
    for (let x = -goff; x < W; x += 44) { ctx.beginPath(); ctx.moveTo(x, GR + 22); ctx.lineTo(x + 16, GR + 22); ctx.stroke(); }
    ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, GR); ctx.lineTo(W, GR); ctx.stroke();
  }

  function cloud(ctx, x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.arc(x + r, y + 4, r * 0.8, 0, 7); ctx.arc(x - r, y + 4, r * 0.8, 0, 7); ctx.arc(x, y + 8, r, 0, 7); ctx.fill(); }
  function drawEiffel(ctx, x, gr, col) {
    ctx.save(); ctx.globalAlpha = 0.3; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 3;
    const top = gr - 180;
    ctx.beginPath(); ctx.moveTo(x - 26, gr); ctx.lineTo(x - 6, top); ctx.moveTo(x + 26, gr); ctx.lineTo(x + 6, top); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 20, gr - 48); ctx.lineTo(x + 20, gr - 48); ctx.moveTo(x - 12, gr - 105); ctx.lineTo(x + 12, gr - 105); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - 6, top); ctx.lineTo(x, top - 16); ctx.lineTo(x + 6, top); ctx.fill();
    ctx.restore();
  }

  /* ---------- Hector (sprite + fallback) ---------- */
  function currentHectorSprite(g) {
    const h = g.hector;
    if (g.lives <= 0) return HECTOR_SPRITES.ko;
    if (!h.onGround) return h.vy < 0 ? HECTOR_SPRITES.jump : HECTOR_SPRITES.fall;
    if (h.landT > 0) return HECTOR_SPRITES.land;
    return HECTOR_SPRITES.run[h.runFrame];
  }

  function drawHector(ctx, g) {
    const h = g.hector;
    const name = currentHectorSprite(g);
    const img = getImg(name);
    ctx.save();
    ctx.translate(h.x, h.y);
    if (g.invuln > 0 && Math.floor(g.t * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    const zoom = 1 + (g.coinPulse > 0 ? g.coinPulse * 0.4 : 0);
    ctx.scale(zoom / h.squash, zoom * h.squash);
    if (img) {
      const dh = CONFIG.hectorScreenH;
      const dw = (img.width / img.height) * dh;
      ctx.drawImage(img, -dw * 0.55, -dh, dw, dh); // pivot bas, légèrement vers l'avant
    } else {
      drawHectorFallback(ctx, h);
    }
    ctx.restore();
  }

  function drawHectorIdle(ctx) {
    const img = getImg(HECTOR_SPRITES.idle) || getImg(HECTOR_SPRITES.run[0]);
    ctx.save(); ctx.translate(150, CONFIG.ground);
    const bob = Math.sin(performance.now() / 400) * 3;
    if (img) { const dh = CONFIG.hectorScreenH * 1.1, dw = (img.width / img.height) * dh; ctx.drawImage(img, -dw / 2, -dh + bob, dw, dh); }
    else { drawHectorFallback(ctx, { runFrame: 0, legPhase: performance.now() / 100 }); }
    ctx.restore();
  }

  // fallback vectoriel minimal si un sprite manque
  function drawHectorFallback(ctx, h) {
    ctx.fillStyle = "#FAF8F4";
    ctx.beginPath(); ctx.ellipse(-6, -40, 30, 18, -0.05, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(26, -50, 18, 14, -0.18, 0, 7); ctx.fill();
    ctx.fillStyle = "#15171C";
    ctx.beginPath(); ctx.ellipse(-16, -46, 14, 12, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(22, -60, 9, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2D7BD4"; ctx.fillRect(8, -42, 14, 4);
  }

  /* ---------- obstacles ---------- */
  function drawObstacle(ctx, o, g) {
    const img = getImg(o.sprite);
    ctx.save();
    const wob = Math.sin(g.t * 8 + o.wobble) * 2;
    ctx.translate(o.x, o.y + wob);
    if (img) {
      const dh = o.dh + 6, dw = (img.width / img.height) * dh;
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    } else {
      ctx.fillStyle = o.color; roundRect(ctx, -o.w / 2, -o.dh, o.w, o.dh, 6); ctx.fill();
      ctx.fillStyle = o.dark ? "#222" : "#fff"; ctx.font = "700 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(o.label, 0, -o.dh / 2);
    }
    ctx.restore();
  }

  /* ---------- pièces ---------- */
  function drawCoin(ctx, c, g) {
    ctx.save();
    ctx.translate(c.x, c.y + Math.sin(g.t * 3 + c.spin) * 3);
    const rw = 2 + Math.abs(Math.cos(c.spin)) * 13;
    ctx.fillStyle = "rgba(240,180,41,0.25)"; ctx.beginPath(); ctx.arc(0, 0, 18, 0, 7); ctx.fill();
    ctx.fillStyle = "#F0B429"; ctx.beginPath(); ctx.ellipse(0, 0, rw, 14, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#C98A0E"; ctx.lineWidth = 2; ctx.stroke();
    if (rw > 7) { ctx.fillStyle = "#7A5208"; ctx.font = "700 15px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("€", 0, 1); }
    ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.beginPath(); ctx.ellipse(-rw * 0.3, -5, rw * 0.2, 4, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawParticles(ctx, g) {
    g.particles.forEach((p) => { ctx.globalAlpha = Math.max(0, p.life / (p.max || 0.5)); ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.r || 3, 0, 7); ctx.fill(); });
    ctx.globalAlpha = 1;
  }

  /* ================================================================ */
  /* UI                                                              */
  /* ================================================================ */
  const C = { green: "#5DCAA5", accent: "#378ADD", red: "#E24B4A", gold: "#F0B429" };
  const best = bestRef.current;

  return (
    <div style={ST.wrap}>
      <div style={ST.frame}>
        <canvas ref={canvasRef} width={CONFIG.width} height={CONFIG.height} onPointerDown={onPointerDown} onPointerUp={release} style={ST.canvas} />

        {!loaded && <div style={ST.overlay}><div style={{ fontSize: 16 }}>Chargement d'Hector…</div></div>}

        {loaded && (screen === "playing" || screen === "paused") && (
          <div style={ST.hud}>
            <div style={ST.col}><span style={ST.lab}>DISTANCE</span><span style={ST.val}>{hud.dist} m</span></div>
            <div style={{ ...ST.col, alignItems: "center" }}><span style={ST.lab}>SCORE</span><span style={{ ...ST.val, color: C.green }}>{hud.score} €</span></div>
            <div style={{ ...ST.col, alignItems: "center" }}>
              <span style={ST.lab}>VIES</span>
              <span style={{ fontSize: 18 }}>{"❤️".repeat(Math.max(0, hud.lives))}<span style={{ opacity: 0.3 }}>{"🤍".repeat(Math.max(0, CONFIG.startLives - hud.lives))}</span></span>
            </div>
            <button style={ST.pause} onClick={togglePause} aria-label="Pause">{screen === "paused" ? "▶" : "⏸"}</button>
          </div>
        )}

        {loaded && screen === "menu" && (
          <div style={ST.overlay}>
            <h2 style={ST.title}>Course avec <span style={{ color: C.accent }}>Hector</span></h2>
            <p style={ST.sub}>Aide Hector à éviter les galères et attraper les € !</p>
            <button style={ST.play} onClick={start}>🐾 Jouer</button>
            <p style={ST.hint}>Espace / clic / tap pour sauter</p>
            {best.bestDist > 0 && <p style={ST.bestL}>🏆 Record : {best.bestDist} m · {best.best} €</p>}
          </div>
        )}

        {screen === "paused" && (
          <div style={ST.overlay}>
            <h2 style={ST.title}>Pause</h2>
            <button style={ST.play} onClick={togglePause}>▶ Reprendre</button>
            {onClose && <button style={ST.ghost} onClick={onClose}>🏠 Quitter</button>}
          </div>
        )}

        {screen === "over" && (
          <div style={ST.overlay}>
            <h2 style={{ ...ST.title, color: C.red }}>Game Over</h2>
            {result.isRecord && <p style={ST.recordL}>🐶 {result.line}</p>}
            <div style={ST.resRow}>
              <div style={ST.resCol}><span style={ST.lab}>DISTANCE</span><span style={ST.resVal}>{result.dist} m</span></div>
              <div style={ST.resCol}><span style={ST.lab}>SCORE</span><span style={{ ...ST.resVal, color: C.accent }}>{result.score} €</span></div>
            </div>
            <p style={ST.bestL}>🏆 Meilleur : {best.bestDist} m · {best.best} €</p>
            <div style={ST.btnRow}>
              {onClose && <button style={ST.ghost} onClick={onClose}>🏠 Retour</button>}
              <button style={ST.play} onClick={start}>↻ Rejouer</button>
            </div>
          </div>
        )}

        {onClose && screen !== "paused" && <button style={ST.close} onClick={onClose} aria-label="Fermer">✕</button>}
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function aabb(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
function burst(x, y, color) { const a = Math.random() * 6.28, s = 80 + Math.random() * 160; return { x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 60, life: 0.5, max: 0.5, color, r: 2 + Math.random() * 2 }; }
function roundRect(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/* ---------- styles ---------- */
const ST = {
  wrap: { width: "100%", display: "flex", justifyContent: "center", fontFamily: "system-ui, sans-serif" },
  frame: { position: "relative", width: "100%", maxWidth: 800, aspectRatio: `${CONFIG.width} / ${CONFIG.height}` },
  canvas: { display: "block", width: "100%", height: "100%", borderRadius: 14, background: "#0A2540", cursor: "pointer", touchAction: "none" },
  hud: { position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", gap: 8, padding: "12px 16px", color: "#fff", pointerEvents: "none" },
  col: { display: "flex", flexDirection: "column", lineHeight: 1.1 },
  lab: { fontSize: 11, letterSpacing: 1, opacity: 0.8, fontWeight: 500 },
  val: { fontSize: 22, fontWeight: 700 },
  pause: { pointerEvents: "auto", background: "rgba(10,37,64,0.7)", color: "#fff", border: "none", borderRadius: 8, width: 34, height: 34, fontSize: 15, cursor: "pointer" },
  overlay: { position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: "#fff", background: "rgba(10,37,64,0.55)", borderRadius: 14, padding: 16 },
  title: { fontSize: 30, fontWeight: 700, margin: "0 0 6px" },
  sub: { fontSize: 14, color: "#9FE1CB", maxWidth: 360, margin: "0 0 18px" },
  hint: { fontSize: 12, opacity: 0.75, margin: "12px 0 0" },
  bestL: { fontSize: 13, color: "#85B7EB", margin: "10px 0 0" },
  recordL: { fontSize: 16, color: "#F0B429", fontWeight: 500, margin: "0 0 12px", maxWidth: 340 },
  play: { background: "#5DCAA5", color: "#04342C", fontWeight: 700, fontSize: 16, border: "none", padding: "11px 30px", borderRadius: 10, cursor: "pointer" },
  ghost: { background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 500, fontSize: 15, border: "1px solid rgba(255,255,255,0.25)", padding: "10px 22px", borderRadius: 10, cursor: "pointer" },
  resRow: { display: "flex", gap: 36, margin: "4px 0 12px" },
  resCol: { display: "flex", flexDirection: "column", alignItems: "center" },
  resVal: { fontSize: 22, fontWeight: 700 },
  btnRow: { display: "flex", gap: 12, marginTop: 14 },
  close: { position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: 8, border: "none", background: "rgba(10,37,64,0.6)", color: "#fff", fontSize: 14, cursor: "pointer", zIndex: 5 },
};
