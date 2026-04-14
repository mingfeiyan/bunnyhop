# Bunnyhop Agent Guide

You are an AI agent helping plan a group trip using Bunnyhop, a collaborative trip-planning app. This guide teaches you how to read and write trip data via the API.

## Authentication

Each **(trip, family)** pair has its own **invite code** (8-character hex string). The invite code is the only auth you need — no API keys, no OAuth, no headers. Just include it in the URL path.

Codes are per-family so that every post is correctly attributed to the family that submitted it. If you act on behalf of Ryan's Family, you use Ryan's Family code on that trip; Yan Family's agent on the same trip uses a different code. Posts you submit appear on the timeline under your family's name and color.

**Your human sends you the code.** The trip organizer sees every invited family's code on the trip page and shares each family's code with that family. Do not use a code you were given for a different family — timeline attribution would end up wrong and your human would have to ask the admin to fix it.

Your invite codes (fill in when you're given access to a trip):
```
TRIP_NAME (YOUR_FAMILY): INVITE_CODE
```

Base URL: `https://bunnyhop-beta.vercel.app`

## Reading: GET the trip summary

To understand the current state of a trip — what's booked, what the group wants, what constraints exist:

```bash
curl https://bunnyhop-beta.vercel.app/api/trips/by-code/<CODE>/summary
```

Returns:
- **trip**: title, destination, dates, timezone, list of participants
- **timeline**: all confirmed bookings (flights, hotels, airbnbs, cruises, activities) sorted by date
- **context**: notes and constraints from the group (e.g., "traveling with kids aged 6-8", "avoid water activities", "easy schedule preferred")
- **results**: every AI-generated recommendation card with its group consensus (`everyone_loves` / `mixed` / `hard_pass`), numeric score, and vote count
- **families**: who's in which family group, including other agents

**Always read the summary before writing.** Understand what's already booked, what the group voted for, and what constraints they've set.

## Writing: POST bookings to the timeline

When you find a confirmed booking (from email, calendar, or user request), POST it:

```bash
curl -X POST https://bunnyhop-beta.vercel.app/api/trips/by-code/<CODE>/timeline-events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "flight",
    "title": "United UA115 SFO → PPT",
    "start_date": "2026-06-27",
    "start_time": "13:25",
    "end_time": "21:30",
    "origin": "SFO",
    "destination": "PPT",
    "reference": "UA115",
    "details": { "confirmation": "NYQ55T", "cabin": "Business" }
  }'
```

### Event types

| Type | Use for | Key fields |
|---|---|---|
| `flight` | Airline tickets | `start_date`, `origin`, `destination`, `start_time`, `end_time`, `reference` |
| `hotel` | Hotels and resorts | `start_date` (check-in), `end_date` (check-out), `details.address` |
| `airbnb` | Airbnb / VRBO rentals | Same as hotel. Set `details.platform: "Airbnb"` |
| `cruise` | Cruise bookings | `start_date` (embark), `end_date` (debark), `details.address` (port), `details.cruise_line` |
| `activity` | Confirmed bookings with a date | `start_date`, `start_time`, `end_time`, `details.location` |

### Rules
- Dates: `YYYY-MM-DD` only (`2026-06-27`, not `June 27`)
- Times: `HH:MM` 24-hour only (`13:25`, not `1:25 PM`)
- Round-trip flights = TWO separate entries
- **Always include `details.address` on stays** — it auto-fills the trip's destination
- Only submit confirmed bookings, not tentative ones
- You can POST a single object or an array for batch submission

## Writing: POST free-text context

If you have unstructured booking text (e.g., a forwarded email blob), send it to be AI-parsed:

```bash
curl -X POST https://bunnyhop-beta.vercel.app/api/trips/by-code/<CODE>/context \
  -H "Content-Type: application/json" \
  -d '{"text": "Confirmed: United flight UA115 from SFO to PPT on June 27 2026, departing 1:25 PM."}'
```

Claude parses the text and routes it: flights/hotels/activities go to the timeline, notes/constraints go to the trip context. Prefer the structured `/timeline-events` endpoint when you have field-level data.

## Planning workflow

When asked to help plan a trip:

1. **Read first.** GET the summary. Understand:
   - What dates are confirmed (timeline)
   - What the group likes (results with `everyone_loves`)
   - What constraints exist (context — kid-friendly? budget? dietary?)
   - Which days have gaps in the schedule

2. **Respect the group.** The consensus scores tell you what the group voted for:
   - `everyone_loves` (score = number of voters) → definitely include these
   - `mixed` → suggest but flag as debatable
   - `hard_pass` → avoid anything similar

3. **Fill gaps.** Look at the timeline for days without activities. Suggest restaurants for meal gaps, activities for free afternoons. Post suggestions to the timeline.

4. **Honor constraints.** The context entries contain rules like "no water activities", "kid-friendly only", "vegetarian restaurants". Always check these before suggesting.

5. **Coordinate across families.** The families section shows who's traveling. If both Yan Family and Ryan's Family are on the trip, suggestions should work for both groups.

6. **Batch when possible.** If you have multiple bookings to post, send them as an array in one request. Faster and atomic.

## What NOT to do

- Don't post tentative/unconfirmed bookings — only real reservations
- Don't duplicate existing timeline events — read the summary first
- Don't ignore constraints — the group set them for a reason
- Don't suggest things the group voted `hard_pass` on
- Don't create new trips — only post to trips you have invite codes for
- Don't reuse another family's code. If you were given a code but it represents the wrong family, stop and ask your human to get the right one from the trip organizer.
