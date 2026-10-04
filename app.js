(() => {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- Videos: play while visible, pause off-screen ---------- */
  // A video the viewer paused by hand stays paused until they press play again.
  const autoVideos = [...document.querySelectorAll('video.autoplay-video')];
  const visible = new WeakMap();
  const userPaused = new WeakSet();
  const autoPausing = new WeakSet();

  function tryPlay(video) {
    if (reduceMotion || userPaused.has(video)) return;
    const p = video.play();
    if (p && p.catch) p.catch(() => { video.controls = true; });
  }

  function autoPause(video) {
    if (video.paused) return;
    autoPausing.add(video);
    video.pause();
  }

  autoVideos.forEach(v => {
    v.addEventListener('pause', () => {
      if (autoPausing.has(v)) autoPausing.delete(v);
      else if (!v.ended && v.readyState > 0) userPaused.add(v);
    });
    v.addEventListener('play', () => userPaused.delete(v));
  });

  if (reduceMotion) {
    autoVideos.forEach(v => { autoPause(v); v.controls = true; });
  } else if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        visible.set(target, isIntersecting);
        if (isIntersecting) tryPlay(target);
        else autoPause(target);
      });
    }, { threshold: 0.35 });
    autoVideos.forEach(v => io.observe(v));
  } else {
    autoVideos.forEach(tryPlay);
  }

  /* ---------- Teaser pause/play button (clicking the video does the same) ---------- */
  document.querySelectorAll('[data-video-toggle]').forEach(btn => {
    const video = document.getElementById(btn.dataset.videoToggle);
    const sync = () => {
      btn.classList.toggle('is-paused', video.paused);
      btn.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
    };
    const toggle = () => {
      if (video.paused) {
        userPaused.delete(video);
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        video.pause();
      }
    };
    btn.addEventListener('click', toggle);
    video.addEventListener('click', toggle);
    video.addEventListener('play', sync);
    video.addEventListener('pause', sync);
    sync();
  });

  /* ---------- Method walkthrough ---------- */
  const walk = document.querySelector('[data-walkthrough]');
  if (walk) {
    const tabs = [...walk.querySelectorAll('[role="tab"]')];
    const stage = walk.querySelector('.pipeline-stage');
    const spot = walk.querySelector('.spot');
    const [prev, next] = walk.querySelectorAll('[data-step-move]');
    let current = 0;

    function select(i, focus) {
      current = i;
      tabs.forEach((t, j) => {
        const on = j === i;
        t.classList.toggle('active', on);
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        panel.hidden = !on;
        if (on) {
          const region = panel.dataset.region;
          stage.classList.toggle('has-spot', Boolean(region));
          if (region) {
            const [x, y, w, h] = region.split(',');
            spot.style.setProperty('--x', `${x}%`);
            spot.style.setProperty('--y', `${y}%`);
            spot.style.setProperty('--w', `${w}%`);
            spot.style.setProperty('--h', `${h}%`);
          }
        }
      });
      prev.disabled = i === 0;
      next.disabled = i === tabs.length - 1;
      if (focus) tabs[i].focus();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(i, false));
      tab.addEventListener('keydown', e => {
        const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
        if (!step) return;
        e.preventDefault();
        select((i + step + tabs.length) % tabs.length, true);
      });
    });
    prev.addEventListener('click', () => select(Math.max(0, current - 1), false));
    next.addEventListener('click', () => select(Math.min(tabs.length - 1, current + 1), false));
    select(0, false);
  }

  /* ---------- Example clips ---------- */
  // Each viewer shows one family of examples. Scores are read from the end of each clip.
  // Appearance changes should leave the reward alone (lower is better); corrupted
  // executions should move it (higher is better).
  const VIPER = 'VIPER', DIFF = 'Diffusion Reward', REWIND = 'ReWiND', OURS = 'DiTaR';
  const VIEWERS = {
    appearance: {
      defaults: { label: 'Δ normalized MAE', note: 'lower is better', aspect: '16/9' },
      clips: {
        light: [
          { src: 'lighting', label: 'Reward shift', aspect: '1280/750',
            scores: [[VIPER, '3.11'], [DIFF, '0.49'], [OURS, '0.15']],
            caption: 'MetaWorld button press under clean, mild and heavy lighting.' }
        ],
        viewpoint: [
          { src: 'camera-viewpoint',
            scores: [[VIPER, '0.228'], [DIFF, '0.259'], [REWIND, '0.229'], [OURS, '0.082']],
            caption: 'ManiSkill Push-T: the same rollout seen from a left and a right camera.' }
        ],
        yaw: [
          { src: 'camera-yaw',
            scores: [[VIPER, '1.624'], [DIFF, '1.421'], [REWIND, '0.352'], [OURS, '0.254']],
            caption: 'ManiSkill Push-T: the camera rotated by 8°.' }
        ],
        zoom: [
          { src: 'camera-zoom',
            scores: [[VIPER, '0.128'], [DIFF, '0.250'], [OURS, '0.102']],
            caption: 'Bridge, “move cloth to the center”: the camera zoomed in 1.25×.' }
        ]
      }
    },
    temporal: {
      defaults: { label: 'Reward shift', note: 'higher = the reward noticed', aspect: '1280/736' },
      clips: {
        drift: [
          { src: 'backward-drift', scores: [[VIPER, '0.10'], [DIFF, '0.20'], [OURS, '0.66']],
            caption: 'Progress runs backwards while every frame still looks perfectly normal.' }
        ],
        loop: [
          { src: 'looped-segments-a', scores: [[VIPER, '0.12'], [DIFF, '0.18'], [OURS, '0.67']],
            caption: 'A repeated segment adds motion but no progress.' },
          { src: 'looped-segments-b', scores: [[VIPER, '0.14'], [DIFF, '0.14'], [OURS, '0.41']],
            caption: 'The same perturbation on a second task and viewpoint.' }
        ],
        shuffle: [
          { src: 'shuffled-segments-a', scores: [[VIPER, '0.22'], [DIFF, '0.20'], [OURS, '1.02']],
            caption: 'Reordering segments destroys execution order without touching a single frame.' },
          { src: 'shuffled-segments-b', scores: [[VIPER, '0.30'], [DIFF, '0.17'], [OURS, '1.38']],
            caption: 'Shuffled segments on the stove task.' }
        ],
        quarter: [
          { src: 'quarter-loop', scores: [[VIPER, '0.21'], [DIFF, '0.19'], [OURS, '0.81']],
            caption: 'Even a short loop stalls the task.' }
        ],
        slow: [
          { src: 'slow-motion', scores: [[VIPER, '0.25'], [DIFF, '0.20'], [OURS, '2.78']],
            caption: 'Order is preserved, but progress per frame halves.' }
        ]
      }
    }
  };

  function scoreLine(el, clip) {
    const span = (cls, text) => {
      const s = document.createElement('span');
      s.className = cls;
      s.textContent = text;
      return s;
    };
    const items = clip.scores.map(([name, value]) => {
      const item = span(name === OURS ? 'shift-item is-ours' : 'shift-item', `${name} `);
      const b = document.createElement('b');
      b.textContent = value;
      item.append(b);
      return item;
    });
    el.replaceChildren(span('shift-label', clip.label), ...items, span('shift-note', clip.note));
  }

  document.querySelectorAll('[data-clip-viewer]').forEach(viewer => {
    const config = VIEWERS[viewer.dataset.clipViewer];
    if (!config) return;
    const video = viewer.querySelector('video');
    const source = video.querySelector('source');
    const groupButtons = [...viewer.querySelectorAll('[data-clip-group]')];
    const pager = viewer.querySelector('[data-clip-pager]');
    const indexLabel = viewer.querySelector('[data-clip-index]');
    const caption = viewer.querySelector('[data-clip-caption]');
    const scores = viewer.querySelector('[data-clip-shifts]');
    let group = groupButtons[0].dataset.clipGroup;
    let index = 0;

    function render() {
      const list = config.clips[group];
      const clip = { ...config.defaults, ...list[index] };
      // Picking a clip is a request to watch it, so it overrides an earlier manual pause.
      autoPause(video);
      userPaused.delete(video);
      video.style.aspectRatio = clip.aspect;
      video.poster = `assets/images/posters/${clip.src}.webp`;
      source.src = `assets/videos/${clip.src}.mp4`;
      video.load();
      if (visible.get(video)) tryPlay(video);
      caption.textContent = clip.caption;
      scoreLine(scores, clip);
      pager.hidden = list.length < 2;
      indexLabel.textContent = `${index + 1} / ${list.length}`;
      groupButtons.forEach(b => {
        const on = b.dataset.clipGroup === group;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
    }

    groupButtons.forEach(b => b.addEventListener('click', () => {
      if (b.dataset.clipGroup === group) return;
      group = b.dataset.clipGroup;
      index = 0;
      render();
    }));
    viewer.querySelectorAll('[data-clip-step]').forEach(b => b.addEventListener('click', () => {
      const n = config.clips[group].length;
      index = (index + Number(b.dataset.clipStep) + n) % n;
      render();
    }));
  });

  /* ---------- Copy BibTeX ---------- */
  document.querySelectorAll('[data-copy]').forEach(btn => btn.addEventListener('click', async () => {
    const target = document.querySelector(btn.dataset.copy);
    try {
      await navigator.clipboard.writeText(target.textContent);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      sel.removeAllRanges();
    }
    btn.textContent = 'Copied';
    btn.classList.add('is-done');
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('is-done'); }, 1600);
  }));
})();
