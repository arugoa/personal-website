/* Hero animation.
   Fine-pointer devices get an interactive "estimator": a blue head chases the
   cursor through a slow P-controller and leaves a smooth trail that fades out —
   the cursor is the amber measurement, the head is the estimate tracking it.
   Coarse-pointer / reduced-motion visitors get the traced odometry trajectory. */
(function () {
  const canvas = document.getElementById('trajectory');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  let W, H, dpr, landmarks = [];

  const CSS = getComputedStyle(document.documentElement);
  const cPath = CSS.getPropertyValue('--path').trim();
  const cEnc  = CSS.getPropertyValue('--encoder').trim();
  const cGrid = CSS.getPropertyValue('--grid').trim();

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = canvas.clientWidth; H = canvas.clientHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    buildLandmarks();
  }

  // A wandering odometry path (parametric), echoing the trajectory plots in the reports.
  function pathPoint(s) {
    const cx = W * 0.62, cy = H * 0.5;
    const a = W * 0.26, b = H * 0.30;
    const x = cx + a * Math.sin(s) * Math.cos(s * 0.5);
    const y = cy + b * Math.sin(s * 0.9);
    return { x, y };
  }

  function buildLandmarks() {
    landmarks = [];
    const n = Math.floor((W * H) / 14000);
    for (let i = 0; i < n; i++) {
      const s = Math.random() * Math.PI * 4;
      const p = pathPoint(s);
      const spread = 46;
      landmarks.push({
        x: p.x + (Math.random() - 0.5) * spread * 2,
        y: p.y + (Math.random() - 0.5) * spread * 2,
        r: Math.random() * 1.6 + 0.6,
        appear: Math.random()
      });
    }
  }

  function drawGrid() {
    ctx.strokeStyle = cGrid; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
    const step = 46;
    for (let x = (W * 0.62) % step; x < W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = (H * 0.5) % step; y < H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.globalAlpha = 1;
  }

  /* ============================ interactive mode ============================ */
  function runInteractive() {
    const K = 0.075;          // P-controller gain — small = slow, smooth pursuit
    const LIFE = 1150;        // trail point lifetime (ms) before it fully fades
    const head = { x: W * 0.5, y: H * 0.5 };
    const target = { x: head.x, y: head.y };
    let hasTarget = false;    // has the cursor moved over the hero yet?
    const trail = [];         // { x, y, t }

    const hero = canvas.parentElement || canvas;
    function setTarget(e) {
      const rect = canvas.getBoundingClientRect();
      target.x = e.clientX - rect.left;
      target.y = e.clientY - rect.top;
      hasTarget = true;
    }
    hero.addEventListener('pointermove', setTarget);
    hero.addEventListener('pointerdown', setTarget);
    window.addEventListener('resize', () => {
      head.x = Math.min(head.x, W); head.y = Math.min(head.y, H);
    });

    function drawLandmarks() {
      ctx.fillStyle = cPath; ctx.globalAlpha = 0.16;
      landmarks.forEach(l => { ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill(); });
      ctx.globalAlpha = 1;
    }

    function frame() {
      const now = performance.now();

      // P-controller: estimate eases toward the measured cursor position.
      head.x += K * (target.x - head.x);
      head.y += K * (target.y - head.y);

      // Record the head, but only once it's actually moving.
      if (hasTarget) {
        const last = trail[trail.length - 1];
        if (!last || Math.hypot(head.x - last.x, head.y - last.y) > 0.6) {
          trail.push({ x: head.x, y: head.y, t: now });
        }
      }
      while (trail.length && now - trail[0].t > LIFE) trail.shift();

      ctx.clearRect(0, 0, W, H);
      drawGrid();
      drawLandmarks();

      // Fading trail — amber echo underneath, blue estimate on top.
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (let i = 1; i < trail.length; i++) {
        const a = trail[i - 1], b = trail[i];
        const life = Math.max(0, 1 - (now - b.t) / LIFE);
        if (life <= 0) continue;

        ctx.globalAlpha = 0.22 * life;
        ctx.strokeStyle = cEnc; ctx.lineWidth = 1.4 * life + 0.3;
        ctx.beginPath(); ctx.moveTo(a.x + 9, a.y - 7); ctx.lineTo(b.x + 9, b.y - 7); ctx.stroke();

        ctx.globalAlpha = 0.9 * life;
        ctx.strokeStyle = cPath; ctx.lineWidth = 2.4 * life + 0.4;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;

      // Faint amber reticle at the measurement (the cursor).
      if (hasTarget) {
        ctx.strokeStyle = cEnc; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(target.x, target.y, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
      }

      // The estimate head — blue dot with a white ring.
      ctx.fillStyle = cPath;
      ctx.beginPath(); ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();

      requestAnimationFrame(frame);
    }

    // Draw one resting frame (grid + landmarks) before the first cursor move.
    ctx.clearRect(0, 0, W, H); drawGrid(); drawLandmarks();
    requestAnimationFrame(frame);
  }

  /* ============================= fallback mode ============================= */
  function renderTrajectory(progress) {
    ctx.clearRect(0, 0, W, H);
    drawGrid();
    const END = Math.PI * 4;
    const sMax = progress * END;

    landmarks.forEach(l => {
      const vis = Math.min(1, Math.max(0, (progress - l.appear) * 3));
      if (vis <= 0) return;
      ctx.globalAlpha = 0.35 * vis;
      ctx.fillStyle = cPath;
      ctx.beginPath(); ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    ctx.strokeStyle = cEnc; ctx.globalAlpha = 0.28; ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let s = 0; s <= sMax; s += 0.03) {
      const p = pathPoint(s);
      s === 0 ? ctx.moveTo(p.x + 10, p.y - 8) : ctx.lineTo(p.x + 10, p.y - 8);
    }
    ctx.stroke();

    ctx.globalAlpha = 0.9; ctx.strokeStyle = cPath; ctx.lineWidth = 2.2;
    ctx.beginPath();
    let head = null;
    for (let s = 0; s <= sMax; s += 0.03) {
      const p = pathPoint(s);
      s === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      head = p;
    }
    ctx.stroke();

    if (head) {
      ctx.globalAlpha = 1; ctx.fillStyle = cPath;
      ctx.beginPath(); ctx.arc(head.x, head.y, 4.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function runTrajectory() {
    let t = 0;
    (function loop() {
      t += 0.0016;
      const cycle = t % 1.4;                 // trace, then hold
      renderTrajectory(Math.min(1, cycle / 1.0));
      requestAnimationFrame(loop);
    })();
  }

  /* ================================ start ================================= */
  window.addEventListener('resize', resize);
  resize();

  if (reduce) {
    renderTrajectory(1);          // static snapshot, no motion
  } else if (finePointer) {
    runInteractive();
  } else {
    runTrajectory();              // touch / coarse pointer
  }
})();
