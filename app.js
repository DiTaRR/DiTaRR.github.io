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

  /* Keep playback controls outside the image so they never cover a curve or formula. */
  autoVideos.forEach(video => {
    const controls = document.createElement('div');
    controls.className = 'player-controls';
    const play = document.createElement('button');
    play.type = 'button';
    const seek = document.createElement('input');
    seek.type = 'range'; seek.min = '0'; seek.max = '100'; seek.step = '0.1'; seek.value = '0';
    seek.setAttribute('aria-label', 'Video progress');
    const time = document.createElement('span');
    time.className = 'player-time';
    const expand = document.createElement('button');
    expand.type = 'button'; expand.textContent = '⛶'; expand.className = 'player-expand';
    expand.setAttribute('aria-label', 'View video fullscreen');
    controls.append(play, seek, time, expand);
    video.after(controls);
    video.controls = false;
    const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
    const sync = () => {
      play.textContent = video.paused ? 'Play' : 'Pause';
      play.setAttribute('aria-label', video.paused ? 'Play video' : 'Pause video');
      const duration = Number.isFinite(video.duration) ? video.duration : 0;
      seek.value = duration ? String(video.currentTime / duration * 100) : '0';
      seek.disabled = !duration;
      time.textContent = `${clock(video.currentTime)} / ${clock(duration)}`;
    };
    play.addEventListener('click', () => {
      if (video.paused) {
        userPaused.delete(video);
        video.play().catch(() => { video.controls = true; });
      } else video.pause();
    });
    seek.addEventListener('input', () => {
      if (Number.isFinite(video.duration)) video.currentTime = Number(seek.value) / 100 * video.duration;
    });
    expand.addEventListener('click', () => {
      if (video.requestFullscreen) video.requestFullscreen().catch(() => {});
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    });
    video.addEventListener('fullscreenchange', () => { video.controls = document.fullscreenElement === video; });
    ['play', 'pause', 'timeupdate', 'loadedmetadata', 'emptied'].forEach(event => video.addEventListener(event, sync));
    sync();
  });

  /* ---------- Example clips ---------- */
  // Each viewer shows one family of examples. Scores are read from the end of each clip.
  // Appearance changes should leave the reward alone (lower is better); corrupted
  // executions should move it (higher is better).
  const VIPER = 'VIPER', DIFF = 'Diffusion Reward', REWIND = 'ReWiND', OURS = 'DiTaR';
  const VIEWERS = {
    camera: {
      defaults: { label: 'Δ normalized MAE', note: 'lower is better', aspect: '16/9' },
      clips: {
        viewpoint: [
          { src: 'camera-viewpoint',
            scores: [[VIPER, '0.228'], [DIFF, '0.259'], [REWIND, '0.229'], [OURS, '0.082']],
            caption: 'ManiSkill Push-T: the same demonstration seen from left and right cameras.' }
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
      defaults: { label: 'Reward shift', note: 'larger response to disruption', aspect: '1760/780' },
      clips: {
        drift: [
          { src: 'backward-drift', scores: [[VIPER, '0.10'], [DIFF, '0.20'], [OURS, '0.66']],
            caption: 'Real-world demonstration with synthetic backward drift: task progress is reversed.' }
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
      source.src = `assets/videos/${clip.src}.mp4?v=short-loops-2`;
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
