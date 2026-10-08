/* =========================================================
   OBERON — Sitio oficial · interacciones compartidas
   ========================================================= */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- navegación ---------- */
  const nav = $('#nav');
  const progress = $('.progress');
  function onScroll() {
    nav.classList.toggle('scrolled', window.scrollY > 20);
    if (progress) {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    }
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger'), panel = $('#mPanel');
  function toggleMenu(force) {
    const open = typeof force === 'boolean' ? force : burger.getAttribute('aria-expanded') !== 'true';
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    nav.classList.toggle('solid', open);
    document.body.classList.toggle('menu-open', open);
  }
  if (burger && panel) {
    burger.addEventListener('click', () => toggleMenu());
    $$('a', panel).forEach(a => a.addEventListener('click', () => toggleMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape') toggleMenu(false); });
    window.addEventListener('resize', () => { if (window.innerWidth > 1060) toggleMenu(false); });
  }

  /* ---------- aparición al desplazar ---------- */
  const io = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
  }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
  $$('.reveal').forEach(n => io.observe(n));

  /* ---------- palabra rotativa del hero ---------- */
  const rot = $('.rotator');
  if (rot) {
    const words = $$('span', rot);
    let i = 0;
    words[0].classList.add('on');
    if (!reduce && words.length > 1) {
      setInterval(() => {
        const cur = words[i]; i = (i + 1) % words.length; const nxt = words[i];
        cur.classList.remove('on'); cur.classList.add('off');
        nxt.classList.remove('off'); nxt.classList.add('on');
        setTimeout(() => cur.classList.remove('off'), 800);
      }, 2600);
    }
  }

  /* ---------- contadores ---------- */
  const counters = $$('[data-count]');
  const cio = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; cio.unobserve(el);
      const end = +el.dataset.count, pre = el.dataset.prefix || '', dur = 1400, t0 = performance.now();
      if (reduce) { el.textContent = pre + end; return; }
      (function tick(t) {
        const p = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
        el.textContent = pre + v;
        if (p < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }, { threshold: .6 });
  counters.forEach(c => cio.observe(c));

  /* ---------- pilares (pestañas con avance automático) ---------- */
  const tabsWrap = $('.p-tabs');
  if (tabsWrap) {
    const tabs = $$('.p-tab', tabsWrap), panels = $$('.p-panel');
    let idx = 0, timer = null, inView = false;
    function select(n, user) {
      idx = n;
      tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === n)); t.tabIndex = k === n ? 0 : -1; });
      panels.forEach((p, k) => p.classList.toggle('on', k === n));
      if (user) stop();
      else restart();
    }
    function restart() { clearInterval(timer); if (!reduce && inView) timer = setInterval(() => select((idx + 1) % tabs.length), 7000); }
    function stop() { clearInterval(timer); timer = null; tabsWrap.classList.add('paused'); }
    tabs.forEach((t, k) => {
      t.addEventListener('click', () => select(k, true));
      t.addEventListener('keydown', e => {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); select((k + 1) % tabs.length, true); tabs[idx].focus(); }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); select((k - 1 + tabs.length) % tabs.length, true); tabs[idx].focus(); }
      });
    });
    new IntersectionObserver(([en]) => { inView = en.isIntersecting; if (inView && !tabsWrap.classList.contains('paused')) restart(); else clearInterval(timer); }, { threshold: .3 }).observe(tabsWrap);
    select(0);
  }

  /* ---------- año ---------- */
  $$('.year').forEach(y => { y.textContent = new Date().getFullYear(); });

  /* ---------- constelación de fondo (fija, toda la página) ---------- */
  const canvas = $('#net');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    let w = 0, h = 0, dpr = 1, pts = [], visible = true;
    const mouse = { x: -9999, y: -9999 };
    function resize() {
      const prevW = w;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (prevW === w && pts.length) { pts.forEach(p => { if (p.y > h) p.y = Math.random() * h; }); if (reduce) draw(); return; }
      const n = Math.min(90, Math.round((w * h) / 16000));
      pts = Array.from({ length: n }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - .5) * .26, vy: (Math.random() - .5) * .26,
        r: Math.random() * 1.6 + .6, gold: Math.random() < .22
      }));
      if (reduce) draw();
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      const max = w < 640 ? 100 : 140;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        if (!reduce) {
          a.x += a.vx; a.y += a.vy;
          if (a.x < 0 || a.x > w) a.vx *= -1;
          if (a.y < 0 || a.y > h) a.vy *= -1;
          const dx = mouse.x - a.x, dy = mouse.y - a.y;
          if (Math.hypot(dx, dy) < 160) { a.x -= dx * .004; a.y -= dy * .004; }
        }
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < max) {
            ctx.strokeStyle = `rgba(191,224,245,${(1 - d / max) * .16})`;
            ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.fillStyle = p.gold ? 'rgba(240,213,160,.9)' : 'rgba(244,242,236,.7)';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    function loop() { if (visible) draw(); requestAnimationFrame(loop); }
    window.addEventListener('resize', () => { clearTimeout(resize._t); resize._t = setTimeout(resize, 150); });
    window.addEventListener('pointermove', e => { mouse.x = e.clientX; mouse.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });
    document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
    resize();
    if (!reduce) loop();
  }
})();
