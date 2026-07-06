import type { Topic } from "@/lib/types";
import { HANZI_LANG, PINYIN_LANG } from "@/lib/lang";
import { cheatSheetMetaLine, cheatSheetSourceUrl } from "@/lib/print-logic";

// Print-only cheat sheet for a topic (Sprint 19). A SERVER component (no client
// JS): it renders into the static topic page and stays `display:none` on screen
// (`hidden`), appearing only under `@media print` (`print:block`). It duplicates
// the topic's ten words — hanzi, tone-marked pinyin, English — plus each word's
// example sentences (hanzi + English; the Sentence type has no pinyin, so none is
// invented, matching WordsPanel). Colors are print-safe black-on-white utilities,
// never the dark-theme tokens. `aria-hidden` keeps the duplicated content out of
// the screen accessibility tree.
export function TopicCheatSheet({ topic }: { topic: Topic }) {
  return (
    <section className="cheat-sheet hidden print:block text-black" aria-hidden="true">
      <header className="border-b border-neutral-300 pb-2">
        <h2 className="text-2xl font-semibold">
          {topic.titleEn}
          <span lang={HANZI_LANG} className="font-hanzi"> · {topic.titleCn}</span>
        </h2>
        <p className="mt-1 text-sm text-neutral-600">{cheatSheetMetaLine(topic)}</p>
      </header>

      <ol className="mt-4 space-y-3">
        {topic.items.map((item, index) => (
          <li key={item.hanzi} className="break-inside-avoid border-b border-neutral-300 pb-3">
            <div className="flex items-baseline gap-3">
              <span className="text-sm text-neutral-600">{index + 1}.</span>
              <span lang={HANZI_LANG} className="font-hanzi text-3xl font-semibold">{item.hanzi}</span>
              <span lang={PINYIN_LANG} className="font-hanzi text-lg text-neutral-600">{item.pinyin}</span>
              <span className="text-lg font-semibold">{item.english}</span>
            </div>
            {item.sentences.length > 0 ? (
              <ul className="mt-2 space-y-1 pl-8 text-sm">
                {item.sentences.map((sentence) => (
                  <li key={sentence.cn}>
                    <span lang={HANZI_LANG} className="font-hanzi">{sentence.cn}</span>
                    <span className="text-neutral-600"> — {sentence.en}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>

      <footer className="mt-4 text-xs text-neutral-600">
        Printed from {cheatSheetSourceUrl(topic)} — audio, quizzes, and your progress live in the app.
      </footer>
    </section>
  );
}
