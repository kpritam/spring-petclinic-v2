import type { ReactNode } from 'react';

interface Feature {
  icon: ReactNode;
  title: string;
  body: string;
}

/* Custom duotone icon set: teal glyph + a small orange accent, tying every
   icon back to the two brand colors instead of a generic outline-icon kit. */

function AccentDot(): ReactNode {
  return <circle cx="20.5" cy="4.5" r="2.4" fill="var(--petclinic-accent)" />;
}

const ICON_PAW = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <ellipse cx="6.2" cy="8.6" rx="1.7" ry="2.2" fill="currentColor" />
    <ellipse cx="10.6" cy="6.4" rx="1.8" ry="2.4" fill="currentColor" />
    <ellipse cx="15" cy="6.9" rx="1.7" ry="2.3" fill="currentColor" />
    <ellipse cx="18.6" cy="10.2" rx="1.5" ry="2" fill="currentColor" />
    <path d="M11 11.2c-3 0-5.5 2.1-5.5 4.7 0 2.6 2.5 4.6 5.5 4.6s5.5-2 5.5-4.6c0-2.6-2.5-4.7-5.5-4.7Z" fill="currentColor" />
    <AccentDot />
  </svg>
);

const ICON_CALENDAR_PULSE = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
    <line x1="16" y1="2.3" x2="16" y2="6.5" />
    <line x1="8" y1="2.3" x2="8" y2="6.5" />
    <line x1="3" y1="9.5" x2="21" y2="9.5" />
    <path d="M6 15.2h2.4l1.4-2.6 1.8 4.6 1.3-2h5" />
    <AccentDot />
  </svg>
);

const ICON_DATABASES = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <ellipse cx="11" cy="5.5" rx="7" ry="2.6" />
    <path d="M4 5.5v5.4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6V5.5" />
    <path d="M4 10.9v5.4c0 1.4 3.1 2.6 7 2.6s7-1.2 7-2.6v-5.4" />
    <AccentDot />
  </svg>
);

const ICON_GLOBE = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="12" r="9" />
    <line x1="2" y1="12" x2="20" y2="12" />
    <path d="M11 3a14 14 0 0 1 3.6 9 14 14 0 0 1-3.6 9 14 14 0 0 1-3.6-9A14 14 0 0 1 11 3z" />
    <AccentDot />
  </svg>
);

const ICON_CONTAINER = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M11 2.6 20 7v10L11 21.4 2 17V7Z" />
    <path d="M2 7l9 4.4 9-4.4" />
    <line x1="11" y1="11.4" x2="11" y2="21.4" />
    <AccentDot />
  </svg>
);

const ICON_FLOW = (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="4.5" cy="12" r="2.3" />
    <circle cx="12" cy="5.5" r="2.3" />
    <circle cx="12" cy="18.5" r="2.3" />
    <circle cx="19.5" cy="12" r="2.3" />
    <path d="M6.6 11.1 9.8 7" />
    <path d="M6.6 12.9l3.2 4.1" />
    <path d="M14.2 6.9l3.2 3.7" />
    <path d="M14.2 17.1l3.2-3.7" />
    <AccentDot />
  </svg>
);

const FEATURED: Feature = {
  icon: ICON_PAW,
  title: 'Owners & pets',
  body: 'Full CRUD for clinic owners and their pets. Search, add, and update records across a normalized JPA schema.',
};

const SUPPORTING: Feature[] = [
  {
    icon: ICON_CALENDAR_PULSE,
    title: 'Visit scheduling',
    body: 'Veterinary visits tied to pets and vets, with date tracking and description fields.',
  },
  {
    icon: ICON_DATABASES,
    title: 'H2, MySQL, PostgreSQL',
    body: 'Switch databases with a single Spring profile flag. Ships with H2 in-memory by default.',
  },
  {
    icon: ICON_GLOBE,
    title: '11 UI languages',
    body: 'English, German, Korean, Farsi, Japanese, and six more. Swap locale with a query param.',
  },
  {
    icon: ICON_CONTAINER,
    title: 'Container-ready',
    body: "One command builds an OCI image via Spring Boot's Buildpacks. Tested on Docker and Kubernetes.",
  },
  {
    icon: ICON_FLOW,
    title: 'Spring MVC patterns',
    body: 'Controller → Service → Repository layering, Thymeleaf forms, and Spring Data JPA queries.',
  },
];

const ENTITY_FLOW = ['Owner', 'Pet', 'Visit', 'Vet'];

