---
sidebar_position: 50
sidebar_label: Configuration Properties
---

# Configuration Properties

All configuration is in `src/main/resources/`. The active Spring profile selects which profile-specific file is overlaid on top of the defaults.

## Default properties (`application.properties`)

| Property | Value | Notes |
|----------|-------|-------|
| `database` | `h2` | Selects `db/${database}/schema.sql` and `data.sql` for initialization |
| `spring.sql.init.schema-locations` | `classpath*:db/${database}/schema.sql` | Schema file path |
| `spring.sql.init.data-locations` | `classpath*:db/${database}/data.sql` | Seed data file path |
| `spring.thymeleaf.mode` | `HTML` | Thymeleaf template mode |
| `spring.jpa.hibernate.ddl-auto` | `none` | DDL managed by `spring.sql.init`, not Hibernate |
| `spring.jpa.open-in-view` | `false` | Disables open-session-in-view; all data must be loaded inside the transaction |
| `spring.jpa.hibernate.naming.physical-strategy` | `PhysicalNamingStrategySnakeCaseImpl` | Maps camelCase fields to snake_case columns |
| `spring.jpa.properties.hibernate.default_batch_fetch_size` | `16` | Batches collection fetches to reduce N+1 queries |
| `spring.messages.basename` | `messages/messages` | i18n message bundle path |
| `management.endpoints.web.exposure.include` | `*` | All Actuator endpoints exposed — **development only** |
| `logging.level.org.springframework` | `INFO` | Spring framework log level |
| `spring.web.resources.cache.cachecontrol.max-age` | `12h` | Browser cache duration for static resources |

> **Warning:** `management.endpoints.web.exposure.include=*` exposes all Actuator endpoints including heap dumps and env variables. This is intentional for the demo; restrict it in production.

## MySQL profile (`application-mysql.properties`)

Activate with `SPRING_PROFILES_ACTIVE=mysql`.

| Property | Default | Override via |
|----------|---------|-------------|
| `database` | `mysql` | — |
| `spring.datasource.url` | `jdbc:mysql://localhost/petclinic` | `MYSQL_URL` env var |
| `spring.datasource.username` | `petclinic` | `MYSQL_USER` env var |
| `spring.datasource.password` | `petclinic` | `MYSQL_PASS` env var |
| `spring.sql.init.mode` | `always` | — |

## PostgreSQL profile (`application-postgres.properties`)

Activate with `SPRING_PROFILES_ACTIVE=postgres`.

| Property | Default | Override via |
|----------|---------|-------------|
| `database` | `postgres` | — |
| `spring.datasource.url` | `jdbc:postgresql://localhost/petclinic` | `POSTGRES_URL` env var |
| `spring.datasource.username` | `petclinic` | `POSTGRES_USER` env var |
| `spring.datasource.password` | `petclinic` | `POSTGRES_PASS` env var |
| `spring.sql.init.mode` | `always` | — |

`spring.sql.init.mode=always` causes schema and data SQL to run on every startup. The SQL is written to be idempotent (H2 uses `DROP TABLE IF EXISTS`; MySQL and PostgreSQL use equivalent guards).

## Activating a profile

```bash
# Environment variable (recommended)
SPRING_PROFILES_ACTIVE=mysql ./mvnw spring-boot:run

# System property
./mvnw spring-boot:run -Dspring.profiles.active=postgres

# Multiple profiles
SPRING_PROFILES_ACTIVE=mysql,actuator ./mvnw spring-boot:run
```

## Actuator endpoints

With the default `management.endpoints.web.exposure.include=*`, the following are available at runtime:

- `/actuator/health` — application health status
- `/actuator/info` — build info
- `/actuator/metrics` — Micrometer metrics
- `/actuator/caches` — JCache statistics (includes `vets` cache hit rate)
- `/h2-console` — H2 in-browser SQL console (H2 profile only, at `http://localhost:8080/h2-console`)

## See also

- [Switch to MySQL or PostgreSQL](../guides/switch-database) — step-by-step database switching
