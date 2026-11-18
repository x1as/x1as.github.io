// Sabit Umarov · portfolio, stage 1: визуальная основа.
// Идея: мир заморожен, время идёт от скролла. Фигура меняет позу между секциями, камера облетает её.
// Скролл идёт по блокам; в блоке Work колесо сначала листает карусель, а фигура за панелью «смахивает» слайд руками.
import * as THREE from 'three'

const $ = s => document.querySelector(s)
const $$ = s => [...document.querySelectorAll(s)]
const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
const lerp = (a, b, t) => a + (b - a) * t
const smooth = t => t * t * (3 - 2 * t)
const D = Math.PI / 180
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches

// ---------------------------------------------------------------- темы
const THEMES = {
  dark: {
    bg: 0x070708, body: 0x1c0503, emissive: 0xff2a12, emissiveK: 0.85, edge: 0xff6a4d, edgeA: 0.95,
    slab: 0x101013, slabEdge: 0xf2efe8, slabEdgeA: 0.16, shard: 0xf2efe8, shardHot: 0xff3b24, grid: 0xf2efe8, gridA: 0.07,
    hemiSky: 0x33343a, hemiGround: 0x050505, hemiK: 0.9, keyK: 0.55, rim: 0xff3b24, rimK: 9, fogNear: 5, fogFar: 22,
  },
  light: {
    bg: 0xefece5, body: 0xe10600, emissive: 0x7a0300, emissiveK: 0.18, edge: 0x5a0200, edgeA: 0.55,
    // осколки серые и красноватые: чёрные сливались с текстом
    slab: 0xffffff, slabEdge: 0x0c0c0c, slabEdgeA: 0.22, shard: 0xb3aea4, shardHot: 0xe86a5c, grid: 0x0c0c0c, gridA: 0.1,
    hemiSky: 0xffffff, hemiGround: 0xcfcac0, hemiK: 1.5, keyK: 1.5, rim: 0xffffff, rimK: 2, fogNear: 6, fogFar: 24,
  },
}
const COLOR_KEYS = ['bg', 'body', 'emissive', 'edge', 'slab', 'slabEdge', 'shard', 'shardHot', 'grid', 'hemiSky', 'hemiGround', 'rim']
const NUM_KEYS = ['emissiveK', 'edgeA', 'slabEdgeA', 'gridA', 'hemiK', 'keyK', 'rimK', 'fogNear', 'fogFar']
let themeName = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'
const T = {} // текущее (интерполированное) состояние темы
for (const k of COLOR_KEYS) T[k] = new THREE.Color(THEMES[themeName][k])
for (const k of NUM_KEYS) T[k] = THEMES[themeName][k]

// ---------------------------------------------------------------- сцена
const canvas = $('#world')
let renderer
try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }) }
catch (e) { document.documentElement.classList.add('no-webgl') }

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(T.bg.getHex(), T.fogNear, T.fogFar)
const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 80)

const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1)
const key = new THREE.DirectionalLight(0xffffff, 1); key.position.set(3, 6, 4)
const rimA = new THREE.PointLight(0xffffff, 1, 14, 2); rimA.position.set(-2.4, 2.2, -2.2)
const rimB = new THREE.PointLight(0xffffff, 1, 14, 2); rimB.position.set(2.6, 0.6, 1.6)
scene.add(hemi, key, rimA, rimB)

// ---------------------------------------------------------------- фигура
const bodyMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.55, metalness: 0.05 })
const edgeMat = new THREE.LineBasicMaterial({ transparent: true })
const parts = [] // все меши тела: для «разлёта»
let seed = 7
const rnd = () => (seed = (seed * 16807) % 2147483647, seed / 2147483647)

function part(geo, parent, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, bodyMat)
  m.position.set(x, y, z); m.scale.set(sx, sy, sz)
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 12), edgeMat))
  m.userData.rest = m.position.clone()
  m.userData.dir = new THREE.Vector3(rnd() - 0.5, rnd() - 0.2, rnd() - 0.5).normalize()
  m.userData.spin = new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(2.4)
  parent.add(m); parts.push(m)
  return m
}
const joint = (parent, x, y, z) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g }
const cyl = (rt, rb, h, seg = 5) => new THREE.CylinderGeometry(rt, rb, h, seg, 1)
const ball = r => new THREE.IcosahedronGeometry(r, 0)

// голова: вытянутый овал с сужением к подбородку и чуть уплощённым лицом
function headGeo() {
  const r = 0.118, g = new THREE.SphereGeometry(r, 8, 6)
  const p = g.attributes.position
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i)
    const t = y / r // -1 низ … 1 макушка
    const jaw = t < 0 ? 1 - 0.46 * Math.pow(-t, 1.25) : 1 - 0.1 * t * t // челюсть уже, макушка слегка
    x *= jaw * 0.92; z *= jaw
    if (z > 0) z *= 0.9; else z *= 1.06 // лицо площе, затылок полнее
    if (z > 0 && t < -0.25) z += 0.012 // подбородок вперёд
    y *= 1.42
    p.setXYZ(i, x, y, z)
  }
  g.computeVertexNormals()
  return g
}

const figure = new THREE.Group(); scene.add(figure)
const J = {}
J.root = joint(figure, 0, 0.95, 0)
part(cyl(0.165, 0.135, 0.22, 6), J.root, 0, 0, 0, 1, 1, 0.72)
J.spine = joint(J.root, 0, 0.1, 0)
part(cyl(0.145, 0.165, 0.27, 6), J.spine, 0, 0.11, 0, 1, 1, 0.7)
J.chest = joint(J.spine, 0, 0.22, 0)
part(cyl(0.255, 0.155, 0.4, 6), J.chest, 0, 0.17, 0, 1, 1, 0.6)
J.neck = joint(J.chest, 0, 0.37, 0)
part(cyl(0.048, 0.066, 0.14, 6), J.neck, 0, 0.04, 0)
J.head = joint(J.neck, 0, 0.08, 0)
part(headGeo(), J.head, 0, 0.165, 0.012)

