---
sidebar_position: 60
sidebar_label: HTTP Routes
---

# HTTP Routes

All routes are derived from `@GetMapping` and `@PostMapping` annotations in the five controllers.

## Route table

| Method | Path | Controller | Handler method | Response |
|--------|------|------------|----------------|----------|
| `GET` | `/` | `WelcomeController` | `welcome` | Thymeleaf `welcome.html` |
| `GET` | `/owners/find` | `OwnerController` | `initFindForm` | Thymeleaf `owners/findOwners.html` |
| `GET` | `/owners` | `OwnerController` | `processFindForm` | `owners/ownersList.html` or redirect to `/owners/{id}` if exactly one match |
| `GET` | `/owners/new` | `OwnerController` | `initCreationForm` | Thymeleaf `owners/createOrUpdateOwnerForm.html` |
| `POST` | `/owners/new` | `OwnerController` | `processCreationForm` | Redirect to `/owners/{id}` on success |
| `GET` | `/owners/{ownerId}` | `OwnerController` | `showOwner` | Thymeleaf `owners/ownerDetails.html` |
| `GET` | `/owners/{ownerId}/edit` | `OwnerController` | `initUpdateOwnerForm` | Thymeleaf `owners/createOrUpdateOwnerForm.html` |
| `POST` | `/owners/{ownerId}/edit` | `OwnerController` | `processUpdateOwnerForm` | Redirect to `/owners/{ownerId}` on success |
| `GET` | `/owners/{ownerId}/pets/new` | `PetController` | `initCreationForm` | Thymeleaf `pets/createOrUpdatePetForm.html` |
| `POST` | `/owners/{ownerId}/pets/new` | `PetController` | `processCreationForm` | Redirect to `/owners/{ownerId}` on success |
| `GET` | `/owners/{ownerId}/pets/{petId}/edit` | `PetController` | `initUpdateForm` | Thymeleaf `pets/createOrUpdatePetForm.html` |
| `POST` | `/owners/{ownerId}/pets/{petId}/edit` | `PetController` | `processUpdateForm` | Redirect to `/owners/{ownerId}` on success |
| `GET` | `/owners/{ownerId}/pets/{petId}/visits/new` | `VisitController` | `initNewVisitForm` | Thymeleaf `pets/createOrUpdateVisitForm.html` |
| `POST` | `/owners/{ownerId}/pets/{petId}/visits/new` | `VisitController` | `processNewVisitForm` | Redirect to `/owners/{ownerId}` on success |
| `GET` | `/vets.html` | `VetController` | `showVetList` | Thymeleaf `vets/vetList.html` |
| `GET` | `/vets` | `VetController` | `showResourcesVetList` | JSON (`Vets` wrapper object) |
| `GET` | `/oups` | `CrashController` | `triggerException` | Error page (throws `RuntimeException`) |

## Notes

### `/owners` pagination

`GET /owners` accepts a `page` query parameter (1-indexed, default `1`). Page size is 5, hardcoded in `OwnerController.findPaginatedForOwnersLastName`. Filter by last-name prefix with the `lastName` form field.

### `/vets.html` pagination

`GET /vets.html` accepts a `page` query parameter (1-indexed, default `1`). Page size is 5, hardcoded in `VetController.findPaginated`.

### `/vets` vs `/vets.html`

Same controller, two mappings. `/vets.html` renders the Thymeleaf list view. `/vets` returns JSON — the handler is annotated `@ResponseBody` and returns a `Vets` object (a wrapper around `List<Vet>`) that Jackson serialises. The `/vets` JSON endpoint uses the cached `VetRepository.findAll()` (no pagination).

### Language switching

All `GET` routes accept a `?lang={code}` parameter. `LocaleChangeInterceptor` (registered in `WebConfiguration`) intercepts every request and updates the session locale if the parameter is present. Supported codes: `en`, `de`, `es`, `fa`, `hi`, `ja`, `ko`, `pt`, `ru`, `tr`.

### `/oups`

`CrashController.triggerException` throws `RuntimeException` unconditionally. The route exists to demonstrate Spring Boot's default error page (`src/main/resources/templates/error.html`).

## See also

- [Request Flow and Spring MVC Patterns](../concepts/request-flow) — how controllers process requests
- [Domain Model](../concepts/domain-model) — entities behind these routes
