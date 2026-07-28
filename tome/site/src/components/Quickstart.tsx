import type { ReactNode } from 'react';
import styles from './Quickstart.module.css';

interface Step {
  n: number;
  label: string;
  code: string;
  lang: string;
}

// Derived from tome/getting-started.md
const STEPS: Step[] = [
  {
    n: 1,
    label: 'Clone the repository',
    code: 'git clone https://github.com/spring-projects/spring-petclinic.git\ncd spring-petclinic',
    lang: 'bash',
  },
  {
    n: 2,
    label: 'Run with the embedded Maven wrapper',
    code: './mvnw spring-boot:run',
    lang: 'bash',
  },
  {
    n: 3,
    label: 'Open the application',
    code: 'http://localhost:8080',
    lang: 'text',
  },
];

export default function Quickstart(): ReactNode {
  return (
    <section className={styles.section} aria-label="Quickstart">
      <div className={styles.inner}>
        <h2 className={styles.heading}>Up and running in three steps</h2>
        <ol className={styles.steps} role="list">
          {STEPS.map((step) => (
            <li key={step.n} className={styles.step}>
              <span className={styles.stepNum} aria-label={`Step ${step.n}`}>
                {step.n}
              </span>
              <div className={styles.stepContent}>
                <p className={styles.stepLabel}>{step.label}</p>
                <pre className={styles.code}>
                  <code>{step.code}</code>
                </pre>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
