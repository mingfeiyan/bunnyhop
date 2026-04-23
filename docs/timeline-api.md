# Bunnyhop Timeline API

Structured API for submitting confirmed travel bookings to a Bunnyhop trip. Supports flights, hotels, Airbnb / VRBO rentals, cruises, restaurants, and confirmed activity bookings. Designed for AI agents that already have structured booking data (from email, calendar, travel systems, etc.) — skips the free-text parsing layer for speed and accuracy.

If your agent only has unstructured text, use the free-text endpoint instead (see "Fallback" at the bottom).

---

## Endpoint

```
POST https://bunnyhop-beta.vercel.app/api/trips/by-code/{INVITE_CODE}/timeline-events
Content-Type: application/json
```

Replace `{INVITE_CODE}` with the invite code from the user's trip. The user can find it in their Bunnyhop invite link:

```
https://bunnyhop-beta.vercel.app/invite/{INVITE_CODE}
                                          ^^^^^^^^^^^^^ the invite code
```

The invite code IS the auth — no bearer token or API key required. Ask the user to share the trip invite link if you don't already have the code.

---

## Request body

Send a **single event object** or an **array of event objects**. Batching multiple events in one request is faster than one POST per booking.

### Event schema

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | `"flight"` \| `"hotel"` \| `"airbnb"` \| `"cruise"` \| `"restaurant"` \| `"activity"` | yes | The kind of booking. See type guide below. |
| `title` | string | yes | Short human-readable label displayed on the timeline card. Examples: `"United UA115 SFO → PPT"`, `"Conrad Bora Bora"`, `"Disney 5-Night Bahamian"`. |
| `start_date` | string | yes | ISO `YYYY-MM-DD`. Flight: departure date. Hotel/Airbnb/Cruise: check-in / embark. Activity/Restaurant: date. |
| `end_date` | string | no | ISO `YYYY-MM-DD`. Flight: arrival date (only if different from `start_date`, e.g. red-eye). Hotel/Airbnb/Cruise: check-out / debark. |
| `start_time` | string | no | 24-hour `HH:MM` (e.g. `"13:25"`, not `"1:25 PM"`). Flight: departure time. Activity/Restaurant: start time. |
| `end_time` | string | no | 24-hour `HH:MM`. Flight: arrival time. Activity/Restaurant: end time. |
| `origin` | string | flights only | IATA airport code, e.g. `"SFO"`. |
| `destination` | string | flights only | IATA airport code, e.g. `"PPT"`. |
| `reference` | string | no | Flight number, confirmation code, or anything useful to display. |
| `details` | object | no | Free-form JSON for extra context. **For all stays (hotel/airbnb/cruise), always include `details.address`** — it's used to auto-fill the trip's destination via the city-extraction heuristic. Other useful fields: `name`, `host`, `platform`, `cruise_line`, `confirmation`, `room_type`, `guests`, etc. |
| `status` | `"planned"` \| `"visited"` \| `"skipped"` | no | Defaults to `"planned"`. Use `"visited"` when logging something that already happened, `"skipped"` for entries the group decided to drop. |
| `card_id` | string (UUID) | no | Link the event to a swipe card from this trip. Get the `id` from `/summary` `results[].id`. The card must belong to the same trip or the request is rejected. |
| `google_place_id` | string | no | Fallback linker — resolved to `card_id` server-side by exact match against `cards.metadata.google_place_id`. Ignored if zero or more than one card matches (never fuzzy). Only consulted when `card_id` is not supplied. |

**Matching precedence for card linking:** `card_id` (explicit) → `google_place_id` (resolved to a single exact match) → neither (event is stored with `card_id = null`).

### Type guide

