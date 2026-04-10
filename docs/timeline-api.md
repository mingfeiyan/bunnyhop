# Bunnyhop Timeline API

Structured API for submitting confirmed flight and hotel bookings to a Bunnyhop trip. Designed for AI agents that already have structured booking data (from email, calendar, travel systems, etc.) — skips the free-text parsing layer for speed and accuracy.

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
| `type` | `"flight"` \| `"hotel"` | yes | The kind of booking. Other types (activities, transfers) are not yet supported. |
| `title` | string | yes | Short human-readable label displayed on the timeline card. Examples: `"United UA115 SFO → PPT"`, `"Conrad Bora Bora"`. |
| `start_date` | string | yes | ISO `YYYY-MM-DD`. For flights: departure date. For hotels: check-in date. |
| `end_date` | string | no | ISO `YYYY-MM-DD`. For flights: arrival date (only if different from `start_date`, e.g. red-eye or international). For hotels: check-out date. |
| `start_time` | string | no | 24-hour `HH:MM` (e.g. `"13:25"`, not `"1:25 PM"`). For flights: departure time. For hotels: check-in time. |
| `end_time` | string | no | 24-hour `HH:MM`. For flights: arrival time. For hotels: check-out time. |
| `origin` | string | flights only | IATA airport code, e.g. `"SFO"`. |
| `destination` | string | flights only | IATA airport code, e.g. `"PPT"`. |
| `reference` | string | no | Flight number, confirmation code, or anything useful to display. |
| `details` | object | no | Free-form JSON for extra context: confirmation codes, cabin class, seats, fare, passenger names, hotel address, room type, etc. Not indexed or parsed — purely for display. |

### Format rules (strict)

- **Dates must be `YYYY-MM-DD`.** `"2026-06-27"` ✅. `"June 27 2026"` ❌. `"06/27/2026"` ❌.
- **Times must be `HH:MM` 24-hour.** `"13:25"` ✅. `"1:25 PM"` ❌. `"13:25:00"` ❌.
- **Round-trip flights = two separate entries.** Do not combine outbound and return into one record.
- **Only confirmed bookings.** Skip quotes, holds, waitlists, or anything tentative. Note these in the user's trip hub instead via the free-text endpoint.
- **One hotel = one entry.** Use `start_date` for check-in and `end_date` for check-out. The timeline will render two visual cards (check-in and check-out) automatically.

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
| `type must be "flight" or "hotel"` | Use one of the two supported types. Other categories aren't available yet. |
| `title is required` | Include a non-empty `title` field. |
| `start_date is required in YYYY-MM-DD format` | Use ISO date format. Reject or reformat any other date style before calling. |
| `end_date must be YYYY-MM-DD format if provided` | Same as above. Omit the field entirely if you don't have an end date. |
| `start_time must be HH:MM 24-hour format if provided` | Convert `"1:25 PM"` → `"13:25"` before sending. Omit if unknown. |
| `end_time must be HH:MM 24-hour format if provided` | Same. |

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

## Deletion and corrections

The API does not currently support updates or deletes via structured calls. To correct a wrong booking:

1. User deletes the bad entry from the timeline page UI (each card has a Delete button for the creator and trip organizer).
2. Your agent re-submits the corrected version via this API.

This is intentional — it keeps the API narrow and avoids needing to track stable IDs across submissions.
