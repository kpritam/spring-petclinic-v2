---
sidebar_position: 50
sidebar_label: Change language
---

# Change language

PetClinic supports 9 languages. Append `?lang=<code>` to any URL to switch.

## Supported languages

| Language | Code |
|----------|------|
| English (default) | `en` |
| German | `de` |
| Spanish | `es` |
| Persian (Farsi) | `fa` |
| Hindi | `hi` |
| Korean | `ko` |
| Portuguese | `pt` |
| Russian | `ru` |
| Turkish | `tr` |

## Switch language

Add `?lang=<code>` to any page URL:

```
http://localhost:8080/?lang=de
http://localhost:8080/owners/find?lang=es
http://localhost:8080/vets.html?lang=ko
```

The selection persists for the browser session via `SessionLocaleResolver` (configured in `WebConfiguration`). All subsequent requests in the same session use the chosen language until you change it again or the session ends.

## How it works

`WebConfiguration` registers two Spring MVC beans:

- **`SessionLocaleResolver`** — stores the active locale in the HTTP session, defaulting to `Locale.ENGLISH`.
- **`LocaleChangeInterceptor`** — intercepts every request, reads the `lang` query parameter, and updates the session locale.

Thymeleaf templates reference message keys with `#{key}` (for example, `#{findOwners}`). Spring resolves each key against `src/main/resources/messages/messages_{locale}.properties`, falling back to `messages.properties` when a key is missing in the locale file.

## Translation completeness

`I18nPropertiesSyncTest` runs as part of `./mvnw -B verify` and fails the build if any message key in `messages.properties` is absent from a locale file or if any Thymeleaf template contains hardcoded strings instead of message keys.

## See also

- [Architecture](../concepts/architecture) — i18n subsystem design and `WebConfiguration` role
- [Getting started](../getting-started) — run the application
- [Configuration reference](../reference/configuration) — `spring.messages.basename` property
