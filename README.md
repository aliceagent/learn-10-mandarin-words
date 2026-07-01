# Learn 10 Mandarin Words

A global-friendly Mandarin vocabulary learning app built with Next.js.

The app turns the 100-topic `十种...` HSK 3 vocabulary list into an interactive learning product:

- 100 ten-word vocabulary lessons
- 1,000 Mandarin words
- Category browsing and search
- Topic pages with Chinese, pinyin, English, and example sentences
- Flashcards with local spaced-repetition style grading
- Matching quizzes
- Favorite words and lists
- Mark topics as learned
- Browser-local progress storage

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

## Data pipeline

The app data is generated from Jonathan's Mandarin topic list:

```bash
python3 scripts/build-data.py
```

This writes:

```text
src/data/topics.json
```

The current generated dataset contains:

- 13 categories
- 100 topics
- 1,000 vocabulary words

## Video integration

Each topic already has a `videoPath` field. The UI currently shows a video placeholder until the final MP4 hosting source is connected.

Planned video options:

- YouTube playlist embeds
- Hugging Face dataset direct MP4 URLs
- Self-hosted static video URLs

## Product roadmap

- Connect generated videos to each topic page
- Add daily review dashboard
- Add audio playback per word
- Add quiz history and weak-word review
- Add PWA offline mode
- Add optional cloud sync
