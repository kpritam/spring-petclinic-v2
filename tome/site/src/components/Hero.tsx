import type { ReactNode } from 'react';
import Link from '@docusaurus/Link';
import styles from './Hero.module.css';

interface HeroProps {
  visual?: ReactNode;
}

export default function Hero({ visual }: HeroProps): ReactNode {
  return (
    <section className={styles.hero} aria-label="Introduction">
      <div className={styles.inner}>
        <div className={styles.copy}>
          <h1 className={`${styles.headline} petclinic-hero-enter`}>
            Every visit, every pet, every owner — all in one place
          </h1>
          <p className={`${styles.sub} petclinic-hero-enter-delay-1`}>
            A Spring Boot 4 reference application demonstrating MVC, JPA,
            Caffeine caching, and 9-language i18n — fully runnable in minutes.
          </p>
          <div className={`${styles.ctas} petclinic-hero-enter-delay-2`}>
            <Link className={styles.ctaPrimary} to="/getting-started">
              Get started
            </Link>
            <Link className={styles.ctaSecondary} to="/concepts/architecture">
              Explore the architecture
            </Link>
          </div>
        </div>
        {visual && (
          <div className={`${styles.visual} petclinic-visual-enter`}>
            {visual}
          </div>
        )}
      </div>
    </section>
  );
}
