/**
 * Regenerates src/components/ui/icons/glyphs.ts from Google's Material Design
 * Icons — the icon set Industry Idle draws its UI with.
 *
 *   npm i -D @material-design-icons/svg   # one-off; not needed at runtime
 *   node tools/gen-glyphs.mjs
 *
 * Add an entry to MAP (legacy game name -> Material name) or to EXTRA (a
 * Material name usable as-is) and re-run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'node_modules/@material-design-icons/svg/filled');
const OUT = resolve(ROOT, 'src/components/ui/icons/glyphs.ts');

/** legacy glyph id -> Material Icons (filled) name */
const MAP = {
  // energy
  bolt: 'bolt',
  battery: 'battery_charging_full',
  solar: 'solar_power',
  radiation: 'crisis_alert',
  atom: 'scatter_plot',
  flame: 'local_fire_department',
  plug: 'power',
  fuel: 'local_gas_station',
  oil: 'oil_barrel',
  gas: 'cloud_queue',
  droplet: 'water_drop',
  reactor: 'donut_large',
  engine: 'settings_suggest',
  jetEngine: 'air',

  // materials
  ore: 'grain',
  drill: 'construction',
  ice: 'ac_unit',
  leaf: 'energy_savings_leaf',
  nut: 'hardware',
  wrench: 'build',
  gear: 'settings',
  glassPane: 'window',
  chemicals: 'science',
  fiber: 'cable',
  sand: 'waves',
  desert: 'landscape',
  recycle: 'recycling',
  waste: 'delete',
  crate: 'inventory_2',
  ingot: 'layers',

  // electronics
  wafer: 'sd_card',
  chip: 'memory',
  cpu: 'developer_board',
  display: 'desktop_windows',
  radar: 'radar',
  antenna: 'settings_input_antenna',
  dna: 'polymer',
  cyberarm: 'precision_manufacturing',
  brain: 'psychology',
  robot: 'smart_toy',
  network: 'lan',

  // industry / buildings
  factory: 'factory',
  crane: 'engineering',
  home: 'home',
  city: 'location_city',
  tower: 'cell_tower',
  temple: 'account_balance',
  castle: 'castle',
  market: 'storefront',
  bank: 'savings',
  vault: 'account_balance_wallet',
  stadium: 'stadium',
  ferris: 'attractions',
  tent: 'cabin',
  statue: 'museum',
  volcano: 'volcano',
  megastructure: 'domain',
  platform: 'dashboard',
  station: 'router',

  // military
  shield: 'shield',
  turret: 'gps_fixed',
  swords: 'sports_martial_arts',
  weapon: 'gavel',
  bomb: 'dangerous',
  blast: 'whatshot',
  siren: 'emergency',

  // space
  rocket: 'rocket_launch',
  satellite: 'satellite_alt',
  ufo: 'lens_blur',
  galaxy: 'blur_on',
  vortex: 'cyclone',
  blackhole: 'blur_circular',
  comet: 'flare',
  moon: 'dark_mode',
  globe: 'public',
  planet: 'travel_explore',
  sparkle: 'auto_awesome',
  starburst: 'star',

  // creatures
  bug: 'bug_report',
  swarm: 'pest_control',
  virus: 'coronavirus',
  skull: 'report',
  demon: 'mood_bad',
  eye: 'visibility',
  crown: 'workspace_premium',
  person: 'person',
  bull: 'trending_up',
  bear: 'trending_down',
  whale: 'tsunami',

  // economy
  credits: 'paid',
  cash: 'payments',
  card: 'credit_card',
  gem: 'diamond',
  chartUp: 'trending_up',
  chartDown: 'trending_down',
  chartBars: 'bar_chart',
  exchange: 'swap_horiz',
  scale: 'balance',
  briefcase: 'work',
  receipt: 'receipt_long',
  moneyFly: 'money_off',
  hundred: 'percent',
  crypto: 'currency_bitcoin',
  omega: 'token',
  cart: 'shopping_cart',
  handshake: 'handshake',
  tag: 'sell',

  // logistics
  truck: 'local_shipping',
  import: 'download',
  export: 'upload',
  folder: 'folder',
  archive: 'archive',
  link: 'link',
  compass: 'explore',
  map: 'map',
  pin: 'place',
  inbox: 'inbox',

  // knowledge
  research: 'biotech',
  telescope: 'nights_stay',
  search: 'search',
  bulb: 'lightbulb',
  book: 'menu_book',
  scroll: 'description',
  news: 'newspaper',
  clipboard: 'assignment',
  ruler: 'straighten',
  numbers: 'numbers',
  graduate: 'school',
  crystalBall: 'auto_fix_high',
  quest: 'flag',

  // culture
  palette: 'palette',
  mask: 'theater_comedy',
  music: 'music_note',
  film: 'movie',
  gamepad: 'sports_esports',
  garment: 'checkroom',
  glasses: 'remove_red_eye',
  vr: 'vrpano',
  trophy: 'emoji_events',
  medal: 'military_tech',
  gift: 'card_giftcard',
  heart: 'favorite',
  peace: 'volunteer_activism',
  clover: 'spa',
  fleur: 'filter_vintage',
  infinity: 'all_inclusive',

  // health
  pill: 'medication',
  syringe: 'vaccines',
  bottle: 'sanitizer',
  clamp: 'compress',

  // comms / ui
  phone: 'smartphone',
  chat: 'chat',
  cloud: 'cloud',
  lock: 'lock',
  unlock: 'lock_open',
  hourglass: 'hourglass_bottom',
  clock: 'schedule',
  calendar: 'event',
  refresh: 'refresh',
  sleep: 'bedtime',

  // status
  check: 'check_circle',
  cross: 'cancel',
  warning: 'warning',
  ban: 'block',
  stop: 'do_not_disturb_on',
  question: 'help',
  pause: 'pause',
  play: 'play_arrow',
  fastForward: 'fast_forward',
  faceHappy: 'sentiment_satisfied',
  faceNeutral: 'sentiment_neutral',
  faceSad: 'sentiment_dissatisfied',

  // direction
  arrowRight: 'arrow_forward',
  arrowLeft: 'arrow_back',
  arrowUp: 'arrow_upward',
  arrowDown: 'arrow_downward',
  triangleUp: 'arrow_drop_up',
  triangleDown: 'arrow_drop_down',
  plus: 'add',

  // shapes
  hex: 'hexagon',
  node: 'circle',
};

