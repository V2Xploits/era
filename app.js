// ===== Stardust =====
const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');

let W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 2);
function resize() {
  W = window.innerWidth; H = window.innerHeight;
  canvas.width = W * DPR; canvas.height = H * DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---- State ----
const STORE_KEY = 'stardust.sky.v1';
let stars = [];        // {x,y,r,hue,phase,tw}
let lines = [];        // {a,b}  indices into stars
let labels = [];       // {x,y,text,alpha}
let shooting = [];     // active shooting stars
let bgStars = [];      // ambient background twinkle
let mode = 'place';
let pendingConnect = null; // index of first selected star

// ---- Ambient background field ----
function seedBackground() {
  bgStars = [];
  const n = Math.round((W * H) / 7000);
  for (let i = 0; i < n; i++) {
    bgStars.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.1 + 0.2,
      base: Math.random() * 0.5 + 0.1,
      sp: Math.random() * 0.02 + 0.004,
      ph: Math.random() * Math.PI * 2,
    });
  }
}
seedBackground();

// ---- Persistence ----
function save() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify({ stars, lines, labels }));
  } catch (e) {}
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
    if (d && Array.isArray(d.stars)) {
      stars = d.stars; lines = d.lines || []; labels = d.labels || [];
    }
  } catch (e) {}
}
load();

