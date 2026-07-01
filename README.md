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
- Video player supporting MP4 and YouTube IDs/URLs

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
npm run build
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — hero, stats, search, topic library |
| `/topics/[slug]` | Topic page — video, words, flashcards, quiz |
| `/review` | Daily review — spaced-repetition due queue |
| `/favorites` | Favorites — saved words and lists |

## Data

13 categories, 100 topics, 1,000 vocabulary words in `src/data/topics.json`.

## Video integration

Each topic has a `videoPath` field. Pass a YouTube ID, YouTube URL, or `.mp4` URL and the VideoPlayer component handles it automatically. A placeholder is shown when no valid video source is detected.

## Progress

All progress is stored in `localStorage` under `learn-10-mandarin-progress-v1`. Use the Export/Import buttons on the home page to back up or restore your data.

## Architecture note

`src/lib/types.ts` exports a `CloudSyncProvider` interface for future optional cloud sync — no implementation required to run the app.
