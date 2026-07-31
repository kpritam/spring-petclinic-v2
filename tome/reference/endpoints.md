---
sidebar_position: 10
sidebar_label: HTTP endpoints
---

# HTTP endpoints

All HTTP routes exposed by PetClinic. Routes serve HTML via Thymeleaf unless noted otherwise.

## Owner endpoints

Handled by `OwnerController` (`owner/OwnerController.java`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/owners/find` | Render the owner search form |
| `GET` | `/owners` | Search owners by last name; paginated (5 per page) |
| `GET` | `/owners/new` | Render the new owner form |
| `POST` | `/owners/new` | Create a new owner; redirects to owner detail on success |
| `GET` | `/owners/{ownerId}` | Display owner details, pets, and visits |
| `GET` | `/owners/{ownerId}/edit` | Render the edit owner form |
| `POST` | `/owners/{ownerId}/edit` | Update an owner; redirects to owner detail on success |

### Query parameters — `GET /owners`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `lastName` | `string` | `""` | Filter owners by last name prefix (case-insensitive). Empty value returns all owners. |
| `page` | `int` | `1` | Page number (1-based). Page size is fixed at 5. |

When the search returns exactly one owner, the response redirects to `/owners/{ownerId}` directly.

## Pet endpoints

Handled by `PetController` (`owner/PetController.java`). Nested under an owner path.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/owners/{ownerId}/pets/new` | Render the new pet form |
| `POST` | `/owners/{ownerId}/pets/new` | Create a new pet for the owner |
| `GET` | `/owners/{ownerId}/pets/{petId}/edit` | Render the edit pet form |
| `POST` | `/owners/{ownerId}/pets/{petId}/edit` | Update a pet |

Pet names must be unique per owner (`UNIQUE (owner_id, name)` in the database). Submitting a duplicate name produces a field error with code `duplicate`.

## Visit endpoints

Handled by `VisitController` (`owner/VisitController.java`).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/owners/{ownerId}/pets/{petId}/visits/new` | Render the new visit form (date pre-filled to tomorrow) |
| `POST` | `/owners/{ownerId}/pets/{petId}/visits/new` | Create a visit; redirects to owner detail on success |

Visit date must be in the future. A past or present date produces a field error with message key `typeMismatch.visitDate` ("Visit date must be in the future").

## Vet endpoints

Handled by `VetController` (`vet/VetController.java`).

| Method | Path | Produces | Description |
|--------|------|----------|-------------|
| `GET` | `/vets.html` | `text/html` | Paginated vet list with specialties |
| `GET` | `/vets` | `application/json` or `application/xml` | Paginated vet list as JSON or XML (content-negotiated) |
| `GET` | `/vets/{vetId}` | `application/json` or `application/xml` | Single vet by ID; 404 if not found |

### Query parameters — `GET /vets.html`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `int` | `1` | Page number (1-based). Page size is fixed at 5. |

### Query parameters — `GET /vets`

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `int` | `1` | Page number (1-based). |
| `size` | `int` | `5` | Page size. |

The response is a `Vets` wrapper object with fields `vetList`, `currentPage`, `totalPages`, and `totalItems`.

List responses (`/vets.html` and `GET /vets`) are cached (cache name: `vets`). `GET /vets/{vetId}` is not cached. When the vet ID does not exist, `GET /vets/{vetId}` returns HTTP 404 with message `Vet not found with id: {vetId}`.

## System endpoints

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| `GET` | `/` | `WelcomeController` | Welcome page |
| `GET` | `/oups` | `CrashController` | Throws a runtime exception to demonstrate error handling |

## Form binding security

`OwnerController`, `PetController`, and `VisitController` each call `WebDataBinder.setDisallowedFields("id", "*.id")` in their `@InitBinder` method. This prevents form submissions from setting entity ID fields directly.

## See also

- [Architecture](../concepts/architecture) — request flow and controller internals
- [Domain model reference](./domain-model) — entity fields and validation rules