for (const [s, sx] of [['L', 1], ['R', -1]]) {
  J['sh' + s] = joint(J.chest, 0.275 * sx, 0.31, 0)
  part(ball(0.078), J['sh' + s], 0, 0, 0)
  part(cyl(0.06, 0.047, 0.35), J['sh' + s], 0, -0.165, 0)
  J['el' + s] = joint(J['sh' + s], 0, -0.33, 0)
  part(ball(0.05), J['el' + s], 0, 0, 0)
  part(cyl(0.047, 0.034, 0.32), J['el' + s], 0, -0.155, 0)
  part(new THREE.OctahedronGeometry(0.058, 0), J['el' + s], 0, -0.335, 0, 0.8, 1.25, 1)
  J['hip' + s] = joint(J.root, 0.095 * sx, -0.08, 0)
  part(cyl(0.09, 0.064, 0.48), J['hip' + s], 0, -0.225, 0)
  J['kn' + s] = joint(J['hip' + s], 0, -0.45, 0)
  part(ball(0.066), J['kn' + s], 0, 0, 0)
  part(cyl(0.062, 0.04, 0.45), J['kn' + s], 0, -0.215, 0)
  part(new THREE.BoxGeometry(0.085, 0.06, 0.22), J['kn' + s], 0, -0.43, 0.065)
}

// предметы для поз галереи: живут в руке, проявляются масштабом, в разлёт не входят
const propMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.5, metalness: 0.1 })
function prop(geo, parent, x, y, z) {
  const m = new THREE.Mesh(geo, propMat); m.position.set(x, y, z)
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 12), edgeMat))
  parent.add(m); return m
}
const PROPS = {}
{ // удочка: в левой кисти, уходит вверх; леска висит от кончика отвесно
  const g = new THREE.Group(); g.position.set(0, -0.34, 0.02); g.rotation.set(-1.25, 0, -0.5)
  prop(cyl(0.011, 0.02, 0.85, 5), g, 0, -0.425, 0)
  const tip = new THREE.Object3D(); tip.position.set(0, -0.85, 0); g.add(tip)
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), edgeMat)
  line.frustumCulled = false
  const bob = new THREE.Mesh(ball(0.028), propMat); bob.add(new THREE.LineSegments(new THREE.EdgesGeometry(bob.geometry), edgeMat))
  scene.add(line, bob)
  PROPS.rod = { g, parent: 'elL', tip, line, bob }
}
{ // кристалл-башня: парит перед грудью над ладонями
  const g = new THREE.Group(); g.position.set(0, 0.1, 0.4)
  prop(new THREE.OctahedronGeometry(0.11, 0), g, 0, 0, 0).scale.set(1, 1.9, 1)
  prop(cyl(0.07, 0.1, 0.06, 6), g, 0, -0.29, 0)
  PROPS.crystal = { g, parent: 'chest', float: 0.08 }
}
{ // карточка с постером в правой руке: рамка светлая, «постер» цветом фигуры
  const g = new THREE.Group(); g.position.set(0, -0.36, 0.03); g.rotation.set(0.1, 0.7, 0)
  prop(new THREE.BoxGeometry(0.2, 0.28, 0.012), g, 0, -0.13, 0)
  const poster = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.02), bodyMat); poster.position.set(0, -0.11, 0); g.add(poster)
  PROPS.card = { g, parent: 'elL' }
}
for (const k in PROPS) { const P = PROPS[k]; J[P.parent].add(P.g); P.w = 0; P.g.scale.setScalar(0.0001); P.g.visible = false }