export default function FeatureGrid(): ReactNode {
  return (
    <section style={styles.section}>
      <div style={styles.inner}>
        <div style={styles.header}>
          <h2 style={styles.h2}>Everything wired up, nothing hidden</h2>
          <p style={styles.lead}>
            Real patterns from real Spring apps — not tutorials that skip the tricky parts.
          </p>
        </div>

        {/* Featured card: the core domain model gets room to breathe */}
        <article
          style={styles.featured}
          onMouseOver={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--petclinic-primary)';
            el.style.boxShadow = 'var(--petclinic-shadow-lg)';
          }}
          onMouseOut={e => {
            const el = e.currentTarget as HTMLElement;
            el.style.borderColor = 'var(--petclinic-border-strong)';
            el.style.boxShadow = 'var(--petclinic-shadow-md)';
          }}
        >
          <div style={styles.featuredCopy}>
            <div style={styles.featuredIconWrap} aria-hidden="true">{FEATURED.icon}</div>
            <h3 style={styles.featuredTitle}>{FEATURED.title}</h3>
            <p style={styles.featuredBody}>{FEATURED.body}</p>
          </div>
          <div style={styles.entityFlow} aria-label="Domain model: Owner has Pets, Pets have Visits, Visits are handled by Vets">
            {ENTITY_FLOW.map((entity, i) => (
              <div key={entity} style={styles.entityFlowItem}>
                <span style={styles.entityPill}>{entity}</span>
                {i < ENTITY_FLOW.length - 1 && (
                  <span style={styles.entityArrow} aria-hidden="true">→</span>
                )}
              </div>
            ))}
          </div>
        </article>

        <div style={styles.grid}>
          {SUPPORTING.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }: { feature: Feature }): ReactNode {
  return (
    <article
      style={styles.card}
      onMouseOver={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--petclinic-shadow-lg, 0 8px 24px rgba(13,78,74,0.12))';
        el.style.transform = 'translateY(-2px)';
        el.style.borderColor = 'var(--petclinic-border-strong)';
      }}
      onMouseOut={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.boxShadow = 'var(--petclinic-shadow-sm, 0 1px 2px rgba(13,78,74,0.06))';
        el.style.transform = 'translateY(0)';
        el.style.borderColor = 'var(--petclinic-border)';
      }}
    >
      <div style={styles.iconWrap} aria-hidden="true">
        {feature.icon}
      </div>
      <h3 style={styles.h3}>{feature.title}</h3>
      <p style={styles.body}>{feature.body}</p>
    </article>
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
    background: 'var(--petclinic-surface)',
  },
  inner: {
    maxWidth: 'var(--petclinic-content-max)',
    marginInline: 'auto',
  },
  header: {
    marginBottom: '2rem',
    maxWidth: '52ch',
  },
  h2: {
    fontFamily: 'var(--petclinic-font-display)',
    fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)',
    fontWeight: 700,
    color: 'var(--petclinic-content)',
    margin: '0 0 0.5rem',
    letterSpacing: '-0.02em',
  } as React.CSSProperties,
  lead: {
    fontSize: '1.05rem',
    lineHeight: 1.6,
    color: 'var(--petclinic-muted)',
    margin: 0,
  },
  featured: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2rem',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--petclinic-surface-elevated)',
    borderRadius: '14px',
    border: '1px solid var(--petclinic-border-strong)',
    padding: 'clamp(1.5rem, 3vw, 2.25rem)',
    boxShadow: 'var(--petclinic-shadow-md)',
    marginBottom: '1rem',
    transition: 'box-shadow 200ms, border-color 200ms',
  },
  featuredCopy: {
    flex: '1 1 20rem',
    maxWidth: '32rem',
  },
  featuredIconWrap: {
    display: 'inline-flex',
    padding: '12px',
    borderRadius: '12px',
    background: 'rgba(13,148,136,0.10)',
    color: 'var(--petclinic-primary)',
    marginBottom: '1rem',
  },
  featuredTitle: {
    fontFamily: 'var(--petclinic-font-display)',
    fontSize: '1.4rem',
    fontWeight: 700,
    color: 'var(--petclinic-content)',
    margin: '0 0 0.5rem',
    letterSpacing: '-0.01em',
  },
  featuredBody: {
    fontSize: '1rem',
    lineHeight: 1.65,
    color: 'var(--petclinic-muted)',
    margin: 0,
  },
  entityFlow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.5rem',
    flex: '1 1 18rem',
    justifyContent: 'flex-end',
  },
  entityFlowItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  entityPill: {
    fontFamily: 'var(--petclinic-font-mono)',
    fontSize: '0.85rem',
    fontWeight: 500,
    padding: '0.4rem 0.9rem',
    borderRadius: '20px',
    border: '1px solid var(--petclinic-border-strong)',
    background: 'var(--petclinic-surface)',
    color: 'var(--petclinic-primary-dark)',
  },
  entityArrow: {
    color: 'var(--petclinic-link-accent)',
    fontWeight: 700,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(15rem, 100%), 1fr))',
    gap: '1rem',
  },
  card: {
    background: 'var(--petclinic-surface-elevated)',
    borderRadius: '10px',
    border: '1px solid var(--petclinic-border)',
    padding: '1.5rem',
    boxShadow: 'var(--petclinic-shadow-sm)',
    transition: 'box-shadow 200ms, transform 200ms, border-color 200ms',
    cursor: 'default',
  },
  iconWrap: {
    display: 'inline-flex',
    padding: '10px',
    borderRadius: '10px',
    background: 'rgba(13,148,136,0.08)',
    color: 'var(--petclinic-primary)',
    marginBottom: '0.875rem',
  },
  h3: {
    fontFamily: 'var(--petclinic-font-display)',
    fontSize: '1rem',
    fontWeight: 600,
    color: 'var(--petclinic-content)',
    margin: '0 0 0.4rem',
  },
  body: {
    fontSize: '0.9rem',
    lineHeight: 1.6,
    color: 'var(--petclinic-muted)',
    margin: 0,
  },
};
