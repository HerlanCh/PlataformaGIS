# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** people moving through La Paz and El Alto on foot, in minibuses, trufis, teleférico or their own car, holding a phone, often outdoors and in motion. Their job is to learn what is blocking or endangering their route right now, and to warn others in two taps when they see an incident.
- **Secondary:** neighbours and commuters who subscribe to an area (home, work, a daily route) to be alerted about incidents there.
- **Moderators:** a small group with the `MODERADOR` role who reject false reports (their tools arrive in a later phase).
- **Researchers and journalists** consume anonymised open data (later phase; not a PWA user today).

## Product Purpose

A community early-warning map of urban incidents in La Paz and El Alto: road blockades and protests, traffic accidents, crime and robbery, damaged infrastructure (landslides, broken roads, leaks) and aggressive dog packs. Reports are created in two taps with automatic location, verified by nearby people ("¿Sigue ahí?"), and expire on their own. Success: a person sees a blockade on their route before reaching it, and a report reaches people looking at that area in under two seconds.

## Positioning

Hyper-local and community-verified for the La Paz / El Alto conurbation only: reports outside the service area are rejected. Trust comes from the crowd's weighted votes (reputation), automatic expiry per category, and privacy by design, not from an authority.

## Operating Context

- Mostly mobile phones, mid and low range, on intermittent mobile data; reports must survive having no signal (offline queue, sent on reconnect).
- Used outdoors, in daylight and at night, often while walking or about to board transport; interactions must be fast and one-handed.
- High altitude, steep city; distances and blockades change route choices quickly.
- Spanish (Bolivia) is the interface language.
- Installable PWA, including iPhone (iOS 16.4+) and Android; push notifications for subscribed areas.

## Capabilities and Constraints

- **Report categories (code: name, initial TTL):** `bloqueo` Bloqueo o protesta vial (6 h) · `accidente` Accidente de tránsito (3 h) · `robo` Hecho delictivo / robo (2 h) · `infraestructura` Derrumbe / vía dañada / fuga (24 h) · `jauria` Jauría de perros agresivos (2 h).
- **Report states:** `ACTIVO`, `CONFIRMADO`, `RESUELTO`, `CADUCADO`, `RECHAZADO`; only `ACTIVO` and `CONFIRMADO` are shown on the live map.
- A report is created with the GPS location and a category only (two taps). Description and photo are deliberately out of scope until moderation exists (Phase 10).
- A new report of the same category near an active one counts as a confirmation of the existing one ("duplicado"); a user's own nearby report is returned instead of a new one.
- Limits: 5 reports and 30 votes per user every 10 minutes; up to 5 subscribed zones of 100 m to 2000 m radius.
- Voting requires being within 1000 m of the incident; the author cannot vote; one vote per report.
- Heatmap cells only appear with 3 or more reports (anonymity threshold).
- Anonymous identity: a device is registered without personal data and receives a token.
- Free tiers only: the API sleeps when idle on Render; OpenStreetMap tiles must respect OSM's usage policy (visible attribution, no bulk prefetch).
- Initial JavaScript budget: under 250 KB compressed; Lighthouse Performance and Accessibility ≥ 90.

## Brand Commitments

- Name: **Alerta La Paz y El Alto**; short name **Alerta LP**.
- Voice: plain, direct Spanish (Bolivia); short sentences; no alarmism and no blame.

## Evidence on Hand

- No logo, photography, testimonials or usage metrics exist yet; none may be invented.
- Real data: the five categories and rules above (`docs/srs.md`), the staging API and its OpenAPI contract (`packages/api-client/openapi.json`).

## Product Principles

1. **Two taps or it does not get reported:** the reporting path must work with one hand, in motion, without typing.
2. **Show what is true now:** only current, verified-or-fresh reports; stale information disappears on its own.
3. **Privacy before detail:** never show a reporter, a real location of a sensitive report, or people.
4. **Works with bad signal:** nothing a user reports is lost to a dropped connection.
5. **Calm urgency:** make danger legible fast without spreading panic.

## Accessibility & Inclusion

WCAG 2.2 AA contrast; touch targets of at least 44 px; ARIA labels; simple language for a broad audience including older adults; usable in bright sunlight; respects `prefers-reduced-motion`.
