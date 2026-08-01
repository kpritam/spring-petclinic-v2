import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';

interface NavCard {
  href: string;
  icon: ReactNode;
  label: string;
  desc: string;
}

function AccentDot(): ReactNode {
  return <circle cx="19" cy="5" r="2.1" fill="var(--petclinic-accent)" />;
}

const CARDS: NavCard[] = [
  {
    href: '/getting-started',
    label: 'Getting Started',
    desc: 'Run the app locally in one command',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polygon points="5 3 19 12 5 21 5 3" />
        <AccentDot />
      </svg>
    ),
  },
  {
    href: '/tutorials/explore-the-app',
    label: 'Tutorials',
    desc: 'Walk through owners, pets, visits, and vets',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        <AccentDot />
      </svg>
    ),
  },
  {
    href: '/guides/switch-database',
    label: 'How-to Guides',
    desc: 'Database switching, containers, Kubernetes, tests',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
        <AccentDot />
      </svg>
    ),
  },
  {
    href: '/concepts/domain-model',
    label: 'Concepts',
    desc: 'Domain model, request flow, Spring MVC internals',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
        <AccentDot />
      </svg>
    ),
  },
  {
    href: '/reference/configuration',
    label: 'Reference',
    desc: 'All configuration properties and HTTP routes',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
        <AccentDot />
      </svg>
    ),
  },
];

export default function NavCards(): ReactNode {
  return (
    <section style={styles.section}>
      <div style={styles.inner}>
        <h2 style={styles.h2}>Explore the documentation</h2>
        <div style={styles.list} role="list">
          {CARDS.map((card, i) => (
            <NavCardRow key={card.href} card={card} last={i === CARDS.length - 1} />
          ))}
        </div>
      </div>
    </section>
  );
}

function NavCardRow({ card, last }: { card: NavCard; last: boolean }): ReactNode {
  return (
    <Link
      to={card.href}
      role="listitem"
      style={{ ...styles.row, borderBottom: last ? 'none' : styles.row.borderBottom }}
      onMouseOver={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'var(--petclinic-surface-elevated)';
        const label = el.querySelector<HTMLElement>('[data-label]');
        const arrow = el.querySelector<HTMLElement>('[data-arrow]');
        if (label) label.style.color = 'var(--petclinic-primary)';
        if (arrow) arrow.style.transform = 'translateX(4px)';
      }}
      onMouseOut={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.background = 'transparent';
        const label = el.querySelector<HTMLElement>('[data-label]');
        const arrow = el.querySelector<HTMLElement>('[data-arrow]');
        if (label) label.style.color = 'var(--petclinic-content)';
        if (arrow) arrow.style.transform = 'translateX(0)';
      }}
    >
      <div style={styles.iconWrap} aria-hidden="true">{card.icon}</div>
      <div style={styles.textCol}>
        <span data-label style={styles.label}>{card.label}</span>
        <span style={styles.desc}>{card.desc}</span>
      </div>
      <span data-arrow style={styles.arrow} aria-hidden="true">→</span>
    </Link>
  );
}

const styles: Record<string, React.CSSProperties> = {
  section: {
    width: '100vw',
    maxWidth: '100vw',
    marginInline: 'calc(50% - 50vw)',
    paddingInline: 'clamp(1rem, 4vw, 4rem)',
    paddingTop: 'clamp(2.5rem, 5vw, 4rem)',
    paddingBottom: 'clamp(3rem, 6vw, 5rem)',
    background: 'var(--petclinic-surface)',
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
    margin: '0 0 1.5rem',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  list: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--petclinic-border)',
    borderRadius: '12px',
    overflow: 'hidden',
    background: 'var(--petclinic-surface-elevated)',
    boxShadow: 'var(--petclinic-shadow-sm)',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.125rem',
    padding: '1.125rem 1.375rem',
    borderBottom: '1px solid var(--petclinic-border)',
    textDecoration: 'none',
    background: 'transparent',
    transition: 'background 150ms',
    cursor: 'pointer',
  },
  iconWrap: {
    flexShrink: 0,
    color: 'var(--petclinic-primary)',
    display: 'inline-flex',
    padding: '10px',
    borderRadius: '10px',
    background: 'rgba(13,148,136,0.08)',
  },
  textCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.15rem',
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontFamily: 'var(--petclinic-font-display)',
    fontWeight: 600,
    fontSize: '1rem',
    color: 'var(--petclinic-content)',
    transition: 'color 150ms',
  },
  desc: {
    fontSize: '0.85rem',
    color: 'var(--petclinic-muted)',
    lineHeight: 1.5,
  },
  arrow: {
    flexShrink: 0,
    color: 'var(--petclinic-link-accent)',
    fontWeight: 700,
    fontSize: '1.1rem',
    transition: 'transform 150ms',
  },
};
