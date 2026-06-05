const palette = [
  '#F9C515',
  '#E6B014',
  '#FFE9B5',
  '#D6594D',
  '#E07F74',
  '#2D424D',
  '#3E5A66',
  '#557080',
  '#CCCFF2',
  '#A8AEE8',
  '#8E95DE',
  '#FFB54D',
  '#FFA8DB',
  '#FFFBF3',
  '#EEE4CF',
  '#6B7B85',
];

const CARD_HTML = '<img class="photo" alt="">';
const FEATURED_HTML =
  '<img class="photo before" alt=""><img class="photo after" alt="">';
const PHOTO_KEY = 'cardStackPhotos';

const CFG = {
  cols: 7,
  rows: 8,
  tilt: 43,
  pan: 0,
  twist: -18,
  startZoom: 0.95,
  offsetX: 10,
  offsetY: -200,
  lens: 2200,
  gapX: 1.05,
  gapY: 0.85,
  scatter: 1.8,
  zoom: 3.55,
  visible: 3,
  trackVh: 200,
  animEnd: 0.95,
};

const SS = 4;
const BASE_COL_GAP = 168 * SS;
const BASE_ROW_GAP = 150 * SS;
let COL_GAP = BASE_COL_GAP * CFG.gapX;
let ROW_GAP = BASE_ROW_GAP * CFG.gapY;

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const smooth = (t: number) => t * t * (3 - 2 * t);

type CardData = {
  el: HTMLDivElement;
  depth: number;
  featured: boolean;
  slot: number;
  gx: number;
  gy: number;
  sx: number;
  sy: number;
  srot: number;
  delay: number;
  beforeEl?: HTMLImageElement;
  afterEl?: HTMLImageElement;
};

let cards: CardData[] = [];
let fit = 1;
let targetP = 0;
let curP = 0;
let rafId = 0;

let plane: HTMLDivElement;
let hint: HTMLElement | null;
let startCopy: HTMLElement | null;
let endCopy: HTMLElement | null;
let pin: HTMLElement | null;
let section: HTMLElement;

function animProgress(raw: number) {
  return clamp(raw / CFG.animEnd, 0, 1);
}

function build() {
  plane.innerHTML = '';
  cards = [];
  const COLS = CFG.cols;
  const ROWS = CFG.rows;
  const COUNT = COLS * ROWS;

  const featuredIdx = Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
  const others: number[] = [];
  for (let i = 0; i < COUNT; i++) if (i !== featuredIdx) others.push(i);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const depthByIdx = new Array<number>(COUNT);
  depthByIdx[featuredIdx] = 0;
  others.forEach((ix, k) => {
    depthByIdx[ix] = k + 1;
  });

  let idx = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const featured = idx === featuredIdx;
      const depth = depthByIdx[idx];
      const el = document.createElement('div');
      el.className = 'card-stack-hero__card' + (featured ? ' featured' : '');
      el.style.background = palette[idx % palette.length] ?? palette[0];
      el.innerHTML = featured ? FEATURED_HTML : CARD_HTML;
      const s = CFG.scatter;
      cards.push({
        el,
        depth,
        featured,
        slot: featured ? -1 : depth - 1,
        gx: (c - (COLS - 1) / 2) * COL_GAP,
        gy: (r - (ROWS - 1) / 2) * ROW_GAP,
        sx: featured ? 0 : (depth * rand(-0.7, 0.7) + rand(-10, 10)) * s * SS,
        sy: featured ? 0 : (-depth * 1.5 + rand(-7, 7) * s) * SS,
        srot: featured ? 0 : rand(-5, 5) * s,
        delay: featured ? 0.05 : Math.random() * 0.42,
      });
      el.style.zIndex = String(600 - depth);
      plane.appendChild(el);
      idx++;
    }
  }
  applyPhotos();
  computeFit();
}

function getPhotos() {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_KEY) ?? '{}') as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
}

function applyPhotos() {
  const data = getPhotos();
  const lib = Array.isArray(data.library) ? (data.library as string[]) : [];
  const front = (data.front ?? {}) as { before?: string; after?: string };

  for (const cd of cards) {
    if (cd.featured) {
      const before = front.before ?? '';
      const after = front.after ?? front.before ?? '';
      cd.beforeEl = cd.el.querySelector<HTMLImageElement>('.photo.before') ?? undefined;
      cd.afterEl = cd.el.querySelector<HTMLImageElement>('.photo.after') ?? undefined;
      if (before && cd.beforeEl && cd.afterEl) {
        cd.beforeEl.src = before;
        cd.afterEl.src = after;
        cd.el.classList.add('has-photo');
      } else if (cd.beforeEl && cd.afterEl) {
        cd.beforeEl.removeAttribute('src');
        cd.afterEl.removeAttribute('src');
        cd.el.classList.remove('has-photo');
      }
    } else {
      const img = cd.el.querySelector<HTMLImageElement>('.photo');
      const url = lib[cd.slot];
      if (url && img) {
        img.src = url;
        cd.el.classList.add('has-photo');
      } else if (img) {
        img.removeAttribute('src');
        cd.el.classList.remove('has-photo');
      }
    }
  }
}