| Type | Use for | Phase rendering | Notes |
|---|---|---|---|
| `flight` | Any airline ticket. | One position at `start_date`. | Round-trip = two separate entries (outbound + return). |
| `hotel` | Traditional hotels and resorts. | Two positions: check-in at `start_date`, check-out at `end_date`. | Always include `details.address`. |
| `airbnb` | Airbnb or VRBO vacation rentals. | Same as hotel — check-in / check-out. | Set `details.platform: "Airbnb"` to lock the type. Same shape as hotel; type controls the kicker label. |
| `cruise` | Cruise bookings. | Two positions: board at `start_date`, debark at `end_date`. | `details.address` should be the embark port (e.g. `"Port Everglades, Fort Lauderdale, FL"`) so the trip destination auto-fills correctly. Optional: `details.cruise_line`, `details.ship_name`. |
| `restaurant` | Restaurants — planned reservations or spontaneous visits. | One position at `start_date`. | Use `status: "planned"` for upcoming reservations, `status: "visited"` to log a meal the group already ate. Link to a swipe card via `card_id` when one exists. |
| `activity` | Confirmed activity bookings (tours, museum tickets, excursions) with a specific date. | One position at `start_date`. | Skip vague wishes ("we want to go snorkeling") — only real bookings with a date. Use `restaurant` for meals. |

### Format rules (strict)

- **Dates must be `YYYY-MM-DD`.** `"2026-06-27"` ✅. `"June 27 2026"` ❌. `"06/27/2026"` ❌.
- **Times must be `HH:MM` 24-hour.** `"13:25"` ✅. `"1:25 PM"` ❌. `"13:25:00"` ❌.
- **Round-trip flights = two separate entries.** Do not combine outbound and return into one record.
- **Only confirmed bookings.** Skip quotes, holds, waitlists, or anything tentative. Note these in the user's trip hub instead via the free-text endpoint.
- **One stay = one entry.** Hotel, Airbnb, and cruise all use a single entry with `start_date` (check-in / embark) and `end_date` (check-out / debark). The timeline renders two visual positions automatically.

---

## Examples

### Single flight

```bash
curl -X POST https://bunnyhop-beta.vercel.app/api/trips/by-code/{INVITE_CODE}/timeline-events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "flight",
    "title": "United UA115 SFO → PPT",
    "start_date": "2026-06-27",
    "start_time": "13:25",
    "origin": "SFO",
    "destination": "PPT",
    "reference": "UA115",
    "details": {
      "confirmation": "NYQ55T",
      "cabin": "Polaris Business",
      "passengers": ["Mingfei Yan", "Yue Ning", "Jasper Yan"]
    }
  }'
```

### Round trip + hotel (batched)

Submit the full trip in one request. Note the round-trip is two separate flight entries.

```bash
curl -X POST https://bunnyhop-beta.vercel.app/api/trips/by-code/{INVITE_CODE}/timeline-events \
  -H "Content-Type: application/json" \
  -d '[
    {
      "type": "flight",
      "title": "United UA115 SFO → PPT",
      "start_date": "2026-06-27",
      "start_time": "13:25",
      "origin": "SFO",
      "destination": "PPT",
      "reference": "UA115",
      "details": {"confirmation": "NYQ55T", "cabin": "Polaris Business"}
    },
    {
      "type": "flight",
      "title": "United UA114 PPT → SFO",
      "start_date": "2026-07-05",
      "end_date": "2026-07-06",
      "start_time": "21:10",
      "end_time": "08:15",
      "origin": "PPT",
      "destination": "SFO",
      "reference": "UA114",
      "details": {"confirmation": "NYQ55T", "cabin": "Polaris Business"}
    },
    {
      "type": "hotel",
      "title": "Conrad Bora Bora",
      "start_date": "2026-06-28",
      "end_date": "2026-07-04",
      "reference": "CONF-ABC123",
      "details": {"room_type": "Overwater Villa", "guests": 3}
    }
  ]'
```

### Overnight flight (arrival next day)

When a flight arrives the day after it departs (red-eyes, long-haul with big time zone shifts), set both `start_date` and `end_date`:

```json
{
  "type": "flight",
  "title": "United UA114 PPT → SFO",
  "start_date": "2026-07-05",
  "end_date": "2026-07-06",
  "start_time": "21:10",
  "end_time": "08:15",
  "origin": "PPT",
  "destination": "SFO",
  "reference": "UA114"
}
```

### Airbnb / VRBO rental

```json
{
  "type": "airbnb",
  "title": "Scenic Retreat w/ River Views & Private Suite",
  "start_date": "2026-08-26",
  "end_date": "2026-08-30",
  "details": {
    "name": "Scenic Retreat w/ River Views & Private Suite",
    "address": "1631 Bellerive Ln, Coeur d'Alene, ID 83814, USA",
    "platform": "Airbnb",
    "host": "Joshua",
    "confirmation": "HMT45H5C3H",
    "guests": "6 adults, 3 children"
  }
}
```

