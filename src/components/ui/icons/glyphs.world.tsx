import { F, S, HEX, P, type GlyphDef } from './svgKit';

/* Space, structures, nature, creatures and culture. */
export const WORLD_GLYPHS: Record<string, GlyphDef> = {
  /* ----------------------------------------------------------------- space */
  rocket: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 1.8c2.9 2.7 4.4 6.1 4.4 10.2l-1.3 4.4H8.9l-1.3-4.4C7.6 7.9 9.1 4.5 12 1.8z"
        />
        <path d="M12 1.8c2.9 2.7 4.4 6.1 4.4 10.2l-1.3 4.4H8.9l-1.3-4.4C7.6 7.9 9.1 4.5 12 1.8z" />
        <circle cx="12" cy="9" r="2" />
        <path d="M7.8 12.6 4.6 15.4l.6 3.6 3.1-2.2M16.2 12.6l3.2 2.8-.6 3.6-3.1-2.2" />
        <path d="M10.4 19.4 12 22.2l1.6-2.8" />
      </>
    ),
  },
  jetEngine: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M4.5 8.4h11.8l3.7 3.6-3.7 3.6H4.5z" />
        <path d="M4.5 8.4h11.8l3.7 3.6-3.7 3.6H4.5z" />
        <path d="M7.4 8.4v7.2M10.3 8.4v7.2M13.2 8.4v7.2" />
        <path d="M2 5.6h4M2 18.4h4" />
      </>
    ),
  },
  satellite: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path {...F} d="M9.4 9.4h5.2v5.2H9.4z" />
        <rect x="9.4" y="9.4" width="5.2" height="5.2" rx="1.2" />
        <path {...F} d="M2.6 9.8h6.8v4.4H2.6zM14.6 9.8h6.8v4.4h-6.8z" />
        <path d="M2.6 9.8h6.8v4.4H2.6zM14.6 9.8h6.8v4.4h-6.8z" />
        <path d="M6 9.8v4.4M18 9.8v4.4" />
        <path d="M12 9.4V5.2M10.2 4h3.6M12 14.6v4.2" />
      </>
    ),
  },
  ufo: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path {...F} d="M2.6 12.6c0-1.9 4.2-3.4 9.4-3.4s9.4 1.5 9.4 3.4-4.2 3.4-9.4 3.4-9.4-1.5-9.4-3.4z" />
        <path d="M2.6 12.6c0-1.9 4.2-3.4 9.4-3.4s9.4 1.5 9.4 3.4-4.2 3.4-9.4 3.4-9.4-1.5-9.4-3.4z" />
        <path d="M7.6 10.4a4.8 4.8 0 0 1 8.8 0" />
        <path d="M7 17.6 5.4 20.4M12 18v2.8M17 17.6l1.6 2.8" />
      </>
    ),
  },
  galaxy: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <ellipse {...F} cx="12" cy="12" rx="9.4" ry="5.4" transform="rotate(-24 12 12)" />
        <ellipse cx="12" cy="12" rx="9.4" ry="5.4" transform="rotate(-24 12 12)" />
        <path d="M12 12c2.4-2.6 5.2-3.2 8.2-1.8M12 12c-2.4 2.6-5.2 3.2-8.2 1.8" />
        <circle {...S} cx="12" cy="12" r="1.9" />
      </>
    ),
  },
  planet: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <ellipse cx="12" cy="12.6" rx="10.6" ry="3.4" transform="rotate(-20 12 12.6)" />
        <circle {...F} cx="12" cy="11" r="6.4" />
        <circle cx="12" cy="11" r="6.4" />
        <path d="M6.4 8.4c3.2-1.2 6.6-1 9.6.6M7.2 14.6c2.8 1.2 6 1.2 8.8-.2" opacity=".75" />
      </>
    ),
  },
  comet: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <circle {...F} cx="16.8" cy="7.2" r="4.2" />
        <circle cx="16.8" cy="7.2" r="4.2" />
        <path d="M13.8 10.2 3.2 20.8M11.6 9 4.4 16.2M15.4 12.4 8.2 19.6" />
      </>
    ),
  },
  vortex: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path d="M12 4.2c4.3 0 7.8 3.5 7.8 7.8s-3.5 7.8-7.8 7.8c-3.4 0-6.2-2.8-6.2-6.2s2.8-6.2 6.2-6.2c2.6 0 4.6 2 4.6 4.6s-2 4.6-4.6 4.6c-1.7 0-3-1.3-3-3s1.3-3 3-3" />
        <circle {...S} cx="12" cy="12" r="1.2" />
      </>
    ),
  },
  blackhole: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <ellipse cx="12" cy="12" rx="9.6" ry="3.8" />
        <circle fill="currentColor" stroke="none" cx="12" cy="12" r="4.4" opacity=".92" />
        <circle cx="12" cy="12" r="4.4" />
        <path d="M12 3.2v4.2M12 16.6v4.2" />
        <ellipse cx="12" cy="12" rx="6.6" ry="2.4" opacity=".55" />
      </>
    ),
  },
  starburst: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M12 1.8 14.4 9l7.8.4-6 4.8 2.1 7.2L12 17.4l-6.3 4 2.1-7.2-6-4.8L9.6 9z" />
        <path d="M12 1.8 14.4 9l7.8.4-6 4.8 2.1 7.2L12 17.4l-6.3 4 2.1-7.2-6-4.8L9.6 9z" />
      </>
    ),
  },
  sparkle: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M10 2.4 11.7 8l5.6 1.7-5.6 1.7L10 17l-1.7-5.6L2.7 9.7 8.3 8z" />
        <path d="M10 2.4 11.7 8l5.6 1.7-5.6 1.7L10 17l-1.7-5.6L2.7 9.7 8.3 8z" />
        <path d="M17.6 14.2l.8 2.6 2.6.8-2.6.8-.8 2.6-.8-2.6-2.6-.8 2.6-.8z" />
      </>
    ),
  },
  moon: {
    a: P.ink,
    b: P.inkDeep,
    d: (
      <>
        <path {...F} d="M12 2.6a9.4 9.4 0 1 0 9.4 9.4A9.4 9.4 0 0 1 12 2.6z" />
        <path d="M20.4 14.6A9.4 9.4 0 1 1 9.4 3.6a7.6 7.6 0 0 0 11 11z" />
      </>
    ),
  },
  globe: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M2.8 12h18.4" />
        <ellipse cx="12" cy="12" rx="4.4" ry="9.2" />
      </>
    ),
  },

  /* ------------------------------------------------------------ structures */
  home: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M12 2.8 21 9.6v11.6H3V9.6z" />
        <path d="M12 2.8 21 9.6v11.6H3V9.6z" />
        <path d="M9.4 21.2v-6.6h5.2v6.6" />
      </>
    ),
  },
  tower: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M8.6 8.4h6.8l1.8 12.8H6.8z" />
        <path d="M12 2.4 15.4 8.4h-6.8z" />
        <path d="M8.6 8.4h6.8l1.8 12.8H6.8z" />
        <path d="M7.8 14.4h8.4M5.4 21.2h13.2" />
      </>
    ),
  },
  city: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M3.4 21.2V9.4h6v11.8zM13 21.2V4.4h7.6v16.8z" />
        <path d="M3.4 21.2V9.4h6v11.8M13 21.2V4.4h7.6v16.8" />
        <path d="M9.4 21.2H13M5.8 12.4h1.4M5.8 16.2h1.4M15.6 8h2.4M15.6 12h2.4M15.6 16h2.4" />
        <path d="M2 21.2h20" />
      </>
    ),
  },
  crane: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path d="M4.4 21.2V4.4h13.2" />
        <path {...F} d="M6.6 21.2V13h7v8.2z" />
        <path d="M6.6 21.2V13h7v8.2z" />
        <path d="M2.4 21.2h19.2M17.6 4.4v5.2M15.4 9.6h4.4M4.4 8l5.6-3.6" />
      </>
    ),
  },
  temple: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M4.6 9.6h14.8v9.4H4.6z" />
        <path d="M12 2.6 21.4 7.4H2.6z" />
        <path d="M4.6 7.4v11.6M19.4 7.4v11.6M9.2 9.6v9.4M14.8 9.6v9.4M2.4 21.2h19.2M2.8 19h18.4" />
      </>
    ),
  },
  castle: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M4 8.6h16v12.6H4z" />
        <path d="M4 21.2V6.6l2.4 2V6.6l2.6 2V6.6l3 2 3-2v2.2l2.6-2v2l2.4-2v14.6z" />
        <path d="M10.2 21.2v-5.4h3.6v5.4" />
      </>
    ),
  },
  station: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="4.4" />
        <circle cx="12" cy="12" r="4.4" />
        <ellipse cx="12" cy="12" rx="9.6" ry="3.4" transform="rotate(-30 12 12)" />
        <path d="M12 7.6V3.2M12 16.4v4.4" />
      </>
    ),
  },
  megastructure: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path {...F} d={HEX} />
        <path d={HEX} />
        <path d="M12 2.7v18.6M4 7.15l16 9.7M20 7.15l-16 9.7" />
        <circle {...S} cx="12" cy="12" r="1.8" />
      </>
    ),
  },
  platform: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M2.6 9.6 12 5.2l9.4 4.4L12 14z" />
        <path d="M2.6 9.6 12 5.2l9.4 4.4L12 14z" />
        <path d="M5.6 11v6.4M18.4 11v6.4M12 14v6.8" />
        <path d="M5.6 17.4h12.8" />
      </>
    ),
  },
  market: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M3.6 9.4h16.8v11.8H3.6z" />
        <path d="M2.6 9.4 4.8 4h14.4l2.2 5.4z" />
        <path d="M3.6 9.4v11.8h16.8V9.4" />
        <path d="M8.4 21.2v-6.4h7.2v6.4" />
      </>
    ),
  },
  bank: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M5 10h14v8.4H5z" />
        <path d="M2.4 8.6 12 3.4l9.6 5.2z" />
        <path d="M5 10v8.4M9.6 10v8.4M14.4 10v8.4M19 10v8.4M2.6 21.2h18.8" />
      </>
    ),
  },
  volcano: {
    a: P.amber,
    b: P.amberDeep,
    d: (
      <>
        <path {...F} d="M2.6 20.4 9 10.4h6l6.4 10z" />
        <path d="M2.6 20.4 9 10.4h6l6.4 10z" />
        <path d="M9.6 10.4 12 2.6l2.4 7.8" opacity=".8" />
        <path d="M8.4 16.4c1.6-1.2 3.2 1.2 4.8 0s2.4.8 3.2 1.2" />
      </>
    ),
  },
  desert: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M2.4 19.6c3-3.4 5.4-3.4 8.4-.8 3-3.6 7-4.4 10.8-1.4v2.2z" />
        <path d="M2.4 19.6c3-3.4 5.4-3.4 8.4-.8 3-3.6 7-4.4 10.8-1.4" />
        <circle cx="7.4" cy="6.6" r="3" />
        <path d="M2.6 21.4h18.8" />
      </>
    ),
  },
  ferris: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="10" r="7.4" />
        <circle cx="12" cy="10" r="7.4" />
        <path d="M12 2.6v14.8M4.6 10h14.8M6.8 4.8l10.4 10.4M17.2 4.8 6.8 15.2" />
        <path d="M9.6 21.4 12 15.4l2.4 6" />
      </>
    ),
  },
  tent: {
    a: P.lime,
    b: P.limeDeep,
    d: (
      <>
        <path {...F} d="M3.4 19.4 12 5.2l8.6 14.2z" />
        <path d="M12 5.2 3.4 19.4h17.2z" />
        <path d="M12 8.6v10.8M9.2 19.4 12 12.4l2.8 7" />
        <path d="M2 21.4h20" />
      </>
    ),
  },
  stadium: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <ellipse {...F} cx="12" cy="12" rx="9.6" ry="6.4" />
        <ellipse cx="12" cy="12" rx="9.6" ry="6.4" />
        <ellipse cx="12" cy="12" rx="5" ry="3.2" />
        <path d="M2.4 12v3.4a9.6 6.4 0 0 0 19.2 0V12" />
      </>
    ),
  },
  statue: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M8 8.4c0-2.4 1.8-4.2 4-4.2s4 1.8 4 4.2-1.2 3.6-1.2 5.6l.6 4H8.6l.6-4C9.2 12 8 10.8 8 8.4z" />
        <path d="M8 8.4c0-2.4 1.8-4.2 4-4.2s4 1.8 4 4.2-1.2 3.6-1.2 5.6l.6 4H8.6l.6-4C9.2 12 8 10.8 8 8.4z" />
        <path d="M5.6 21.2h12.8M7.6 18h8.8" />
      </>
    ),
  },

  /* ------------------------------------------------------------- creatures */
  robot: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path {...F} d="M4.6 8.4h14.8v9.8H4.6z" />
        <rect x="4.6" y="8.4" width="14.8" height="9.8" rx="3" />
        <circle {...S} cx="9.2" cy="12.6" r="1.4" />
        <circle {...S} cx="14.8" cy="12.6" r="1.4" />
        <path d="M9.6 15.8h4.8M12 4.6v3.8" />
        <circle cx="12" cy="3.4" r="1.3" />
        <path d="M2.6 11.4v3.8M21.4 11.4v3.8" />
      </>
    ),
  },
  bug: {
    a: P.lime,
    b: P.limeDeep,
    d: (
      <>
        <path {...F} d="M7 9.4h10v5.2a5 5 0 0 1-10 0z" />
        <path d="M7 10.4a5 5 0 0 1 10 0v4.2a5 5 0 0 1-10 0z" />
        <path d="M9 6.6 7.4 4M15 6.6 16.6 4M7 11.6H3.4M17 11.6h3.6M7.4 15.6l-3 1.8M16.6 15.6l3 1.8" />
      </>
    ),
  },
  swarm: {
    a: P.lime,
    b: P.limeDeep,
    d: (
      <>
        <circle {...F} cx="8" cy="8.4" r="3.4" />
        <circle cx="8" cy="8.4" r="3.4" />
        <circle cx="16.4" cy="10.4" r="2.8" />
        <circle cx="11" cy="16.6" r="3" />
        <path d="M10.8 9.6l3 .4M9.4 11.4l.6 2.4M14.4 12.8l-1.6 2" opacity=".7" />
      </>
    ),
  },
  skull: {
    a: P.steel,
    b: P.steelDeep,
    d: (
      <>
        <path {...F} d="M4.4 10.6a7.6 7.6 0 0 1 15.2 0c0 2.9-1.4 4.6-2.8 5.6v2.4H7.2v-2.4c-1.4-1-2.8-2.7-2.8-5.6z" />
        <path d="M4.4 10.6a7.6 7.6 0 0 1 15.2 0c0 2.9-1.4 4.6-2.8 5.6v2.4H7.2v-2.4c-1.4-1-2.8-2.7-2.8-5.6z" />
        <circle fill="currentColor" stroke="none" cx="9.2" cy="11" r="1.8" />
        <circle fill="currentColor" stroke="none" cx="14.8" cy="11" r="1.8" />
        <path d="M9.8 18.6v2.6M14.2 18.6v2.6M12 18.6v2.6" />
      </>
    ),
  },
  demon: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path {...F} d="M6 11.4a6 6 0 0 1 12 0v2.2a6 6 0 0 1-12 0z" />
        <path d="M6 12a6 6 0 0 1 12 0v1.6a6 6 0 0 1-12 0z" />
        <path d="M6.4 8.6 4 3.6l4.4 3.2M17.6 8.6 20 3.6l-4.4 3.2" />
        <path d="M9.4 11.8h1.2M13.4 11.8h1.2M9.6 16.6c1.6 1 3.2 1 4.8 0" />
      </>
    ),
  },
  eye: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path {...F} d="M1.8 12S5.6 5.8 12 5.8 22.2 12 22.2 12 18.4 18.2 12 18.2 1.8 12 1.8 12z" />
        <path d="M1.8 12S5.6 5.8 12 5.8 22.2 12 22.2 12 18.4 18.2 12 18.2 1.8 12 1.8 12z" />
        <circle cx="12" cy="12" r="3.2" />
        <circle fill="currentColor" stroke="none" cx="12" cy="12" r="1.3" />
      </>
    ),
  },
  crown: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M3 7.6 7.4 12 12 4.6l4.6 7.4L21 7.6l-1.8 10.8H4.8z" />
        <path d="M3 7.6 7.4 12 12 4.6l4.6 7.4L21 7.6l-1.8 10.8H4.8z" />
        <path d="M5.4 21.4h13.2" />
      </>
    ),
  },
  person: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="7.6" r="4" />
        <circle cx="12" cy="7.6" r="4" />
        <path d="M4.4 20.8a7.6 7.6 0 0 1 15.2 0" />
      </>
    ),
  },
  virus: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="5.6" />
        <circle cx="12" cy="12" r="5.6" />
        <path d="M12 6.4V2.6M12 17.6v3.8M6.4 12H2.6M17.6 12h3.8M8 8l-2.6-2.6M16 16l2.6 2.6M16 8l2.6-2.6M8 16l-2.6 2.6" />
        <circle {...S} cx="10.4" cy="10.8" r=".9" />
        <circle {...S} cx="13.6" cy="13.4" r=".9" />
      </>
    ),
  },

  /* --------------------------------------------------------------- culture */
  palette: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 2.8a9.2 9.2 0 0 0 0 18.4c1.4 0 2-.9 2-1.9s-.7-1.7-.7-2.6c0-1 .8-1.7 1.8-1.7h1.7a5.2 5.2 0 0 0 5.4-5.2c0-3.9-4.6-7-10.2-7z"
        />
        <path d="M12 2.8a9.2 9.2 0 0 0 0 18.4c1.4 0 2-.9 2-1.9s-.7-1.7-.7-2.6c0-1 .8-1.7 1.8-1.7h1.7a5.2 5.2 0 0 0 5.4-5.2c0-3.9-4.6-7-10.2-7z" />
        <circle fill="currentColor" stroke="none" cx="7.6" cy="9" r="1.3" />
        <circle fill="currentColor" stroke="none" cx="12" cy="7" r="1.3" />
        <circle fill="currentColor" stroke="none" cx="6.4" cy="14" r="1.3" />
      </>
    ),
  },
  mask: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path {...F} d="M3.4 7.4h17.2v4.4a8.6 8.6 0 0 1-17.2 0z" />
        <path d="M3.4 7.4h17.2v4.4a8.6 8.6 0 0 1-17.2 0z" />
        <path d="M7.4 11.4c.8-1 1.8-1 2.6 0M14 11.4c.8-1 1.8-1 2.6 0" />
        <path d="M9.6 16.4c1.6 1.2 3.2 1.2 4.8 0" />
      </>
    ),
  },
  music: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <circle {...F} cx="7" cy="17.4" r="3" />
        <circle cx="7" cy="17.4" r="3" />
        <circle {...F} cx="17.4" cy="15" r="3" />
        <circle cx="17.4" cy="15" r="3" />
        <path d="M10 17.4V6.4l10.4-2.8V15" />
        <path d="M10 10 20.4 7.2" />
      </>
    ),
  },
  film: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <rect x="2.6" y="5.4" width="18.8" height="13.2" rx="2" />
        <path {...F} d="M7.4 5.4h9.2v13.2H7.4z" />
        <path d="M7.4 5.4v13.2M16.6 5.4v13.2" />
        <path d="M4.6 8.6h1.2M4.6 12h1.2M4.6 15.4h1.2M18.2 8.6h1.2M18.2 12h1.2M18.2 15.4h1.2" />
      </>
    ),
  },
  gamepad: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <path
          {...F}
          d="M7.4 7.6h9.2a5.4 5.4 0 0 1 5 7.4l-.8 2a2.6 2.6 0 0 1-4.4.8L14.6 15.4H9.4L7.6 17.8a2.6 2.6 0 0 1-4.4-.8l-.8-2a5.4 5.4 0 0 1 5-7.4z"
        />
        <path d="M7.4 7.6h9.2a5.4 5.4 0 0 1 5 7.4l-.8 2a2.6 2.6 0 0 1-4.4.8L14.6 15.4H9.4L7.6 17.8a2.6 2.6 0 0 1-4.4-.8l-.8-2a5.4 5.4 0 0 1 5-7.4z" />
        <path d="M7.6 11.6h2.4M8.8 10.4v2.4" />
        <circle {...S} cx="15.4" cy="11.6" r="1.1" />
      </>
    ),
  },
  book: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M12 6.4v13.4c-2-1.4-4.6-2-8.2-1.8V4.6c3.6-.2 6.2.4 8.2 1.8z" />
        <path d="M12 6.4c2-1.4 4.6-2 8.2-1.8V18c-3.6-.2-6.2.4-8.2 1.8-2-1.4-4.6-2-8.2-1.8V4.6c3.6-.2 6.2.4 8.2 1.8z" />
        <path d="M12 6.4v13.4" />
      </>
    ),
  },
  scroll: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M6 4.6h12v14.8H6z" />
        <path d="M6 4.6h12v14.8H6z" />
        <path d="M8.8 8.4h6.4M8.8 12h6.4M8.8 15.6h4" />
        <path d="M4.4 4.6h3.2M4.4 19.4h3.2" />
      </>
    ),
  },
  glasses: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <circle {...F} cx="6.6" cy="13.4" r="3.8" />
        <circle cx="6.6" cy="13.4" r="3.8" />
        <circle {...F} cx="17.4" cy="13.4" r="3.8" />
        <circle cx="17.4" cy="13.4" r="3.8" />
        <path d="M10.4 13.4h3.2M2.8 13.4 4.6 8h3.2M21.2 13.4 19.4 8h-3.2" />
      </>
    ),
  },
  vr: {
    a: P.violet,
    b: P.violetDeep,
    d: (
      <>
        <path {...F} d="M3 8.6h18v6.8a1.6 1.6 0 0 1-1.6 1.6h-3.2L12 14.4l-4.2 2.6H4.6A1.6 1.6 0 0 1 3 15.4z" />
        <path d="M3 8.6h18v6.8a1.6 1.6 0 0 1-1.6 1.6h-3.2L12 14.4l-4.2 2.6H4.6A1.6 1.6 0 0 1 3 15.4z" />
        <path d="M5.4 8.6 6.6 6h10.8l1.2 2.6" />
      </>
    ),
  },
  garment: {
    a: P.magenta,
    b: P.magentaDeep,
    d: (
      <>
        <path {...F} d="M9.4 3.4h5.2l-1 4.2 4 13.6H6.4l4-13.6z" />
        <path d="M9.4 3.4h5.2l-1 4.2 4 13.6H6.4l4-13.6z" />
        <path d="M12 3.4v4.2" />
      </>
    ),
  },
  gem: {
    a: P.cyan,
    b: P.cyanDeep,
    d: (
      <>
        <path {...F} d="M12 21.4 2.8 9.4 6.4 3.6h11.2L21.2 9.4z" />
        <path d="M12 21.4 2.8 9.4 6.4 3.6h11.2L21.2 9.4z" />
        <path d="M2.8 9.4h18.4M8.6 9.4 12 3.6l3.4 5.8M8.6 9.4 12 21.4l3.4-12" />
      </>
    ),
  },
  trophy: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M7.4 3.4h9.2v6.2a4.6 4.6 0 0 1-9.2 0z" />
        <path d="M7.4 3.4h9.2v6.2a4.6 4.6 0 0 1-9.2 0z" />
        <path d="M7.4 5.4H4.6v1.8a3.4 3.4 0 0 0 3 3.4M16.6 5.4h2.8v1.8a3.4 3.4 0 0 1-3 3.4" />
        <path d="M12 14.2v3.6M8 21.2h8l-.8-3.4H8.8z" />
      </>
    ),
  },
  medal: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="15.4" r="5.8" />
        <circle cx="12" cy="15.4" r="5.8" />
        <circle {...S} cx="12" cy="15.4" r="2" />
        <path d="M8.6 10.4 6 3.4M15.4 10.4 18 3.4" />
      </>
    ),
  },
  graduate: {
    a: P.azure,
    b: P.azureDeep,
    d: (
      <>
        <path {...F} d="M1.8 8.6 12 4l10.2 4.6L12 13.2z" />
        <path d="M1.8 8.6 12 4l10.2 4.6L12 13.2z" />
        <path d="M6 10.6v5c0 1.8 2.7 3.2 6 3.2s6-1.4 6-3.2v-5" />
        <path d="M22.2 8.6v6" />
      </>
    ),
  },
  heart: {
    a: P.rose,
    b: P.roseDeep,
    d: (
      <>
        <path
          {...F}
          d="M12 20.6 4.6 13.2a4.9 4.9 0 0 1 7.4-6.4 4.9 4.9 0 0 1 7.4 6.4z"
        />
        <path d="M12 20.6 4.6 13.2a4.9 4.9 0 0 1 7.4-6.4 4.9 4.9 0 0 1 7.4 6.4z" />
      </>
    ),
  },
  peace: {
    a: P.mint,
    b: P.mintDeep,
    d: (
      <>
        <circle {...F} cx="12" cy="12" r="9.2" />
        <circle cx="12" cy="12" r="9.2" />
        <path d="M12 2.8v18.4M12 12 5.4 18.6M12 12l6.6 6.6" />
      </>
    ),
  },
  clover: {
    a: P.lime,
    b: P.limeDeep,
    d: (
      <>
        <g {...F}>
          <circle cx="8.4" cy="8.4" r="3.2" />
          <circle cx="14.4" cy="8.4" r="3.2" />
          <circle cx="8.4" cy="14" r="3.2" />
          <circle cx="14.4" cy="14" r="3.2" />
        </g>
        <circle cx="8.4" cy="8.4" r="3.2" />
        <circle cx="14.4" cy="8.4" r="3.2" />
        <circle cx="8.4" cy="14" r="3.2" />
        <circle cx="14.4" cy="14" r="3.2" />
        <path d="M11.4 15.4c-.4 3 .4 5 2.4 6" />
      </>
    ),
  },
  fleur: {
    a: P.gold,
    b: P.goldDeep,
    d: (
      <>
        <path {...F} d="M12 2.6c2 2.4 3.2 4.6 3.2 6.6 0 2.6-3.2 3.2-3.2 5.6 0-2.4-3.2-3-3.2-5.6 0-2 1.2-4.2 3.2-6.6z" />
        <path d="M12 2.6c2 2.4 3.2 4.6 3.2 6.6 0 2.6-3.2 3.2-3.2 5.6 0-2.4-3.2-3-3.2-5.6 0-2 1.2-4.2 3.2-6.6z" />
        <path d="M12 14.8c-2.2-2.6-6-3.4-6 .4 0 2 1.6 3.2 3.4 3.2M12 14.8c2.2-2.6 6-3.4 6 .4 0 2-1.6 3.2-3.4 3.2" />
        <path d="M7.4 21h9.2" />
      </>
    ),
  },
};
