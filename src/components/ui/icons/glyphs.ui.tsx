import { F, S, L, HEX, P, type GlyphDef } from './svgKit';

/* Economy, logistics, interface affordances and status marks. */
export const UI_GLYPHS: Record<string, GlyphDef> = {
  /* --------------------------------------------------------------- economy */
  credits: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M15 8.6c-.8-.9-1.9-1.4-3-1.4-2.6 0-4 2.1-4 4.8s1.4 4.8 4 4.8c1.1 0 2.2-.5 3-1.4" />
        <path d="M6.8 10.6h5.6M6.8 13.4h5.6" />
      </>
    ),
  },
  cash: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M2.6 6.4h18.8v11.2H2.6z" />
        <rect x="2.6" y="6.4" width="18.8" height="11.2" rx="1.8" />
        <circle cx="12" cy="12" r="2.8" />
        <path d="M6 9.4v5.2M18 9.4v5.2" />
      </>
    ),
  },
  card: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <rect x="2.4" y="5" width="19.2" height="14" rx="2.4" />
        <path {...F} d="M2.4 8.6h19.2v3.2H2.4z" />
        <path d="M2.4 8.6h19.2M6 15.4h4.4M15.6 15.4h2.4" />
      </>
    ),
  },
  chartUp: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M3.4 20.6V15l5-3.6 4.4 2.6 7.8-6.6v13.2z" />
        <path d="M3.4 20.6h17.6" />
        <path d="M3.4 15.4 8.6 11l4.4 2.6L20.6 7" />
        <path d="M15.6 6.6h5.2v5" />
      </>
    ),
  },
  chartDown: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M3.4 20.6V8.4l5 3.6 4.4-2.6 7.8 6.6v4.6z" />
        <path d="M3.4 20.6h17.6" />
        <path d="M3.4 8.6 8.6 13l4.4-2.6L20.6 17" />
        <path d="M15.6 17.4h5.2v-5" />
      </>
    ),
  },
  chartBars: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M4.4 12h3.2v8.6H4.4zM10.4 7.4h3.2v13.2h-3.2zM16.4 14.4h3.2v6.2h-3.2z" />
        <path d="M4.4 20.6V12h3.2v8.6M10.4 20.6V7.4h3.2v13.2M16.4 20.6v-6.2h3.2v6.2" />
        <path d="M2.6 20.6h18.8" />
      </>
    ),
  },
  exchange: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path d="M3.4 8.4h15.2M15 4.8l3.6 3.6L15 12" />
        <path d="M20.6 15.6H5.4M9 12l-3.6 3.6L9 19.2" />
      </>
    ),
  },
  scale: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path d="M12 4v16M7.4 21h9.2M4 7.4h16" />
        <path {...F} d="M1.6 12.6 4 7.4l2.4 5.2z" />
        <path d="M1.6 12.6a2.4 2.4 0 0 0 4.8 0L4 7.4z" />
        <path {...F} d="M17.6 12.6 20 7.4l2.4 5.2z" />
        <path d="M17.6 12.6a2.4 2.4 0 0 0 4.8 0L20 7.4z" />
        <circle {...S} cx="12" cy="4" r="1.4" />
      </>
    ),
  },
  briefcase: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <rect x="2.6" y="7" width="18.8" height="12.4" rx="2" />
        <path {...F} d="M2.6 11h18.8v3.2H2.6z" />
        <path d="M8.6 7V5.4A1.6 1.6 0 0 1 10.2 3.8h3.6A1.6 1.6 0 0 1 15.4 5.4V7" />
        <path d="M2.6 12h18.8" />
      </>
    ),
  },
  receipt: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <path {...F} d="M5.4 3.4h13.2v17.2l-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4z" />
        <path d="M5.4 3.4h13.2v17.2l-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4-2.2-1.4-2.2 1.4z" />
        <path d="M8.4 8h7.2M8.4 11.6h7.2" />
      </>
    ),
  },
  bull: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M7.4 10.4h9.2v4.2a4.6 4.6 0 0 1-9.2 0z" />
        <path d="M7.4 11a4.6 4.6 0 0 1 9.2 0v3.6a4.6 4.6 0 0 1-9.2 0z" />
        <path d="M7.6 9.4 4 5.4c3-1 5.4-.4 6.6 1.6M16.4 9.4 20 5.4c-3-1-5.4-.4-6.6 1.6" />
        <circle {...S} cx="10.4" cy="13" r=".9" />
        <circle {...S} cx="13.6" cy="13" r=".9" />
      </>
    ),
  },
  bear: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="13.4" r="6" />
        <circle cx="12" cy="13.4" r="6" />
        <circle cx="6.6" cy="6.8" r="2.8" />
        <circle cx="17.4" cy="6.8" r="2.8" />
        <circle {...S} cx="10" cy="12.4" r=".9" />
        <circle {...S} cx="14" cy="12.4" r=".9" />
        <path d="M10.4 16.4c1 .8 2.2.8 3.2 0" />
      </>
    ),
  },
  whale: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M2.6 14c0-3.4 3.6-6 8-6s8 2.6 8 6-3.6 6-8 6-8-2.6-8-6z" />
        <path d="M2.6 14c0-3.4 3.6-6 8-6s8 2.6 8 6-3.6 6-8 6-8-2.6-8-6z" />
        <path d="M18.2 11.6 21.8 8.4v11.2l-3.6-3" />
        <circle {...S} cx="7" cy="12.6" r=".9" />
        <path d="M9.6 6.2c0-1.8 1.2-3 2.8-3" />
      </>
    ),
  },

  /* ------------------------------------------------------------- logistics */
  truck: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M1.8 7h11.6v8.6H1.8z" />
        <path d="M1.8 15.6V7h11.6v8.6M13.4 10.4h4l3 3.4v1.8h-7z" />
        <circle cx="6.6" cy="17.8" r="2.2" />
        <circle cx="16.4" cy="17.8" r="2.2" />
        <path d="M8.8 17.8h5.4M1.8 17.8h2.6M18.6 17.8h2.8" />
      </>
    ),
  },
  cart: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M6.8 7.4h14l-1.8 7.2H8.4z" />
        <path d="M2.6 3.8h2.6l1.6 3.6h14l-1.8 7.2H8.4L6.8 7.4" />
        <path d="M8.4 14.6 7 17.8h12" />
        <circle cx="9.6" cy="20" r="1.6" />
        <circle cx="17.4" cy="20" r="1.6" />
      </>
    ),
  },
  inbox: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M2.6 13.4h5.6l1.4 2.6h4.8l1.4-2.6h5.6v5.6H2.6z" />
        <path d="M2.6 13.4 6 4.4h12l3.4 9v5.6H2.6z" />
        <path d="M2.6 13.4h5.6l1.4 2.6h4.8l1.4-2.6h5.6" />
      </>
    ),
  },
  export: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path d="M12 15.6V3.6M8 7.6 12 3.6l4 4" />
        <path {...F} d="M3.6 13.4h16.8v6.8H3.6z" />
        <path d="M3.6 13.4v6.8h16.8v-6.8" />
      </>
    ),
  },
  import: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path d="M12 3.6v12M8 11.6 12 15.6l4-4" />
        <path {...F} d="M3.6 13.4h16.8v6.8H3.6z" />
        <path d="M3.6 13.4v6.8h16.8v-6.8" />
      </>
    ),
  },
  folder: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M2.6 8.4h18.8v11H2.6z" />
        <path d="M2.6 19.4V5.6h6.4l2 2.8h10.4v11z" />
        <path d="M2.6 8.4h18.8" />
      </>
    ),
  },
  archive: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <rect x="2.6" y="4.4" width="18.8" height="5" rx="1.4" />
        <path {...F} d="M4.4 9.4h15.2v10.2H4.4z" />
        <path d="M4.4 9.4v10.2h15.2V9.4" />
        <path d="M9.6 13.4h4.8" />
      </>
    ),
  },
  link: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path d="M10 13.6a4 4 0 0 1 0-5.6l2.6-2.6a4 4 0 0 1 5.6 5.6l-1.4 1.4" />
        <path d="M14 10.4a4 4 0 0 1 0 5.6L11.4 18.6a4 4 0 0 1-5.6-5.6l1.4-1.4" />
      </>
    ),
  },
  network: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path d="M12 9.4V6.4M10.2 13.6 7 16.6M13.8 13.6 17 16.6" />
        <circle {...F} cx="12" cy="11.6" r="2.8" />
        <circle cx="12" cy="11.6" r="2.8" />
        <circle {...S} cx="12" cy="4.4" r="2" />
        <circle {...S} cx="5.4" cy="18.4" r="2" />
        <circle {...S} cx="18.6" cy="18.4" r="2" />
      </>
    ),
  },
  compass: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z" fill="currentColor" stroke="none" />
        <path d="M15.6 8.4 13.4 13.4 8.4 15.6 10.6 10.6z" />
      </>
    ),
  },
  map: {
    a: P.lime,
    b: P.limeDeep,
    d: (
      <>
        <path {...F} d="M2.6 6.4 8.8 4l6.4 2.4L21.4 4v13.6L15.2 20l-6.4-2.4L2.6 20z" />
        <path d="M2.6 6.4 8.8 4l6.4 2.4L21.4 4v13.6L15.2 20l-6.4-2.4L2.6 20z" />
        <path d="M8.8 4v13.6M15.2 6.4V20" />
      </>
    ),
  },
  pin: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M12 2.6a6.8 6.8 0 0 1 6.8 6.8c0 4.4-6.8 12-6.8 12S5.2 13.8 5.2 9.4A6.8 6.8 0 0 1 12 2.6z" />
        <path d="M12 2.6a6.8 6.8 0 0 1 6.8 6.8c0 4.4-6.8 12-6.8 12S5.2 13.8 5.2 9.4A6.8 6.8 0 0 1 12 2.6z" />
        <circle cx="12" cy="9.4" r="2.4" />
      </>
    ),
  },
  hex: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d={HEX} />
        <path d={HEX} />
      </>
    ),
  },

  /* ------------------------------------------------------------- interface */
  search: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle {...F} cx="10.4" cy="10.4" r="6.8" />
        <circle cx="10.4" cy="10.4" r="6.8" />
        <path d="M15.4 15.4 21 21" />
      </>
    ),
  },
  telescope: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path {...F} d="M3.4 12.4 16.8 6.6l2.6 5.4-13.4 5.8z" />
        <path d="M3.4 12.4 16.8 6.6l2.6 5.4-13.4 5.8z" />
        <path d="M11 15.2 13.4 21M8.4 16.4 6.6 21M19.4 12l2.2-1" />
      </>
    ),
  },
  research: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <circle {...F} cx="10.4" cy="10.4" r="6.8" />
        <circle cx="10.4" cy="10.4" r="6.8" />
        <ellipse cx="10.4" cy="10.4" rx="6.2" ry="2.5" transform="rotate(-30 10.4 10.4)" />
        <circle {...S} cx="10.4" cy="10.4" r="1.5" />
        <path d="M15.4 15.4 21 21" />
      </>
    ),
  },
  bulb: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 2.6a6.6 6.6 0 0 0-3.6 12.1c.6.4 1 1 1.1 1.7l.1 1.2h4.8l.1-1.2c.1-.7.5-1.3 1.1-1.7A6.6 6.6 0 0 0 12 2.6z"
        />
        <path d="M12 2.6a6.6 6.6 0 0 0-3.6 12.1c.6.4 1 1 1.1 1.7l.1 1.2h4.8l.1-1.2c.1-.7.5-1.3 1.1-1.7A6.6 6.6 0 0 0 12 2.6z" />
        <path d="M9.8 20.4h4.4" />
      </>
    ),
  },
  brain: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 4.2A3.4 3.4 0 0 0 5.6 5.8 3 3 0 0 0 4.2 8.4c0 1 .4 1.8 1 2.4a3.4 3.4 0 0 0-.2 1.2c0 1.5.9 2.7 2.2 3.3v1.2a2.6 2.6 0 0 0 4.8 1.4zM12 4.2a3.4 3.4 0 0 1 6.4 1.6 3 3 0 0 1 1.4 2.6c0 1-.4 1.8-1 2.4.1.4.2.8.2 1.2 0 1.5-.9 2.7-2.2 3.3v1.2a2.6 2.6 0 0 1-4.8 1.4z"
        />
        <path d="M12 4.2A3.4 3.4 0 0 0 5.6 5.8 3 3 0 0 0 4.2 8.4c0 1 .4 1.8 1 2.4a3.4 3.4 0 0 0-.2 1.2c0 1.5.9 2.7 2.2 3.3v1.2a2.6 2.6 0 0 0 4.8 1.4V4.2z" />
        <path d="M12 4.2a3.4 3.4 0 0 1 6.4 1.6 3 3 0 0 1 1.4 2.6c0 1-.4 1.8-1 2.4.1.4.2.8.2 1.2 0 1.5-.9 2.7-2.2 3.3v1.2a2.6 2.6 0 0 1-4.8 1.4" />
        <path d="M8.6 8.6c1 .5 1.6 1.4 1.6 2.6M15.4 8.6c-1 .5-1.6 1.4-1.6 2.6M9 15c.7-.5 1.5-.7 2.2-.5M15 15c-.7-.5-1.5-.7-2.2-.5" opacity=".7" />
      </>
    ),
  },
  clipboard: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M4.6 4.6h14.8v16.8H4.6z" />
        <path d="M9 4.6H6.2A1.6 1.6 0 0 0 4.6 6.2v13.6A1.6 1.6 0 0 0 6.2 21.4h11.6a1.6 1.6 0 0 0 1.6-1.6V6.2A1.6 1.6 0 0 0 17.8 4.6H15" />
        <rect x="9" y="2.6" width="6" height="4" rx="1.2" />
        <path d="M8.4 11.4h7.2M8.4 15h4.8" />
      </>
    ),
  },
  lock: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <path {...F} d="M4.4 10.6h15.2v10.6H4.4z" />
        <rect x="4.4" y="10.6" width="15.2" height="10.6" rx="2.2" />
        <path d="M8 10.6V7.8a4 4 0 0 1 8 0v2.8" />
        <circle {...S} cx="12" cy="15.8" r="1.6" />
      </>
    ),
  },
  unlock: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M4.4 10.6h15.2v10.6H4.4z" />
        <rect x="4.4" y="10.6" width="15.2" height="10.6" rx="2.2" />
        <path d="M8 10.6V7.8a4 4 0 0 1 7.7-1.5" />
        <circle {...S} cx="12" cy="15.8" r="1.6" />
      </>
    ),
  },
  refresh: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path d="M20.4 12a8.4 8.4 0 1 1-2.5-6" />
        <path d="M20.8 4.4v5.2h-5.2" />
      </>
    ),
  },
  hourglass: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M7 15.4c0-2 5-2.4 5-3.4 0 1 5 1.4 5 3.4v4.2H7z" />
        <path d="M6.4 3.4h11.2v3.2c0 2.6-5.6 3.4-5.6 5.4S17.6 15.4 17.6 18v2.6H6.4V18c0-2.6 5.6-4.6 5.6-6.6S6.4 9.2 6.4 6.6z" />
        <path d="M4.8 3.4h14.4M4.8 20.6h14.4" />
      </>
    ),
  },
  clock: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M12 6.6V12l4 2.6" />
      </>
    ),
  },
  calendar: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <rect x="3.4" y="5.4" width="17.2" height="15.2" rx="2" />
        <path {...F} d="M3.4 9.6h17.2v11H3.4z" />
        <path d="M3.4 9.6h17.2M8 3.4v4M16 3.4v4" />
        <path d="M7.4 13.4h3.2M13.4 13.4h3.2M7.4 17h3.2" />
      </>
    ),
  },
  chat: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M3.4 5.4h17.2v11H12l-5 4.4v-4.4H3.4z" />
        <path d="M3.4 5.4h17.2v11H12l-5 4.4v-4.4H3.4z" />
        <path d="M7.4 9.4h9.2M7.4 12.6h5.6" />
      </>
    ),
  },
  phone: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <rect x="6.4" y="2.6" width="11.2" height="18.8" rx="2.6" />
        <path {...F} d="M6.4 6.4h11.2v11.2H6.4z" />
        <path d="M10.4 4.6h3.2M10.4 19.4h3.2" />
      </>
    ),
  },
  cloud: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M7.4 18.4a4.4 4.4 0 0 1-.6-8.8 5.8 5.8 0 0 1 11.2 1.4 3.7 3.7 0 0 1-.6 7.4z" />
        <path d="M7.4 18.4a4.4 4.4 0 0 1-.6-8.8 5.8 5.8 0 0 1 11.2 1.4 3.7 3.7 0 0 1-.6 7.4z" />
      </>
    ),
  },
  pill: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M9.4 9.4 14.6 14.6 19.8 9.4a3.7 3.7 0 0 0-5.2-5.2z" />
        <rect x="2.2" y="8.3" width="19.6" height="7.4" rx="3.7" transform="rotate(-45 12 12)" />
        <path d="M9.4 9.4 14.6 14.6" />
      </>
    ),
  },
  syringe: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path {...F} d="M4.8 15.6 8.4 19.2 17.2 10.4 13.6 6.8z" />
        <path d="M4.8 15.6 8.4 19.2 17.2 10.4 13.6 6.8z" />
        <path d="M2.6 21.4 5.8 18.2M12.2 5.4 18.6 11.8M15.4 8.6 21.4 2.6" />
        <path d="M7.4 12.4 11 16" opacity=".7" />
      </>
    ),
  },
  handshake: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M12 8 16 12l-4 4-4-4z" />
        <path d="M12 8 16 12l-4 4-4-4z" />
        <path d="M8 12 4.2 8.2H1.6M16 12l3.8-3.8h2.6M8 12l-3.8 3.8H1.6M16 12l3.8 3.8h2.6" />
      </>
    ),
  },
  tag: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <path {...F} d="M11 2.6h10.4V13L12 22.4 1.6 12z" />
        <path d="M11 2.6h10.4V13L12 22.4 1.6 12z" />
        <circle {...S} cx="16.8" cy="7.2" r="1.6" />
      </>
    ),
  },
  ruler: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <rect x="1.6" y="8.4" width="20.8" height="7.2" rx="1.6" transform="rotate(-45 12 12)" />
        <path d="M8.8 6.6 11 8.8M6.2 9.2 8.4 11.4M11.4 4 13.6 6.2" />
      </>
    ),
  },
  numbers: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path d="M9 3.4 7.4 20.6M16.6 3.4 15 20.6" />
        <path d="M4.4 8.6h16M3.4 15.4h16" />
      </>
    ),
  },
  siren: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M6 16.4a6 6 0 0 1 12 0z" />
        <path d="M6 16.4a6 6 0 0 1 12 0z" />
        <path d="M3.4 19.4h17.2M12 6.4V3.4M5.6 8.6 3.4 6.4M18.4 8.6l2.2-2.2" />
      </>
    ),
  },
  bottle: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path {...F} d="M8 12h8v9.4H8z" />
        <path d="M10 2.6h4v3.4l2 3v11a1.4 1.4 0 0 1-1.4 1.4H9.4A1.4 1.4 0 0 1 8 20V9l2-3z" />
        <path d="M8 12h8" />
      </>
    ),
  },
  clamp: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path d="M6.4 2.6v6.8h11.2V2.6" />
        <path {...F} d="M7.6 9.4h8.8l1.4 5.2H6.2z" />
        <path d="M7.6 9.4h8.8l1.4 5.2H6.2z" />
        <path d="M12 14.6v6.8M8.4 21.4h7.2" />
      </>
    ),
  },
  news: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M3.4 5.4h13.2v14H3.4z" />
        <path d="M3.4 19.4V5.4h13.2v14a2 2 0 0 0 2-2V8.4h2v9a3 3 0 0 1-3 3z" />
        <path d="M6.4 9h7.2M6.4 12.4h7.2M6.4 15.8h4.4" />
      </>
    ),
  },
  gift: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <path {...F} d="M3.6 11h16.8v9.4H3.6z" />
        <path d="M3.6 11h16.8v9.4H3.6zM2.6 7.4h18.8V11H2.6z" />
        <path d="M12 7.4v13M12 7.4C10.4 4 8.6 3 7.2 3.8S6.6 7 9 7.4M12 7.4c1.6-3.4 3.4-4.4 4.8-3.6S17.4 7 15 7.4" />
      </>
    ),
  },
  crystalBall: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="10.4" r="7.4" />
        <circle cx="12" cy="10.4" r="7.4" />
        <path d="M9 8.4a4 4 0 0 1 3.4-2.6" />
        <path d="M6.4 17.8h11.2l1.4 3.6H5z" />
      </>
    ),
  },
  quest: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M5.4 3.4h13.2v17.2l-6.6-3.6-6.6 3.6z" />
        <path d="M5.4 3.4h13.2v17.2l-6.6-3.6-6.6 3.6z" />
        <path d="M9 8h6M9 11.6h6" />
      </>
    ),
  },
  infinity: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path d="M8.4 8.2c2 0 2.6 1.4 3.6 3.8s1.6 3.8 3.6 3.8a3.8 3.8 0 0 0 0-7.6c-2 0-2.6 1.4-3.6 3.8s-1.6 3.8-3.6 3.8a3.8 3.8 0 0 1 0-7.6z" />
      </>
    ),
  },

  crypto: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M9 7.4h4a2.6 2.6 0 0 1 0 5.2H9zM9 12.6h4.4a2.7 2.7 0 0 1 0 5.4H9V7.4" />
        <path d="M11 5.4v2M14 5.4v2M11 18v2.2M14 18v2.2" />
      </>
    ),
  },
  omega: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path d="M5.4 20.6h4.2A7.6 7.6 0 1 1 14.4 20.6h4.2" />
      </>
    ),
  },
  hundred: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path d="M4.6 7.4 6.6 6v10.4" />
        <ellipse cx="12.6" cy="11.2" rx="3" ry="5.2" />
        <ellipse cx="20" cy="11.2" rx="3" ry="5.2" />
        <path d="M3.4 20.4h17.2" />
      </>
    ),
  },
  moneyFly: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M7.4 6.4h14v9.2h-14z" />
        <rect x="7.4" y="6.4" width="14" height="9.2" rx="1.6" />
        <circle cx="14.4" cy="11" r="2.2" />
        <path d="M2.6 8.4h3.2M1.6 12h4.2M2.6 15.6h3.2M4.6 19.4h6" />
      </>
    ),
  },

  /* ---------------------------------------------------------------- status */
  check: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M7.6 12.4 10.8 15.6 16.4 9" />
      </>
    ),
  },
  cross: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M8.6 8.6 15.4 15.4M15.4 8.6 8.6 15.4" />
      </>
    ),
  },
  warning: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M12 2.8 22 20.4H2z" />
        <path d="M13.4 3.6a1.6 1.6 0 0 0-2.8 0L2.2 18.8a1.6 1.6 0 0 0 1.4 2.4h16.8a1.6 1.6 0 0 0 1.4-2.4z" />
        <path d="M12 9v4.6" />
        <circle {...L} cx="12" cy="17.2" r="1.1" />
      </>
    ),
  },
  ban: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M5.5 5.5 18.5 18.5" />
      </>
    ),
  },
  question: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M9.4 9a2.7 2.7 0 0 1 5.2 1c0 1.8-2.6 2.2-2.6 4" />
        <circle {...L} cx="12" cy="17.2" r="1.1" />
      </>
    ),
  },
  node: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...S} d={HEX} />
        <path d={HEX} />
      </>
    ),
  },
  pause: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M10 8.6v6.8M14 8.6v6.8" />
      </>
    ),
  },
  play: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M10 8.4 16 12l-6 3.6z" />
      </>
    ),
  },
  fastForward: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M2.6 6 11 12l-8.4 6zM12.6 6 21 12l-8.4 6z" />
        <path d="M2.6 6 11 12l-8.4 6zM12.6 6 21 12l-8.4 6z" />
      </>
    ),
  },
  stop: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M8.4 2.8h7.2L21.2 8.4v7.2L15.6 21.2H8.4L2.8 15.6V8.4z" />
        <path d="M8.4 2.8h7.2L21.2 8.4v7.2L15.6 21.2H8.4L2.8 15.6V8.4z" />
        <path d="M9 9h6v6H9z" />
      </>
    ),
  },
  arrowUp: {
    a: P.mint,
    b: P.mintDeep,
    d: <path d="M12 20V4.6M5.8 10.8 12 4.6l6.2 6.2" />,
  },
  arrowDown: {
    a: P.rose,
    b: P.roseDeep,
    d: <path d="M12 4v15.4M5.8 13.2 12 19.4l6.2-6.2" />,
  },
  arrowRight: {
    a: P.azure,
    b: P.azureDeep,
    d: <path d="M4 12h15.4M13.2 5.8 19.4 12l-6.2 6.2" />,
  },
  arrowLeft: {
    a: P.azure,
    b: P.azureDeep,
    d: <path d="M20 12H4.6M10.8 5.8 4.6 12l6.2 6.2" />,
  },
  plus: {
    a: P.mint,
    b: P.mintDeep,
    d: <path d="M12 4.6v14.8M4.6 12h14.8" />,
  },
  triangleUp: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M12 5 20.4 19H3.6z" />
        <path d="M12 5 20.4 19H3.6z" />
      </>
    ),
  },
  triangleDown: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M12 19 3.6 5h16.8z" />
        <path d="M12 19 3.6 5h16.8z" />
      </>
    ),
  },
  faceHappy: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M8 14.4c2.4 2.2 5.6 2.2 8 0" />
        <circle {...L} cx="9.2" cy="9.8" r="1.1" />
        <circle {...L} cx="14.8" cy="9.8" r="1.1" />
      </>
    ),
  },
  faceNeutral: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M8.4 15h7.2" />
        <circle {...L} cx="9.2" cy="9.8" r="1.1" />
        <circle {...L} cx="14.8" cy="9.8" r="1.1" />
      </>
    ),
  },
  faceSad: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M8 16.4c2.4-2.2 5.6-2.2 8 0" />
        <circle {...L} cx="9.2" cy="9.8" r="1.1" />
        <circle {...L} cx="14.8" cy="9.8" r="1.1" />
      </>
    ),
  },
  sleep: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <path d="M4.4 4.4h6L4.4 11h6" />
        <path d="M13.6 13h6l-6 6.6h6" />
      </>
    ),
  },
};