The `details.address` is what powers the trip's destination auto-fill — the city is extracted via a robust parser that handles country suffixes, merged "City STATE zip" forms, and international addresses.

### Cruise

```json
{
  "type": "cruise",
  "title": "Disney Cruise — 5-Night Very Merrytime Bahamian",
  "start_date": "2026-11-25",
  "end_date": "2026-11-30",
  "details": {
    "name": "Disney Cruise — 5-Night Very Merrytime Bahamian",
    "address": "Port Everglades, Fort Lauderdale, FL",
    "cruise_line": "Disney Cruise Line",
    "ship_name": "Disney Magic",
    "embark_port": "Fort Lauderdale (Port Everglades)",
    "confirmation": "42559440"
  }
}
```

`address` should be the embark port — the city portion is what fills in the trip's destination.

### Activity (a confirmed booking with a date)

```json
{
  "type": "activity",
  "title": "Sunset catamaran cruise — Vaitape Harbor",
  "start_date": "2026-06-28",
  "start_time": "17:00",
  "end_time": "19:30",
  "reference": "CRUISE-789",
  "details": {
    "name": "Sunset Catamaran Cruise",
    "location": "Vaitape Harbor",
    "organizer": "Bora Bora Adventures",
    "guests": 4
  }
}
```

### Restaurant linked to a swipe card

Commit a card the group voted on into the itinerary. Pull the `id` from `/summary` `results[].id`:

```json
{
  "type": "restaurant",
  "title": "Joe's Pizza",
  "start_date": "2026-04-23",
  "start_time": "19:00",
  "card_id": "c6f4f0b2-3c5e-4c8a-9f4f-1a6d4b9d1e11",
  "status": "planned"
}
```

### Restaurant matched by Google place id

When you don't have the `card_id` but you do have a Google place id (e.g. from a Places search), let the server resolve it. It only links when exactly one card has that place id in its `metadata.google_place_id`; otherwise the event is stored unlinked.

```json
{
  "type": "restaurant",
  "title": "Joe's Pizza",
  "start_date": "2026-04-23",
  "google_place_id": "ChIJifIePKtZwokRVZ-UdRGkZzs",
  "status": "planned"
}
```

### Spontaneous restaurant visit (no card)

Log a meal that already happened with no prior swipe card:

```json
{
  "type": "restaurant",
  "title": "Noodle House on 5th",
  "start_date": "2026-04-22",
  "status": "visited"
}
```

---

## Responses

### Success (200 OK)

Returns an array of the inserted rows (even when you submit a single event):

```json
[
  {
    "id": "abc-123-...",
    "trip_id": "def-456-...",
    "type": "flight",
    "title": "United UA115 SFO → PPT",
    "start_date": "2026-06-27",
    "start_time": "13:25",
    "end_time": null,
    "origin": "SFO",
    "destination": "PPT",
    "reference": "UA115",
    "details": {"confirmation": "NYQ55T"},
    "source": "agent",
    "status": "planned",
    "card_id": null,
    "created_at": "2026-04-10T22:56:19Z"
  }
]
```

### Validation errors (400)

```json
{"error": "event[0]: start_date is required in YYYY-MM-DD format"}
```

Common validation errors and how to fix them:

| Error | Fix |
|---|---|
| `type must be one of: flight, hotel, activity, airbnb, cruise, restaurant` | Use one of the six supported types. |
| `title is required` | Include a non-empty `title` field. |
| `start_date is required in YYYY-MM-DD format` | Use ISO date format. Reject or reformat any other date style before calling. |
| `end_date must be YYYY-MM-DD format if provided` | Same as above. Omit the field entirely if you don't have an end date. |
| `start_time must be HH:MM 24-hour format if provided` | Convert `"1:25 PM"` → `"13:25"` before sending. Omit if unknown. |
| `end_time must be HH:MM 24-hour format if provided` | Same. |
| `status must be one of: planned, visited, skipped` | Use one of the three allowed values, or omit the field to default to `planned`. |
| `card_id must be a string if provided` | Pass the card UUID from `/summary` `results[].id`, or omit. |
| `card_id <id> does not belong to this trip` | The card is from a different trip. Re-read `/summary` for the correct `id`. |