// позы: углы в градусах [x, y, z]; root: p = позиция таза, r = поворот; e = разлёт тела 0..1
const POSES = [
  { name: 'REACH', root: { p: [0, 0.95, 0], r: [0, -24, 0] }, spine: [4, 0, 0], chest: [0, -12, 0], head: [-4, 26, 0],
    shL: [-82, 0, 14], elL: [-8, 0, 0], shR: [12, 0, -12], elR: [-22, 0, 0], hipL: [-10, 0, 3], knL: [12, 0, 0], hipR: [12, 0, -3], knR: [16, 0, 0], e: 0 },
  { name: 'STAND', root: { p: [0, 0.95, 0], r: [0, 38, 0] }, spine: [-2, 0, 0], chest: [0, 10, 0], head: [6, -42, 0],
    shL: [6, 0, 9], elL: [-14, 0, 0], shR: [-28, 0, -8], elR: [-118, 0, 0], hipL: [0, 0, 4], knL: [0, 0, 0], hipR: [-6, 0, -4], knR: [9, 0, 0], e: 0 },
  // стоит за панелью карусели лицом к нам, кисти лежат на её верхнем крае
  { name: 'SWIPE', root: { p: [0, 0.95, 0], r: [0, 0, 0] }, spine: [4, 0, 0], chest: [6, 0, 0], head: [12, 0, 0],
    shL: [-34, 0, 13], elL: [-54, 0, 0], shR: [-34, 0, -13], elR: [-54, 0, 0], hipL: [0, 0, 4], knL: [2, 0, 0], hipR: [0, 0, -4], knR: [2, 0, 0], e: 0 },
  { name: 'CROUCH', root: { p: [0, 0.6, 0], r: [0, -38, 0] }, spine: [26, 0, 0], chest: [12, 0, 0], head: [-26, 22, 0],
    shL: [-62, 0, 32], elL: [-72, 0, 0], shR: [-38, 0, -36], elR: [-84, 0, 0], hipL: [-98, 0, 12], knL: [112, 0, 0], hipR: [-38, 0, -8], knR: [118, 0, 0], e: 0 },
  { name: 'SPRINT', root: { p: [0, 0.93, 0], r: [12, -62, 0] }, spine: [14, 0, 0], chest: [4, 16, 0], head: [-12, 22, 0],
    shL: [56, 0, 6], elL: [-78, 0, 0], shR: [-72, 0, -6], elR: [-92, 0, 0], hipL: [-72, 0, 0], knL: [70, 0, 0], hipR: [32, 0, 0], knR: [96, 0, 0], e: 0 },
  // презентация: руки разведены ладонями вверх
  { name: 'OFFER', root: { p: [0, 0.95, 0], r: [0, 0, 0] }, spine: [2, 0, 0], chest: [4, 0, 0], head: [6, 0, 0],
    shL: [-38, 0, 34], elL: [-58, 0, 0], shR: [-38, 0, -34], elR: [-58, 0, 0], hipL: [0, 0, 4], knL: [2, 0, 0], hipR: [0, 0, -4], knR: [2, 0, 0], e: 0 },
]
const JOINTS = ['spine', 'chest', 'neck', 'head', 'shL', 'elL', 'shR', 'elR', 'hipL', 'knL', 'hipR', 'knR']
const Z3 = [0, 0, 0]
const WORK = 2 // индекс секции с каруселью
const PETS = 4 // индекс секции с галереей pet-проектов
// В галерее у каждого проекта своя поза. При листании фигура рассыпается на осколки, проворачивается
// в этом облаке и собирается уже в позу следующего проекта. prop: какой предмет проявляется в руке.
const PET_POSES = [
  // рыбак: в три четверти вправо, полуприсед, руки у груди; удочка поднята круто вверх, леска висит отвесно перед ним
  { name: 'CAST', prop: 'rod', root: { p: [0, 0.9, 0], r: [0, 34, 0] }, spine: [10, 0, 0], chest: [2, 0, 0], head: [14, 10, 0],
    shL: [-36, 0, 4], elL: [-58, 0, 0], shR: [-30, 0, -10], elR: [-76, 0, 0], hipL: [-28, 0, 4], knL: [34, 0, 0], hipR: [12, 0, -5], knR: [22, 0, 0], e: 0 },
  // серфер: грудью к нам, присед на широко расставленных ногах, крен влево, руки в стороны, взгляд по ходу
  { name: 'SURF', root: { p: [0, 0.8, 0], r: [0, 12, 13] }, spine: [12, 0, -4], chest: [0, -10, 0], head: [-4, -56, 6],
    shL: [-8, 0, 84], elL: [-14, 0, 0], shR: [-4, 0, -72], elR: [-26, 0, 0], hipL: [-34, 0, 20], knL: [54, 0, 0], hipR: [-18, 0, -22], knR: [44, 0, 0], e: 0 },
  // строитель: в три четверти вправо, ладони перед грудью, над ними парит и вращается кристалл-башня
  { name: 'BUILD', prop: 'crystal', root: { p: [0, 0.95, 0], r: [0, 42, 0] }, spine: [4, 0, 0], chest: [6, 0, 0], head: [20, 0, 0],
    shL: [-52, 0, 18], elL: [-56, 0, 0], shR: [-52, 0, -18], elR: [-56, 0, 0], hipL: [0, 0, 5], knL: [2, 0, 0], hipR: [-10, 0, -5], knR: [12, 0, 0], e: 0 },
  // критик: лицом к нам; левая рука держит карточку с постером на уровне лица, правая у подбородка, голова склонена к карточке
  { name: 'JUDGE', prop: 'card', root: { p: [0, 0.95, 0], r: [0, 14, 0] }, spine: [-4, 0, 0], chest: [0, 8, 0], head: [6, 16, 10],
    shL: [-48, 0, 10], elL: [-96, 0, 0], shR: [-30, 0, -22], elR: [-138, 0, 0], hipL: [-6, 0, 6], knL: [10, 0, 0], hipR: [2, 0, -3], knR: [0, 0, 0], e: 0 },
]
const SHATTER_MS = 1150 // рассыпаться → провернуться → собраться
// Жест листания. «Вперёд»: фигура наклоняется к экрану, левая рука (от нас правая) опускается к правому
// верхнему углу панели и проводит влево над её краем, потом возвращается. «Назад»: зеркально, правой рукой.
const SWIPE_MS = 1080, SW_T1 = 0.25, SW_T2 = 0.66 // дотянуться · провести · вернуть
// rx/rz: смещение таза (в сторону руки и к экрану), остальное в градусах
const SW_START = { sh: [-34, 0, 74], el: [-8, 0, 0], rx: 0.2, rz: 0.34, spineX: 15, spineZ: -15, chestY: 10, headX: 6, headY: 24 }
const SW_END = { sh: [-84, 0, -30], el: [-30, 0, 0], rx: -0.07, rz: 0.36, spineX: 17, spineZ: 5, chestY: -30, headX: 4, headY: -18 }
const easeOut = t => 1 - Math.pow(1 - t, 3)
const easeIO = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// камера на секцию: откуда смотрим и куда. Сдвиг точки взгляда ставит фигуру слева или справа от текста.
const CAMS = [
  { p: [0.5, 1.35, 4.0], l: [-0.85, 1.02, 0] },
  { p: [-2.7, 1.5, 3.0], l: [0.85, 1.05, 0] },
  { p: [0, 1.5, 3.05], l: [0, 1.12, 0], center: true }, // по центру за панелью, чуть дальше, чем в контактах
  { p: [2.3, 0.85, 3.2], l: [-0.95, 0.72, 0] },
  { p: [0.85, 1.14, 4.2], l: [-1.2, 1.02, 0], pets: true }, // ближе, чем было: фигура справа от галереи в полный рост
  { p: [0, 1.52, 2.25], l: [0, 1.5, 0], center: true }, // от пояса до макушки, голова в кадре
]

