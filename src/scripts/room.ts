/**
 * The Shelf room (three.js, voxel style). One full fold: a floor-to-ceiling bookcase on the back wall (her favourite
 * fours, plus more films, series, books and songs that only live here, a French press and the cat mug, a photo of her
 * with Kafka), her desk with the real kit, her (turned round in the chair to say hello), Kafka on the monitor, and a
 * window on the left wall behind a Great Wave blind. Open the blind and Chennai is outside; Kafka flies over to look.
 * Light theme = day; dark theme = night (lit by the screens, the lamp and the city).
 * Click anything: the camera leans in, stacked things swap or slide out, and a small glass card says what it is.
 * Renders on demand and pauses off-screen. Loaded only on wide screens when the room nears the viewport (shelf.astro).
 */
import * as THREE from 'three';
import { APP_COLORS, appIcon } from '../lib/apps';

export type Item = { title: string; by?: string; year?: string; image?: string; url?: string; note?: string; spotify?: string };
export type RoomData = {
  shelves: { id: string; name: string; items: Item[]; more?: Item[] }[];
  missingNote?: string;
  currently: { label: string; title: string; by?: string; image?: string; url?: string; note?: string; spotify?: string }[];
  desk: { kafka?: string; kafkaWindow?: string; kafkaWindowNight?: string; kafkaCorner?: string; shelfLine?: string; shelfNote?: string; trex?: { kind?: string; name?: string; note?: string }; items: { id: string; kind: string; name: string; note?: string }[]; monitorApps: string[]; laptopApps: string[] };
  wave?: string;
};
export type Card = { kind: string; title: string; by?: string; note?: string; image?: string; url?: string; linkLabel?: string; pixel?: boolean };
export type RoomUI = {
  show: (c: Card) => void; hide: () => void;
  tip: (text: string | null, x?: number, y?: number) => void;
  say: (text: string | null, x?: number, y?: number) => void;
  zoomed: (on: boolean) => void;
  play: (it: Item) => void;        // a song: the page opens its Spotify player
  night: (on: boolean) => void;    // the room's own day or night (the lamp can change it without the site theme)
};

const PAL = {
  day: { back: '#FFFBF6', left: '#FFFCF8', floorA: '#DCC7AA', floorB: '#D3BD9F', wood: '#B08B67', woodDark: '#8C6C50', woodBack: '#C9AE8E', cab: '#E3D3BD', cabPanel: '#D8C6AD', desk: '#E9DCCB', deskEdge: '#CDBDA7', rug: '#E6D8C5', hemi: 2.3, sun: 2.6, glow: 0, lamp: 0, city: 0 },
  night: { back: '#3A342D', left: '#352F28', floorA: '#4A3F34', floorB: '#433930', wood: '#7C604B', woodDark: '#644B39', woodBack: '#56473A', cab: '#7A6550', cabPanel: '#6A5744', desk: '#62554A', deskEdge: '#504338', rug: '#544538', hemi: 1.6, sun: 0.45, glow: 150, lamp: 190, city: 60 },
};
type PalKey = Exclude<keyof typeof PAL.day, 'hemi' | 'sun' | 'glow' | 'lamp' | 'city'>;
// Kafka, the same pixel art as Crow.astro: '#' body, 'o' glasses frame, 'w' lens, 'e' eye, 'b' beak, 'l' legs
const CROW = [
  '...........#####......', '.........########.....', '........###ooooo##....', '........##owwwwwo#bb..', '........##owwewwooobbb',
  '........##owwwwwo#bb..', '........###ooooo##....', '.......###########....', '......############....', '....#############.....',
  '..###############.....', '.################.....', '####.###########......', '##....#########.......', '........######........',
  '.........l..l.........', '.........l..l.........', '........ll.ll.........',
];
const CROW_COLORS: Record<string, string> = { '#': '#151414', b: '#151414', l: '#151414', e: '#151414', o: '#F94D03', w: '#FFFFFF' };