// ---- Helpers ----
function addStar(x, y) {
  stars.push({
    x, y,
    r: Math.random() * 1.6 + 1.8,
    hue: 200 + Math.random() * 80,         // blue → violet → pink
    phase: Math.random() * Math.PI * 2,
    tw: Math.random() * 0.03 + 0.02,
    born: performance.now(),
  });
}
function nearestStar(x, y, maxDist = 26) {
  let best = -1, bd = maxDist * maxDist;
  for (let i = 0; i < stars.length; i++) {
    const dx = stars[i].x - x, dy = stars[i].y - y;
    const d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function launchWish() {
  const fromLeft = Math.random() < 0.5;
  const y = Math.random() * H * 0.5 + 20;
  const x = fromLeft ? -40 : W + 40;
  const angle = (Math.random() * 0.3 + 0.15) * (fromLeft ? 1 : -1);
  const speed = Math.random() * 6 + 9;
  shooting.push({
    x, y,
    vx: Math.cos(angle) * speed * (fromLeft ? 1 : -1),
    vy: Math.sin(angle) * speed + 2,
    life: 1,
    trail: [],
  });
  showWhisper(randWhisper());
}

// ---- Whispers (poetic micro-lines) ----
const WHISPERS = [
  "Somewhere, a star is being named after you.",
  "The sky remembers every wish it was given.",
  "You are made of the same stuff you're drawing.",
  "Light from these stars left home before you were born.",
  "Connect the lonely ones. They've been waiting.",
  "No two skies are ever the same.",
  "Even the dark between stars is part of the picture.",
  "Make a shape only you would see.",
  "The night is patient. Take your time.",
  "A constellation is just stars that decided to belong together.",
];
let lastWhisper = -1;
function randWhisper() {
  let i; do { i = Math.floor(Math.random() * WHISPERS.length); } while (i === lastWhisper);
  lastWhisper = i; return WHISPERS[i];
}
const whisperEl = document.getElementById('whisper');
let whisperTimer = null;
function showWhisper(text) {
  whisperEl.textContent = '“' + text + '”';
  whisperEl.style.opacity = '1';
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => { whisperEl.style.opacity = '0'; }, 5000);
}

// ---- Counters ----
const starCountEl = document.getElementById('starCount');
const lineCountEl = document.getElementById('lineCount');
function updateCounts() {
  starCountEl.textContent = stars.length;
  lineCountEl.textContent = lines.length;
}

// ===== Render loop =====
function draw(now) {
  ctx.clearRect(0, 0, W, H);

  // ambient background twinkle
  for (const b of bgStars) {
    b.ph += b.sp;
    const a = b.base + Math.sin(b.ph) * 0.25;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(200,210,255,${Math.max(0, a)})`;
    ctx.fill();
  }

  // constellation lines
  ctx.lineWidth = 1;
  for (const ln of lines) {
    const a = stars[ln.a], b = stars[ln.b];
    if (!a || !b) continue;
    const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
    grad.addColorStop(0, `hsla(${a.hue},80%,75%,0.55)`);
    grad.addColorStop(1, `hsla(${b.hue},80%,75%,0.55)`);
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // pending connect line follows cursor
  if (mode === 'connect' && pendingConnect != null && stars[pendingConnect]) {
    const a = stars[pendingConnect];
    ctx.strokeStyle = 'rgba(165,180,252,0.4)';
    ctx.setLineDash([4, 6]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(mouse.x, mouse.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // user stars
  for (let i = 0; i < stars.length; i++) {
    const s = stars[i];
    s.phase += s.tw;
    const tw = 0.7 + Math.sin(s.phase) * 0.3;
    const grow = Math.min(1, (now - (s.born || 0)) / 350); // pop-in
    const r = s.r * (0.3 + grow * 0.7);

    const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 6);
    glow.addColorStop(0, `hsla(${s.hue},90%,80%,${0.55 * tw})`);
    glow.addColorStop(1, `hsla(${s.hue},90%,70%,0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = `hsla(${s.hue},100%,95%,${tw})`;
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();

    // highlight selected
    if (i === pendingConnect) {
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // labels
  ctx.textAlign = 'center';
  ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
  for (const l of labels) {
    ctx.fillStyle = `rgba(220,225,255,${0.6 * (l.alpha ?? 1)})`;
    ctx.fillText(l.text, l.x, l.y);
  }

  // shooting stars
  for (let i = shooting.length - 1; i >= 0; i--) {
    const sh = shooting[i];
    sh.x += sh.vx; sh.y += sh.vy; sh.life -= 0.012;
    sh.trail.push({ x: sh.x, y: sh.y });
    if (sh.trail.length > 18) sh.trail.shift();

    for (let t = 0; t < sh.trail.length; t++) {
      const p = sh.trail[t];
      const a = (t / sh.trail.length) * sh.life;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6 * (t / sh.trail.length) + 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,245,220,${a})`;
      ctx.fill();
    }
    const head = ctx.createRadialGradient(sh.x, sh.y, 0, sh.x, sh.y, 8);
    head.addColorStop(0, `rgba(255,255,255,${sh.life})`);
    head.addColorStop(1, 'rgba(255,240,200,0)');
    ctx.fillStyle = head;
    ctx.beginPath(); ctx.arc(sh.x, sh.y, 8, 0, Math.PI * 2); ctx.fill();

    if (sh.life <= 0 || sh.x < -60 || sh.x > W + 60 || sh.y > H + 60) shooting.splice(i, 1);
  }

  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

// ===== Interaction =====
const mouse = { x: W / 2, y: H / 2 };
function pos(e) {
  const t = e.touches ? e.touches[0] : e;
  return { x: t.clientX, y: t.clientY };
}
canvas.addEventListener('pointermove', (e) => { const p = pos(e); mouse.x = p.x; mouse.y = p.y; });

canvas.addEventListener('pointerdown', (e) => {
  const p = pos(e);
  if (mode === 'place') {
    addStar(p.x, p.y);
    updateCounts(); save();
  } else if (mode === 'connect') {
    const idx = nearestStar(p.x, p.y);
    if (idx === -1) return;
    if (pendingConnect == null) {
      pendingConnect = idx;
    } else if (pendingConnect !== idx) {
      const exists = lines.some(l =>
        (l.a === pendingConnect && l.b === idx) || (l.a === idx && l.b === pendingConnect));
      if (!exists) lines.push({ a: pendingConnect, b: idx });
      pendingConnect = idx; // chain for easy multi-line shapes
      updateCounts(); save();
    }
  }
});

// ===== Mode buttons =====
const modeButtons = document.querySelectorAll('[data-mode]');
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    mode = btn.dataset.mode;
    pendingConnect = null;
    modeButtons.forEach(b => b.classList.toggle('is-active', b === btn));
    if (mode === 'connect') showWhisper('Click two stars to join them.');
    if (mode === 'place') showWhisper('Click anywhere to scatter light.');
  });
});

document.getElementById('wishBtn').addEventListener('click', launchWish);

document.getElementById('clearBtn').addEventListener('click', () => {
  stars = []; lines = []; labels = []; pendingConnect = null;
  updateCounts(); save();
  showWhisper('A blank sky. Endless possibility.');
});

// ===== Naming =====
const namePanel = document.getElementById('namePanel');
const nameInput = document.getElementById('nameInput');
function openNamePanel() {
  if (!stars.length) { showWhisper('Place some stars first.'); return; }
  namePanel.classList.add('show-flex');
  nameInput.value = ''; nameInput.focus();
}
function commitName(text) {
  if (text && text.trim()) {
    // center label under the centroid of the most-recent stars
    const recent = stars.slice(-8);
    const cx = recent.reduce((s, p) => s + p.x, 0) / recent.length;
    const cy = recent.reduce((s, p) => s + p.y, 0) / recent.length;
    labels.push({ x: cx, y: cy + 28, text: text.trim().toUpperCase(), alpha: 1 });
    save();
    showWhisper('“' + text.trim() + '” now lives in the sky.');
  }
  namePanel.classList.remove('show-flex');
}
document.getElementById('nameSave').addEventListener('click', () => commitName(nameInput.value));
document.getElementById('nameSkip').addEventListener('click', () => namePanel.classList.remove('show-flex'));
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') commitName(nameInput.value); });
// Double-click anywhere opens naming
canvas.addEventListener('dblclick', openNamePanel);

// ===== Save PNG =====
document.getElementById('saveBtn').addEventListener('click', () => {
  // paint background onto an export canvas (canvas is transparent)
  const ex = document.createElement('canvas');
  ex.width = canvas.width; ex.height = canvas.height;
  const exc = ex.getContext('2d');
  const g = exc.createRadialGradient(ex.width/2, -ex.height*0.1, 0, ex.width/2, -ex.height*0.1, ex.height*1.2);
  g.addColorStop(0, '#1b2452'); g.addColorStop(0.45, '#0a0e22'); g.addColorStop(1, '#05060f');
  exc.fillStyle = g; exc.fillRect(0, 0, ex.width, ex.height);
  exc.drawImage(canvas, 0, 0);
  const link = document.createElement('a');
  link.download = 'my-stardust-sky.png';
  link.href = ex.toDataURL('image/png');
  link.click();
  showWhisper('Your sky has been saved.');
});

// ===== Help modal =====
const helpModal = document.getElementById('helpModal');
document.getElementById('helpBtn').addEventListener('click', () => helpModal.classList.add('show-flex'));
document.getElementById('helpClose').addEventListener('click', () => helpModal.classList.remove('show-flex'));
helpModal.addEventListener('click', (e) => { if (e.target === helpModal) helpModal.classList.remove('show-flex'); });

// ===== First-run flourish =====
updateCounts();
if (!stars.length) {
  // gentle starter sky
  setTimeout(() => { for (let i = 0; i < 5; i++) addStar(W*0.3 + Math.random()*W*0.4, H*0.3 + Math.random()*H*0.3); updateCounts(); }, 300);
  showWhisper('Tap to scatter your first stars.');
} else {
  showWhisper('Welcome back. Your sky was waiting.');
}
// occasional ambient shooting star
setInterval(() => { if (Math.random() < 0.4 && shooting.length < 2) launchWish(); }, 12000);