// ---------------------------------------------------------------- мир: плиты, осколки, пол
const slabMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9, metalness: 0 })
const slabEdgeMat = new THREE.LineBasicMaterial({ transparent: true })
const world = new THREE.Group(); scene.add(world)
for (let i = 0; i < 22; i++) {
  const a = (i / 22) * Math.PI * 2 + rnd() * 0.5, r = 4.6 + rnd() * 8
  const w = 0.4 + rnd() * 1.6, h = 0.6 + rnd() * rnd() * 7, d = 0.4 + rnd() * 1.6
  const g = new THREE.BoxGeometry(w, h, d)
  const m = new THREE.Mesh(g, slabMat)
  m.position.set(Math.cos(a) * r, h / 2 - 0.001 + (rnd() < 0.25 ? 0.6 + rnd() * 2.2 : 0), Math.sin(a) * r)
  m.rotation.y = rnd() * Math.PI
  if (rnd() < 0.3) m.rotation.z = (rnd() - 0.5) * 0.5
  m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), slabEdgeMat))
  world.add(m)
}
const gridMat = new THREE.LineBasicMaterial({ transparent: true })
{
  const pts = [], N = 40, S = 1
  for (let i = -N; i <= N; i++) { pts.push(i * S, 0, -N * S, i * S, 0, N * S, -N * S, 0, i * S, N * S, 0, i * S) }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  world.add(new THREE.LineSegments(g, gridMat))
}
// осколки: замерли в воздухе, двигаются только вместе со «временем»
const SH = innerWidth < 760 ? 220 : 420
const shardGeo = new THREE.TetrahedronGeometry(1, 0)
const shardMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.4, metalness: 0.1 })
const shards = new THREE.InstancedMesh(shardGeo, shardMat, SH)
const shardData = []
const dummy = new THREE.Object3D()
const cA = new THREE.Color()
for (let i = 0; i < SH; i++) {
  const a = rnd() * Math.PI * 2, r = 0.9 + Math.pow(rnd(), 1.6) * 8.5
  shardData.push({
    x: Math.cos(a) * r, y: 0.15 + rnd() * 3.6, z: Math.sin(a) * r,
    s: 0.012 + Math.pow(rnd(), 3) * 0.11, sx: 0.5 + rnd() * 1.6, sy: 0.3 + rnd() * 0.9,
    rx: rnd() * 6.28, ry: rnd() * 6.28, vr: (rnd() - 0.5) * 2.2, vy: (rnd() - 0.5) * 0.5, va: (rnd() - 0.5) * 0.35, hot: rnd() < 0.22,
  })
}
shards.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
scene.add(shards)
function paintShards() { for (let i = 0; i < SH; i++) shards.setColorAt(i, shardData[i].hot ? T.shardHot : T.shard); shards.instanceColor.needsUpdate = true }

// ---------------------------------------------------------------- применение темы
function applyTheme() {
  bodyMat.color.copy(T.body); bodyMat.emissive.copy(T.emissive); bodyMat.emissiveIntensity = T.emissiveK
  edgeMat.color.copy(T.edge); edgeMat.opacity = T.edgeA
  slabMat.color.copy(T.slab); slabEdgeMat.color.copy(T.slabEdge); slabEdgeMat.opacity = T.slabEdgeA
  gridMat.color.copy(T.grid); gridMat.opacity = T.gridA
  propMat.color.copy(T.shard); propMat.emissive.copy(T.shard); propMat.emissiveIntensity = T.emissiveK * 0.42
  hemi.color.copy(T.hemiSky); hemi.groundColor.copy(T.hemiGround); hemi.intensity = T.hemiK
  key.intensity = T.keyK; rimA.color.copy(T.rim); rimB.color.copy(T.rim); rimA.intensity = T.rimK; rimB.intensity = T.rimK * 0.5
  scene.fog.color.copy(T.bg); scene.fog.near = T.fogNear; scene.fog.far = T.fogFar
  paintShards()
}
applyTheme()
let themeAnim = null
function setTheme(name) {
  themeName = name
  document.documentElement.dataset.theme = name
  $('meta[name="theme-color"]').content = name === 'dark' ? '#070708' : '#efece5'
  try { localStorage.setItem('theme', name) } catch (e) {}
  const from = {}, to = THEMES[name]
  for (const k of COLOR_KEYS) from[k] = T[k].clone()
  for (const k of NUM_KEYS) from[k] = T[k]
  themeAnim = { from, to, t0: performance.now(), d: REDUCED ? 1 : 700 }
}
$('#theme').addEventListener('click', () => setTheme(themeName === 'dark' ? 'light' : 'dark'))