### Invalid invite code (404)

```json
{"error": "Invalid invite code"}
```

Double-check the code with the user. The invite code is the last path segment of the `/invite/...` link.

### Server error (500)

```json
{"error": "timeline_events insert failed: <pg error message>"}
```

Usually indicates a schema or database issue. Retry once; if it persists, fall back to the free-text endpoint or ask the user.

---

## Best practices

1. **Batch aggressively.** If you find 5 bookings in one pass, send them in one array. Faster and atomic.
2. **Normalize before sending.** Do all the date/time reformatting on your side — the API rejects anything non-ISO.
3. **Keep `title` short.** It's rendered as a single line on mobile. Long airline names + route is fine (`"United UA115 SFO → PPT"`), but avoid full fare details.
4. **Use `details` liberally.** It's untyped JSON — store anything contextual the user might care about (seats, fare, confirmation codes, notes).
5. **Don't submit duplicates.** The API does not deduplicate. If you're unsure whether a booking was already submitted, ask the user first or check via a GET.
6. **Split round trips.** Outbound and return are two separate entries. Do not combine.
7. **Skip quotes and holds.** Only confirmed bookings belong on the timeline. If the user has a pending reservation, use the free-text endpoint or surface it as a note in the trip hub.
8. **Time zones:** `start_time` / `end_time` are raw HH:MM values. They are displayed in the trip's destination timezone on the timeline page. Don't pre-convert to UTC.

---

## Fallback: free-text endpoint

If your agent only has unstructured text (e.g., a forwarded email blob), POST to the free-text endpoint instead. Claude parses the text and splits it into structured entries automatically. Slower and less reliable than the structured endpoint, but tolerant of messy input.

```
POST https://bunnyhop-beta.vercel.app/api/trips/by-code/{INVITE_CODE}/context
Content-Type: application/json

{"text": "Confirmed: United Airlines flight UA115 from SFO to Papeete (PPT) on June 27 2026, departing 1:25 PM. Round trip return UA114 on July 5 at 9:10 PM. Conrad Bora Bora June 28 to July 4."}
```

Prefer the structured endpoint whenever you have field-level data.

---

## Updating an event (PATCH)

Use PATCH to change the `status` of an existing timeline event, or to adjust its date/time/details. Get the event `id` from `/summary` `timeline[].id`.

```
PATCH https://bunnyhop-beta.vercel.app/api/trips/by-code/{INVITE_CODE}/timeline-events/{EVENT_ID}
Content-Type: application/json
```

An authenticated equivalent exists at `/api/trips/{TRIP_ID}/timeline-events/{EVENT_ID}` for in-app clients — same request shape.

### Mutable fields

Only these fields are accepted; anything else in the body is silently ignored:

| Field | Notes |
|---|---|
| `status` | `"planned"` \| `"visited"` \| `"skipped"`. |
| `start_date`, `end_date` | ISO `YYYY-MM-DD`. |
| `start_time`, `end_time` | 24-hour `HH:MM`. |
| `details` | Free-form object — replaces the existing object, not merged. |

`type`, `title`, `card_id`, `origin`, `destination`, and `reference` are immutable via PATCH. To change those, delete the entry and re-POST.

### Example: mark a planned entry as visited

```bash
curl -X PATCH https://bunnyhop-beta.vercel.app/api/trips/by-code/{INVITE_CODE}/timeline-events/{EVENT_ID} \
  -H "Content-Type: application/json" \
  -d '{"status": "visited"}'
```

### Responses

- **200 OK** — returns the single updated row (same shape as POST success, minus the array wrapper).
- **400** — `no mutable fields provided`, or a validation error on `status` / dates / times.
- **404** — invalid invite code, or event id does not exist on this trip.

---

## Deletion

The API does not currently support deletes via structured calls. To drop a wrong booking:

1. User deletes the bad entry from the timeline page UI (each card has a Delete button for the creator and trip organizer).
2. Your agent re-submits the corrected version via POST.

PATCH covers in-place edits (status, dates, times, details). For type/title changes, use the delete-and-repost flow above.