function render(rawP: number) {
  const P = animProgress(rawP);
  const e = smooth(clamp(P / 0.85, 0, 1));
  const rx = lerp(CFG.tilt, 0, e);
  const ry = lerp(CFG.pan, 0, e);
  const rz = lerp(CFG.twist, 0, e);
  const ps = fit * lerp(CFG.startZoom, 1, e);
  const tx = lerp(CFG.offsetX, 0, e);
  const ty = lerp(CFG.offsetY, 0, e);
  plane.style.transform = `translate(${tx}px, ${ty}px) scale(${ps}) rotateX(${rx}deg) rotateY(${ry}deg) rotateZ(${rz}deg)`;

  for (const cd of cards) {
    const pi = smooth(clamp((P - cd.delay) / 0.55, 0, 1));
    const x = lerp(cd.gx, cd.sx, pi);
    const y = lerp(cd.gy, cd.sy, pi);
    const rot = lerp(0, cd.srot, pi);
    const sc = lerp(1, CFG.zoom, pi);
    cd.el.style.transform = `translate3d(${x}px, ${y}px, 0) rotateZ(${rot}deg) scale(${sc})`;
    cd.el.style.opacity = cd.depth < CFG.visible ? '1' : String(1 - pi);
    if (cd.featured && cd.beforeEl) {
      const ba = smooth(clamp((P - 0.4) / 0.5, 0, 1));
      cd.beforeEl.style.opacity = String(1 - ba);
      if (cd.afterEl) cd.afterEl.style.opacity = String(ba);
    }
  }

  if (hint) hint.style.opacity = String(clamp(1 - P / 0.04, 0, 1));

  if (startCopy) {
    const t = smooth(clamp(rawP / 0.14, 0, 1));
    startCopy.style.opacity = String(1 - t);
    startCopy.style.transform = `translateY(${-t * 28}px)`;
  }

  if (endCopy) {
    const headlineStart = CFG.animEnd - 0.14;
    const t = smooth(clamp((rawP - headlineStart) / 0.14, 0, 1));
    endCopy.style.opacity = String(t);
    endCopy.style.transform = `translateY(${(1 - t) * 28}px)`;
  }

}

function computeFit() {
  const gw = CFG.cols * BASE_COL_GAP;
  fit = Math.min(
    1,
    (window.innerWidth - 80) / gw,
    (window.innerHeight - 40) / (CFG.rows * BASE_ROW_GAP * 0.6),
  );
}

function scrollProgress() {
  const rect = section.getBoundingClientRect();
  const scrollable = section.offsetHeight - window.innerHeight;
  if (scrollable <= 0) return 0;
  // Progress 0→1 while the hero track scrolls (viewport stays sticky/fixed in view).
  const traveled = -rect.top;
  return clamp(traveled / scrollable, 0, 1);
}

function onScroll() {
  targetP = scrollProgress();
  const rect = section.getBoundingClientRect();
  // Hide fixed layers once the hero track has fully scrolled past.
  section.classList.toggle('is-complete', rect.bottom <= 0);
}

function loop() {
  curP += (targetP - curP) * 0.12;
  if (Math.abs(targetP - curP) < 0.0002) curP = targetP;
  render(curP);
  rafId = requestAnimationFrame(loop);
}

export function initCardStackHero() {
  section = document.getElementById('top');
  plane = document.getElementById('hero-card-plane') as HTMLDivElement | null;
  hint = document.getElementById('hero-card-hint');
  startCopy = document.getElementById('hero-start-copy');
  endCopy = document.getElementById('hero-end-copy');
  pin = document.getElementById('hero-pin');

  if (!section || !plane) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    section.style.height = '100svh';
    hint?.remove();
    if (startCopy) {
      startCopy.style.opacity = '1';
      startCopy.style.transform = 'none';
    }
    if (endCopy) {
      endCopy.style.opacity = '1';
      endCopy.style.transform = 'none';
    }
    if (pin) pin.style.transform = 'none';
    return;
  }

  section.style.height = `${CFG.trackVh}svh`;
  const viewport = section.querySelector<HTMLElement>('.card-stack-hero__viewport');
  if (viewport) viewport.style.perspective = `${CFG.lens}px`;

  build();
  targetP = curP = scrollProgress();
  onScroll();
  render(curP);
  rafId = requestAnimationFrame(loop);

  window.addEventListener('resize', () => {
    computeFit();
    render(curP);
    onScroll();
  });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('storage', (e) => {
    if (e.key === PHOTO_KEY) applyPhotos();
  });
  window.addEventListener('focus', applyPhotos);

  return () => {
    cancelAnimationFrame(rafId);
    window.removeEventListener('scroll', onScroll);
  };
}