// ---------------------------------------------------------------- скролл → прогресс по секциям
const sections = $$('main .s')
let tops = []
function measure() { tops = sections.map(s => s.offsetTop + s.offsetHeight / 2 - innerHeight / 2) }
function progressAt(y) { // дробный индекс секции: 2.4 = между третьей и четвёртой
  if (y <= tops[0]) return 0
  for (let i = 0; i < tops.length - 1; i++) if (y < tops[i + 1]) return i + (y - tops[i]) / (tops[i + 1] - tops[i])
  return tops.length - 1
}
let target = 0, prog = 0, vel = 0, timeScale = 0.02, worldTime = 0, lastY = scrollY
const pointer = { x: 0, y: 0, sx: 0, sy: 0 }
addEventListener('pointermove', e => { pointer.x = (e.clientX / innerWidth) * 2 - 1; pointer.y = (e.clientY / innerHeight) * 2 - 1 }, { passive: true })

function resize() {
  const w = innerWidth, h = innerHeight
  if (renderer) { renderer.setPixelRatio(Math.min(devicePixelRatio, w < 760 ? 1.5 : 2)); renderer.setSize(w, h, false) }
  camera.aspect = w / h; camera.fov = w / h < 0.8 ? 46 : 34; camera.updateProjectionMatrix()
  measure()
}
addEventListener('resize', resize)
resize()
if (document.fonts?.ready) document.fonts.ready.then(measure)
addEventListener('load', measure)

// ---------------------------------------------------------------- карусель опыта
const slides = $$('#car .slide'), tabsEl = $('#cartabs'), car = $('#car')
let slide = 0, swipe = null // swipe: { t0, dir } — взмах руки фигуры
slides.forEach((s, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = s.dataset.name
  b.addEventListener('click', () => setSlide(i)); tabsEl.append(b)
})
const tabs = [...tabsEl.children]
function setSlide(i) {
  i = clamp(i, 0, slides.length - 1)
  if (i === slide) return false
  const dir = i > slide ? 1 : -1
  const old = slides[slide], next = slides[i]
  slide = i
  tabs.forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-current', k === i ? 'true' : 'false') })
  $('#carnum').textContent = String(i + 1).padStart(2, '0')
  // слайд трогается, когда рука дотянулась до угла панели
  setTimeout(() => {
    car.style.setProperty('--d', dir)
    old.classList.remove('on'); old.classList.add('gone')
    setTimeout(() => old.classList.remove('gone'), 620)
    if (slides[slide] === next) next.classList.add('on')
    slides.forEach((s, k) => { if (k !== slide) s.classList.remove('on') })
  }, REDUCED ? 0 : SWIPE_MS * SW_T1 - 40)
  swipe = { t0: performance.now(), dir }
  return true
}
tabs[0].classList.add('on')
$('#carprev').addEventListener('click', () => setSlide(slide - 1))
$('#carnext').addEventListener('click', () => setSlide(slide + 1))
{ // свайп пальцем или мышью по карусели
  let x0 = null
  car.addEventListener('pointerdown', e => { x0 = e.clientX })
  addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0; x0 = null; if (Math.abs(dx) > 48) setSlide(slide + (dx < 0 ? 1 : -1)) })
}

// ---------------------------------------------------------------- галерея pet-проектов
const pjs = $$('#gal .pj'), gal = $('#gal'), galTabsEl = $('#galtabs')
let pet = 0, petFrom = 0, shatter = null // shatter: { t0, dir } — фигура рассыпается и собирается в новую позу
pjs.forEach((s, i) => {
  const b = document.createElement('button'); b.type = 'button'; b.textContent = s.dataset.name
  b.addEventListener('click', () => setPet(i)); galTabsEl.append(b)
})
const galTabs = [...galTabsEl.children]
function markPet(i) {
  galTabs.forEach((t, k) => { t.classList.toggle('on', k === i); t.setAttribute('aria-current', k === i ? 'true' : 'false') })
  pjs.forEach((s, k) => { s.setAttribute('aria-hidden', k === i ? 'false' : 'true'); s.querySelectorAll('a').forEach(a => { a.tabIndex = k === i ? 0 : -1 }) })
  $('#galnum').textContent = String(i + 1).padStart(2, '0')
}
markPet(0)
function setPet(i) {
  i = clamp(i, 0, pjs.length - 1)
  if (i === pet) return false
  const dir = i > pet ? 1 : -1, old = pjs[pet]
  // поза, из которой собираемся: если прошлая сборка не закончилась, стартуем с того, что видно сейчас
  petFrom = shatter ? (shatterK(performance.now()) > 0.5 ? pet : petFrom) : pet
  pet = i
  gal.dataset.d = dir; gal.style.setProperty('--d', dir)
  old.classList.remove('on'); old.classList.add('gone')
  setTimeout(() => old.classList.remove('gone'), 720)
  pjs.forEach((s, k) => { if (k !== i && s !== old) s.classList.remove('on', 'gone') })
  pjs[i].classList.add('on')
  markPet(i)
  shatter = { t0: performance.now(), dir }
  return true
}
const shatterP = now => shatter ? clamp((now - shatter.t0) / (REDUCED ? 1 : SHATTER_MS), 0, 1) : 1
const shatterK = now => smooth(clamp((shatterP(now) - 0.32) / 0.36, 0, 1)) // смена позы идёт, пока фигура рассыпана
$('#galprev').addEventListener('click', () => setPet(pet - 1))
$('#galnext').addEventListener('click', () => setPet(pet + 1))
{ // свайп пальцем или мышью; после свайпа клик по кадру не открывает ссылку
  let x0 = null, y0 = 0, moved = false
  gal.addEventListener('pointerdown', e => { x0 = e.clientX; y0 = e.clientY; moved = false })
  addEventListener('pointerup', e => {
    if (x0 === null) return
    const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.2) { moved = true; setPet(pet + (dx < 0 ? 1 : -1)) }
  })
  gal.addEventListener('click', e => { if (moved) { e.preventDefault(); moved = false } }, true)
  gal.addEventListener('dragstart', e => e.preventDefault())
}
// поза секции PETS: смесь поз двух проектов
const petPose = { root: { p: [0, 0, 0], r: [0, 0, 0] }, e: 0 }
for (const n of JOINTS) petPose[n] = [0, 0, 0]
function blendPet(k) {
  const A = PET_POSES[petFrom], B = PET_POSES[pet]
  for (const c of ['p', 'r']) for (let j = 0; j < 3; j++) petPose.root[c][j] = lerp(A.root[c][j], B.root[c][j], k)
  for (const n of JOINTS) { const a = A[n] || Z3, b = B[n] || Z3; for (let j = 0; j < 3; j++) petPose[n][j] = lerp(a[j], b[j], k) }
  petPose.name = (k > 0.5 ? B : A).name
  return petPose
}
const poseAt = i => i === PETS ? petPose : POSES[i]

