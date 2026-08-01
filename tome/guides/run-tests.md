---
sidebar_position: 60
sidebar_label: Run the Test Suite
---

# Run the Test Suite

Spring PetClinic has three tiers of tests: MockMvc slice tests, a full H2 integration test, and database-specific integration tests that spin up real MySQL and PostgreSQL containers via TestContainers.

## Run everything

```bash
./mvnw verify
```

This runs all tests, Checkstyle, Spring Java Format checks, and generates a JaCoCo coverage report.

## Run just unit and slice tests

```bash
./mvnw test
```

`mvn test` runs the Surefire plugin (unit tests). `mvn verify` additionally runs Failsafe (integration tests tagged with `@SpringBootTest`).

## Test types in the codebase

| Class | Type | Database |
|-------|------|----------|
| `OwnerControllerTests` | MockMvc slice (`@WebMvcTest`) | none (mocked) |
| `PetControllerTests` | MockMvc slice (`@WebMvcTest`) | none (mocked) |
| `VisitControllerTests` | MockMvc slice (`@WebMvcTest`) | none (mocked) |
| `VetControllerTests` | MockMvc slice (`@WebMvcTest`) | none (mocked) |
| `PetValidatorTests` | Unit | none |
| `PetTypeFormatterTests` | Unit | none |
| `ValidatorTests` | Unit (Bean Validation) | none |
| `WelcomeControllerTests` | MockMvc slice | none (mocked) |
| `CrashControllerTests` | MockMvc slice | none (mocked) |
| `PetClinicIntegrationTests` | Full integration (`@SpringBootTest`) | H2 |
| `MySqlIntegrationTests` | Full integration | MySQL (TestContainers) |
| `PostgresIntegrationTests` | Full integration | PostgreSQL (Docker Compose) |
| `PetClinicConcurrencyTests` | Concurrency | H2 |

`MySqlIntegrationTests` uses TestContainers to start a MySQL container automatically — no local MySQL installation needed. `PostgresIntegrationTests` uses Spring Boot's Docker Compose support.

## Run a single test class

```bash
./mvnw test -Dtest=OwnerControllerTests
```

## Coverage report

After `./mvnw verify`, the JaCoCo HTML report is at:

```
target/site/jacoco/index.html
```

Open it in a browser to see line and branch coverage per class.

## See also

- [Domain Model](../concepts/domain-model) — the entities under test