export function createRoom(host: HTMLElement, data: RoomData, ui: RoomUI) {
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let dirty = true, raf = 0, visible = true;   // render-loop state (declared first: building the scene already asks for redraws)
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  let night = isDark();   // the room's own day or night: follows the site theme, and the lamp flips it
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 700);

  // ---------------------------------------------------------------- helpers
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const flat = new Map<string, THREE.MeshLambertMaterial>();
  const m = (hex: string) => { if (!flat.has(hex)) flat.set(hex, new THREE.MeshLambertMaterial({ color: hex })); return flat.get(hex)!; };
  const themed: { mat: THREE.MeshLambertMaterial; key: PalKey }[] = [];
  const tm = (key: PalKey) => { const mat = new THREE.MeshLambertMaterial(); themed.push({ mat, key }); return mat; };
  const box = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], shadow = true) => {
    const b = new THREE.Mesh(geo, mat);
    b.scale.set(w, h, d); b.position.set(x + w / 2, y + h / 2, z + d / 2);
    b.castShadow = shadow; b.receiveShadow = true; parent.add(b); return b;
  };
  const cyl = (parent: THREE.Object3D, x: number, y: number, z: number, r: number, h: number, mat: THREE.Material, seg = 20, r2 = r) => {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r2, h, seg), mat);
    c.position.set(x, y + h / 2, z); c.castShadow = true; c.receiveShadow = true; parent.add(c); return c;
  };
  const group = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };

  // textures, and the average colour of each cover (for spines and edges)
  const loader = new THREE.TextureLoader();
  const texCache = new Map<string, THREE.Texture>();
  const avg = new Map<string, THREE.Color>();
  const waiting = new Map<string, ((c: THREE.Color) => void)[]>();
  const tex = (url: string) => {
    if (!texCache.has(url)) {
      const t = loader.load(url, () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = 6;
          const x = c.getContext('2d')!; x.drawImage(t.image, 0, 0, 6, 6);
          const d = x.getImageData(0, 0, 6, 6).data; let r = 0, g = 0, b = 0;
          for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
          const n = d.length / 4, col = new THREE.Color().setRGB(r / n / 255, g / n / 255, b / n / 255, THREE.SRGBColorSpace).multiplyScalar(0.85);
          avg.set(url, col); (waiting.get(url) ?? []).forEach((f) => f(col)); waiting.delete(url);
        } catch { /* keep the default colour */ }
        invalidate();
      });
      t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; texCache.set(url, t);
    }
    return texCache.get(url)!;
  };
  const colorOf = (url: string | undefined, fn: (c: THREE.Color) => void) => {
    if (!url) return; tex(url);
    const c = avg.get(url); if (c) fn(c); else waiting.set(url, [...(waiting.get(url) ?? []), fn]);
  };
  const canvases: THREE.CanvasTexture[] = [];
  const canvasTex = (w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, pixel = false) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    if (pixel) { t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; }
    t.userData.redraw = () => { const x = c.getContext('2d')!; x.clearRect(0, 0, w, h); draw(x); t.needsUpdate = true; };
    canvases.push(t); return t;
  };
  const rounded = (x: CanvasRenderingContext2D, X: number, Y: number, W: number, H: number, r: number) => { x.beginPath(); x.roundRect(X, Y, W, H, r); };
  const FONT = '"Schibsted Grotesk", Arial, sans-serif';
  const light = (c: THREE.Color) => { const s = c.clone().convertLinearToSRGB(); return 0.2126 * s.r + 0.7152 * s.g + 0.0722 * s.b > 0.55; };

  // a box whose front face (+z) is a spine or label carrying a title in the cover's own colour
  const labelled = (parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, vertical: boolean, base = '#8A8178') => {
    const side = new THREE.MeshLambertMaterial({ color: base });
    let col = new THREE.Color(base), title = '';
    const cw = vertical ? 64 : Math.min(512, Math.round(64 * w / h)), ch = vertical ? Math.min(512, Math.round(64 * h / w)) : 64;
    const t = canvasTex(cw, ch, (x) => {
      x.fillStyle = '#' + col.getHexString(); x.fillRect(0, 0, cw, ch);
      x.fillStyle = 'rgba(0,0,0,.12)'; vertical ? (x.fillRect(0, 10, cw, 3), x.fillRect(0, ch - 13, cw, 3)) : x.fillRect(6, 0, 3, ch);
      if (!title) return;
      x.fillStyle = light(col) ? 'rgba(24,18,14,.88)' : 'rgba(255,252,246,.94)';
      x.save(); x.translate(cw / 2, ch / 2); if (vertical) x.rotate(Math.PI / 2);
      const room = (vertical ? ch : cw) * 0.84; let fs = 26;
      x.font = `600 ${fs}px ${FONT}`; while (x.measureText(title).width > room && fs > 10) { fs--; x.font = `600 ${fs}px ${FONT}`; }
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(title, 0, 1); x.restore();
    });
    const face = new THREE.MeshLambertMaterial({ map: t });
    const mesh = box(parent, x, y, z, w, h, d, [side, side, side, side, face, side]);
    return {
      mesh,
      set(it?: Item, fallback?: string) {
        title = it?.title ?? ''; col = new THREE.Color(fallback ?? base); side.color.copy(col); t.userData.redraw();
        if (it?.image) colorOf(it.image, (c) => { if (title !== it.title) return; col = c.clone(); side.color.copy(c); t.userData.redraw(); invalidate(); });
        invalidate();
      },
    };
  };

  // clickables
  type Hit = { tip: string; click: () => void; lift?: boolean; focus?: number };
  const hits: THREE.Object3D[] = [];
  const clickable = (o: THREE.Object3D, hit: Hit) => { o.userData.root = true; o.traverse((c) => { c.userData.hit = hit; if ((c as THREE.Mesh).isMesh) hits.push(c); }); };

  // tweens
  const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
  const tweens = new Set<{ t0: number; dur: number; fn: (k: number) => void; res: () => void }>();
  const tween = (dur: number, fn: (k: number) => void) => new Promise<void>((res) => {
    if (still) { fn(1); invalidate(); res(); return; }
    tweens.add({ t0: performance.now(), dur, fn, res }); kick();
  });
  const cardOf = (kind: string, it: Item, linkLabel?: string) =>
    ui.show({ kind, title: it.title, by: [it.by, it.year].filter(Boolean).join(', '), note: it.note, image: it.image, url: it.url, linkLabel });

  // ---------------------------------------------------------------- the room (walls and floor run on past the frame, so it never floats)
  const room = new THREE.Group(); scene.add(room);
  for (let i = 0; i < 40; i++) box(room, i * 4, -1, 0, 4, 1, 130, tm(i % 2 ? 'floorA' : 'floorB'), false);
  box(room, 0, 0, -1, 160, 130, 1, tm('back'), false);
  box(room, -1, 0, 0, 1, 130, 130, tm('left'), false);
  box(room, 0, 0, -0.02, 160, 0.8, 0.3, tm('woodDark'));
  box(room, 0, 0, 0, 0.3, 0.8, 130, tm('woodDark'));
  box(room, 37, 0.01, 9.6, 17, 0.12, 12, tm('rug'), false);

  // ---------------------------------------------------------------- the window: a Great Wave blind; behind it, Chennai
  const WZ0 = 8.5, WZ1 = 24.5, WY0 = 13, WY1 = 26, WZC = (WZ0 + WZ1) / 2;
  const drawCity = (x: CanvasRenderingContext2D) => {
    const W = 256, H = 208; let s = 11;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const R = (c: string, X: number, Y: number, w: number, h: number) => { x.fillStyle = c; x.fillRect(Math.round(X), Math.round(Y), Math.round(w), Math.round(h)); };
    const sky = night ? ['#0A1130', '#0E1739', '#141E44', '#1A2650', '#222E5B', '#2C3866', '#37426F'] : ['#86BDE6', '#98C7E9', '#AAD0EA', '#BED9EA', '#D2E1E6', '#E4E5DE', '#F1E3CC'];
    sky.forEach((c, i) => R(c, 0, i * 18, W, 19));
    if (night) {
      for (let i = 0; i < 46; i++) R(rnd() > 0.8 ? '#FFF4D6' : '#C9D3F2', rnd() * W, rnd() * 100, 1, 1);
      x.fillStyle = '#F3EBD3'; x.beginPath(); x.arc(204, 30, 9, 0, 7); x.fill(); x.fillStyle = sky[1]; x.beginPath(); x.arc(200, 27, 8, 0, 7); x.fill();
    } else {
      for (const [cx, cy, w] of [[40, 24, 26], [150, 40, 34], [222, 18, 20]]) { R('#FFFFFF', cx, cy, w, 4); R('#FFFFFF', cx + 4, cy - 3, w - 10, 3); R('#F4F7FA', cx + 2, cy + 4, w - 4, 2); }
    }
    // the Bay of Bengal
    R(night ? '#18244A' : '#6FA4C4', 0, 118, W, 16);
    for (let i = 0; i < 26; i++) R(night ? '#2C3A68' : '#A9CDE0', rnd() * W, 119 + rnd() * 13, 3 + rnd() * 5, 1);
    if (night) for (let y = 120; y < 133; y += 2) R('#F3EBD3', 200 + (rnd() - 0.5) * 6, y, 2 + rnd() * 4, 1);
    // far skyline in the haze
    const farFill = night ? '#20284A' : '#AFB5C3'; R(farFill, 0, 132, W, 26);
    const far = night ? '#20284A' : '#AFB5C3', lit = '#F2C46A';
    for (let X = 0; X < W;) { const w = 7 + rnd() * 12, h = 6 + rnd() * 20; R(far, X, 134 - h, w, h + 24); if (night) for (let k = 0; k < 3; k++) if (rnd() > 0.4) R(lit, X + 2 + rnd() * (w - 4), 136 - h + rnd() * (h - 4), 1, 1); X += w + rnd() * 3; }
    // the LIC building (tall, white, with its mast)
    R(night ? '#3A4266' : '#ECE8E0', 46, 86, 14, 60); R(night ? '#2B3253' : '#CFCAC0', 56, 86, 4, 60);
    for (let y = 90; y < 140; y += 4) R(night ? lit : '#7E8796', 48, y, 7, 1);
    R(night ? '#5A6280' : '#9AA0AA', 52, 72, 1, 14); if (night) R('#FF4D4D', 52, 71, 1, 1);
    // the city in between: low, colourful houses
    const houses = night ? ['#2B2E3F', '#2F2B3A', '#2A3140', '#33303C'] : ['#E9D9B8', '#D8E3D2', '#EBC7BE', '#D9D2E6', '#F0E2C0', '#CFE0E3'];
    for (let X = -4; X < W;) {
      const w = 12 + rnd() * 16, top = 140 + rnd() * 12, c = houses[Math.floor(rnd() * houses.length)];
      R(c, X, top, w, H - top); R(night ? '#24273A' : '#00000014', X, top, w, 2);
      for (let y = top + 5; y < 200; y += 7) for (let wx = X + 3; wx < X + w - 3; wx += 5) if (rnd() > 0.35) R(night ? (rnd() > 0.45 ? lit : '#3C3F55') : '#8C8C96', wx, y, 2, 3);
      X += w;
    }
    // Chennai Central: red, a clock tower and two corner turrets
    const red = night ? '#6A2E26' : '#B4472E', redLit = night ? '#FFD98A' : '#E9C9B4';
    R(red, 104, 146, 60, 20); R(red, 130, 116, 10, 32); R(red, 132, 110, 6, 6); R(red, 134, 104, 2, 6);
    R(red, 104, 134, 6, 14); R(red, 158, 134, 6, 14); R(red, 105, 130, 4, 4); R(red, 159, 130, 4, 4);
    R(night ? '#4E211B' : '#93391F', 104, 146, 60, 2);
    x.fillStyle = night ? '#FFE7A6' : '#F6F1E6'; x.beginPath(); x.arc(135, 124, 3, 0, 7); x.fill();
    for (let X = 108; X < 162; X += 5) if (X < 128 || X > 142) { R(redLit, X, 151, 2, 5); R(redLit, X, 159, 2, 4); }
    // a temple gopuram: stone tiers narrowing upward, a barrel-vault top with gold finials
    const stone = night ? ['#4A4858', '#524F5E'] : ['#E4CF9E', '#D9C08A'];
    for (let i = 0; i < 9; i++) {
      const w = 40 - i * 3.6, y = 170 - i * 6;
      R(stone[i % 2], 212 - w / 2, y, w, 6); R(night ? '#3A3846' : '#C2A672', 212 - w / 2, y + 5, w, 1);
      for (let k = 0; k < w - 4; k += 4) if (rnd() > 0.35) R(night ? '#6E6A7C' : ['#C8553D', '#3E8E86', '#E1A83A', '#6A7FC2'][Math.floor(rnd() * 4)], 214 - w / 2 + k, y + 2, 1, 2);
      if (night) { R('#F6B24A', 212 - w / 2, y, 1, 1); R('#F6B24A', 212 + w / 2 - 1, y, 1, 1); }
    }
    R(night ? '#5E5A4E' : '#C98E4B', 203, 117, 18, 6); R(night ? '#4A473E' : '#B27A3C', 203, 122, 18, 1);
    for (const X of [205, 211, 217]) R('#E8B53A', X, 113, 2, 4);
    // rooftops: terraces, black water tanks, a clothes line
    const roof = night ? '#2A2932' : '#D3C9B9', roofEdge = night ? '#353440' : '#E4DCCD';
    R(roof, 0, 182, 96, 30); R(roofEdge, 0, 180, 96, 3); R(roof, 154, 178, 102, 34); R(roofEdge, 154, 176, 102, 3);
    for (const [X, Y] of [[18, 170], [34, 172], [178, 166], [228, 168]]) { R('#1D1D1F', X, Y, 10, 10); R('#2A2A2D', X + 1, Y - 2, 8, 2); }
    if (!night) { R('#6B6B6B', 58, 170, 74, 1); [['#E05B4B', 64], ['#F2C14E', 76], ['#4C7BD9', 90], ['#F0F0F0', 102], ['#44A06A', 114]].forEach(([c, X]) => R(c as string, X as number, 171, 6, 8)); }
    // coconut palms
    for (const [bx, lean] of [[14, 1], [244, -1]] as const) {
      for (let k = 0; k < 44; k++) R(night ? '#2C241C' : '#7A5B3C', bx + lean * Math.pow(k / 44, 2) * 10, 208 - k * 1.6, 3, 2);
      const tx = bx + lean * 10, ty = 138;
      for (let a = 0; a < 8; a++) { const ang = -Math.PI * (-0.08 + a * 0.15); for (let r = 0; r < 17; r++) R(night ? '#1D2E22' : (a % 2 ? '#3F7F3A' : '#4E9445'), tx + Math.cos(ang) * r, ty - Math.sin(ang) * r * 0.5 + r * r * 0.035, 2, 2); }
    }
  };
  const city = canvasTex(256, 208, drawCity, true);
  const view = new THREE.Mesh(new THREE.PlaneGeometry(WZ1 - WZ0, WY1 - WY0), new THREE.MeshBasicMaterial({ map: city }));
  view.rotation.y = Math.PI / 2; view.position.set(0.04, (WY0 + WY1) / 2, WZC); room.add(view);
  const win = new THREE.Group(); room.add(win);
  for (const [z, y, h, d] of [[WZ0 - 0.5, WY0 - 0.5, WY1 - WY0 + 1, 0.5], [WZ1, WY0 - 0.5, WY1 - WY0 + 1, 0.5], [WZ0 - 0.5, WY1, 0.5, WZ1 - WZ0 + 1], [WZC - 0.15, WY0, WY1 - WY0, 0.3]] as const)
    box(win, 0, y, z, 0.5, h, d, tm('woodDark'));
  box(win, 0, WY0 - 0.6, WZ0 - 1, 1.9, 0.6, WZ1 - WZ0 + 2, tm('wood'));
  // the blind rolls up from the bottom: we show only the bottom part of the print, like a real roller blind
  const blindTex = loader.load(data.wave ?? '/images/shelf/room-wave.webp', () => invalidate());
  blindTex.colorSpace = THREE.SRGBColorSpace; blindTex.anisotropy = 4;
  const waveAspect = 1280 / 863, bw = WZ1 - WZ0 + 0.6, bh = WY1 - WY0 + 0.2, crop = (bw / bh) / waveAspect;
  blindTex.repeat.set(crop, 1); blindTex.offset.set((1 - crop) / 2, 0);
  const blindTop = group(win, 0.66, WY1 + 0.1, WZC);
  const blindMat = new THREE.MeshLambertMaterial({ map: blindTex, side: THREE.DoubleSide });
  const blind = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), blindMat);
  blind.rotation.y = Math.PI / 2; blindTop.add(blind);
  const bar = box(blindTop, -0.05, 0, -bw / 2, 0.25, 0.25, bw, m('#2C2A27'));
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, bw + 0.8, 16), m('#E9E2D4')); roller.rotation.x = Math.PI / 2; roller.position.set(0.1, 0.35, 0); roller.castShadow = true; blindTop.add(roller);
  let shut = 1;   // 1 = blind down
  const cityLight = new THREE.PointLight('#9DB4FF', 0, 30, 1.6); cityLight.position.set(3, 19, WZC); scene.add(cityLight);
  let spectrumUpdate = () => {};
  const setBlind = (f: number) => {
    shut = f; const k = Math.max(0.02, f); cityLight.intensity = (night ? PAL.night.city : 0) * (1 - f);
    blind.scale.y = k; blind.position.y = -bh * k / 2; blindTex.repeat.y = k; blindTex.offset.y = 0;
    bar.position.y = -bh * k; spectrumUpdate(); invalidate();
  };
  setBlind(1);

  // ---------------------------------------------------------------- the bookcase: floor to ceiling
  const shelf = new THREE.Group(); room.add(shelf); shelf.userData.container = true;
  const BX0 = 2, BX1 = 32, BD = 6.5, TOP = 35.4;
  const COL = [2.7, 12.6, 22.4], ROW = [6.6, 13.8, 21.0, 28.2];
  const carcass = group(shelf);   // the bookcase itself (pointing at it says what it is)
  box(carcass, BX0, 0, 0, 0.7, TOP + 0.6, BD, tm('wood')); box(carcass, BX1 - 0.7, 0, 0, 0.7, TOP + 0.6, BD, tm('wood'));
  box(carcass, BX0 - 0.3, TOP, 0, BX1 - BX0 + 0.6, 0.6, BD + 0.3, tm('wood'));
  box(carcass, BX0 - 0.5, TOP + 0.6, 0, BX1 - BX0 + 1, 0.5, BD + 0.5, tm('woodDark'));
  box(carcass, BX0 + 0.7, 6.0, 0, BX1 - BX0 - 1.4, TOP - 6, 0.3, tm('woodBack'), false);
  for (const x of [12.0, 21.8]) box(carcass, x, 6.0, 0, 0.6, TOP - 6, BD, tm('wood'));
  for (const y of [6.0, 13.2, 20.4, 27.6]) box(carcass, BX0 + 0.7, y, 0, BX1 - BX0 - 1.4, 0.6, BD, tm('wood'));
  // the cabinet below: three doors
  box(carcass, BX0 + 0.7, 0, 0.4, BX1 - BX0 - 1.4, 0.6, BD - 0.6, tm('woodDark'), false);
  for (const x of COL) { box(carcass, x + 0.15, 0.75, BD - 0.25, 9.0, 5.1, 0.25, tm('cab')); box(carcass, x + 0.65, 1.3, BD - 0.02, 6.9, 4.0, 0.1, tm('cabPanel'), false); box(carcass, x + 7.85, 2.7, BD - 0.05, 0.4, 1.5, 0.4, m('#C29A5B')); }

  clickable(carcass, { tip: data.desk.shelfLine ?? 'My shelf', focus: 1.12, click: () => ui.show({ kind: 'The shelf', title: data.desk.shelfLine ?? 'My shelf', note: data.desk.shelfNote }) });

  const byId = Object.fromEntries(data.shelves.map((s) => [s.id, s]));
  const missingNote = data.missingNote ?? 'Still searching.';
  const faceMats = (side: string) => { const s = m(side).clone(); return [s, s, s, s, new THREE.MeshLambertMaterial({ color: '#ffffff' }), s] as THREE.MeshLambertMaterial[]; };
  const coverOn = (mats: THREE.MeshLambertMaterial[], it: Item, tint = 1) => {
    mats[4].map = tex(it.image!); mats[4].needsUpdate = true;
    if (tint) colorOf(it.image, (c) => { [0, 1, 2, 3, 5].forEach((k) => mats[k].color.copy(c).multiplyScalar(tint)); invalidate(); });
    invalidate();
  };

  // songs play (the page opens Spotify); everything else gets a card
  const open = (label: string, it: Item, link?: string) => (it.spotify ? ui.play(it) : cardOf(label, it, link));
  let vinyl: THREE.Object3D | null = null, vinylX = 0, spinning = false;
  // a favourite four: one thing out front, three beside it; click one beside it and they swap
  type Spine = { obj: THREE.Object3D; set: (it?: Item) => void };
  const fav = (id: string, label: string, front: THREE.Object3D, setFront: (it: Item) => void, spines: Spine[], flourish: () => Promise<void> = async () => {}, opts: { flip?: boolean; link?: string } = {}) => {
    const items = byId[id]?.items ?? []; const order = [0, 1, 2, 3];
    if (items[0]) setFront(items[0]); spines.forEach((s, i) => s.set(items[i + 1]));
    const frontHit: Hit = { tip: items[0]?.title ?? '', click: () => items[order[0]] && open(label, items[order[0]], opts.link) };
    clickable(front, frontHit);
    spines.forEach((sp, i) => {
      const hit: Hit = { lift: true, tip: items[order[i + 1]]?.title ?? missingNote, click: async () => {
        const idx = order[i + 1], item = items[idx];
        if (item === undefined) { ui.show({ kind: label, title: missingNote }); return; }
        const was = order[0]; order[0] = idx; order[i + 1] = was;
        hit.tip = items[was].title; frontHit.tip = item.title;
        await Promise.all([flourish(), tween(160, (k) => { if (opts.flip !== false) front.rotation.y = ease(k) * Math.PI / 2; })]);
        setFront(item); sp.set(items[was]);
        await tween(220, (k) => { if (opts.flip !== false) front.rotation.y = (1 - ease(k)) * Math.PI / 2; });
        open(label, item, opts.link);
      } };
      clickable(sp.obj, hit);
    });
  };
  // more of the same, only in the room: click one and it slides (or tips) out
  const extra = (label: string, it: Item, obj: THREE.Object3D, move: (k: number) => void, link?: string) =>
    clickable(obj, { lift: true, tip: it.title, click: async () => { cardOf(label, it, link); await tween(260, (k) => move(ease(k))); await tween(420, (k) => move(1 - ease(k))); } });

  // books, top left: one face-out, three standing
  {
    const [sx, sy] = [COL[0], ROW[3]];
    const mats = faceMats('#8A8178');
    const front = group(shelf, sx + 2.2, sy, 5.0); front.rotation.x = -0.08; box(front, -1.7, 0, -0.3, 3.4, 5.2, 0.6, mats);
    const spines = [0, 1, 2].map((i) => { const g = group(shelf); const l = labelled(g, sx + 4.4 + i * 1.0, sy, 2.2, 0.9, [4.9, 5.4, 5.0][i], 3.4, true, '#D8CEC0'); return { obj: g, set: (it?: Item) => l.set(it) }; });
    fav('books', 'Books', front, (it) => coverOn(mats, it), spines);
  }
  // more books, top middle: spines with their titles; they tip out from the top
  {
    const [sx, sy] = [COL[1], ROW[3]];
    let x = sx + 0.5; const ws = [0.95, 1.15, 0.85, 1.05, 0.9, 1.2, 0.8], hs = [5.0, 5.5, 4.7, 5.3, 4.9, 5.7, 4.5];
    (byId.books?.more ?? []).slice(0, 7).forEach((it, i) => {
      const g = group(shelf, x, sy, 5.6); const l = labelled(g, 0, 0, -3.6, ws[i], hs[i], 3.6, true); l.set(it);
      extra('Books', it, g, (k) => (g.rotation.x = k * 0.22)); x += ws[i] + 0.05;
    });
    box(shelf, x + 0.15, sy, 2.4, 0.15, 3.2, 3.0, m('#2E2B28')); box(shelf, x + 0.15, sy, 2.4, 1.4, 0.12, 3.0, m('#2E2B28'));
  }
  // a toy T-rex, top right, looking across at Kafka
  {
    const [sx, sy] = [COL[2], ROW[3]];
    const rex = group(shelf, sx + 5.0, sy, 3.6); rex.rotation.y = -0.9;   // facing us
    const g1 = m('#5E9C50'), g2 = m('#4A8540'), belly = m('#A9D18E');
    for (const z of [-0.65, 0.25]) { box(rex, -0.9, 0, z, 0.75, 1.5, 0.45, g2); box(rex, -0.9, 0, z - 0.05, 1.1, 0.3, 0.55, g2); }
    const torso = box(rex, -1.6, 1.3, -0.85, 2.7, 1.8, 1.7, g1); torso.rotation.z = 0.25;
    box(rex, -1.1, 1.25, -0.6, 1.9, 0.5, 1.2, belly).rotation.z = 0.25;
    box(rex, -3.4, 1.45, -0.5, 2.0, 0.85, 1.0, g1); box(rex, -4.5, 1.3, -0.3, 1.2, 0.55, 0.6, g2);
    box(rex, 0.6, 2.55, -0.45, 0.8, 1.0, 0.9, g1);
    box(rex, 0.9, 3.15, -0.75, 2.0, 1.25, 1.5, g1); box(rex, 1.0, 2.7, -0.65, 1.75, 0.45, 1.3, belly);
    for (const z of [-0.78, 0.68]) { box(rex, 2.0, 3.85, z, 0.32, 0.32, 0.12, m('#FFFFFF')); box(rex, 2.12, 3.88, z + (z < 0 ? -0.02 : 0.02), 0.16, 0.2, 0.12, m('#151414')); }
    for (let k = 0; k < 4; k++) box(rex, 1.3 + k * 0.38, 3.08, -0.62, 0.14, 0.14, 1.24, m('#FFFFFF'), false);
    for (const z of [-0.95, 0.6]) box(rex, 1.0, 2.1, z, 0.55, 0.18, 0.18, g2);
    const t = data.desk.trex;
    clickable(rex, { tip: t?.name ?? 'The T-rex', click: async () => { ui.show({ kind: t?.kind ?? 'On the shelf', title: t?.name ?? 'The T-rex', note: t?.note }); await tween(700, (k) => { rex.rotation.z = Math.sin(k * Math.PI * 4) * 0.08 * (1 - k); }); } });
  }
  // films: DVD cases; the disc rises when you change films
  {
    const [sx, sy] = [COL[0], ROW[2]];
    const mats = faceMats('#141414');
    const front = group(shelf, sx + 2.2, sy, 5.1); box(front, -1.7, 0, -0.25, 3.4, 4.8, 0.5, mats);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 0.05, 40), new THREE.MeshLambertMaterial({ color: '#D8DBE0' }));
    disc.rotation.x = Math.PI / 2; disc.position.set(sx + 2.2, sy + 2.4, 4.7); disc.visible = false; shelf.add(disc);
    const spines = [0, 1, 2].map((i) => { const g = group(shelf); const l = labelled(g, sx + 4.4 + i * 0.66, sy, 2.2, 0.58, 4.8, 3.4, true, '#2A2A2A'); return { obj: g, set: (it?: Item) => l.set(it, '#2A2A2A') }; });
    fav('films', 'Films', front, (it) => coverOn(mats, it, 0), spines,
      async () => { disc.visible = true; await tween(380, (k) => { disc.position.y = sy + 2.4 + Math.sin(k * Math.PI) * 3.2; disc.rotation.y = k * 6; }); disc.visible = false; }, { link: 'Letterboxd' });
  }
  // more films, middle: DVD spines that slide out; and the photo of her with Kafka
  {
    const [sx, sy] = [COL[1], ROW[2]];
    (byId.films?.more ?? []).slice(0, 8).forEach((it, i) => {
      const g = group(shelf, sx + 0.5 + i * 0.64, sy, 0); const l = labelled(g, 0, 0, 2.2, 0.58, 4.8, 3.4, true, '#2A2A2A'); l.set(it, '#2A2A2A');
      extra('Films', it, g, (k) => (g.position.z = k * 1.8), 'Letterboxd');
    });
    const frame = group(shelf, sx + 7.3, sy, 4.4); frame.rotation.x = -0.16; frame.rotation.y = -0.25;
    box(frame, -1.8, 0, -0.15, 3.6, 3.9, 0.3, m('#2B2622'));
    const photo = portrait();
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 3.35), new THREE.MeshLambertMaterial({ map: photo.texture })); pic.position.set(0, 1.95, 0.16); frame.add(pic);
    const d = data.desk.items.find((x) => x.id === 'frame');
    clickable(frame, { tip: d?.name ?? 'Kiruthika and Kafka', click: () => ui.show({ kind: d?.kind ?? 'Photo frame', title: d?.name ?? 'Kiruthika and Kafka', note: d?.note, image: photo.url, pixel: true }) });
  }
  // more series, right: tapes standing on end
  {
    const [sx, sy] = [COL[2], ROW[2]];
    (byId.series?.more ?? []).slice(0, 7).forEach((it, i) => {
      const g = group(shelf, sx + 0.5 + i * 1.14, sy, 0); const l = labelled(g, 0, 0, 2.4, 1.04, 4.7, 3.0, true, '#1E1E1E'); l.set(it);
      extra('Series', it, g, (k) => (g.position.z = k * 1.8));
    });
  }
  // music: a sleeve with the record peeking out; the record slides out and spins when you change it
  {
    const [sx, sy] = [COL[0], ROW[1]];
    const mats = faceMats('#202020');
    const rec = group(shelf, sx + 3.4, sy + 2.15, 4.8);
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 0.08, 48), m('#141414')); disk.rotation.x = Math.PI / 2; disk.castShadow = true; rec.add(disk);
    const labelMat = m('#C9452A').clone();
    const lab = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.1, 32), labelMat); lab.rotation.x = Math.PI / 2; lab.position.z = 0.01; rec.add(lab);
    const front = group(shelf, sx + 2.4, sy, 5.1); front.rotation.x = -0.06; box(front, -2.1, 0, -0.12, 4.2, 4.2, 0.25, mats);
    const spines = [0, 1, 2].map((i) => { const g = group(shelf, sx + 6.1 + i * 0.45, sy, 1.4); g.rotation.z = 0.06; const l = labelled(g, 0, 0, 0, 0.36, 4.2, 4.2, true); return { obj: g, set: (it?: Item) => l.set(it) }; });
    fav('music', 'Music', front, (it) => { coverOn(mats, it, 0); colorOf(it.image, (c) => { labelMat.color.copy(c); invalidate(); }); }, spines,
      async () => { await tween(420, (k) => { rec.position.x = sx + 3.4 + Math.sin(k * Math.PI) * 1.6; rec.rotation.z = -k * 8; }); });
    clickable(rec, front.userData.hit); vinyl = rec; vinylX = sx + 3.4;
  }
  // more songs, middle: a crate of records to flip through
  {
    const [sx, sy] = [COL[1], ROW[1]];
    const crate = tm('woodDark'), cx = sx + 0.8;
    box(shelf, cx, sy, 1.2, 5.6, 0.25, 4.8, crate); box(shelf, cx, sy, 1.2, 0.25, 2.4, 4.8, crate); box(shelf, cx + 5.35, sy, 1.2, 0.25, 2.4, 4.8, crate);
    box(shelf, cx, sy, 1.2, 5.6, 2.4, 0.25, crate); box(shelf, cx, sy, 5.75, 5.6, 1.3, 0.25, crate);
    const songs = (byId.music?.more ?? []).slice(0, 6);
    const sleeves = songs.map((it, i) => {
      const g = group(shelf, cx + 2.8, sy + 0.25, 1.8 + i * 0.66); g.rotation.x = -0.2;
      const mats = faceMats('#2A2A2A'); box(g, -2.2, 0, -0.06, 4.4, 4.4, 0.12, mats); coverOn(mats, it, 0.8); return g;
    });
    let flipped = -1;
    sleeves.forEach((g, i) => clickable(g, { tip: songs[i].title, lift: flipped !== i, click: async () => {
      open('Music', songs[i]); flipped = i;
      const from = sleeves.map((s) => s.rotation.x);
      await tween(420, (k) => sleeves.forEach((s, j) => { s.rotation.x = from[j] + ((j > i ? 0.62 : -0.2) - from[j]) * ease(k); }));
    } }));
    // a little cactus keeps the crate company
    cyl(shelf, sx + 7.8, sy, 3.6, 0.7, 1.1, m('#C9734D'), 12, 0.55);
    box(shelf, sx + 7.4, sy + 1.1, 3.2, 0.8, 1.9, 0.8, m('#5E9C50')); box(shelf, sx + 8.1, sy + 1.7, 3.35, 0.5, 0.8, 0.5, m('#4E8A45'));
  }
  // series: a VHS sleeve face-out, three tapes lying in a pile (labels carry the titles)
  {
    const [sx, sy] = [COL[2], ROW[1]];
    const mats = faceMats('#1C1C1C');
    const front = group(shelf, sx + 2.4, sy, 5.0); box(front, -1.8, 0, -0.45, 3.6, 5.6, 0.9, mats);
    const spines = [0, 1, 2].map((i) => { const g = group(shelf); box(g, sx + 4.7, sy + i * 0.86, 1.4, 3.4, 0.82, 4.2, m('#1E1E1E')); const l = labelled(g, sx + 4.95, sy + i * 0.86 + 0.16, 5.6, 2.9, 0.5, 0.06, false, '#DDD6CB'); return { obj: g, set: (it?: Item) => l.set(it, '#DDD6CB') }; });
    fav('series', 'Series', front, (it) => coverOn(mats, it, 0.7), spines);
  }
  // YouTube: a small TV; the three knobs change channel (a burst of static)
  {
    const [sx, sy] = [COL[0], ROW[0]];
    const tv = group(shelf);
    box(tv, sx + 0.6, sy, 1.6, 6.0, 4.4, 3.6, m('#3A3733'));
    box(tv, sx + 0.9, sy + 0.4, 5.15, 4.1, 3.6, 0.1, m('#1A1918'));
    box(tv, sx + 1.8, sy + 4.4, 2.7, 0.3, 1.0, 0.2, m('#2A2826'));
    const a1 = box(tv, sx + 2.6, sy + 5.0, 2.8, 0.08, 1.6, 0.08, m('#8E8B85')); a1.rotation.z = 0.7;
    const a2 = box(tv, sx + 3.5, sy + 5.0, 2.8, 0.08, 1.6, 0.08, m('#8E8B85')); a2.rotation.z = -0.7;
    const screenMat = new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const front = group(tv);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.7, 3.2), screenMat); screen.position.set(sx + 2.95, sy + 2.2, 5.27); front.add(screen);
    const noise = canvasTex(128, 128, (x) => { for (let i = 0; i < 128; i += 4) for (let j = 0; j < 128; j += 4) { const v = Math.random() * 255 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(i, j, 4, 4); } });
    const knobs = [0, 1, 2].map((i) => { const g = group(shelf); const mat = m('#8A8178').clone(); const k = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 16), mat); k.rotation.x = Math.PI / 2; k.position.set(sx + 5.65, sy + 3.4 - i * 1.05, 5.3); k.castShadow = true; g.add(k); return { obj: g, set: (it?: Item) => { if (it?.image) colorOf(it.image, (c) => { mat.color.copy(c); invalidate(); }); } }; });
    fav('youtube', 'YouTube', front, (it) => { const t = loader.load(it.image!, () => invalidate()); t.colorSpace = THREE.SRGBColorSpace; t.repeat.set(1, 3.2 / 3.7); t.offset.set(0, (1 - 3.2 / 3.7) / 2); screenMat.map = t; screenMat.needsUpdate = true; invalidate(); },
      knobs, async () => { screenMat.map = noise; screenMat.needsUpdate = true; await tween(260, () => {}); }, { flip: false, link: 'YouTube' });
  }
  // podcasts: a case face-out with its cassette in front (the reels turn), three cassettes in a pile
  {
    const [sx, sy] = [COL[1], ROW[0]];
    const mats = faceMats('#2A2A2A');
    const front = group(shelf, sx + 2.4, sy + 0.4, 4.7); box(front, -1.7, 0, -0.2, 3.4, 3.4, 0.4, mats);
    const tape = group(shelf, sx + 1.0, sy, 5.2);
    box(tape, 0, 0, 0, 2.8, 0.4, 1.0, m('#3B3B3B'));
    const reels = [0.85, 1.95].map((x) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 6), m('#F2EFE8')); r.position.set(x, 0.43, 0.5); tape.add(r); return r; });
    const spines = [0, 1, 2].map((i) => { const g = group(shelf); const l = labelled(g, sx + 4.8, sy + i * 0.5, 2.6, 2.9, 0.46, 2.4, false); return { obj: g, set: (it?: Item) => l.set(it) }; });
    fav('podcasts', 'Podcasts', front, (it) => coverOn(mats, it, 0), spines, async () => { await tween(500, (k) => reels.forEach((r) => (r.rotation.y = k * 9))); });
    clickable(tape, front.userData.hit);
  }
  // the French press and the cat mug, bottom right
  {
    const [sx, sy] = [COL[2], ROW[0]];
    const press = group(shelf, sx + 2.6, sy, 3.8);
    const glass = new THREE.MeshLambertMaterial({ color: '#E3ECEF', transparent: true, opacity: 0.38 });
    cyl(press, 0, 0.3, 0, 0.95, 3.5, glass, 24).castShadow = false;
    cyl(press, 0, 0.3, 0, 0.86, 2.1, m('#3A2417'), 24);
    cyl(press, 0, 2.4, 0, 0.87, 0.35, m('#B0896A'), 24);
    cyl(press, 0, 0, 0, 1.05, 0.32, m('#1E1E1F'), 24);
    cyl(press, 0, 3.75, 0, 1.02, 0.4, m('#1E1E1F'), 24);
    cyl(press, 0, 4.15, 0, 0.09, 1.0, m('#C9CBCE'), 8);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), m('#1E1E1F')); knob.position.set(0, 5.25, 0); press.add(knob);
    box(press, 0.95, 0.9, -0.2, 0.25, 2.8, 0.4, m('#1E1E1F')); box(press, 0.95, 3.45, -0.2, 0.7, 0.3, 0.4, m('#1E1E1F')); box(press, 1.45, 1.0, -0.2, 0.25, 2.75, 0.4, m('#1E1E1F'));
    for (const y of [0.32, 3.45]) cyl(press, 0, y, 0, 0.99, 0.12, m('#9EA2A6'), 24);
    const pd = data.desk.items.find((x) => x.id === 'press');
    clickable(press, { tip: pd?.name ?? 'French press', click: () => ui.show({ kind: pd?.kind ?? 'French press', title: pd?.name ?? 'French press', note: pd?.note }) });
    // the cat mug: ears on the rim, a face, a tail for a handle, and steam
    const mug = group(shelf, sx + 5.8, sy, 4.3);
    const white = m('#F4F1EA');
    cyl(mug, 0, 0, 0, 0.75, 1.5, white, 24);
    cyl(mug, 0, 1.38, 0, 0.66, 0.1, m('#3A2417'), 24);
    for (const dx of [-0.45, 0.25]) box(mug, dx, 1.5, -0.1, 0.22, 0.32, 0.22, m('#222222'));
    for (const dx of [-0.32, 0.18]) box(mug, dx, 0.85, 0.66, 0.14, 0.14, 0.1, m('#222222'));
    box(mug, -0.07, 0.65, 0.72, 0.14, 0.1, 0.06, m('#E79AA3'));
    const tail = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 16, Math.PI * 1.3), m('#222222')); tail.position.set(0.8, 0.75, 0); tail.rotation.z = -Math.PI * 0.62; mug.add(tail);
    const steam = [0, 1, 2].map((i) => { const s = box(mug, -0.2 + i * 0.2, 1.8 + i * 0.4, -0.05, 0.16, 0.16, 0.16, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.6 }), false); return s; });
    const md = data.desk.items.find((x) => x.id === 'mug');
    clickable(mug, { tip: md?.name ?? 'The cat mug', click: async () => {
      ui.show({ kind: md?.kind ?? 'Mug', title: md?.name ?? 'The cat mug', note: md?.note });
      await tween(1400, (k) => steam.forEach((s, i) => { const t = (k * 2 + i / 3) % 1; s.position.y = 1.8 + t * 1.6; s.position.x = -0.12 + i * 0.2 + Math.sin(t * 6 + i) * 0.12; (s.material as THREE.MeshBasicMaterial).opacity = 0.65 * (1 - t); }));
    } });
  }

  // ---------------------------------------------------------------- a glass prism on the sill (Dark Side of the Moon, drawn in light):
  // when the blind is up by day, a white beam comes in, goes through it, and leaves a spectrum across the floor. Click it and Time plays.
  {
    const P = new THREE.Vector3(1.1, WY0, 20.6);
    const pg = new THREE.CylinderGeometry(0.85, 0.85, 0.75, 3); pg.rotateZ(Math.PI / 2); pg.rotateX(-Math.PI / 2);
    const prism = new THREE.Mesh(pg, new THREE.MeshLambertMaterial({ color: '#EEF5F8', transparent: true, opacity: 0.6, emissive: '#FFFFFF', emissiveIntensity: 0.12 }));
    prism.position.set(P.x, P.y + 0.43, P.z); prism.castShadow = true; room.add(prism);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(pg), new THREE.LineBasicMaterial({ color: '#B9C6CC' })); edges.position.copy(prism.position); room.add(edges);
    const light = group(room); light.visible = false;
    const ray = (a: THREE.Vector3[], color: string, op: number) => {
      const g = new THREE.BufferGeometry().setFromPoints([a[0], a[1], a[2], a[0], a[2], a[3]]); g.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: op, side: THREE.DoubleSide, depthWrite: false });
      const mesh = new THREE.Mesh(g, mat); light.add(mesh); return mat;
    };
    const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
    const mats: [THREE.MeshBasicMaterial, number][] = [];
    // the white beam, from high in the window down to the prism's left face
    mats.push([ray([V(0.08, 19.6, 18.6), V(0.08, 19.9, 18.6), V(0.9, P.y + 0.6, P.z - 0.15), V(0.9, P.y + 0.42, P.z - 0.15)], '#FFFFFF', 0.75), 0.75]);
    // six bands out of the right face, fanning down to the floor
    const BANDS = ['#E8312F', '#F28A2E', '#F6D23A', '#48B04A', '#2F8FD8', '#7B4BB6'];
    const A = V(9.2, 0.03, 23.6), B = V(6.2, 0.03, 27.6);   // spread across our line of sight, so the fan reads from here
    BANDS.forEach((c, i) => {
      const y = P.y + 0.62 - i * 0.075, e0 = A.clone().lerp(B, i / 6), e1 = A.clone().lerp(B, (i + 1) / 6);
      mats.push([ray([V(1.35, y, P.z + 0.15), V(1.35, y - 0.075, P.z + 0.15), e1, e0], c, 0.34), 0.34]);
      // where it lands: a soft stripe on the floor
      const d = e0.clone().sub(V(1.35, y, P.z + 0.15)).setY(0).normalize().multiplyScalar(2.6);
      mats.push([ray([e0, e1, e1.clone().add(d), e0.clone().add(d)], c, 0.55), 0.55]);
    });
    spectrumUpdate = () => { const k = night ? 0 : Math.max(0, 1 - shut * 1.6); light.visible = k > 0.01; mats.forEach(([m, o]) => (m.opacity = o * k)); };
    spectrumUpdate();
    const time = (byId.music?.items ?? []).find((it) => /^time$/i.test(it.title));
    const prismHit: Hit = { tip: time ? `A prism · plays ${time.title}` : 'A prism', click: () => time && open('Music', time) };
    clickable(prism, prismHit); clickable(edges, prismHit);
  }

  // ---------------------------------------------------------------- the desk
  const desk = new THREE.Group(); room.add(desk); desk.userData.container = true;
  const deskItem = (id: string) => data.desk.items.find((d) => d.id === id);
  const deskHit = (id: string, extraNote?: string): Hit => { const d = deskItem(id); return { tip: d ? d.name : id, click: () => d && ui.show({ kind: d.kind, title: d.name, note: [d.note, extraNote].filter(Boolean).join(' ') }) }; };
  const top = 8, DX = 10;
  box(desk, 26.5 + DX, top - 0.6, 0.8, 13, 0.6, 8.6, tm('desk'));
  box(desk, 26.5 + DX, top - 0.75, 9.1, 13, 0.15, 0.3, tm('deskEdge'));
  for (const [x, z] of [[27, 1.2], [38.9, 1.2], [27, 8.8], [38.9, 8.8]]) box(desk, x + DX, 0, z, 0.5, top - 0.6, 0.5, m('#2C2C2A'));

  // BenQ GW2790Q: slim black panel, thin bezels, a slightly deeper chin, column stand on an oval base
  const mon = group(desk);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.6, 0.2, 32), m('#1E1E1F')); foot.scale.set(1.25, 1, 0.75); foot.position.set(33.6 + DX, top + 0.1, 2.7); foot.castShadow = true; mon.add(foot);
  box(mon, 33.3 + DX, top + 0.2, 2.4, 0.6, 2.4, 0.35, m('#1E1E1F'));
  box(mon, 29.2 + DX, top + 2.0, 2.1, 8.8, 5.3, 0.32, m('#151516'));
  box(mon, 29.2 + DX, top + 2.0, 2.42, 8.8, 0.45, 0.04, m('#232325'), false);
  // app icons on the screens (the letter tile shows until the icon has loaded)
  const icons = new Map<string, HTMLImageElement>();
  const appTile = (x: CanvasRenderingContext2D, a: string, X: number, Y: number, S: number, r: number, bg: string, fg: string, g: string) => {
    const im = icons.get(a); x.save(); rounded(x, X, Y, S, S, r); x.clip();
    if (im?.complete && im.naturalWidth) x.drawImage(im, X, Y, S, S);
    else { x.fillStyle = bg; x.fillRect(X, Y, S, S); x.fillStyle = fg; x.font = `600 ${S * 0.56}px ${FONT}`; x.textAlign = 'center'; x.fillText(g, X + S / 2, Y + S * 0.7); }
    x.restore();
  };
  const monTex = canvasTex(1280, 720, (x) => {
    x.fillStyle = '#1C1C20'; x.fillRect(0, 0, 1280, 720);
    x.fillStyle = '#2A2A30'; x.fillRect(0, 0, 1280, 56);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { x.fillStyle = c; x.beginPath(); x.arc(34 + i * 30, 28, 9, 0, 7); x.fill(); });
    x.fillStyle = '#E9E6DF'; x.font = `500 30px ${FONT}`; x.fillText('Work', 72, 118);
    data.desk.monitorApps.forEach((a, i) => {
      const [bg, fg, g] = APP_COLORS[a] ?? ['#444', '#fff', a[0]]; const cx = 120 + (i % 4) * 290, cy = 190 + Math.floor(i / 4) * 250;
      appTile(x, a, cx, cy, 150, 34, bg, fg, g); x.textAlign = 'center';
      x.fillStyle = '#CFCBC3'; x.font = `400 28px ${FONT}`; x.fillText(a, cx + 75, cy + 196); x.textAlign = 'left';
    });
  });
  const monScreen = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 4.75), new THREE.MeshBasicMaterial({ map: monTex })); monScreen.position.set(33.6 + DX, top + 4.85, 2.43); mon.add(monScreen);
  clickable(mon, deskHit('monitor', `Work apps: ${data.desk.monitorApps.join(', ')}.`));

  // HP 14s: natural silver, open, its screen tilted back
  const lap = group(desk);
  box(lap, 27.4 + DX, top, 4.4, 5.0, 0.22, 3.3, m('#C9CACC'));
  box(lap, 27.75 + DX, top + 0.22, 4.75, 4.3, 0.02, 1.8, m('#9FA1A5'), false);
  box(lap, 29.0 + DX, top + 0.22, 6.85, 1.8, 0.02, 0.7, m('#B4B6B9'), false);
  const lid = group(lap, 29.9 + DX, top + 0.2, 4.45); lid.rotation.x = -0.28;
  box(lid, -2.5, 0, -0.2, 5.0, 3.2, 0.2, m('#C9CACC'));
  const lapTex = canvasTex(800, 500, (x) => {
    x.fillStyle = '#F3F1EC'; x.fillRect(0, 0, 800, 500);
    x.fillStyle = '#1C1B19'; x.font = `500 30px ${FONT}`; x.fillText('After hours', 48, 70);
    data.desk.laptopApps.forEach((a, i) => {
      const [bg, fg, g] = APP_COLORS[a] ?? ['#444', '#fff', a[0]]; const cx = 48 + i * 185, cy = 140;
      appTile(x, a, cx, cy, 130, 30, bg, fg, g); x.strokeStyle = '#DDD8CF'; x.lineWidth = 3; rounded(x, cx, cy, 130, 130, 30); x.stroke(); x.textAlign = 'center';
      x.fillStyle = '#4A4844'; x.font = `400 26px ${FONT}`; x.fillText(a, cx + 65, cy + 175); x.textAlign = 'left';
    });
  });
  const lapScreen = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 2.85), new THREE.MeshBasicMaterial({ map: lapTex })); lapScreen.position.set(0, 1.65, 0.01); lid.add(lapScreen);
  for (const a of [...data.desk.monitorApps, ...data.desk.laptopApps]) { const src = appIcon(a); if (!src) continue; const im = new Image(); im.onload = () => { monTex.userData.redraw(); lapTex.userData.redraw(); invalidate(); }; im.src = src; icons.set(a, im); }
  clickable(lap, deskHit('laptop', `After hours: ${data.desk.laptopApps.join(', ')}.`));

  // Logitech Pebble Keys 2 K380s, graphite: compact, round keys
  const kb = group(desk);
  box(kb, 32.6 + DX, top, 6.3, 4.8, 0.28, 1.9, m('#3E3F42'));
  const keyMat = m('#55575B');
  for (let r = 0; r < 4; r++) for (let c = 0; c < 11; c++) { const k = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12), keyMat); k.position.set(32.9 + DX + c * 0.42 + (r % 2) * 0.1, top + 0.32, 6.6 + r * 0.42); kb.add(k); }
  clickable(kb, deskHit('keyboard'));

  // Lenovo 130 wireless mouse (black)
  const mouse = group(desk);
  const mm = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), m('#1C1C1D')); mm.scale.set(0.95, 0.45, 1.45); mm.position.set(38.3 + DX, top + 0.2, 7.0); mm.castShadow = true; mouse.add(mm);
  clickable(mouse, deskHit('mouse'));

  // Ambrane stand with the Galaxy S25 (mint), showing what's on repeat
  const stand = group(desk);
  box(stand, 37.4 + DX, top, 2.0, 1.6, 0.18, 1.6, m('#1F1F20'));
  const arm = box(stand, 38.0 + DX, top + 0.1, 2.5, 0.35, 1.8, 0.2, m('#1F1F20')); arm.rotation.x = -0.35;
  clickable(stand, deskHit('stand'));
  const phone = group(desk, 38.2 + DX, top + 0.55, 3.15); phone.rotation.x = -0.32;
  box(phone, -0.62, 0, -0.08, 1.24, 2.6, 0.16, m('#B9D8C6'));
  const nowItem = data.currently.find((c) => /repeat/i.test(c.label));
  const phoneScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.45), new THREE.MeshBasicMaterial({ color: '#0E0E10' })); phoneScreen.position.set(0, 1.3, 0.09); phone.add(phoneScreen);
  if (nowItem?.image) { const cover = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.98), new THREE.MeshBasicMaterial({ map: tex(nowItem.image) })); cover.position.set(0, 1.65, 0.1); phone.add(cover); box(phone, -0.42, 0.75, 0.09, 0.84, 0.05, 0.01, m('#EDEDED'), false); }
  clickable(phone, { tip: deskItem('phone')?.name ?? 'Phone', click: () => nowItem?.spotify ? ui.play(nowItem as Item) : ui.show({ kind: 'On repeat', title: nowItem?.title ?? '', by: [nowItem?.by, deskItem('phone')?.name].filter(Boolean).join(' · '), image: nowItem?.image, url: nowItem?.url }) });

  // Portronics Conch Theta (white, USB-C): two buds and a loose cable
  const ear = group(desk);
  const whiteM = m('#F2F2F0');
  const curve = new THREE.CatmullRomCurve3([[36.2, 4.2], [35.4, 4.9], [35.8, 5.6], [36.8, 5.3], [37.0, 4.6], [36.4, 4.4]].map(([x, z]) => new THREE.Vector3(x + DX, top + 0.06, z)));
  const cable = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, 0.05, 6, false), whiteM); cable.castShadow = true; ear.add(cable);
  for (const [x, z] of [[36.2, 4.2], [36.4, 4.4]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), whiteM); b.position.set(x + DX, top + 0.2, z); b.castShadow = true; ear.add(b); }
  box(ear, 35.25 + DX, top, 4.85, 0.3, 0.16, 0.5, m('#DADAD8'));
  clickable(ear, deskHit('earphones'));

  // Diet Coke and the pen holder
  const can = group(desk);
  cyl(can, 27.9 + DX, top, 2.3, 0.42, 1.55, m('#C9CBCE'));
  cyl(can, 27.9 + DX, top + 0.55, 2.3, 0.425, 0.42, m('#C8102E'));
  clickable(can, deskHit('can'));
  const pens = group(desk);
  cyl(pens, 29.3 + DX, top, 1.8, 0.48, 1.3, m('#2A2927'));
  for (const [dx, h, c] of [[-0.15, 2.0, '#C8102E'], [0.1, 2.3, '#111111'], [0.25, 1.8, '#2563EB']] as const) box(pens, 29.3 + DX + dx, top + 0.5, 1.75, 0.08, h, 0.08, m(c));
  clickable(pens, deskHit('pens'));

  // ---------------------------------------------------------------- the floor lamp: click it and the room alone goes to night (and back)
  const lampG = group(room);
  cyl(lampG, 54.5, 0, 4.5, 1.3, 0.3, m('#2B2B2D'), 24); cyl(lampG, 54.5, 0.3, 4.5, 0.13, 14.6, m('#2B2B2D'), 8);
  const shade = new THREE.MeshLambertMaterial({ color: '#EFE6D6' }); cyl(lampG, 54.5, 14.6, 4.5, 1.1, 2.4, shade, 24, 1.8);
  const lampHit: Hit = { tip: 'The lamp', focus: 0, click: () => { night = !night; applyTheme(); } };
  clickable(lampG, lampHit);

  // a snake plant in the corner past the window
  const pot = group(room); const PX = 3.2, PZ = 28.6;
  cyl(pot, PX, 0, PZ, 1.4, 2.6, m('#C9734D'), 18, 1.1);
  cyl(pot, PX, 2.5, PZ, 1.25, 0.12, m('#5A4535'), 18);
  for (const [dx, dz, h, rx, rz, c] of [[0, 0, 7.2, 0, 0, '#3F7739'], [-0.6, 0.3, 5.8, 0.12, 0.22, '#5E9C50'], [0.6, -0.2, 6.4, -0.1, -0.2, '#4E8A45'], [0.2, 0.6, 5.0, 0.3, -0.08, '#4E8A45'], [-0.3, -0.6, 6.0, -0.28, 0.1, '#5E9C50'], [0.7, 0.5, 4.4, 0.2, -0.35, '#3F7739'], [-0.8, -0.2, 4.8, -0.05, 0.4, '#3F7739']] as const) {
    const g = group(pot, PX + dx, 2.5, PZ + dz); g.rotation.set(rx, dx, rz); box(g, -0.32, 0, -0.08, 0.64, h, 0.16, m(c)); box(g, -0.36, 0, -0.05, 0.08, h * 0.95, 0.1, m('#C9C26A'));
  }

  // Kafka's corner, on the left wall: a perch, her brass nameplate, a bowl she ignores
  const corner = group(room); const KZ = 25.8;
  for (const z of [KZ, KZ + 3.0]) box(corner, 0, 16.6, z, 1.3, 1.2, 0.35, tm('woodDark'));
  const dowel = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 4.0, 12), tm('wood')); dowel.rotation.x = Math.PI / 2; dowel.position.set(1.05, 17.95, KZ + 1.7); dowel.castShadow = true; corner.add(dowel);
  const plate = canvasTex(256, 72, (x) => {
    const g = x.createLinearGradient(0, 0, 256, 72); g.addColorStop(0, '#D9B46A'); g.addColorStop(0.5, '#EED39A'); g.addColorStop(1, '#B98F4B');
    x.fillStyle = g; x.fillRect(0, 0, 256, 72); x.strokeStyle = 'rgba(80,55,20,.45)'; x.lineWidth = 3; x.strokeRect(5, 5, 246, 62);
    x.fillStyle = '#3A2A12'; x.font = `600 34px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; (x as any).letterSpacing = '6px'; x.fillText('KAFKA', 128, 38);
  });
  const plateMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.73), new THREE.MeshLambertMaterial({ map: plate })); plateMesh.rotation.y = Math.PI / 2; plateMesh.position.set(0.05, 15.6, KZ + 1.7); corner.add(plateMesh);
  box(corner, 0, 14.0, KZ + 3.4, 1.5, 0.2, 1.4, tm('woodDark'));
  cyl(corner, 0.75, 14.2, KZ + 4.1, 0.5, 0.36, m('#E4DED2'), 18, 0.36);
  cyl(corner, 0.75, 14.5, KZ + 4.1, 0.42, 0.05, m('#6B4E2E'), 18);
  clickable(corner, { tip: "Kafka's corner", click: () => ui.show({ kind: "Kafka's corner", title: 'Kafka', note: data.desk.kafkaCorner, url: '/kafka/', linkLabel: 'Her file' }) });

  // her line in neon above the desk, on two lines: lit softly by day (a tube with a faint shadow on the wall), glowing at night
  const NEON = ['Chasing the', 'escaping sun'];
  const neon = canvasTex(1024, 512, (x) => {
    x.font = `italic 500 150px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineJoin = 'round'; x.lineCap = 'round';
    const tube = (dx = 0, dy = 0) => NEON.forEach((t, i) => x.strokeText(t, 512 + dx, 150 + i * 200 + dy));
    if (night) {
      x.shadowColor = '#F94D03'; x.shadowBlur = 40; x.strokeStyle = '#FF7A3D'; x.lineWidth = 9; tube(); tube();
      x.shadowBlur = 10; x.strokeStyle = '#FFE0CC'; x.lineWidth = 3; tube();
    } else {
      x.shadowColor = 'rgba(60,35,20,.22)'; x.shadowBlur = 6; x.shadowOffsetX = 5; x.shadowOffsetY = 9; x.strokeStyle = 'rgba(60,35,20,.01)'; x.lineWidth = 8; tube();
      x.shadowOffsetX = 0; x.shadowOffsetY = 0; x.shadowColor = 'rgba(249,77,3,.5)'; x.shadowBlur = 16; x.strokeStyle = '#F94D03'; x.lineWidth = 8; tube(); tube();
      x.shadowBlur = 0; x.strokeStyle = 'rgba(255,214,190,.9)'; x.lineWidth = 2.5; tube(-1, -1);
    }
  });
  const neonMesh = new THREE.Mesh(new THREE.PlaneGeometry(13, 6.5), new THREE.MeshBasicMaterial({ map: neon, transparent: true, depthWrite: false }));
  neonMesh.position.set(45, 22.6, 0.06); room.add(neonMesh);
  const neonLight = new THREE.PointLight('#FF6A2B', 0, 24, 1.6); neonLight.position.set(45, 22.6, 3.5); scene.add(neonLight);

  // a wooden sofa by the window (Indian frame in teak, deep modern cushions), facing the view
  const sofa = group(room); const S = { x0: 3.4, x1: 9.2, z0: 11.4, z1: 21.6, seat: 5.2 };
  const teak = m('#7A4E2D'), teakDark = m('#5B3A20'), cushion = m('#F1E8DA');
  for (const [x, z] of [[S.x0 + 0.5, S.z0 + 0.5], [S.x1 - 0.5, S.z0 + 0.5], [S.x0 + 0.5, S.z1 - 0.5], [S.x1 - 0.5, S.z1 - 0.5]]) cyl(sofa, x, 0, z, 0.32, 2.5, teakDark, 10, 0.22);
  box(sofa, S.x0, 2.5, S.z0, S.x1 - S.x0, 0.8, S.z1 - S.z0, teak);
  box(sofa, S.x1 - 0.7, 3.3, S.z0, 0.7, 5.0, S.z1 - S.z0, teak);
  box(sofa, S.x1 - 0.9, 8.3, S.z0 - 0.2, 1.1, 0.4, S.z1 - S.z0 + 0.4, teakDark);
  for (let z = S.z0 + 1.2; z < S.z1 - 1; z += 1.25) box(sofa, S.x1 - 0.78, 3.6, z, 0.1, 4.5, 0.45, teakDark, false);
  for (const z of [S.z0, S.z1 - 0.7]) { box(sofa, S.x0 + 0.3, 3.3, z, S.x1 - S.x0 - 1.0, 2.6, 0.7, teak); box(sofa, S.x0 + 0.1, 5.9, z - 0.15, S.x1 - S.x0 - 0.7, 0.35, 1.0, teakDark); }
  box(sofa, S.x0 + 0.2, 3.3, S.z0 + 0.7, S.x1 - S.x0 - 0.9, S.seat - 3.3, S.z1 - S.z0 - 1.4, cushion);
  for (const z of [S.z0 + 0.8, S.z0 + 5.15]) box(sofa, S.x1 - 1.75, S.seat, z, 1.05, 2.9, 4.25, cushion);
  for (const [z, c, ry] of [[S.z0 + 1.0, '#D9A43C', 0.35], [S.z1 - 2.9, '#C8643C', -0.3]] as const) { const p = box(sofa, S.x1 - 2.55, S.seat, z, 0.75, 2.0, 2.0, m(c)); p.rotation.set(0, ry, 0.18); }
  clickable(sofa, { tip: 'The sofa', click: () => { if (shut > 0.5) windowHit.click(); } });

  // ---------------------------------------------------------------- her (from her homepage portrait): a small rig so she can sit at the desk, walk, and sit by the window
  const skin = m('#BE8762'), hairM = m('#1E1814'), sweater = m('#E9957F'), sweaterDark = m('#D88470'), jeans = m('#33384A'), under = m('#2A2A2E'), shoe = m('#E8E4DC');
  // her desk chair, facing the desk
  const chair = group(room, 45, 0, 11.4); chair.rotation.y = Math.PI;
  box(chair, -1.9, 4.4, -1.7, 3.8, 0.8, 3.4, m('#2B2B2D')); box(chair, -1.9, 5.2, -2.25, 3.8, 3.9, 0.45, m('#2B2B2D'));
  cyl(chair, 0, 0.3, -0.2, 0.25, 4.1, m('#5A5A5C'));
  box(chair, -1.8, 0, -0.5, 3.6, 0.3, 0.6, m('#3A3A3C')); box(chair, -0.3, 0, -2.0, 0.6, 0.3, 3.6, m('#3A3A3C'));
  // her: the origin is her hips; she faces +z before turning
  const me = group(room);
  box(me, -1.15, 0, -0.75, 2.3, 3.9, 1.5, sweater);
  box(me, -1.15, 0, -0.75, 2.3, 0.35, 1.5, sweaterDark);
  box(me, -0.45, 3.35, 0.72, 0.9, 0.55, 0.06, under);
  box(me, -0.3, 3.9, -0.3, 0.6, 0.45, 0.6, skin);
  const legs = [-1, 1].map((s) => { const hip = group(me, s * 0.5, 0.2, 0); box(hip, -0.47, -3.0, -0.45, 0.95, 3.0, 0.9, jeans); const knee = group(hip, 0, -3.0, 0); box(knee, -0.45, -5.0, -0.45, 0.9, 5.0, 0.9, jeans); box(knee, -0.5, -5.5, -0.5, 1.0, 0.5, 1.4, shoe); return { hip, knee }; });
  const arms = [-1, 1].map((s) => { const sh = group(me, s * 1.42, 3.6, 0); box(sh, -0.28, -1.9, -0.45, 0.55, 1.9, 0.9, sweater); const el = group(sh, 0, -1.9, 0); box(el, -0.25, -1.8, -0.25, 0.5, 1.8, 0.5, sweater); box(el, -0.21, -2.2, -0.25, 0.42, 0.42, 0.5, skin); return { sh, el }; });
  const face = canvasTex(16, 16, (x) => {
    const P = (c: string, X: number, Y: number, w = 1, h = 1) => { x.fillStyle = c; x.fillRect(X, Y, w, h); };
    P('#BE8762', 0, 0, 16, 16); P('#1E1814', 0, 0, 16, 3); P('#1E1814', 0, 3, 2, 3); P('#1E1814', 14, 3, 2, 3); P('#1E1814', 7, 3, 2, 1);
    const g = '#2B2320';
    for (const ox of [2, 9]) { P(g, ox, 6, 5, 1); P(g, ox, 10, 5, 1); P(g, ox, 7, 1, 3); P(g, ox + 4, 7, 1, 3); P('#D9B79F', ox + 1, 7, 3, 3); P('#2A1E18', ox + 1, 8, 1, 1); P('#2A1E18', ox + 2, 8, 2, 1); }
    P(g, 7, 7, 2, 1); P('#D97C6F', 2, 11, 2, 1); P('#D97C6F', 12, 11, 2, 1);
    P('#7C3B2C', 5, 13, 6, 1); P('#7C3B2C', 4, 12, 1, 1); P('#7C3B2C', 11, 12, 1, 1);
  }, true);
  box(me, -0.82, 4.3, -0.8, 1.64, 1.75, 1.6, [skin, skin, skin, skin, new THREE.MeshLambertMaterial({ map: face }), skin]);
  box(me, -0.92, 5.95, -0.92, 1.84, 0.42, 1.8, hairM);
  box(me, -0.92, 4.35, -0.98, 1.84, 2.0, 0.32, hairM);
  box(me, -1.0, 4.05, -0.95, 0.24, 2.2, 1.35, hairM); box(me, 0.76, 4.05, -0.95, 0.24, 2.2, 1.35, hairM);
  box(me, -0.98, 5.55, 0.35, 0.3, 0.6, 0.5, hairM); box(me, 0.68, 5.55, 0.35, 0.3, 0.6, 0.5, hairM);
  box(me, -0.35, 4.6, -1.4, 0.7, 0.8, 0.45, hairM);
  box(me, 0.5, 3.75, -1.25, 0.5, 0.55, 2.1, hairM); box(me, 0.55, 1.5, 0.62, 0.45, 2.4, 0.42, hairM); box(me, 0.6, 1.1, 0.66, 0.35, 0.5, 0.36, hairM);
  type Pose = [number, number, number, number];   // hip, knee, shoulder, elbow
  const POSE = { desk: [-Math.PI / 2, Math.PI / 2, -0.6, -1.6] as Pose, sofa: [-Math.PI / 2, Math.PI / 2, -0.25, -1.1] as Pose, stand: [0, 0, 0, -0.15] as Pose };
  let pose: Pose = [...POSE.desk];
  const setPose = (p: Pose, walk = 0) => {
    pose = p;
    legs.forEach((l, i) => { const s = i ? -1 : 1; l.hip.rotation.x = p[0] + Math.sin(walk) * 0.5 * s; l.knee.rotation.x = p[1] + Math.max(0, Math.sin(walk + (i ? Math.PI : 0) - 0.6)) * 0.7; });
    arms.forEach((a, i) => { const s = i ? 1 : -1; a.sh.rotation.x = p[2] + Math.sin(walk) * 0.45 * s; a.el.rotation.x = p[3]; });
  };
  const lerpPose = (a: Pose, b: Pose, k: number) => a.map((v, i) => v + (b[i] - v) * k) as Pose;
  const SIT = 5.45, STAND = 8.3;
  const AT = { desk: { p: new THREE.Vector3(45, SIT, 11.4), r: Math.PI }, sofa: { p: new THREE.Vector3(6.3, SIT, 16.5), r: -Math.PI / 2 } };
  me.position.copy(AT.desk.p); me.rotation.y = AT.desk.r; setPose(POSE.desk);
  let meAt: 'desk' | 'sofa' = 'desk';
  const turnTo = (r: number) => { const r0 = me.rotation.y; let d = r - r0; d = Math.atan2(Math.sin(d), Math.cos(d)); return tween(160, (k) => { me.rotation.y = r0 + d * ease(k); }); };
  const walk = async (pts: THREE.Vector3[]) => {
    for (const to of pts) {
      const from = me.position.clone(), dist = from.distanceTo(to); if (dist < 0.01) continue;
      await turnTo(Math.atan2(to.x - from.x, to.z - from.z));
      await tween(dist / 17 * 1000, (k) => { me.position.lerpVectors(from, to, k); setPose(POSE.stand, k * dist * 0.9); });
    }
    setPose(POSE.stand);
  };
  const standUp = (to: THREE.Vector3) => { const from = me.position.clone(), p0 = [...pose] as Pose; return tween(520, (k) => { const e = ease(k); me.position.lerpVectors(from, to, e); setPose(lerpPose(p0, POSE.stand, e)); }); };
  const sit = async (at: { p: THREE.Vector3; r: number }, p: Pose) => { await turnTo(at.r); const from = me.position.clone(); await tween(620, (k) => { const e = ease(k); me.position.lerpVectors(from, at.p, e); setPose(lerpPose(POSE.stand, p, e)); }); };
  const PATH = [new THREE.Vector3(38, STAND, 19), new THREE.Vector3(1.9, STAND, 24.4), new THREE.Vector3(1.9, STAND, 16.5)];
  const goSofa = async () => { await standUp(new THREE.Vector3(45, STAND, 13.4)); await walk(PATH); await sit(AT.sofa, POSE.sofa); meAt = 'sofa'; };
  const goDesk = async () => { await standUp(new THREE.Vector3(1.9, STAND, 16.5)); await walk([...PATH.slice(0, 2).reverse(), new THREE.Vector3(45, STAND, 13.4)]); await sit(AT.desk, POSE.desk); meAt = 'desk'; };
  clickable(me, { tip: 'Kiruthika', click: () => ui.show({ kind: meAt === 'desk' ? 'At the desk' : 'By the window', title: 'Kiruthika' }) });

  // ---------------------------------------------------------------- Kafka: on the monitor, beak towards the room; she flies to the window when it opens
  const kafka = group(room); const kbody = group(kafka, -1.43, 0, -0.31);
  const px = 0.13;
  CROW.forEach((row, ry) => { let x = 0; while (x < row.length) { const ch = row[x]; if (ch === '.') { x++; continue; } let w = 1; while (row[x + w] === ch) w++; box(kbody, x * px, (17 - ry) * px, 0, w * px, px, ch === 'w' || ch === 'o' || ch === 'e' ? 0.62 : 0.5, m(CROW_COLORS[ch])); x += w; } });
  const wings = [1, -1].map((side) => { const g = group(kafka, -0.3, 1.25, side * 0.3); box(g, -0.6, 0, side > 0 ? 0 : -1.5, 1.2, 0.1, 1.5, m('#151414')); g.visible = false; return g; });
  const head = group(kafka, 0.5, 2.0, 0);
  const PERCH = { monitor: new THREE.Vector3(45.4 + 1.43, top + 7.32, 2.31), window: new THREE.Vector3(1.0, WY0, 15.0) };
  kafka.position.copy(PERCH.monitor);
  let kafkaAt: 'monitor' | 'window' = 'monitor', saying: string | null = null, busy = false, sayTimer = 0;
  const fly = async (to: THREE.Vector3, face: number) => {
    const from = kafka.position.clone(), dir = to.clone().sub(from);
    kafka.rotation.y = Math.atan2(-dir.z, dir.x); wings.forEach((w) => (w.visible = true));
    await tween(1500, (k) => {
      const e = ease(k); kafka.position.lerpVectors(from, to, e); kafka.position.y += Math.sin(Math.PI * e) * 7;
      const f = Math.sin(k * 44) * 0.9; wings[0].rotation.x = -f; wings[1].rotation.x = f;
    });
    wings.forEach((w) => (w.visible = false)); kafka.position.copy(to); kafka.rotation.y = face; invalidate();
  };
  const hop = () => { const y0 = kafka.position.y; return tween(500, (k) => { kafka.position.y = y0 + Math.abs(Math.sin(k * Math.PI * 2)) * 0.5; }); };
  const windowLine = () => (night ? data.desk.kafkaWindowNight : data.desk.kafkaWindow) ?? '';
  const kafkaHit: Hit = { tip: 'Kafka', click: () => {
    if (kafkaAt === 'window') { say(windowLine()); hop(); return; }
    ui.show({ kind: 'Kafka', title: 'Kafka', note: data.desk.kafka, url: '/kafka/', linkLabel: 'Her file' }); hop();
  } };
  clickable(kafka, kafkaHit);
  // her words stay just long enough to read (about a third of a second a word, never under four seconds)
  function say(text: string | null) {
    clearTimeout(sayTimer); saying = text || null;
    if (!saying) ui.say(null); else sayTimer = window.setTimeout(() => say(null), Math.max(4000, saying.split(/\s+/).length * 330 + 1800));
    invalidate();
  }

  const windowHit: Hit = { tip: 'The window', focus: 1.1, click: async () => {
    if (busy) return; busy = true; ui.hide();
    if (shut > 0.5) {
      windowHit.tip = 'Close the blind';
      await Promise.all([(async () => { await tween(900, (k) => setBlind(1 - ease(k))); await fly(PERCH.window, Math.PI); kafkaAt = 'window'; })(), goSofa()]);
      say(windowLine());
    } else {
      windowHit.tip = 'The window'; say(null);
      await Promise.all([tween(900, (k) => setBlind(ease(k))), fly(PERCH.monitor, 0), goDesk()]); kafkaAt = 'monitor';
    }
    busy = false;
  } };
  clickable(win, windowHit); clickable(view, windowHit);

  // ---------------------------------------------------------------- light
  const hemi = new THREE.HemisphereLight('#FFFFFF', '#B9A58B', 2); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#FFF4E6', 2.5);
  sun.position.set(-14, 50, 36); sun.target.position.set(28, 0, 10); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 1, far: 140 }); sun.shadow.camera.updateProjectionMatrix();
  // a soft fill from the room side by day, so the left wall is as light as the back one (and meets the white page cleanly)
  const fill = new THREE.DirectionalLight('#FFF7EE', 0); fill.position.set(80, 30, 40); scene.add(fill);
  const glow = new THREE.PointLight('#AFC4FF', 0, 28, 1.4); glow.position.set(43.6, top + 4.6, 5.2); scene.add(glow);
  const glowSoft = new THREE.PointLight('#FFE3C4', 0, 18, 1.6); glowSoft.position.set(40, top + 2.2, 6); scene.add(glowSoft);
  const lampLight = new THREE.PointLight('#FFC98A', 0, 40, 1.4); lampLight.position.set(54.5, 15.4, 5.5); scene.add(lampLight);

  function applyTheme() {
    const p = night ? PAL.night : PAL.day;
    themed.forEach(({ mat, key }) => mat.color.set(p[key]));
    hemi.intensity = p.hemi; sun.intensity = p.sun; sun.color.set(night ? '#AFC0EA' : '#FFF4E6'); hemi.groundColor.set(night ? '#5A4A3C' : '#B9A58B');
    fill.intensity = night ? 0 : 1.9; glow.intensity = p.glow; glowSoft.intensity = night ? 40 : 0; lampLight.intensity = p.lamp; neonLight.intensity = night ? 30 : 0;
    cityLight.intensity = p.city * (1 - shut); city.userData.redraw(); neon.userData.redraw(); spectrumUpdate();
    shade.emissive.set(night ? '#FFB868' : '#000000'); shade.emissiveIntensity = night ? 0.9 : 0; blindMat.color.set(night ? '#9A9792' : '#FFFFFF');
    lampHit.tip = night ? 'Turn the lights on' : 'Turn the lights off';
    if (saying && kafkaAt === 'window') say(windowLine());
    ui.night(night); invalidate();
  }
  new MutationObserver(() => { night = isDark(); applyTheme(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyTheme();

  // ---------------------------------------------------------------- camera: a three-quarter view that fills the fold; it leans in on what you click
  const R = 260;
  const base = { az: THREE.MathUtils.degToRad(40), el: THREE.MathUtils.degToRad(25) };
  const cur = { ...base, zoom: 1, t: new THREE.Vector3(29, 17, 11) }, aim = { az: base.az, el: base.el, zoom: 1, t: cur.t.clone() };
  const home = cur.t.clone();
  const place = () => {
    camera.position.set(cur.t.x + R * Math.cos(cur.el) * Math.sin(cur.az), cur.t.y + R * Math.sin(cur.el), cur.t.z + R * Math.cos(cur.el) * Math.cos(cur.az));
    camera.lookAt(cur.t); if (camera.zoom !== cur.zoom) { camera.zoom = cur.zoom; camera.updateProjectionMatrix(); }
  };
  const corners = [0, 57].flatMap((x) => [0, TOP + 1].flatMap((y) => [0, 17].map((z) => new THREE.Vector3(x, y, z))));
  corners.push(new THREE.Vector3(0, WY1 + 1, WZ1 + 0.5), new THREE.Vector3(0, WY0 - 1, WZ1 + 0.5), new THREE.Vector3(0, 19.5, KZ + 4.4), new THREE.Vector3(0, 0, KZ + 4.4));   // the window, Kafka's corner
  const resize = () => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h, false);
    // fit the room's contents (not the endless walls) into the frame, centred
    const center = new THREE.Vector3(29, 17, 11);
    const save = { az: cur.az, el: cur.el, t: cur.t.clone(), zoom: cur.zoom };
    cur.az = base.az; cur.el = base.el; cur.t.copy(center); cur.zoom = 1; place(); camera.updateMatrixWorld();
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const c of corners) { const v = c.clone().applyMatrix4(camera.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), up = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
    home.copy(center).addScaledVector(right, (x0 + x1) / 2).addScaledVector(up, (y0 + y1) / 2);
    const pad = 0.99, cw = (x1 - x0) / pad, ch = (y1 - y0) / pad, aspect = w / h;
    const fit = cw / ch > aspect ? { w: cw, h: cw / aspect } : { w: ch * aspect, h: ch };
    camera.left = -fit.w / 2; camera.right = fit.w / 2; camera.top = fit.h / 2; camera.bottom = -fit.h / 2;
    cur.az = save.az; cur.el = save.el; cur.zoom = save.zoom;
    if (focused) cur.t.copy(save.t); else { cur.t.copy(home); aim.t.copy(home); }
    camera.zoom = -1; place(); camera.updateProjectionMatrix(); invalidate();
  };
  let focused: THREE.Object3D | null = null;
  const focus = (o: THREE.Object3D, zoom = 1.45) => {
    focused = o; const b = new THREE.Box3().setFromObject(o), c = b.getCenter(new THREE.Vector3());
    aim.t.copy(home).lerp(c, 0.8); aim.zoom = zoom; ui.zoomed(true); kick();
  };
  const unfocus = () => { focused = null; aim.t.copy(home); aim.zoom = 1; say(null); ui.zoomed(false); kick(); };

  // ---------------------------------------------------------------- loop (on demand)
  const kv = new THREE.Vector3();
  function invalidate() { dirty = true; kick(); }
  function kick() { if (!raf && visible) raf = requestAnimationFrame(frame); }
  function frame(now: number) {
    raf = 0;
    for (const t of tweens) { const k = Math.min(1, (now - t.t0) / t.dur); t.fn(k); if (k >= 1) { tweens.delete(t); t.res(); } }
    const d = Math.abs(aim.az - cur.az) + Math.abs(aim.el - cur.el) + Math.abs(aim.zoom - cur.zoom) + aim.t.distanceTo(cur.t) * 0.01;
    const settling = d > 0.0004;
    if (settling) { const f = still ? 1 : 0.09; cur.az += (aim.az - cur.az) * f; cur.el += (aim.el - cur.el) * f; cur.zoom += (aim.zoom - cur.zoom) * f; cur.t.lerp(aim.t, f); }
    if (spinning && vinyl && !still) vinyl.rotation.z -= 0.035;
    if (settling || tweens.size || dirty || spinning) {
      place(); renderer.render(scene, camera); dirty = false;
      if (saying) { head.getWorldPosition(kv).project(camera); ui.say(saying, (kv.x + 1) / 2 * host.clientWidth, (1 - kv.y) / 2 * host.clientHeight); }
    }
    if (settling || tweens.size || spinning) kick();
  }
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) invalidate(); });
  io.observe(host);
  new ResizeObserver(resize).observe(host);

  // ---------------------------------------------------------------- pointer
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let liftObj: THREE.Object3D | null = null;
  const pick = (e: MouseEvent) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(hits, false)[0]?.object ?? null;
  };
  const rootOf = (o: THREE.Object3D) => { let n = o; while (!n.userData.root && n.parent && !n.parent.userData.container) n = n.parent; return n; };
  const drop = () => { if (liftObj) { liftObj.position.y -= 0.35; liftObj = null; invalidate(); } };
  renderer.domElement.addEventListener('pointermove', (e) => {
    const r = renderer.domElement.getBoundingClientRect();
    if (!still && e.pointerType === 'mouse') { aim.az = base.az + ((e.clientX - r.left) / r.width - 0.5) * 0.07; aim.el = base.el - ((e.clientY - r.top) / r.height - 0.5) * 0.04; kick(); }
    const o = pick(e); const hit = o?.userData.hit as Hit | undefined;
    renderer.domElement.style.cursor = hit ? 'pointer' : '';
    ui.tip(hit?.tip || null, e.clientX - r.left, e.clientY - r.top);
    const root = o && hit?.lift ? rootOf(o) : null;
    if (root !== liftObj) { drop(); if (root) { root.position.y += 0.35; liftObj = root; invalidate(); } }
  });
  renderer.domElement.addEventListener('pointerleave', () => { ui.tip(null); drop(); aim.az = base.az; aim.el = base.el; kick(); });
  renderer.domElement.addEventListener('click', (e) => {
    const o = pick(e); const hit = o?.userData.hit as Hit | undefined;
    if (!hit) { ui.hide(); unfocus(); return; }
    drop(); ui.tip(null); if (hit.focus !== 0) focus(rootOf(o!), hit.focus ?? 1.45); hit.click(); invalidate();
  });

  document.fonts?.ready.then(() => { canvases.forEach((t) => t.userData.redraw()); invalidate(); });
  resize();
  // the page says when its player starts or stops: the record slides out and turns while a song plays
  const spin = (on: boolean) => {
    if (!vinyl || on === spinning) return; spinning = on; const v = vinyl, x0 = v.position.x, x1 = vinylX + (on ? 1.9 : 0);
    tween(500, (k) => { v.position.x = x0 + (x1 - x0) * ease(k); }); kick();
  };
  return { invalidate, unfocus, spin };
}