// ---------------------------------------------------------------- скролл по блокам
const currentIndex = () => { let best = 0, d = Infinity; sections.forEach((s, i) => { const k = Math.abs(s.offsetTop - scrollY); if (k < d) { d = k; best = i } }); return best }
let snap = null, lockUntil = 0
function goSection(i) {
  i = clamp(i, 0, sections.length - 1)
  const to = Math.min(sections[i].offsetTop, document.documentElement.scrollHeight - innerHeight)
  if (REDUCED) { scrollTo(0, to); return }
  snap = { from: scrollY, to, t0: performance.now(), d: 820 }
  lockUntil = performance.now() + 980
}
// шаг вперёд или назад: в блоке Work сначала листаем карусель
function step(dir) {
  const now = performance.now()
  if (now < lockUntil) return
  const i = currentIndex()
  if (i === WORK && Math.abs(sections[i].offsetTop - scrollY) < 8 && setSlide(slide + dir)) { lockUntil = now + SWIPE_MS + 40; return }
  if (i === PETS && Math.abs(sections[i].offsetTop - scrollY) < 8 && setPet(pet + dir)) { lockUntil = now + 900; return }
  if (i + dir < 0 || i + dir >= sections.length) return
  goSection(i + dir)
}
// блок выше экрана (маленькое окно): внутри него скролл обычный, до края
function tallNative(dir) {
  const s = sections[currentIndex()]
  if (s.offsetHeight <= innerHeight * 1.12) return false
  return dir > 0 ? scrollY + innerHeight < s.offsetTop + s.offsetHeight - 4 : scrollY > s.offsetTop + 4
}
addEventListener('wheel', e => {
  if (e.ctrlKey) return
  const dir = Math.sign(e.deltaY); if (!dir) return
  if (!snap && tallNative(dir)) return
  e.preventDefault()
  if (Math.abs(e.deltaY) < 3) return
  step(dir)
}, { passive: false })
addEventListener('keydown', e => {
  if (e.target.closest('input, textarea, select') || e.altKey || e.ctrlKey || e.metaKey) return
  const k = e.key
  if (k === 'ArrowDown' || k === 'PageDown' || (k === ' ' && !e.shiftKey && !e.target.closest('button, a'))) { if (!tallNative(1)) { e.preventDefault(); step(1) } }
  else if (k === 'ArrowUp' || k === 'PageUp' || (k === ' ' && e.shiftKey)) { if (!tallNative(-1)) { e.preventDefault(); step(-1) } }
  else if (k === 'Home') { e.preventDefault(); goSection(0) }
  else if (k === 'End') { e.preventDefault(); goSection(sections.length - 1) }
  else if ((k === 'ArrowRight' || k === 'ArrowLeft') && currentIndex() === WORK) setSlide(slide + (k === 'ArrowRight' ? 1 : -1))
  else if ((k === 'ArrowRight' || k === 'ArrowLeft') && currentIndex() === PETS) setPet(pet + (k === 'ArrowRight' ? 1 : -1))
})

// ---------------------------------------------------------------- DOM-реакции
const io = new IntersectionObserver(es => { for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } }, { threshold: 0.18, rootMargin: '0px 0px -6% 0px' })
$$('.rv').forEach(el => io.observe(el))
const railLinks = $$('.rail a'), words = $$('.backdrop span')
let active = -1
function setActive(i) {
  if (i === active) return
  active = i
  railLinks.forEach((a, k) => a.classList.toggle('on', k === i))
  words.forEach((w, k) => w.classList.toggle('on', k === i))
  showPose()
}
let poseLabel = ''
function showPose() {
  const t = String(active).padStart(2, '0') + ' · ' + (active === PETS ? petPose.name || PET_POSES[pet].name : POSES[active].name)
  if (t !== poseLabel) { poseLabel = t; $('#posename').textContent = t }
}
for (const a of [...railLinks, $('.mark')]) a.addEventListener('click', e => {
  e.preventDefault()
  const i = sections.findIndex(s => '#' + s.id === a.getAttribute('href')); if (i >= 0) { lockUntil = 0; goSection(i) }
})

// ---------------------------------------------------------------- кадр
const vP = new THREE.Vector3(), vL = new THREE.Vector3(), look = new THREE.Vector3(0, 1, 0), vT = new THREE.Vector3()
const elTime = $('#timeval'), elBar = $('#timebar'), elCoords = $('#coords'), elHint = $('#hint'), backdrop = $('.backdrop')
let last = performance.now(), frame = 0

