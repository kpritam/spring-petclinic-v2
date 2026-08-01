import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import TerminalMockup from './TerminalMockup';
import css from './Hero.module.css';

export default function Hero(): ReactNode {
  return (
    <section className="petclinic-hero" style={styles.section}>
      {/* Glow blobs */}
      <div className={css.glowPrimary} style={styles.glowPrimary} aria-hidden="true" />
      <div className={css.glowAccent} style={styles.glowAccent} aria-hidden="true" />

      <div style={styles.inner}>
        {/* Copy column */}
        <div style={styles.copy}>
          <div style={{ ...styles.badge, animationDelay: '0ms' }}>
            Spring Boot · Thymeleaf · JPA
          </div>
          <h1 style={{ ...styles.h1, animationDelay: '60ms' }}>
            Build confidence before you ship to production
          </h1>
          <p style={{ ...styles.sub, animationDelay: '160ms' }}>
            A fully-wired Spring Boot application you can run, break, and learn from.
            Multi-database, multi-language, and ready for containers.
          </p>
          <div style={{ ...styles.ctaRow, animationDelay: '260ms' }}>
            <Link to="/getting-started" className="petclinic-btn petclinic-btn-primary">
              Get started
              <span className="petclinic-cta-arrow" aria-hidden="true">→</span>
            </Link>
            <Link to="/tutorials/explore-the-app" className="petclinic-btn petclinic-btn-secondary">
              Explore the app
              <span className="petclinic-cta-arrow" aria-hidden="true">→</span>
            </Link>
          </div>
        </div>

        {/* Visual anchor */}
        <div style={{ ...styles.visual, animationDelay: '100ms' }}>
          <TerminalMockup />
        </div>
      </div>
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    position: 'relative',
    overflow: 'hidden',
    width: '100vw',
    maxWidth: '100vw',
    marginInline: 'calc(50% - 50vw)',
    paddingInline: 'clamp(1rem, 4vw, 4rem)',
    paddingTop: 'clamp(4.5rem, 9vw, 8rem)',
    paddingBottom: 'clamp(3.5rem, 7vw, 6rem)',
    background: 'var(--petclinic-hero-bg)',
  },
  glowPrimary: {
    position: 'absolute',
    top: '-100px',
    left: '8%',
    width: '560px',
    height: '560px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(45,212,191,0.22) 0%, transparent 70%)',
    boxShadow: 'var(--petclinic-hero-glow-primary)',
    pointerEvents: 'none',
  },
  glowAccent: {
    position: 'absolute',
    top: '15%',
    right: '4%',
    width: '380px',
    height: '380px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(251,146,60,0.16) 0%, transparent 70%)',
    boxShadow: 'var(--petclinic-hero-glow-accent)',
    pointerEvents: 'none',
  },
  inner: {
    position: 'relative',
    maxWidth: 'var(--petclinic-content-max)',
    marginInline: 'auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(28rem, 100%), 1fr))',
    gap: 'clamp(2rem, 5vw, 4rem)',
    alignItems: 'center',
  },
  copy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1.4rem',
  },
  badge: {
    display: 'inline-flex',
    alignSelf: 'flex-start',
    padding: '5px 14px',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: 600,
    fontFamily: 'var(--petclinic-font-mono)',
    letterSpacing: '0.03em',
    background: 'var(--petclinic-hero-badge-bg)',
    color: 'var(--petclinic-hero-ink-muted)',
    border: '1px solid var(--petclinic-hero-badge-border)',
    animation: 'petclinic-fade-up 420ms var(--petclinic-ease-out, cubic-bezier(0.16,1,0.3,1)) both',
  },
  h1: {
    fontFamily: 'var(--petclinic-font-display)',
    fontSize: 'clamp(2.25rem, 5.5vw, 4.25rem)',
    fontWeight: 700,
    lineHeight: 1.12,
    letterSpacing: '-0.03em',
    color: 'var(--petclinic-hero-ink)',
    margin: 0,
    textWrap: 'balance',
    animation: 'petclinic-fade-up 480ms var(--petclinic-ease-out, cubic-bezier(0.16,1,0.3,1)) both',
  } as React.CSSProperties,
  sub: {
    fontSize: 'clamp(1.05rem, 2vw, 1.2rem)',
    fontWeight: 500,
    lineHeight: 1.7,
    letterSpacing: '0.01em',
    color: 'var(--petclinic-hero-ink-muted)',
    margin: 0,
    maxWidth: '52ch',
    animation: 'petclinic-fade-up 480ms var(--petclinic-ease-out, cubic-bezier(0.16,1,0.3,1)) both',
  },
  ctaRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.875rem',
    alignItems: 'center',
    marginTop: '0.5rem',
    animation: 'petclinic-fade-up 480ms var(--petclinic-ease-out, cubic-bezier(0.16,1,0.3,1)) both',
  },
  visual: {
    animation: 'petclinic-fade-up 560ms var(--petclinic-ease-out, cubic-bezier(0.16,1,0.3,1)) both',
  },
};
