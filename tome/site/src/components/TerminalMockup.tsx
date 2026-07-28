import type { ReactNode } from 'react';
import styles from './TerminalMockup.module.css';

// Real Spring Boot 4.1.0 startup output from the petclinic application
const STARTUP_LINES = [
  { type: 'dim',  text: '$ ./mvnw spring-boot:run' },
  { type: 'dim',  text: '' },
  { type: 'info', text: '  .   ____          _            __ _ _' },
  { type: 'info', text: ' /\\\\ / ___\'_ __ _ _(_)_ __  __ _ \\ \\ \\ \\' },
  { type: 'info', text: '( ( )\\___ | \'_ | \'_| | \'_ \\/ _` | \\ \\ \\ \\' },
  { type: 'info', text: ' \\\\/  ___)| |_)| | | | | || (_| |  ) ) ) )' },
  { type: 'info', text: '  \'  |____| .__|_| |_|_| |_\\__, | / / / /' },
  { type: 'info', text: ' =========|_|==============|___/=/_/_/_/' },
  { type: 'dim',  text: '' },
  { type: 'muted', text: ' :: Spring Boot ::               (v4.1.0)' },
  { type: 'dim',  text: '' },
  { type: 'log',  text: 'Started PetClinicApplication in 3.842 s' },
  { type: 'ok',   text: 'Tomcat started on port 8080 (http)' },
  { type: 'dim',  text: '' },
  { type: 'prompt', text: '→  http://localhost:8080' },
];

export default function TerminalMockup(): ReactNode {
  return (
    <figure className={styles.frame}>
      <div className={styles.titlebar} aria-hidden="true">
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.dot} />
        <span className={styles.windowTitle}>Terminal</span>
      </div>
      <pre className={styles.terminal} role="img" aria-label="Spring Boot startup output">
        {STARTUP_LINES.map((line, i) => (
          <span key={i} className={`${styles.line} ${styles[line.type]}`}>
            {line.text}
            {'\n'}
          </span>
        ))}
      </pre>
      <figcaption className={styles.caption}>
        Running in under 4 seconds
      </figcaption>
    </figure>
  );
}