function tick(now) {
  requestAnimationFrame(tick)
  if (document.hidden || !renderer) return
  const gap = now - last
  const dt = Math.min(0.05, (now - last) / 1000); last = now; frame++

  // переход между блоками
  if (snap) {
    const p = clamp((now - snap.t0) / snap.d, 0, 1), k = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
    scrollTo(0, lerp(snap.from, snap.to, k)); if (p >= 1) snap = null
  }

  // тема
  if (themeAnim) {
    const k = smooth(clamp((now - themeAnim.t0) / themeAnim.d, 0, 1))
    for (const c of COLOR_KEYS) T[c].copy(themeAnim.from[c]).lerp(cA.set(themeAnim.to[c]), k)
    for (const n of NUM_KEYS) T[n] = lerp(themeAnim.from[n], themeAnim.to[n], k)
    applyTheme(); if (k >= 1) themeAnim = null
  }

  // скролл и «время»
  const y = scrollY
  target = progressAt(y)
  prog = REDUCED ? target : lerp(prog, target, 1 - Math.exp(-Math.min(1, gap / 1000) * 6.5)) // по реальному времени: не отстаёт при редких кадрах
  const speed = Math.abs(y - lastY) / Math.max(dt, 0.001) / innerHeight; lastY = y // экранов в секунду
  vel = lerp(vel, speed, 1 - Math.exp(-dt * 8))

  // жест листания: веса ключевых положений «у угла» (gS) и «провёл» (gE)
  let gS = 0, gE = 0, swDir = 1
  if (swipe) {
    const p = clamp((now - swipe.t0) / SWIPE_MS, 0, 1); swDir = swipe.dir
    if (p < SW_T1) gS = easeOut(p / SW_T1)
    else if (p < SW_T2) { gE = easeIO((p - SW_T1) / (SW_T2 - SW_T1)); gS = 1 - gE }
    else gE = 1 - easeIO((p - SW_T2) / (1 - SW_T2))
    if (p >= 1) swipe = null
  }
  // галерея: рассыпаться (sh растёт), провернуться, собраться в позу нового проекта (kp)
  const sp = shatterP(now), kp = shatterK(now)
  const sh = shatter ? Math.pow(Math.sin(Math.PI * sp), 0.8) : 0
  const spinDir = shatter ? shatter.dir : 1
  if (shatter && sp >= 1) { shatter = null; petFrom = pet }
  blendPet(kp)
  const sw = Math.min(1, gS * 0.5 + gE + sh * 0.9) // насколько жест «толкает» время
  timeScale = lerp(timeScale, clamp(0.02 + vel * 0.9 + sw * 0.8, 0.02, 1), 1 - Math.exp(-dt * (vel > timeScale || sw > 0.1 ? 10 : 2.2)))
  worldTime += dt * timeScale * (REDUCED ? 0.2 : 1)
  if (y > 40) elHint.classList.add('gone')

  const i0 = clamp(Math.floor(prog), 0, POSES.length - 1), i1 = Math.min(i0 + 1, POSES.length - 1)
  const raw = prog - i0
  // поза держится в центре секции и быстро меняется на границе
  const k = smooth(clamp((raw - 0.18) / 0.64, 0, 1))
  const A = poseAt(i0), B = poseAt(i1)
  setActive(raw > 0.5 ? i1 : i0)
  const petW = (i0 === PETS ? 1 - k : 0) + (i1 === PETS ? k : 0) // насколько мы «в галерее»

  // фигура
  const breath = Math.sin(worldTime * 2.2)
  J.root.position.set(lerp(A.root.p[0], B.root.p[0], k), lerp(A.root.p[1], B.root.p[1], k) + breath * 0.012 + Math.sin(k * Math.PI) * 0.06, lerp(A.root.p[2], B.root.p[2], k))
  J.root.rotation.set(lerp(A.root.r[0], B.root.r[0], k) * D, lerp(A.root.r[1], B.root.r[1], k) * D, lerp(A.root.r[2], B.root.r[2], k) * D)
  // полный оборот внутри облака осколков: видно, что собирается уже другая фигура
  J.root.rotation.y += easeIO(clamp((sp - 0.14) / 0.72, 0, 1)) * Math.PI * 2 * spinDir * petW * (shatter ? 1 : 0)
  J.root.position.y += sh * 0.12 * petW
  for (const n of JOINTS) {
    const a = A[n] || Z3, b = B[n] || Z3
    J[n].rotation.set(lerp(a[0], b[0], k) * D, lerp(a[1], b[1], k) * D, lerp(a[2], b[2], k) * D)
  }
  J.chest.rotation.x += breath * 0.018
  // голова следит за курсором (со спины знак обратный)
  pointer.sx = lerp(pointer.sx, pointer.x, 1 - Math.exp(-dt * 4)); pointer.sy = lerp(pointer.sy, pointer.y, 1 - Math.exp(-dt * 4))
  const facing = Math.cos(J.root.rotation.y)
  J.head.rotation.y += pointer.sx * 0.35 * facing; J.head.rotation.x += pointer.sy * 0.2 * facing
  // жест листания поверх позы: одна рука и корпус
  if (gS + gE > 0.001) {
    const L = swDir > 0, mir = L ? 1 : -1 // «назад» = зеркально, правой рукой
    const sh = L ? J.shL : J.shR, el = L ? J.elL : J.elR, rest = 1 - gS - gE
    sh.rotation.x = sh.rotation.x * rest + (SW_START.sh[0] * gS + SW_END.sh[0] * gE) * D
    sh.rotation.z = sh.rotation.z * rest + (SW_START.sh[2] * gS + SW_END.sh[2] * gE) * D * mir
    el.rotation.x = el.rotation.x * rest + (SW_START.el[0] * gS + SW_END.el[0] * gE) * D
    J.root.position.x += (SW_START.rx * gS + SW_END.rx * gE) * mir; J.root.position.z += SW_START.rz * gS + SW_END.rz * gE
    J.spine.rotation.x += (SW_START.spineX * gS + SW_END.spineX * gE) * D
    J.spine.rotation.z += (SW_START.spineZ * gS + SW_END.spineZ * gE) * D * mir
    J.chest.rotation.y += (SW_START.chestY * gS + SW_END.chestY * gE) * D * mir
    J.head.rotation.x += (SW_START.headX * gS + SW_END.headX * gE) * D
    J.head.rotation.y += (SW_START.headY * gS + SW_END.headY * gE) * D * mir
  }
  // разлёт: лёгкий на переходе между позами, быстрый скролл слегка усиливает
  const ex = lerp(A.e, B.e, k) + Math.sin(k * Math.PI) * 0.07 + clamp(vel * 0.04, 0, 0.08)
  const shx = sh * petW
  for (const m of parts) {
    const u = m.userData, r = ex + shx * 1.7
    m.position.copy(u.rest).addScaledVector(u.dir, ex * 0.3 + shx * 0.62)
    m.rotation.set(u.spin.x * r, u.spin.y * r, u.spin.z * r)
  }
  // предмет в руке: проявляется, когда фигура собрана в позу своего проекта
  const shown = PET_POSES[kp > 0.5 ? pet : petFrom].prop
  for (const key in PROPS) {
    const P = PROPS[key], want = key === shown ? petW * clamp(1 - shx * 2.2, 0, 1) : 0
    P.w = lerp(P.w, want, 1 - Math.exp(-dt * (want > P.w ? 7 : 14)))
    const on = P.w > 0.01
    P.g.visible = on; if (on) P.g.scale.setScalar(Math.max(P.w, 0.0001))
    if (P.float !== undefined) { P.g.position.y = P.float + Math.sin(worldTime * 2.4) * 0.03; P.g.rotation.y = worldTime * 1.3 }
    if (P.tip) {
      P.line.visible = P.bob.visible = on
      if (on) {
        P.tip.getWorldPosition(vT)
        const sway = Math.sin(worldTime * 1.7) * 0.03
        P.bob.position.set(vT.x + sway, vT.y - 0.78 * P.w, vT.z + sway * 0.5); P.bob.scale.setScalar(P.w)
        const a = P.line.geometry.attributes.position; a.setXYZ(0, vT.x, vT.y, vT.z); a.setXYZ(1, P.bob.position.x, P.bob.position.y, P.bob.position.z); a.needsUpdate = true
      }
    }
  }

  // камера
  const ca = CAMS[i0], cb = CAMS[i1], kc = smooth(raw)
  const narrow = camera.aspect < 0.8
  vP.set(lerp(ca.p[0], cb.p[0], kc), lerp(ca.p[1], cb.p[1], kc), lerp(ca.p[2], cb.p[2], kc))
  vL.set(lerp(ca.l[0], cb.l[0], kc), lerp(ca.l[1], cb.l[1], kc), lerp(ca.l[2], cb.l[2], kc))
  const centerK = lerp(ca.center ? 1 : 0, cb.center ? 1 : 0, kc) // крупный план по центру: общие сдвиги не нужны
  const mid = narrow ? 0 : clamp((1.95 - camera.aspect) / 0.6, 0, 1) // узкий десктоп: фигуру дальше от текста
  vL.x *= 1 + 0.5 * mid; vP.multiplyScalar(1 + 0.14 * mid * (1 - centerK))
  if (narrow) { vL.x *= 0.12; vL.y = lerp(Math.max(vL.y - 0.42, 0.25), vL.y - 0.16, centerK); vP.multiplyScalar(lerp(1.22, 1.3, centerK)); vP.y += 0.1 }
  vP.x += pointer.sx * 0.22; vP.y -= pointer.sy * 0.12
  // лёгкий дрейф камеры во «времени»
  vP.x += Math.sin(worldTime * 0.7) * 0.06; vP.y += Math.cos(worldTime * 0.9) * 0.03
  camera.position.copy(vP); look.copy(vL); camera.lookAt(look)

  // осколки
  for (let i = 0; i < SH; i++) {
    const s = shardData[i], a = s.va * worldTime
    const cx = s.x * Math.cos(a) - s.z * Math.sin(a), cz = s.x * Math.sin(a) + s.z * Math.cos(a)
    dummy.position.set(cx, s.y + Math.sin(worldTime * s.vy * 2 + i) * 0.22, cz)
    dummy.rotation.set(s.rx + worldTime * s.vr, s.ry + worldTime * s.vr * 0.7, 0)
    const near = clamp((dummy.position.distanceTo(vP) - 0.7) / 0.7, 0, 1) // у самой камеры осколок исчезает
    dummy.scale.set(s.s * s.sx * near, s.s * s.sy * 2.4 * near, s.s * near)
    dummy.updateMatrix(); shards.setMatrixAt(i, dummy.matrix)
  }
  shards.instanceMatrix.needsUpdate = true

  renderer.render(scene, camera)

  // HUD: обновляем через кадр, чтобы не дёргать layout
  if (frame % 3 === 0) {
    if (active === PETS) showPose()
    elTime.textContent = '×' + timeScale.toFixed(2)
    elBar.style.transform = 'scaleX(' + timeScale.toFixed(3) + ')'
    elCoords.textContent = 'X ' + vP.x.toFixed(2) + ' · Y ' + vP.y.toFixed(2) + ' · Z ' + vP.z.toFixed(2)
  }
  backdrop.style.setProperty('--by', ((raw > 0.5 ? raw - 1 : raw) * -90).toFixed(1) + 'px')
}
prog = target = progressAt(scrollY)
requestAnimationFrame(tick)
