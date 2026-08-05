import { F, S, HEX, P, type GlyphDef } from './svgKit';

/* Energy, raw materials, industry and hard tech. */
export const CORE_GLYPHS: Record<string, GlyphDef> = {
  /* ---------------------------------------------------------------- energy */
  bolt: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M13.6 2 6.2 13.2h4.4L9.8 22 17.8 10.4h-4.7z" />
        <path d="M13.6 2 6.2 13.2h4.4L9.8 22 17.8 10.4h-4.7z" />
      </>
    ),
  },
  battery: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <rect x="2.5" y="7" width="15.5" height="10" rx="2.4" />
        <path {...F} d="M4.6 9.1h6.2v5.8H4.6z" />
        <path d="M20.6 10.4v3.2" />
        <path {...S} d="M12.8 8.2 8.4 13.4h2.8l-.6 3.2 4.4-5.4h-2.8z" />
      </>
    ),
  },
  solar: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="4.6" />
        <circle cx="12" cy="12" r="4.6" />
        <path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.9 4.9l1.9 1.9M17.2 17.2l1.9 1.9M19.1 4.9l-1.9 1.9M6.8 17.2l-1.9 1.9" />
      </>
    ),
  },
  reactor: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d={HEX} />
        <path d={HEX} />
        <circle {...S} cx="12" cy="12" r="2" />
        <path d="M12 7.4v2.4M12 14.2v2.4M8.2 9.9l2 1.2M13.8 12.9l2 1.2M8.2 14.1l2-1.2M13.8 11.1l2-1.2" />
      </>
    ),
  },
  atom: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle {...S} cx="12" cy="12" r="2.1" />
        <ellipse cx="12" cy="12" rx="9.4" ry="3.9" />
        <ellipse cx="12" cy="12" rx="9.4" ry="3.9" transform="rotate(60 12 12)" />
        <ellipse cx="12" cy="12" rx="9.4" ry="3.9" transform="rotate(-60 12 12)" />
      </>
    ),
  },
  radiation: {
    a: P.lime,
    b: P.limeDeep,
    d: (
      <>
        <circle cx="12" cy="12" r="9.2" />
        <g {...S}>
          <path d="M12 12 7.4 4.2a9 9 0 0 1 9.2 0z" />
          <path d="M12 12 7.4 4.2a9 9 0 0 1 9.2 0z" transform="rotate(120 12 12)" />
          <path d="M12 12 7.4 4.2a9 9 0 0 1 9.2 0z" transform="rotate(240 12 12)" />
        </g>
        <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
        <circle cx="12" cy="12" r="2.4" />
      </>
    ),
  },
  flame: {
    a: P.amber,
    b: P.amberDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 2.4c3 3.5 6.2 5.9 6.2 10.1A6.2 6.2 0 0 1 5.8 12.7c0-2 .9-3.6 2-4.9.2 1.7 1 2.7 2.1 3 .5-2.7 1-5.4 2.1-8.4z"
        />
        <path d="M12 2.4c3 3.5 6.2 5.9 6.2 10.1A6.2 6.2 0 0 1 5.8 12.7c0-2 .9-3.6 2-4.9.2 1.7 1 2.7 2.1 3 .5-2.7 1-5.4 2.1-8.4z" />
        <path d="M12 20.4a3.1 3.1 0 0 0 3.1-3.1c0-2-2-2.9-3.1-4.8-1.1 1.9-3.1 2.8-3.1 4.8A3.1 3.1 0 0 0 12 20.4z" />
      </>
    ),
  },
  plug: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path d="M9 2.5v5M15 2.5v5" />
        <path {...F} d="M6.4 7.5h11.2v3.9a5.6 5.6 0 0 1-11.2 0z" />
        <path d="M6.4 7.5h11.2v3.9a5.6 5.6 0 0 1-11.2 0z" />
        <path d="M12 17v4.5" />
      </>
    ),
  },

  /* ------------------------------------------------------------- materials */
  ore: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M6.4 8.4 12 3.2l6.2 4.4 1.4 7.4-5.6 5.4-7.4-1.6L3.8 12.4z" />
        <path d="M6.4 8.4 12 3.2l6.2 4.4 1.4 7.4-5.6 5.4-7.4-1.6L3.8 12.4z" />
        <path d="M12 3.2 10.4 11.4 3.8 12.4M10.4 11.4l9.2 3.8M10.4 11.4l2.6 9" />
      </>
    ),
  },
  ice: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path d="M12 2.3v19.4M3.6 7.1l16.8 9.8M20.4 7.1 3.6 16.9" />
        <path d="M9.3 4.9 12 7.5l2.7-2.6M9.3 19.1 12 16.5l2.7 2.6M4.1 11l.2 3.1 2.9 1M19.9 11l-.2 3.1-2.9 1M4.3 9.9l2.9-1 .2-3.1M19.7 9.9l-2.9-1-.2-3.1" />
      </>
    ),
  },
  leaf: {
    a: P.lime,
    b: P.limeDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 21.6c-4.4-3-6.4-6.6-6.4-10.4C5.6 6.5 8.4 2.9 12 2.4c3.6.5 6.4 4.1 6.4 8.8 0 3.8-2 7.4-6.4 10.4z"
        />
        <path d="M12 21.6c-4.4-3-6.4-6.6-6.4-10.4C5.6 6.5 8.4 2.9 12 2.4c3.6.5 6.4 4.1 6.4 8.8 0 3.8-2 7.4-6.4 10.4z" />
        <path d="M12 21V7.2M12 13.4 8.7 10.2M12 16.6l3.3-3.2" />
      </>
    ),
  },
  ingot: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M2.6 19.4h18.8l-2.7-5H5.3z" />
        <path d="M2.6 19.4h18.8l-2.7-5H5.3z" />
        <path d="M6.6 14.4 8.2 9.6h7.6l1.6 4.8" />
        <path d="M9.4 9.6 10.6 5h2.8l1.2 4.6" />
      </>
    ),
  },
  gas: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <path d="M3 8.5h11.5a3.2 3.2 0 1 0-3.1-4" />
        <path d="M3 13h14a3.2 3.2 0 1 1-3.1 4" />
        <path d="M5.5 17.5h6.8" />
      </>
    ),
  },
  oil: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <path {...F} d="M5.5 6h13v13.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5z" />
        <path d="M5.5 6h13v13.5a1.5 1.5 0 0 1-1.5 1.5H7a1.5 1.5 0 0 1-1.5-1.5z" />
        <path d="M4 6h16M9 3h6v3H9zM8 11h8M8 15h8" />
      </>
    ),
  },
  fuel: {
    a: P.amber,
    b: P.amberDeep,
    d: (
      <>
        <path {...F} d="M4 5.5h9.5v15.5H4z" />
        <path d="M4 21V5.5A1.5 1.5 0 0 1 5.5 4h6.5A1.5 1.5 0 0 1 13.5 5.5V21" />
        <path d="M2.6 21h12.3M5.5 8.5h6.5" />
        <path d="M13.5 11h4a2 2 0 0 1 2 2v4.4a1.6 1.6 0 0 0 3.2 0V8.5l-2.4-2.6" />
      </>
    ),
  },
  droplet: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M12 2.6c3.5 4.2 6.2 7 6.2 10.4A6.2 6.2 0 0 1 5.8 13c0-3.4 2.7-6.2 6.2-10.4z" />
        <path d="M12 2.6c3.5 4.2 6.2 7 6.2 10.4A6.2 6.2 0 0 1 5.8 13c0-3.4 2.7-6.2 6.2-10.4z" />
        <path d="M9.2 14.6a2.8 2.8 0 0 0 2.4 3.2" />
      </>
    ),
  },
  sand: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M2.5 19.5 9 9.5l4 5.4 2.6-3.2 5.9 7.8z" />
        <path d="M2.5 19.5 9 9.5l4 5.4 2.6-3.2 5.9 7.8z" />
        <circle cx="17.4" cy="5.6" r="2.6" />
      </>
    ),
  },
  glassPane: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path {...F} d="M4.5 3.5h15v17h-15z" />
        <rect x="4.5" y="3.5" width="15" height="17" rx="1.6" />
        <path d="M12 3.5v17M4.5 12h15" />
        <path d="M6.6 6.2 9.6 9.2" opacity=".7" />
      </>
    ),
  },
  chemicals: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path d="M9.4 2.5h5.2M10.2 2.5v6.3L5.9 17.2A2.4 2.4 0 0 0 8 20.8h8a2.4 2.4 0 0 0 2.1-3.6L13.8 8.8V2.5" />
        <path {...F} d="M7.6 14h8.8l1.7 3.2a2.4 2.4 0 0 1-2.1 3.6H8a2.4 2.4 0 0 1-2.1-3.6z" />
        <circle {...S} cx="10.4" cy="17.4" r=".9" />
        <circle {...S} cx="13.6" cy="18.6" r=".7" />
      </>
    ),
  },
  fiber: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <path d="M4.5 3.5c0 6 15 6 15 12 0 3-2.6 5-5.5 5" />
        <path d="M8 3.5c0 5.5 12 6.5 12 11.5" opacity=".65" />
        <circle {...S} cx="14" cy="20.5" r="1.4" />
        <circle {...S} cx="4.5" cy="3.5" r="1.4" />
      </>
    ),
  },
  recycle: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path d="M4.6 12a7.4 7.4 0 0 1 12.6-5.3" />
        <path d="M17.4 3.2v3.8h-3.8" />
        <path d="M19.4 12a7.4 7.4 0 0 1-12.6 5.3" />
        <path d="M6.6 20.8V17h3.8" />
      </>
    ),
  },
  waste: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <path {...F} d="M5.5 7h13l-1.2 12.5a1.6 1.6 0 0 1-1.6 1.5H8.3a1.6 1.6 0 0 1-1.6-1.5z" />
        <path d="M5.5 7h13l-1.2 12.5a1.6 1.6 0 0 1-1.6 1.5H8.3a1.6 1.6 0 0 1-1.6-1.5z" />
        <path d="M3.5 7h17M9.5 4h5M10 11v6M14 11v6" />
      </>
    ),
  },

  dna: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <path d="M8.4 2.6c0 4.6 7.2 4.6 7.2 9.4s-7.2 4.8-7.2 9.4" />
        <path d="M15.6 2.6c0 4.6-7.2 4.6-7.2 9.4s7.2 4.8 7.2 9.4" />
        <path d="M9.2 6.6h5.6M8.4 12h7.2M9.2 17.4h5.6" />
      </>
    ),
  },
  cyberarm: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path {...F} d="M3.4 3.6h6.4v5.2H3.4zM12.2 12h5.4v4.6h-5.4z" />
        <rect x="3.4" y="3.6" width="6.4" height="5.2" rx="1.6" />
        <rect x="12.2" y="12" width="5.4" height="4.6" rx="1.4" />
        <circle cx="11" cy="10.4" r="1.8" />
        <circle cx="18.8" cy="17.8" r="1.8" />
        <path d="M20.2 19.2 22 21M17.4 20.2l1 1.4" />
      </>
    ),
  },

  /* ----------------------------------------------------------- electronics */
  wafer: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="8.8" />
        <circle cx="12" cy="12" r="8.8" />
        <path d="M8.2 3.7v16.6M15.8 3.7v16.6M3.7 8.2h16.6M3.7 15.8h16.6" />
      </>
    ),
  },
  chip: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <rect x="6.8" y="6.8" width="10.4" height="10.4" rx="1.8" />
        <path {...F} d="M9.2 9.2h5.6v5.6H9.2z" />
        <path d="M9.8 3.6v3.2M14.2 3.6v3.2M9.8 17.2v3.2M14.2 17.2v3.2M3.6 9.8h3.2M3.6 14.2h3.2M17.2 9.8h3.2M17.2 14.2h3.2" />
      </>
    ),
  },
  cpu: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M3.5 5h17v10.5h-17z" />
        <rect x="3.5" y="5" width="17" height="10.5" rx="1.8" />
        <path d="M8 19h8M12 15.5V19M7 8.4h5.2M7 11.6h8" />
        <path d="M6.5 21h11" />
      </>
    ),
  },
  display: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M2.8 5.5h18.4v11.2H2.8z" />
        <rect x="2.8" y="5.5" width="18.4" height="11.2" rx="2" />
        <path d="M8 20h8" />
        <path d="M6.2 8.8h6.4M6.2 12.2h4" opacity=".8" />
      </>
    ),
  },
  antenna: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path d="M12 12.5V21M8.5 21h7" />
        <path d="M7.7 13.2a6 6 0 0 1 0-8.5M4.9 15.9a9.8 9.8 0 0 1 0-13.9M16.3 13.2a6 6 0 0 0 0-8.5M19.1 15.9a9.8 9.8 0 0 0 0-13.9" />
        <circle {...S} cx="12" cy="9" r="2.2" />
      </>
    ),
  },
  engine: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="6.2" />
        <circle cx="12" cy="12" r="6.2" />
        <circle {...S} cx="12" cy="12" r="2.3" />
        <path d="M12 2.6v3.2M12 18.2v3.2M2.6 12h3.2M18.2 12h3.2M5.4 5.4l2.3 2.3M16.3 16.3l2.3 2.3M18.6 5.4l-2.3 2.3M7.7 16.3l-2.3 2.3" />
      </>
    ),
  },
  gear: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <circle cx="12" cy="12" r="6" />
        <circle {...F} cx="12" cy="12" r="6" />
        <circle cx="12" cy="12" r="2.4" />
        <path d="M12 3v3.1M12 17.9V21M3 12h3.1M17.9 12H21M5.6 5.6l2.2 2.2M16.2 16.2l2.2 2.2M18.4 5.6l-2.2 2.2M7.8 16.2l-2.2 2.2" />
      </>
    ),
  },
  wrench: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path
          {...F}
          d="M15.7 2.6a4.7 4.7 0 0 0-4.1 7.8l-7.4 7.4a1.9 1.9 0 0 0 2.7 2.7l7.4-7.4a4.7 4.7 0 0 0 6-6l-2.7 2.7-2.6-.6-.6-2.6z"
        />
        <path d="M15.7 2.6a4.7 4.7 0 0 0-4.1 7.8l-7.4 7.4a1.9 1.9 0 0 0 2.7 2.7l7.4-7.4a4.7 4.7 0 0 0 6-6l-2.7 2.7-2.6-.6-.6-2.6z" />
      </>
    ),
  },
  nut: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d={HEX} />
        <path d={HEX} />
        <circle cx="12" cy="12" r="3.5" />
      </>
    ),
  },
  drill: {
    a: P.amber,
    b: P.amberDeep,
    d: (
      <>
        <path {...F} d="M7.8 3h8.4l-1.3 6.8L12 17.4 8.9 9.8z" />
        <path d="M7.8 3h8.4l-1.3 6.8L12 17.4 8.9 9.8z" />
        <path d="M8.6 6.6h6.8M9.6 10.1h4.8M12 17.4V21" />
      </>
    ),
  },
  factory: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M3 20.4v-8.8l5 3v-3l5 3v-3l4.6 2.8v6z" />
        <path d="M3 20.4v-8.8l5 3v-3l5 3v-3l4.6 2.8v6z" />
        <path d="M17.6 11.6V4h3.4v16.4M2 20.4h20" />
        <path d="M7 16.4v2M12 16.4v2" />
      </>
    ),
  },
  crate: {
    a: P.amber,
    b: P.amberDeep,
    d: (
      <>
        <path d="M12 2.6 20.6 7v10L12 21.4 3.4 17V7z" />
        <path {...F} d="M12 11.7 20.6 7v10L12 21.4z" />
        <path d="M3.4 7 12 11.7 20.6 7M12 11.7v9.7" />
      </>
    ),
  },
  vault: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2.2" />
        <circle {...F} cx="12" cy="12" r="4.8" />
        <circle cx="12" cy="12" r="4.8" />
        <path d="M12 7.2v-1.4M12 18.2v-1.4M7.2 12H5.8M18.2 12h-1.4" />
      </>
    ),
  },
  weapon: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M2.6 8.4h11.2l2.4 3.2h4.8v2.8h-5.6l-1.8 2.4H9.6l-1-2.4H5.2A2.6 2.6 0 0 1 2.6 11.8z" />
        <path d="M2.6 8.4h11.2l2.4 3.2h4.8v2.8h-5.6l-1.8 2.4H9.6l-1-2.4H5.2A2.6 2.6 0 0 1 2.6 11.8z" />
        <path d="M8.6 16.8v4M4.6 8.4V6h6.8v2.4" />
      </>
    ),
  },
  swords: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M17.6 2.6h3.8v3.8L10.2 17.6 6.4 13.8z" />
        <path d="M17.6 2.6h3.8v3.8L10.2 17.6 6.4 13.8z" />
        <path d="M6.4 2.6H2.6v3.8L13.8 17.6l3.8-3.8z" />
        <path d="M4.6 21.4 8 18M19.4 21.4 16 18" />
      </>
    ),
  },
  bomb: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <circle {...F} cx="10.4" cy="14.6" r="6.4" />
        <circle cx="10.4" cy="14.6" r="6.4" />
        <path d="M14.4 9.6 17 7c1-1 2.4-1 3.4 0" />
        <path d="M20.8 2.6v1.8M22.6 5.2l-1.6.8M18.8 5.2l1.6.8" />
        <path d="M7.4 11.6a4.2 4.2 0 0 1 2.4-1.6" opacity=".7" />
      </>
    ),
  },
  blast: {
    a: P.amber,
    b: P.amberDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 2.2l2.4 4.6 4.8-1.6-1.4 4.9 4.6 2.3-4.6 2.3 1.4 4.9-4.8-1.6L12 21.8l-2.4-4.8-4.8 1.6 1.4-4.9L1.6 12.4l4.6-2.3-1.4-4.9 4.8 1.6z"
        />
        <path d="M12 2.2l2.4 4.6 4.8-1.6-1.4 4.9 4.6 2.3-4.6 2.3 1.4 4.9-4.8-1.6L12 21.8l-2.4-4.8-4.8 1.6 1.4-4.9L1.6 12.4l4.6-2.3-1.4-4.9 4.8 1.6z" />
      </>
    ),
  },
  turret: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle cx="12" cy="12" r="8.8" />
        <circle {...F} cx="12" cy="12" r="4.2" />
        <circle cx="12" cy="12" r="4.2" />
        <circle {...S} cx="12" cy="12" r="1.3" />
        <path d="M12 1.4v3.6M12 19v3.6M1.4 12H5M19 12h3.6" />
      </>
    ),
  },
  shield: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M12 2.4 20 5.3v6.2c0 5-3.3 8.5-8 10.1V2.4z" />
        <path d="M12 2.4 20 5.3v6.2c0 5-3.3 8.5-8 10.1-4.7-1.6-8-5.1-8-10.1V5.3z" />
        <path d="M12 2.4v19.2" />
      </>
    ),
  },
  radar: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <circle cx="12" cy="12" r="8.8" />
        <path d="M12 12V3.2" />
        <path {...F} d="M12 12 4.2 8a8.8 8.8 0 0 1 7.8-4.8z" />
        <path d="M12 12l6.6 5.8" />
        <circle {...S} cx="12" cy="12" r="1.4" />
        <path d="M12 5.8a6.2 6.2 0 0 1 6.2 6.2" opacity=".7" />
      </>
    ),
  },
};