/* Extra Material names exposed directly so new code can pick any icon from the
   set by its own name without inventing a legacy alias for it. */
const EXTRA = [
  'menu',
  'close',
  // Трещины: разрушенное здание на выработанном месторождении (bigplan 38).
  'broken_image',
  'forest',
  'celebration',
  'expand_more',
  'expand_less',
  'chevron_right',
  'chevron_left',
  'more_vert',
  'tune',
  'visibility_off',
  'info',
  'bookmark',
  'push_pin',
  'notifications',
  'groups',
  'public_off',
  'apartment',
  'water_damage',
  'speed',
  'timeline',
  'pie_chart',
  'show_chart',
  'insights',
  'leaderboard',
  'query_stats',
  'account_circle',
  'logout',
  'login',
  'save',
  'delete_forever',
  'content_copy',
  'edit',
  'add_circle',
  'remove_circle',
  'remove',
  'arrow_right',
  'arrow_left',
  'keyboard_double_arrow_right',
  'auto_mode',
  'bolt',
  'sync',
  'lock_clock',
  'hub',
  'account_tree',
  'schema',
  'category',
  'widgets',
  'grid_view',
  'view_list',
  'filter_alt',
  'sort',
  'star_border',
  'star_half',
  'verified',
  'shopping_basket',
  'local_atm',
  'trending_flat',
  'south',
  'north',
  'bar_chart',
  'candlestick_chart',
  'wallet',
];

