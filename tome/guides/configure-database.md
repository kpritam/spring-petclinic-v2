---
sidebar_position: 20
sidebar_label: Configure a database
---

# Configure a database

Switch PetClinic from the default H2 in-memory database to MySQL or PostgreSQL.

## How it works

The active Spring profile controls which `application-{profile}.properties` file is loaded. Each profile file sets `database`, `spring.datasource.url`, `spring.datasource.username`, and `spring.datasource.password`. The SQL schema and seed data are loaded from `src/main/resources/db/{database}/` at startup because `spring.sql.init.mode=always`.

## MySQL

**1. Start MySQL:**

```bash
docker compose up mysql
```

Or run manually:

```bash
docker run \
  -e MYSQL_USER=petclinic \
  -e MYSQL_PASSWORD=petclinic \
  -e MYSQL_ROOT_PASSWORD=root \
  -e MYSQL_DATABASE=petclinic \
  -p 3306:3306 \
  mysql:9.7
```

**2. Run the application with the `mysql` profile:**

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=mysql
```

Or set the environment variable:

```bash
SPRING_PROFILES_ACTIVE=mysql ./mvnw spring-boot:run
```

**Override connection details** with environment variables when the defaults don't match your setup:

| Variable | Default |
|----------|---------|
| `MYSQL_URL` | `jdbc:mysql://localhost/petclinic` |
| `MYSQL_USER` | `petclinic` |
| `MYSQL_PASS` | `petclinic` |

## PostgreSQL

**1. Start PostgreSQL:**

```bash
docker compose up postgres
```

Or run manually:

```bash
docker run \
  -e POSTGRES_USER=petclinic \
  -e POSTGRES_PASSWORD=petclinic \
  -e POSTGRES_DB=petclinic \
  -p 5432:5432 \
  postgres:18.4
```

**2. Run the application with the `postgres` profile:**

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=postgres
```

Or set the environment variable:

```bash
SPRING_PROFILES_ACTIVE=postgres ./mvnw spring-boot:run
```

**Override connection details:**

| Variable | Default |
|----------|---------|
| `POSTGRES_URL` | `jdbc:postgresql://localhost/petclinic` |
| `POSTGRES_USER` | `petclinic` |
| `POSTGRES_PASS` | `petclinic` |

## Schema initialization

Schema and seed data run automatically from `src/main/resources/db/{database}/schema.sql` and `data.sql`. The SQL files are idempotent (safe to re-run), which is why `spring.sql.init.mode=always` is set for both profiles.

## See also

- [Run with Docker](./docker) — container image for the application itself
- [Getting started](../getting-started) — run with the default H2 database
- [Configuration reference](../reference/configuration) — full list of `application.properties` keys
