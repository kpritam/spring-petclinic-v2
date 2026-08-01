---
sidebar_position: 40
sidebar_label: Build a Container Image
---

# Build a Container Image

Spring PetClinic uses the Spring Boot Maven plugin's Paketo Buildpacks integration to produce an OCI-compatible container image. No `Dockerfile` is needed.

## Prerequisites

- Docker running locally (`docker info` succeeds)
- Java 17+ (`java -version`)

## Build the image

```bash
./mvnw spring-boot:build-image
```

With Gradle:

```bash
./gradlew bootBuildImage
```

The plugin pulls Paketo builder and run images on first use. The resulting image is tagged `spring-petclinic:4.0.0-SNAPSHOT` (from the `artifactId` and `version` in `pom.xml`).

## Override the image name

```bash
./mvnw spring-boot:build-image -Dspring-boot.build-image.imageName=myregistry/petclinic:latest
```

## Run the image

```bash
docker run -p 8080:8080 spring-petclinic:4.0.0-SNAPSHOT
```

Open http://localhost:8080. The default H2 profile runs inside the container.

## Pass a Spring profile

```bash
docker run \
  -e SPRING_PROFILES_ACTIVE=postgres \
  -e POSTGRES_URL=jdbc:postgresql://host.docker.internal/petclinic \
  -e POSTGRES_USER=petclinic \
  -e POSTGRES_PASS=petclinic \
  -p 8080:8080 \
  spring-petclinic:4.0.0-SNAPSHOT
```

`host.docker.internal` resolves to the Docker host on macOS and Windows; on Linux use the host's actual IP or a Docker network.

## See also

- [Deploy to Kubernetes](./deploy-kubernetes) — use this image in a cluster