/** A small pixel portrait of her with Kafka on her shoulder (for the frame on the shelf, and its card). */
function portrait() {
  const W = 56, H = 60, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d')!;
  const P = (col: string, X: number, Y: number, w = 1, h = 1) => { x.fillStyle = col; x.fillRect(X, Y, w, h); };
  const disc = (col: string, cx: number, cy: number, rx: number, ry: number) => { for (let y = -ry; y <= ry; y++) { const half = Math.round(rx * Math.sqrt(1 - (y * y) / (ry * ry))); P(col, cx - half, cy + y, half * 2, 1); } };
  ['#DDE9D6', '#D6E5CF', '#CFE0C8', '#C8DAC1', '#C2D5BB', '#BCD0B5'].forEach((col, i) => P(col, 0, i * 10, W, 10));
  P('#E9957F', 3, 47, 42, 13); P('#E9957F', 6, 45, 36, 2); P('#D88470', 3, 51, 2, 9); P('#D88470', 43, 51, 2, 9);
  P('#BE8762', 18, 38, 8, 9); P('#2A2A2E', 18, 44, 8, 3); P('#2A2A2E', 20, 47, 4, 1);
  disc('#1E1814', 22, 26, 11, 14);
  disc('#BE8762', 22, 29, 9, 11);
  P('#1E1814', 13, 17, 18, 3); P('#1E1814', 21, 17, 2, 4);
  const g = '#2B2320';
  for (const ox of [14, 23]) { P(g, ox, 26, 7, 1); P(g, ox, 31, 7, 1); P(g, ox, 27, 1, 4); P(g, ox + 6, 27, 1, 4); P('#D9B79F', ox + 1, 27, 5, 4); P('#2A1E18', ox + 2, 29, 1, 1); P('#2A1E18', ox + 3, 28, 2, 1); P('#2A1E18', ox + 5, 29, 1, 1); }
  P(g, 21, 27, 2, 1); P('#D97C6F', 14, 33, 2, 1); P('#D97C6F', 28, 33, 2, 1);
  P('#9A6248', 22, 31, 1, 2); P('#7C3B2C', 18, 36, 8, 1); P('#7C3B2C', 17, 35, 1, 1); P('#7C3B2C', 26, 35, 1, 1); P('#FFFFFF', 19, 36, 6, 1); P('#7C3B2C', 19, 37, 6, 1);
  // Kafka on her left shoulder, looking the other way
  CROW.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== '.') P(CROW_COLORS[ch], 32 + rx, 27 + ry, 1, 1); }));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; t.generateMipmaps = false;
  const big = document.createElement('canvas'); big.width = W * 8; big.height = H * 8; const bx = big.getContext('2d')!; bx.imageSmoothingEnabled = false; bx.drawImage(c, 0, 0, W * 8, H * 8);
  return { texture: t, url: big.toDataURL('image/png') };
}
