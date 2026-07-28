---
sidebar_position: 30
sidebar_label: Configuration
---

# Configuration reference

Properties that control PetClinic's runtime behavior. Values are set in `src/main/resources/application.properties` and overridden by profile-specific files.

## Base properties (`application.properties`)

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `database` | `string` | `h2` | Selects the SQL init scripts directory under `db/`. Valid values: `h2`, `mysql`, `postgres`. |
| `spring.sql.init.schema-locations` | `string` | `classpath*:db/${database}/schema.sql` | Path to the DDL script run at startup. |
| `spring.sql.init.data-locations` | `string` | `classpath*:db/${database}/data.sql` | Path to the seed data script run at startup. |
| `spring.thymeleaf.mode` | `string` | `HTML` | Thymeleaf template mode. |
| `spring.jpa.hibernate.ddl-auto` | `string` | `none` | Hibernate schema generation. Set to `none` because SQL init scripts manage the schema. |
| `spring.jpa.open-in-view` | `boolean` | `false` | Disables the Open Session in View anti-pattern. |
| `spring.jpa.hibernate.naming.physical-strategy` | `string` | `PhysicalNamingStrategySnakeCaseImpl` | Maps Java camelCase field names to SQL snake_case column names. |
| `spring.jpa.properties.hibernate.default_batch_fetch_size` | `int` | `16` | Batch size for collection fetches to reduce N+1 queries. |
| `spring.messages.basename` | `string` | `messages/messages` | Base name for the `MessageSource` resource bundle. |
| `management.endpoints.web.exposure.include` | `string` | `*` | Exposes all Spring Boot Actuator endpoints. Restrict in production. |
| `spring.web.resources.cache.cachecontrol.max-age` | `duration` | `12h` | `Cache-Control: max-age` header for static resources. |

## MySQL profile (`application-mysql.properties`)

Activated with `spring.profiles.active=mysql` or `SPRING_PROFILES_ACTIVE=mysql`.

| Property | Default | Override via env var |
|----------|---------|---------------------|
| `database` | `mysql` | — |
| `spring.datasource.url` | `jdbc:mysql://localhost/petclinic` | `MYSQL_URL` |
| `spring.datasource.username` | `petclinic` | `MYSQL_USER` |
| `spring.datasource.password` | `petclinic` | `MYSQL_PASS` |
| `spring.sql.init.mode` | `always` | — |

## PostgreSQL profile (`application-postgres.properties`)

Activated with `spring.profiles.active=postgres` or `SPRING_PROFILES_ACTIVE=postgres`.

| Property | Default | Override via env var |
|----------|---------|---------------------|
| `database` | `postgres` | — |
| `spring.datasource.url` | `jdbc:postgresql://localhost/petclinic` | `POSTGRES_URL` |
| `spring.datasource.username` | `petclinic` | `POSTGRES_USER` |
| `spring.datasource.password` | `petclinic` | `POSTGRES_PASS` |
| `spring.sql.init.mode` | `always` | — |

## See also

- [Configure a database](../guides/configure-database) — step-by-step database switching
- [Run with Docker](../guides/docker) — pass environment variables to a container
- [Architecture](../concepts/architecture) — how profiles and schema init work at runtime
