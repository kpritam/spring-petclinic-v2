---
sidebar_position: 10
sidebar_label: Getting Started
---

# Getting Started

Run Spring PetClinic locally in a single command. No database setup required — the default configuration uses an H2 in-memory database with seed data loaded automatically.

## Prerequisites

- Java 17 or later. Check with `java -version`.
- The Maven wrapper (`mvnw`) is included in the repository; no separate Maven install is needed.

## Run the application

```bash
./mvnw spring-boot:run
```

The first run downloads dependencies. Once you see output like:

```
Started PetClinicApplication in X.XXX seconds
```

open http://localhost:8080 in your browser.

## Verify it works

1. The welcome page loads with a Spring PetClinic banner.
2. Click **Find owners** in the navigation — a list of pre-loaded owners appears.
3. Click **Veterinarians** — a paginated list of vets with their specialties appears.

The seed data comes from `src/main/resources/db/h2/data.sql` and is loaded fresh on every start because H2 runs in memory.

## What you just ran

`./mvnw spring-boot:run` starts an embedded Tomcat server on port 8080. The `database=h2` property in `application.properties` tells the app to run schema and data SQL from `src/main/resources/db/h2/`. All data is lost when the process stops — which is fine for exploration.

## Stop the application

Press `Ctrl+C` in the terminal where the app is running.

## Next steps

- [Explore the App End to End](./tutorials/explore-the-app) — walk through owners, pets, and visits
- [Switch to MySQL or PostgreSQL](./guides/switch-database) — persist data across restarts
