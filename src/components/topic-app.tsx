"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Topic } from "@/lib/types";
import { wordKey } from "@/lib/data";
import { useProgress } from "./use-progress";

type QuizCard = {
  prompt: string;
  answer: string;
  choices: string[];
};

function shuffle<T>(items: T[]): T[] {
  return [...items].sort(() => Math.random() - 0.5);
}

export function TopicApp({ topic }: { topic: Topic }) {
  const { progress, toggleFavoriteTopic, toggleFavoriteWord, toggleLearnedTopic, gradeWord } = useProgress();
  const [mode, setMode] = useState<"words" | "flashcards" | "quiz">("words");
  const [cardIndex, setCardIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);

  const isLearned = progress.learnedTopics.includes(topic.slug);
  const isFavoriteTopic = progress.favoriteTopics.includes(topic.slug);
  const current = topic.items[cardIndex % topic.items.length];
  const currentKey = wordKey(topic, current);

  const quiz = useMemo<QuizCard[]>(() => topic.items.map((item) => ({
    prompt: item.hanzi,
    answer: item.english,
    choices: shuffle([item.english, ...shuffle(topic.items.filter((other) => other.english !== item.english)).slice(0, 3).map((other) => other.english)]),
  })), [topic.items]);
  const currentQuiz = quiz[quizIndex % quiz.length];

  function answerQuiz(choice: string) {
    if (picked) return;
    setPicked(choice);
    if (choice === currentQuiz.answer) setScore((value) => value + 1);
  }

  function nextQuiz() {
    setPicked(null);
    setQuizIndex((value) => value + 1);
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:px-10">
      <Link href="/" className="text-sm font-semibold text-emerald-300 hover:text-emerald-200">Back to library</Link>
      <section className="mt-8 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div>
          <p className="text-sm text-slate-400">{topic.category}</p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white md:text-6xl">{topic.titleEn}</h1>
          <p className="mt-3 text-3xl font-semibold text-emerald-300">{topic.titleCn}</p>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">Watch the lesson, practice the ten words, then mark the list learned when it feels easy.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <button onClick={() => toggleFavoriteTopic(topic.slug)} className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white transition hover:border-amber-300">
              {isFavoriteTopic ? "Saved list" : "Save list"}
            </button>
            <button onClick={() => toggleLearnedTopic(topic.slug)} className="rounded-full bg-emerald-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-300">
              {isLearned ? "Marked learned" : "Mark learned"}
            </button>
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/[0.05] p-4">
          <div className="flex aspect-video items-center justify-center rounded-[1.5rem] bg-slate-950 text-center">
            <div className="px-8">
              <p className="text-2xl font-semibold text-white">Video lesson slot</p>
              <p className="mt-3 text-sm leading-6 text-slate-400">The generated MP4 for this topic will plug in here once the hosting source is connected.</p>
              <p className="mt-4 rounded-full bg-white/[0.06] px-4 py-2 text-xs text-slate-400">{topic.videoPath}</p>
            </div>
          </div>
        </div>
      </section>

      <nav className="mt-10 flex flex-wrap gap-2 rounded-3xl border border-white/10 bg-slate-950/80 p-2">
        <Tab active={mode === "words"} onClick={() => setMode("words")}>Words</Tab>
        <Tab active={mode === "flashcards"} onClick={() => setMode("flashcards")}>Flashcards</Tab>
        <Tab active={mode === "quiz"} onClick={() => setMode("quiz")}>Matching quiz</Tab>
      </nav>

      {mode === "words" ? (
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {topic.items.map((item) => {
            const key = wordKey(topic, item);
            const favorite = progress.favoriteWords.includes(key);
            return (
              <article key={item.hanzi} className="rounded-3xl border border-white/10 bg-white/[0.045] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-4xl font-semibold text-white">{item.hanzi}</h2>
                    <p className="mt-2 text-xl text-emerald-300">{item.pinyin}</p>
                    <p className="mt-1 text-lg font-semibold text-slate-200">{item.english}</p>
                  </div>
                  <button onClick={() => toggleFavoriteWord(key)} className="rounded-full border border-white/10 px-3 py-2 text-sm font-semibold text-slate-200 hover:border-amber-300">
                    {favorite ? "Saved" : "Save"}
                  </button>
                </div>
                <div className="mt-5 space-y-3 border-t border-white/10 pt-4">
                  {item.sentences.map((sentence) => <p key={sentence.cn} className="text-sm leading-6 text-slate-300"><span className="text-white">{sentence.cn}</span><br />{sentence.en}</p>)}
                </div>
              </article>
            );
          })}
        </section>
      ) : null}

      {mode === "flashcards" ? (
        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 text-center">
          <p className="text-sm text-slate-400">Card {cardIndex + 1} of {topic.items.length}</p>
          <h2 className="mt-4 text-7xl font-semibold text-white">{current.hanzi}</h2>
          {revealed ? <div className="mt-5"><p className="text-2xl text-emerald-300">{current.pinyin}</p><p className="mt-2 text-xl text-slate-200">{current.english}</p></div> : null}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {!revealed ? <button onClick={() => setRevealed(true)} className="rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950">Reveal</button> : (
              (["again", "hard", "good", "easy"] as const).map((grade) => <button key={grade} onClick={() => { gradeWord(currentKey, grade); setRevealed(false); setCardIndex((value) => (value + 1) % topic.items.length); }} className="rounded-full border border-white/15 px-5 py-3 font-semibold capitalize text-white hover:border-emerald-300">{grade}</button>)
            )}
          </div>
        </section>
      ) : null}

      {mode === "quiz" ? (
        <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.045] p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-400">Question {(quizIndex % quiz.length) + 1} of {quiz.length}</p>
            <p className="text-sm font-semibold text-emerald-300">Score {score}</p>
          </div>
          <h2 className="mt-8 text-center text-7xl font-semibold text-white">{currentQuiz.prompt}</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2">
            {currentQuiz.choices.map((choice) => {
              const right = picked && choice === currentQuiz.answer;
              const wrong = picked === choice && choice !== currentQuiz.answer;
              return <button key={choice} onClick={() => answerQuiz(choice)} className={`rounded-2xl border px-5 py-4 text-left font-semibold transition ${right ? "border-emerald-300 bg-emerald-300 text-slate-950" : wrong ? "border-rose-300 bg-rose-300 text-slate-950" : "border-white/10 bg-slate-950 text-white hover:border-emerald-300"}`}>{choice}</button>;
            })}
          </div>
          {picked ? <button onClick={nextQuiz} className="mt-6 rounded-full bg-emerald-400 px-6 py-3 font-semibold text-slate-950">Next question</button> : null}
        </section>
      ) : null}
    </main>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={`rounded-2xl px-5 py-3 font-semibold transition ${active ? "bg-emerald-400 text-slate-950" : "text-slate-300 hover:bg-white/[0.06] hover:text-white"}`}>{children}</button>;
}
