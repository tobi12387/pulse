// Inline-SVG Icons (kein Lucide-import, alles gezeichnet — passt überall rein)
// Stroke = currentColor; alle Icons 1.6px stroke, 24x24 viewBox.

const Ico = ({ d, size = 18, fill, stroke = 1.6, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill || 'none'}
       stroke={fill ? 'none' : 'currentColor'} strokeWidth={stroke}
       strokeLinecap="round" strokeLinejoin="round" style={style}
       dangerouslySetInnerHTML={{ __html: d }} />
);

const Icons = {
  pulse:    <Ico d='<path d="M3 12h3l2-6 4 12 3-9 2 3h4"/>'/>,
  chat:     <Ico d='<path d="M4 12c0-4 3-7 8-7s8 3 8 7-3 7-8 7c-1 0-2-.1-3-.4L4 20l1.4-3.6C4.5 15.3 4 13.7 4 12z"/>'/>,
  data:     <Ico d='<rect x="3" y="13" width="4" height="8" rx="1"/><rect x="10" y="8" width="4" height="13" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>'/>,
  plan:     <Ico d='<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'/>,
  settings: <Ico d='<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'/>,
  heart:    <Ico d='<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>'/>,
  zap:      <Ico d='<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>'/>,
  moon:     <Ico d='<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'/>,
  battery:  <Ico d='<rect x="2" y="7" width="18" height="10" rx="2"/><path d="M22 11v2"/><path d="M5 10v4M8 10v4M11 10v4"/>'/>,
  steps:    <Ico d='<path d="M5 4c0 4 1 6 3 7M9 11l-2 6c-.4 1.4.4 2.5 1.7 2.5 1.6 0 2.5-1 3-3M14 8c0 3 1 4.5 2.5 5.2M16.5 13.2l-1.5 4.3c-.4 1.4.4 2.2 1.5 2.2 1 0 1.7-.6 2-1.7"/>'/>,
  flame:    <Ico d='<path d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1.5-.7-2.5-1.5-3.3.5 2-.5 3.3-2 3.3 0-3 1-5-2.5-8z"/><path d="M8 14a4 4 0 0 0 8 4 5 5 0 0 1-8-4z"/>'/>,
  send:     <Ico d='<path d="M5 12h14M14 5l7 7-7 7"/>'/>,
  mic:      <Ico d='<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'/>,
  arrowR:   <Ico d='<path d="M5 12h14M13 5l7 7-7 7"/>'/>,
  trend:    <Ico d='<path d="M3 17l6-6 4 4 8-8M21 7h-5M21 7v5"/>'/>,
  check:    <Ico d='<path d="M5 12l5 5L20 7"/>'/>,
  plus:     <Ico d='<path d="M12 5v14M5 12h14"/>'/>,
  close:    <Ico d='<path d="M6 6l12 12M18 6L6 18"/>'/>,
  sparkle:  <Ico d='<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>'/>,
  brain:    <Ico d='<path d="M9 4a3 3 0 0 0-3 3v.5A3 3 0 0 0 4 10v1a3 3 0 0 0 1 2.2V15a3 3 0 0 0 3 3 3 3 0 0 0 4 0 3 3 0 0 0 4 0 3 3 0 0 0 3-3v-1.8A3 3 0 0 0 20 11v-1a3 3 0 0 0-2-2.5V7a3 3 0 0 0-3-3 3 3 0 0 0-3 1.5A3 3 0 0 0 9 4z"/>'/>,
};

window.Icons = Icons;
