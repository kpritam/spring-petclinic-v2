import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import css from './Quickstart.module.css';

interface Step {
  num: number;
  title: string;
  cmd?: string;
  note?: string;
}

const STEPS: Step[] = [
  {
    num: 1,
    title: 'Clone the repository',
    cmd: 'git clone https://github.com/spring-projects/spring-petclinic.git\ncd spring-petclinic',
  },
  {
    num: 2,
    title: 'Run with Maven wrapper',
    cmd: './mvnw spring-boot:run',
    note: 'JDK 17 or later required. The wrapper downloads Maven automatically.',
  },
  {
    num: 3,
    title: 'Open the app',
    cmd: 'open http://localhost:8080',
    note: 'Default credentials: none required. Sample data loads on startup.',
  },
  {
    num: 4,
    title: 'Switch to MySQL or PostgreSQL',
    cmd: './mvnw spring-boot:run -Dspring-boot.run.profiles=mysql',
    note: 'See the database guide for connection string setup.',
  },
];

export default function Quickstart(): ReactNode {
  return (
    <section style={styles.section}>
      <div style={styles.inner}>
        <h2 style={styles.h2}>Up and running in 60 seconds</h2>
        <p style={styles.lead}>JDK 17+ and Git are the only prerequisites.</p>

        <ol style={styles.ol} aria-label="Quickstart steps">
          {STEPS.map((step) => (
            <QuickstartStep key={step.num} step={step} />
          ))}
        </ol>

        <div style={styles.footer}>
          <Link to="/getting-started" style={styles.link}>
            Full getting-started guide →
          </Link>
          <Link to="/guides/switch-database" style={styles.linkSecondary}>
            Switch databases
          </Link>
        </div>
      </div>
    </section>
  );
}

function QuickstartStep({ step }: { step: Step }): ReactNode {
  return (
    <li className={css.li} style={styles.li}>
      <div style={styles.numWrap} aria-hidden="true">
        <span style={styles.num}>{step.num}</span>
      </div>
      <div style={styles.content}>
        <p style={styles.stepTitle}>{step.title}</p>
        {step.cmd && (
          <pre style={styles.pre}>
            <code style={styles.codeBlock}>{step.cmd}</code>
          </pre>
        )}
        {step.note && <p style={styles.note}>{step.note}</p>}
      </div>
    </li>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    width: '100vw',
    maxWidth: '100vw',
    marginInline: 'calc(50% - 50vw)',
    paddingInline: 'clamp(1rem, 4vw, 4rem)',
    paddingTop: 'clamp(3rem, 6vw, 5rem)',
    paddingBottom: 'clamp(3rem, 6vw, 5rem)',
    background: 'var(--petclinic-bg-gradient)',
  },
  inner: {
    maxWidth: 'var(--petclinic-content-max)',
    marginInline: 'auto',
  },
  h2: {
    fontFamily: 'var(--petclinic-font-display)',
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    fontWeight: 700,
    color: 'var(--petclinic-content)',
    margin: '0 0 0.5rem',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  lead: {
    fontSize: '1rem',
    color: 'var(--petclinic-muted)',
    margin: '0 0 2rem',
  },
  ol: {
    listStyle: 'none',
    padding: 0,
    margin: '0 0 2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  li: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
    background: 'var(--petclinic-surface-elevated)',
    border: '1px solid var(--petclinic-border)',
    borderRadius: '10px',
    padding: '1.125rem 1.25rem',
    boxShadow: 'var(--petclinic-shadow-sm)',
  },
  numWrap: {
    flexShrink: 0,
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    background: 'var(--petclinic-primary)',
    boxShadow: '0 2px 8px rgba(13,148,136,0.35)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '1px',
  },
  num: {
    color: '#fff',
    fontFamily: 'var(--petclinic-font-display)',
    fontWeight: 700,
    fontSize: '1.05rem',
    lineHeight: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  stepTitle: {
    fontFamily: 'var(--petclinic-font-display)',
    fontWeight: 600,
    fontSize: '0.975rem',
    color: 'var(--petclinic-content)',
    margin: '0 0 0.5rem',
  },
  pre: {
    margin: '0 0 0.5rem',
    padding: '0.65rem 0.875rem',
    borderRadius: '6px',
    background: '#0A1F1E',
    overflowX: 'auto',
    border: '1px solid rgba(13,148,136,0.20)',
  },
  codeBlock: {
    fontFamily: 'var(--petclinic-font-mono)',
    fontSize: '0.82rem',
    color: '#A7F3D0',
    lineHeight: 1.5,
    whiteSpace: 'pre',
    display: 'block',
  },
  note: {
    fontSize: '0.82rem',
    color: 'var(--petclinic-muted)',
    margin: 0,
    lineHeight: 1.5,
  },
  footer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '1rem',
    alignItems: 'center',
  },
  link: {
    fontFamily: 'var(--petclinic-font-display)',
    fontWeight: 600,
    fontSize: '0.95rem',
    color: 'var(--petclinic-link-accent)',
    textDecoration: 'none',
  },
  linkSecondary: {
    fontFamily: 'var(--petclinic-font-body)',
    fontSize: '0.9rem',
    color: 'var(--petclinic-muted)',
    textDecoration: 'none',
  },
};
