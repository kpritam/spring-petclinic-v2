---
sidebar_position: 30
sidebar_label: Run with Docker
---

# Run with Docker

Build a container image for PetClinic and run it with Docker or Docker Compose.

## Build the image

```bash
./mvnw spring-boot:build-image
```

This produces `docker.io/library/spring-petclinic:4.0.0-SNAPSHOT` using Cloud Native Buildpacks — no `Dockerfile` required.

## Run the image

```bash
docker run -p 8080:8080 docker.io/library/spring-petclinic:4.0.0-SNAPSHOT
```

The application starts with the default H2 in-memory database. Navigate to [http://localhost:8080/](http://localhost:8080/).

## Run with MySQL via Docker Compose

The repository includes a `docker-compose.yml` with preconfigured MySQL and PostgreSQL services.

**Start MySQL:**

```bash
docker compose up mysql
```

Then run the application container with the `mysql` profile:

```bash
docker run \
  -e SPRING_PROFILES_ACTIVE=mysql \
  -e MYSQL_URL=jdbc:mysql://host.docker.internal/petclinic \
  -e MYSQL_USER=petclinic \
  -e MYSQL_PASS=petclinic \
  -p 8080:8080 \
  docker.io/library/spring-petclinic:4.0.0-SNAPSHOT
```

## Run with PostgreSQL via Docker Compose

**Start PostgreSQL:**

```bash
docker compose up postgres
```

Then run the application container with the `postgres` profile:

```bash
docker run \
  -e SPRING_PROFILES_ACTIVE=postgres \
  -e POSTGRES_URL=jdbc:postgresql://host.docker.internal/petclinic \
  -e POSTGRES_USER=petclinic \
  -e POSTGRES_PASS=petclinic \
  -p 8080:8080 \
  docker.io/library/spring-petclinic:4.0.0-SNAPSHOT
```

## See also

- [Configure a database](./configure-database) — profile-based database switching details
- [Getting started](../getting-started) — run locally without Docker
- [Configuration reference](../reference/configuration) — datasource environment variables
