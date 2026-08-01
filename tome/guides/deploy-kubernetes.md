---
sidebar_position: 50
sidebar_label: Deploy to Kubernetes
---

# Deploy to Kubernetes

The repository ships Kubernetes manifests in `k8s/`. They deploy the application alongside a PostgreSQL instance connected via the [Service Binding specification](https://servicebinding.io/).

## Prerequisites

- A running Kubernetes cluster (minikube, kind, or a cloud provider)
- `kubectl` configured to target it
- A container image pushed to a registry your cluster can reach (see [Build a Container Image](./build-container-image))

## Step 1 — Deploy the database

```bash
kubectl apply -f k8s/db.yml
```

`k8s/db.yml` creates:
- A `Secret` named `demo-db` of type `servicebinding.io/postgresql` holding host, port, database, username, and password.
- A `Deployment` running `postgres:18.4`, with credentials drawn from the same secret.
- A `Service` named `demo-db` exposing port 5432.

## Step 2 — Update the image name

Edit `k8s/petclinic.yml` and replace `dsyer/petclinic` (the default placeholder) with your image reference:

```yaml
containers:
  - name: workload
    image: myregistry/petclinic:latest   # <- change this
```

## Step 3 — Deploy the application

```bash
kubectl apply -f k8s/petclinic.yml
```

`k8s/petclinic.yml` creates:
- A `Service` of type `NodePort` named `petclinic` on port 80 → 8080.
- A `Deployment` with:
  - `SPRING_PROFILES_ACTIVE=postgres`
  - `SERVICE_BINDING_ROOT=/bindings` — tells Spring Cloud Bindings where to read the secret
  - `SPRING_APPLICATION_JSON` enabling `management.endpoint.health.probes.add-additional-paths: true` so `/livez` and `/readyz` work for liveness and readiness probes
  - A `volumeMount` at `/bindings/secret` projecting the `demo-db` secret

## Step 4 — Access the application

```bash
# minikube
minikube service petclinic --url

# kind / cloud — check the NodePort
kubectl get svc petclinic
```

Open the URL in your browser.

## Health probes

The deployment configures:

| Probe | Path |
|-------|------|
| Liveness | `/livez` |
| Readiness | `/readyz` |

These paths are activated by `management.endpoint.health.probes.add-additional-paths: true` passed via `SPRING_APPLICATION_JSON`.

## See also

- [Build a Container Image](./build-container-image) — produce the image used here
- [Configuration Properties](../reference/configuration) — environment variable reference
