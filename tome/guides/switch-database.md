---
sidebar_position: 30
sidebar_label: Switch to MySQL or PostgreSQL
---

# Switch to MySQL or PostgreSQL

By default Spring PetClinic runs against H2 in memory. To persist data across restarts, switch to MySQL or PostgreSQL using Docker Compose and a Spring profile.

## Start the database container

The repository ships a `docker-compose.yml` at the repo root with two services:

```bash
# MySQL 9.7 on port 3306
docker compose up mysql -d

# — or —

# PostgreSQL 18.4 on port 5432
docker compose up postgres -d
```

Both services pre-create a `petclinic` database with username and password `petclinic`.

## Run the application with the profile

```bash
# MySQL
SPRING_PROFILES_ACTIVE=mysql ./mvnw spring-boot:run

# PostgreSQL
SPRING_PROFILES_ACTIVE=postgres ./mvnw spring-boot:run
```

With Gradle:

```bash
SPRING_PROFILES_ACTIVE=mysql ./gradlew bootRun
```

Spring Boot applies `application-mysql.properties` (or `application-postgres.properties`) on top of `application.properties`. Schema and data SQL are re-run on each startup because `spring.sql.init.mode=always` is set in both profile files — the SQL is idempotent.

## Override connection details

The profile files use environment variables with defaults:

| Profile | Variable | Default |
|---------|----------|---------|
| `mysql` | `MYSQL_URL` | `jdbc:mysql://localhost/petclinic` |
| `mysql` | `MYSQL_USER` | `petclinic` |
| `mysql` | `MYSQL_PASS` | `petclinic` |
| `postgres` | `POSTGRES_URL` | `jdbc:postgresql://localhost/petclinic` |
| `postgres` | `POSTGRES_USER` | `petclinic` |
| `postgres` | `POSTGRES_PASS` | `petclinic` |

To point at an external database:

```bash
SPRING_PROFILES_ACTIVE=mysql \
MYSQL_URL=jdbc:mysql://db.example.com/petclinic \
MYSQL_USER=myuser \
MYSQL_PASS=mypass \
./mvnw spring-boot:run
```

## Verify

Open http://localhost:8080. Data you create now persists — restart the app and the owners you added are still there.

## Teardown

```bash
docker compose down
```

This stops and removes the containers. Data is lost unless you added a named volume to the compose file.

## See also

- [Configuration Properties](../reference/configuration) — full property reference
- [Deploy to Kubernetes](./deploy-kubernetes) — run in a cluster with a managed database
