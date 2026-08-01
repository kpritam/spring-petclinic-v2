import type { ReactNode } from 'react';

interface Line {
  type: 'prompt' | 'output' | 'blank' | 'success' | 'info';
  text: string;
}

const LINES: Line[] = [
  { type: 'prompt',  text: './mvnw spring-boot:run' },
  { type: 'blank',   text: '' },
  { type: 'info',    text: '  .   ____          _            __ _ _' },
  { type: 'info',    text: " /\\\\ / ___'_ __ _ _(_)_ __  __ _ \\ \\ \\ \\" },
  { type: 'info',    text: '( ( )\\___ | \'_ | \'_| | \'_ \\/ _` | \\ \\ \\ \\' },
  { type: 'info',    text: " \\\\/ ___)| |_)| | | | | || (_| |  ) ) ) )" },
  { type: 'info',    text: "  '  |____| .__|_| |_|_| |_\\__, | / / / /" },
  { type: 'info',    text: " =========|_|==============|___/=/_/_/_/" },
  { type: 'blank',   text: '' },
  { type: 'output',  text: ':: Spring Boot ::              (v4.1.0)' },
  { type: 'blank',   text: '' },
  { type: 'output',  text: 'Started PetClinicApplication in 2.341 s' },
  { type: 'success', text: '✓ Listening on http://localhost:8080' },
];

export default function TerminalMockup(): ReactNode {
  return (
    <figure style={styles.figure}>
      {/* Window chrome */}
      <div style={styles.chrome} aria-hidden="true">
        <span style={{ ...styles.dot, background: '#FF5F57' }} />
        <span style={{ ...styles.dot, background: '#FEBC2E' }} />
        <span style={{ ...styles.dot, background: '#28C840' }} />
        <span style={styles.title}>bash</span>
      </div>

      {/* Terminal body */}
      <pre style={styles.pre} role="img" aria-label="Terminal showing Spring Boot startup output">
        <code style={styles.code}>
          {LINES.map((line, i) => (
            <div
              key={i}
              style={{
                ...styles.line,
                ...lineStyle(line.type),
                animation: `petclinic-reveal-line 280ms var(--petclinic-ease-out, cubic-bezier(0.16,1,0.3,1)) both`,
                animationDelay: `${420 + i * 70}ms`,
              }}
            >
              {line.type === 'prompt' && (
                <span style={styles.promptSymbol} aria-hidden="true">$ </span>
              )}
              {line.text}
              {line.type === 'success' && (
                <span style={styles.cursor} aria-hidden="true" />
              )}
            </div>
          ))}
        </code>
      </pre>
      <figcaption style={styles.caption}>Boots in under 3 seconds on JDK 17+</figcaption>
    </figure>
  );
}

function lineStyle(type: Line['type']): React.CSSProperties {
  switch (type) {
    case 'prompt':  return { color: '#A7F3D0', fontWeight: 500 };
    case 'success': return { color: '#34D399' };
    case 'info':    return { color: '#6B7280', fontFamily: 'var(--petclinic-font-mono)' };
    case 'blank':   return { lineHeight: '0.5' };
    default:        return { color: '#D1FAE5' };
  }
}

const styles: Record<string, React.CSSProperties> = {
  figure: {
    margin: 0,
    borderRadius: '12px',
    overflow: 'hidden',
    border: '1px solid rgba(94,234,212,0.30)',
    boxShadow: 'var(--petclinic-shadow-xl, 0 20px 40px rgba(13,78,74,0.14)), var(--petclinic-hero-glow-primary)',
    background: '#0A1F1E',
  },
  chrome: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '10px 14px',
    background: '#111F1E',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    display: 'inline-block',
    flexShrink: 0,
  },
  title: {
    marginLeft: '8px',
    fontSize: '0.7rem',
    color: '#4B5563',
    fontFamily: 'var(--petclinic-font-mono)',
    letterSpacing: '0.05em',
  },
  pre: {
    margin: 0,
    padding: '1.25rem 1.5rem',
    overflowX: 'auto',
    background: 'transparent',
    fontSize: '0.78rem',
    lineHeight: 1.55,
  },
  code: {
    fontFamily: 'var(--petclinic-font-mono, ui-monospace, monospace)',
    display: 'block',
  },
  line: {
    display: 'block',
    color: '#D1FAE5',
    whiteSpace: 'pre',
  },
  promptSymbol: {
    color: '#2DD4BF',
    userSelect: 'none',
  },
  cursor: {
    display: 'inline-block',
    width: '7px',
    height: '14px',
    marginLeft: '8px',
    verticalAlign: '-2px',
    background: '#34D399',
    animation: 'petclinic-cursor-blink 1s step-end infinite',
    animationDelay: `${420 + LINES.length * 70}ms`,
  },
  caption: {
    display: 'block',
    padding: '8px 14px',
    fontSize: '0.72rem',
    color: '#4B6B67',
    fontFamily: 'var(--petclinic-font-body)',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    background: '#0D1F1E',
  },
};
