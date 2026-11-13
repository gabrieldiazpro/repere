// Icônes de l'app (traits 1,8 px, 24×24, décoratives : toujours accompagnées d'un libellé).
const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const;

export type IconName =
  | 'home'
  | 'quote'
  | 'shield'
  | 'link'
  | 'podium'
  | 'check'
  | 'trend'
  | 'spark'
  | 'file'
  | 'gear'
  | 'more'
  | 'copy'
  | 'chevron'
  | 'arrowUp'
  | 'arrowDown'
  | 'alert'
  | 'send'
  | 'external'
  | 'plus'
  | 'download'
  | 'lock'
  | 'bell'
  | 'search'
  | 'sun'
  | 'moon'
  | 'monitor'
  | 'users'
  | 'card'
  | 'plug'
  | 'share'
  | 'database'
  | 'close'
  | 'info'
  | 'map'
  | 'box'
  | 'store'
  | 'compass'
  | 'list'
  | 'bolt'
  | 'eye'
  | 'flag'
  | 'globe'
  | 'star';

const PATHS: Record<IconName, React.ReactNode> = {
  home: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6 9.5V20h4.5v-5.5h3V20H18V9.5" /></>,
  quote: <><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  shield: <><path d="M12 3.5 19 6v5.5c0 4.2-3 7.6-7 9-4-1.4-7-4.8-7-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  podium: <><path d="M4 20v-6h5v6M9 20V9h6v11M15 20v-8h5v8" /><path d="M3 20h18" /></>,
  check: <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  trend: <><path d="M4 18 9.5 12l3.5 3.5L20 8" /><path d="M15 8h5v5" /></>,
  spark: <><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4" /><path d="m12 8.5 1.2 2.3 2.3 1.2-2.3 1.2L12 15.5l-1.2-2.3L8.5 12l2.3-1.2z" /></>,
  file: <><path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10.5A.5.5 0 0 1 6.5 20V4a.5.5 0 0 1 .5-.5z" /><path d="M14 3.5V8h4M9.5 12.5h5M9.5 16h5" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 0 0-2-1.2L14.2 3h-4.4l-.4 2.6a7 7 0 0 0-2 1.2l-2.3-.9-2 3.4 2 1.5a7 7 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-.9a7 7 0 0 0 2 1.2l.4 2.6h4.4l.4-2.6a7 7 0 0 0 2-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z" /></>,
  more: <><circle cx="5.5" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18.5" cy="12" r="1.3" /></>,
  copy: <><rect x="8.5" y="8.5" width="11" height="11" rx="2" /><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" /></>,
  chevron: <path d="m9.5 6 6 6-6 6" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  alert: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  send: <><path d="M4.5 12 20 4.5 15.5 20l-3-6.5z" /><path d="m12.5 13.5 3-3" /></>,
  external: <><path d="M14 4.5h5.5V10M19.5 4.5 11 13" /><path d="M18 14v5a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V7.5a1 1 0 0 1 1-1H10" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  download: <><path d="M12 4v11M7 10.5l5 5 5-5" /><path d="M4.5 19.5h15" /></>,
  lock: <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /><path d="M12 14.5v2" /></>,
  bell: <><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  search: <><circle cx="11" cy="11" r="6" /><path d="m15.5 15.5 4 4" /></>,
  sun: <><circle cx="12" cy="12" r="3.8" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
  moon: <path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z" />,
  monitor: <><rect x="3.5" y="4.5" width="17" height="11.5" rx="2" /><path d="M9 20h6M12 16v4" /></>,
  users: <><circle cx="9" cy="9" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><path d="M15.5 6.2a3 3 0 0 1 0 5.6M17.5 14.5a5 5 0 0 1 3 5" /></>,
  card: <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="M3.5 10h17M7 15h3" /></>,
  plug: <><path d="M9 3.5V8M15 3.5V8" /><path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z" /><path d="M12 16.5v4" /></>,
  share: <><circle cx="17.5" cy="6" r="2.5" /><circle cx="6.5" cy="12" r="2.5" /><circle cx="17.5" cy="18" r="2.5" /><path d="m8.7 10.8 6.6-3.6M8.7 13.2l6.6 3.6" /></>,
  database: <><ellipse cx="12" cy="6" rx="7" ry="2.5" /><path d="M5 6v12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V6" /><path d="M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5M12 7.8v.2" /></>,
  map: <><path d="M9 4.5 3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2z" /><path d="M9 4.5v13M15 6.5v13" /></>,
  box: <><path d="M12 3.5 20 7.5v9L12 20.5 4 16.5v-9z" /><path d="M4 7.5 12 11.5l8-4M12 11.5v9" /></>,
  store: <><path d="M4 9.5 5.5 4.5h13L20 9.5" /><path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" /><path d="M5.5 11.5v8h13v-8M10 19.5v-4.5h4v4.5" /></>,
  compass: <><circle cx="12" cy="12" r="8.5" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  list: <><path d="M9 6.5h11M9 12h11M9 17.5h11" /><path d="M4.5 6.5h.5M4.5 12h.5M4.5 17.5h.5" /></>,
  bolt: <path d="M13 3.5 5.5 13.5H12l-1 7 7.5-10H12z" />,
  eye: <><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></>,
  flag: <><path d="M5.5 20.5v-16" /><path d="M5.5 4.5h11l-2 4 2 4h-11" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z" /></>,
  star: <path d="m12 4 2.4 5 5.4.6-4 3.7 1.1 5.4L12 16l-4.9 2.7 1.1-5.4-4-3.7 5.4-.6z" />,
};

export function Icon({ name, size = 20, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" className={className} {...s}>
      {PATHS[name]}
    </svg>
  );
}

export function AppLogo({ size = 32 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} role="img" aria-label="Repéré">
      <rect width="64" height="64" rx="14" fill="#3730A3" />
      <g fill="none" stroke="#FFFFFF" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 26V19a2 2 0 0 1 2-2h7" />
        <path d="M38 17h7a2 2 0 0 1 2 2v7" />
        <path d="M47 38v7a2 2 0 0 1-2 2h-7" />
        <path d="M26 47h-7a2 2 0 0 1-2-2v-7" />
      </g>
      <circle cx="32" cy="32" r="7" fill="#F5A524" />
    </svg>
  );
}
