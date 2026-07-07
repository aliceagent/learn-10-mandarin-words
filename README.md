# Learn 10 Mandarin Words

A global-friendly Mandarin vocabulary learning app built with Next.js.

The app turns the 100-topic `十种...` vocabulary list into an interactive learning product:

- 100 ten-word vocabulary lessons
- 1,000 Mandarin words with pinyin and English
- Category browsing, search with diacritic-tolerant pinyin matching
- Topic pages with Chinese, pinyin, English, and example sentences
- Flashcards with spaced-repetition grading
- Three quiz modes: Hanzi→English, English→Hanzi, Hanzi→Pinyin
- Pinyin always shown in quiz prompts
- Favorite words and lists
- Mark topics as learned
- Browser-local progress with export/import JSON backup
- Streak tracker and per-topic progress indicators
- Daily review queue using spaced-repetition due dates
- Audio pronunciation via browser TTS (zh-CN speechSynthesis)
- Mobile swipe gestures on flashcards
- Mobile bottom navigation (Home / Review / Favorites)
- Favorites consolidated view
- Video player supporting YouTube IDs/URLs and remote MP4s, with an intentional "coming soon" placeholder until videos are connected
- First-run onboarding with a daily-goal preference and a recommended starter path
- "Continue learning / Start here" home CTA that points to the next recommended lesson
- Installable PWA with an offline app shell (service worker + web manifest)
- Privacy-first, local-only analytics that is disabled by default

## Tech stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- Static JSON data
- Browser localStorage for progress

## Run locally

```bash
npm install
npm run dev
```

Open:

```text
http://localhost:3000
```

## Build

```bash
npm run lint
npm run build          # runs data validation first (prebuild), then next build
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the dev server |
| `npm run build` | Validate data, then build for production |
| `npm run start` | Serve the production build |
| `npm run lint` | Run ESLint |
| `npm run validate:data` | Validate `src/data/topics.json` (add `--strict` to fail on warnings) |
| `npm run map:videos [file]` | Map real videos into topics (see "Video integration") |

## Data validation

`npm run validate:data` checks `src/data/topics.json` and reports **errors** (exit 1)
and **warnings** (exit 0). It runs automatically before every build via `prebuild`.

It verifies: exactly 102 topics with 10 items each; required topic/item fields are
present and non-empty; unique topic slugs, category slugs, and per-topic hanzi;
category ↔ topic cross-references are consistent; pinyin shape and tone marks
(warns on missing tone marks / stray characters); pinyin syllable count matches
hanzi character count (warning; blocking under `validate:quality`); each item has
a non-empty `sentences` array with `cn`/`en`; example sentences contain the
target hanzi (warning); and each `videoPath` is a `/videos/*.mp4` path, YouTube
id, or URL.

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, stats, "continue learning" CTA, search, topic library |
| `/topics/[slug]` | Topic page — video, words, flashcards, quiz |
| `/review` | Daily review — spaced-repetition due queue |
| `/favorites` | Favorites — saved words and lists |
| `/privacy` | Privacy — what is stored and how analytics works |
| `/offline` | Offline fallback shown by the service worker |

## Data

14 categories, 102 topics, 1,020 vocabulary words in `src/data/topics.json`.

## Video integration

Each topic has a `videoPath` field. Pass a YouTube ID, YouTube URL, or `.mp4` URL
and the VideoPlayer component handles it automatically. A placeholder is shown
when no valid video source is detected. Topics ship with local
`/videos/<slug>.mp4` placeholder paths; the player treats a bare local path as a
"coming soon" placeholder until a real video is connected.

### Mapping real videos

Use `npm run map:videos` to write video metadata onto topics from a JSON map
keyed by topic slug. Copy `scripts/videos.example.json` to `video-map.json`
(gitignored) and fill in **real** sources. A value can be:

- a **YouTube** id or URL — `"dQw4w9WgXcQ"` or `"https://youtu.be/dQw4w9WgXcQ"`
- a **remote MP4** URL — `"https://cdn.example.com/clip.mp4"`
- a **local MP4** — `{ "provider": "mp4", "source": "/videos/<slug>.mp4" }`
- a full object — `{ provider, source, poster?, captions? }`

**Dry run first.** Preview exactly what would change without touching
`topics.json`:

```bash
npm run map:videos -- --dry-run          # uses video-map.json
npm run map:videos path/to/map.json -- --dry-run
```

**Local files.** A `{ "provider": "mp4", "source": "/videos/<slug>.mp4" }` entry
is applied only if the file exists under `public/videos/`. If the file is
missing it is **warned about and skipped** — a broken local path is never
written. Drop your generated MP4s in `public/videos/` first, then run the mapper.

Applying the map (no `--dry-run`) writes a `video` metadata object onto each
matched topic and keeps `videoPath` in sync. Re-run `npm run validate:data`
afterwards.

`validate:data` also checks that any mapped local `/videos/*.mp4` source has a
real file under `public/videos/` — this is a **warning** (so CI stays green when
the MP4s aren't committed) unless you pass `--strict`.

## Progress

All progress is stored in `localStorage` under `learn-10-mandarin-progress-v1`. Use the Export/Import buttons on the home page to back up or restore your data.

## Architecture note

`src/lib/types.ts` exports a `CloudSyncProvider` interface for future optional cloud sync — no implementation required to run the app.