/** Turns <circle>/<ellipse> primitives into path data so one <path> is enough. */
function circleToPath(cx, cy, r) {
  return `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
}
function ellipseToPath(cx, cy, rx, ry) {
  return `M${cx - rx} ${cy}a${rx} ${ry} 0 1 0 ${2 * rx} 0a${rx} ${ry} 0 1 0 ${-2 * rx} 0z`;
}

const num = (tag, attr) => {
  const m = tag.match(new RegExp(`${attr}="([^"]+)"`));
  return m ? parseFloat(m[1]) : 0;
};

function extract(name) {
  const file = resolve(SRC, `${name}.svg`);
  let svg;
  try {
    svg = readFileSync(file, 'utf8');
  } catch {
    return null;
  }
  const parts = [];
  for (const m of svg.matchAll(/<path\b[^>]*\bd="([^"]+)"/g)) parts.push(m[1]);
  for (const m of svg.matchAll(/<circle\b[^>]*>/g))
    parts.push(circleToPath(num(m[0], 'cx'), num(m[0], 'cy'), num(m[0], 'r')));
  for (const m of svg.matchAll(/<ellipse\b[^>]*>/g))
    parts.push(ellipseToPath(num(m[0], 'cx'), num(m[0], 'cy'), num(m[0], 'rx'), num(m[0], 'ry')));
  if (!parts.length) return null;
  // Material's "hidden" 24×24 spacer rect shows up as `d="M0 0h24v24H0z"`; dropping
  // it keeps the path data honest without changing how the icon renders.
  const kept = parts.filter((d) => !/^M0 0h24v24H0(V0)?z?$/i.test(d.trim()));
  return (kept.length ? kept : parts).join(' ');
}

const paths = new Map();
const missing = [];

for (const mi of new Set([...Object.values(MAP), ...EXTRA])) {
  const d = extract(mi);
  if (!d) missing.push(mi);
  else paths.set(mi, d);
}

const aliases = {};
for (const [id, mi] of Object.entries(MAP)) if (id !== mi && paths.has(mi)) aliases[id] = mi;

if (missing.length) {
  console.error('MISSING:', missing.join(', '));
  process.exit(1);
}

const sorted = [...paths.entries()].sort(([a], [b]) => a.localeCompare(b));
const bytes = sorted.reduce((n, [, d]) => n + d.length, 0);

const out = `/* eslint-disable */
/**
 * Material Icons (filled) path data — the same icon set Industry Idle draws its
 * UI with, taken from Google's Material Design Icons (Apache License 2.0).
 *
 * GENERATED FILE — do not hand-edit. Regenerate with tools/gen-glyphs.mjs.
 *
 * Every glyph is a single 24×24 path meant to be painted with \`fill\`, not
 * stroked: that flat, solid silhouette is what makes the set read as one family
 * at 12px as well as at 48px.
 */

/** Path data keyed by Material Icons name. */
export const GLYPH_PATHS: Record<string, string> = {
${sorted.map(([k, d]) => `  ${/^[a-z_][a-z0-9_]*$/i.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(d)},`).join('\n')}
};

/**
 * Names the game used before the switch to Material Icons. Kept so the emoji
 * table and existing \`<GameIcon icon="...">\` call sites keep resolving.
 */
export const GLYPH_ALIASES: Record<string, string> = {
${Object.entries(aliases)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `  ${/^[a-z_][a-z0-9_]*$/i.test(k) ? k : JSON.stringify(k)}: '${v}',`)
  .join('\n')}
};
`;

writeFileSync(OUT, out);
console.log(`wrote ${sorted.length} glyphs (${(bytes / 1024).toFixed(1)} KB of path data), ${Object.keys(aliases).length} aliases`);
