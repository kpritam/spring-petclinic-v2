---
sidebar_position: 10
sidebar_label: Getting Started
---

# Getting started

Run Spring PetClinic locally and open the application in your browser.

## Prerequisites

- Java 17 or newer
- Maven wrapper (`./mvnw`) or Gradle wrapper (`./gradlew`) — both are included in the repository

## Run the application

**With Maven:**

```bash
./mvnw spring-boot:run
```

**With Gradle:**

```bash
./gradlew bootRun
```

The application starts on port 8080 and uses an embedded H2 in-memory database by default. No external database setup is required.

## Open the application

Navigate to [http://localhost:8080/](http://localhost:8080/).

The welcome page links to owner search, the vet directory, and error demonstration.

## Optional: inspect the database

The H2 web console is available at [http://localhost:8080/h2-console](http://localhost:8080/h2-console) while the application is running. Use these connection settings:

| Field | Value |
|-------|-------|
| JDBC URL | `jdbc:h2:mem:petclinic` |
| Username | `sa` |
| Password | *(empty)* |

## Build and verify (CI-equivalent)

**Maven:**

```bash
./mvnw -B verify
```

**Gradle:**

```bash
./gradlew build
```

Both commands compile, run tests, and verify code quality (Checkstyle, Spring Java Format, JaCoCo).

## See also

- [Configure a database](./guides/configure-database) — switch from H2 to MySQL or PostgreSQL
- [Run with Docker](./guides/docker) — build and run a container image
- [IDE setup](./guides/ide-setup) — import the project into Eclipse, IntelliJ IDEA, or VS Code
