import type { ReactNode } from 'react';
import styles from './FeatureGrid.module.css';

interface Feature {
  icon: string;
  title: string;
  body: string;
}

// All features sourced from codebase evidence (src/main/java, pom.xml, messages_*.properties)
const FEATURES: Feature[] = [
  {
    icon: '⬡',
    title: 'Spring MVC + Thymeleaf',
    body: 'Server-side rendering with Thymeleaf templates, form binding, and validation — all wired through @Controller handlers.',
  },
  {
    icon: '⬡',
    title: 'Spring Data JPA',
    body: 'JPA repositories backed by H2 (default), MySQL, or PostgreSQL. Switch profiles at runtime with no code changes.',
  },
  {
    icon: '⬡',
    title: 'Caffeine caching',
    body: 'Veterinarian list cached via JCache and Caffeine. Configurable via spring.cache.* properties.',
  },
  {
    icon: '⬡',
    title: 'Nine-language i18n',
    body: 'Messages in English, German, Spanish, Farsi, Hindi, Korean, Portuguese, Russian, and Turkish — switchable with ?lang=.',
  },
  {
    icon: '⬡',
    title: 'Validated forms',
    body: 'Bean Validation enforces required fields, date constraints, and unique pet names per owner.',
  },
  {
    icon: '⬡',
    title: 'Container-ready',
    body: 'Build an OCI image with ./mvnw spring-boot:build-image and run it with a single docker run command.',
  },
];

// Using hex shapes instead of emoji to satisfy no-emoji-as-structural-icon rule
function HexIcon(): ReactNode {
  return (
    <span className={styles.icon} aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M12 2L21 7V17L12 22L3 17V7L12 2Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

export default function FeatureGrid(): ReactNode {
  return (
    <section className={styles.section} aria-label="Key features">
      <div className={styles.inner}>
        <h2 className={styles.heading}>Built to demonstrate Spring best practices</h2>
        <ul className={styles.grid} role="list">
          {FEATURES.map((f) => (
            <li key={f.title} className={styles.card}>
              <HexIcon />
              <h3 className={styles.cardTitle}>{f.title}</h3>
              <p className={styles.cardBody}>{f.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
