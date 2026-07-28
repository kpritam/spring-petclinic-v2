import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import styles from './NavCards.module.css';

interface NavCard {
  title: string;
  description: string;
  href: string;
  label: string;
}

const CARDS: NavCard[] = [
  {
    title: 'Getting started',
    description: 'Run the application locally in three steps using Maven or Gradle.',
    href: '/getting-started',
    label: 'Start here',
  },
  {
    title: 'Guides',
    description: 'Configure MySQL or PostgreSQL, build container images, set up your IDE, and switch languages.',
    href: '/guides/',
    label: 'Browse guides',
  },
  {
    title: 'Architecture',
    description: 'Understand the MVC layer structure, request flow, caching subsystem, and i18n runtime.',
    href: '/concepts/architecture',
    label: 'Read architecture',
  },
  {
    title: 'Reference',
    description: 'HTTP endpoints, configuration properties, domain model, and entity relationships.',
    href: '/reference/endpoints',
    label: 'View reference',
  },
];

export default function NavCards(): ReactNode {
  return (
    <section className={styles.section} aria-label="Documentation sections">
      <div className={styles.inner}>
        <h2 className={styles.heading}>Where to go next</h2>
        <ul className={styles.grid} role="list">
          {CARDS.map((card) => (
            <li key={card.title}>
              <Link to={card.href} className={styles.card}>
                <h3 className={styles.cardTitle}>{card.title}</h3>
                <p className={styles.cardDesc}>{card.description}</p>
                <span className={styles.cardLink} aria-hidden="true">
                  {card.label} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
