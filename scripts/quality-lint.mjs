// Content-quality heuristics for src/data/topics.json.
//
// These are *lint* rules, not structural rules: they flag awkward or likely
// malformed generated text (bad articles, truncated sentences, duplicate
// labels, CN/EN punctuation drift). Everything here is a pure function so it
// can be unit-tested in isolation; scripts/validate-data.mjs wires them up and
// decides whether findings are warnings (default) or failures (--strict-quality).
//
// All detectors are conservative on purpose: the shipped dataset must produce
// zero findings, so a finding means something genuinely looks off.

// ── Articles ────────────────────────────────────────────────────────────────
// English "a"/"an" agrees with the *sound* of the next word, not its spelling.
// We can't pronounce arbitrary text, so we lean on three small curated tables
// plus a first-letter fallback, and only flag clear disagreements.

// Words spelled with a leading vowel letter but pronounced with a consonant
// sound → they take "a" (e.g. "a university", "a one-way street").
const A_BEFORE_VOWEL_LETTER = new Set([
  "university", "universities", "universe", "unicorn", "unit", "units",
  "unique", "union", "united", "useful", "user", "users", "use", "used",
  "usual", "usually", "european", "euro", "euros", "one", "once", "one-way",
  "one-time", "ubiquitous", "unanimous",
]);

// Words spelled with a leading consonant letter but pronounced with a vowel
// sound → they take "an" (e.g. "an hour", "an honest answer").
const AN_BEFORE_CONSONANT_LETTER = new Set([
  "hour", "hours", "hourly", "honest", "honestly", "honor", "honour",
  "honorable", "heir", "heirloom",
]);

// Initialisms sounded out letter-by-letter, where the leading letter's sound
// disagrees with its spelling. Value is the article the initialism should take.
const INITIALISM_ARTICLE = new Map([
  ["us", "a"], ["usd", "a"], ["uk", "a"], ["un", "a"],
  ["rmb", "an"], ["eu", "an"], ["fbi", "an"], ["suv", "an"],
  ["mba", "an"], ["nba", "an"], ["llm", "an"], ["mri", "an"],
  ["hr", "an"], ["ml", "an"], ["ngo", "an"],
]);

// Named entities that read awkwardly with an indefinite article — they are
// usually definite ("the Spring Festival"). We only flag "a/an" before these.
const DEFINITE_PROPER_NOUNS = [
  "Spring Festival", "Mid-Autumn Festival", "Dragon Boat Festival",
  "Lantern Festival", "Great Wall", "Forbidden City", "Chinese New Year",
  "Lunar New Year", "New Year",
];

const VOWEL_LETTERS = new Set(["a", "e", "i", "o", "u"]);

// The article a bare word should take, by our best guess. Returns "a" or "an".
export function expectedArticle(word) {
  const bare = String(word).replace(/[^A-Za-z'-]/g, "");
  if (!bare) return null;
  const lower = bare.toLowerCase();

  // All-caps (2+ letters) reads as an initialism.
  if (/^[A-Z]{2,}$/.test(bare)) {
    if (INITIALISM_ARTICLE.has(lower)) return INITIALISM_ARTICLE.get(lower);
    return VOWEL_LETTERS.has(lower[0]) ? "an" : "a";
  }
  if (INITIALISM_ARTICLE.has(lower)) return INITIALISM_ARTICLE.get(lower);
  if (A_BEFORE_VOWEL_LETTER.has(lower)) return "a";
  if (AN_BEFORE_CONSONANT_LETTER.has(lower)) return "an";
  return VOWEL_LETTERS.has(lower[0]) ? "an" : "a";
}

// Detect "a"/"an" that disagrees with the following word, plus indefinite
// articles before definite proper nouns. Returns [{ phrase, message }].
export function suspiciousArticles(text) {
  const out = [];
  const str = String(text ?? "");

  const articleRe = /\b(a|an)\s+([A-Za-z][A-Za-z'-]*)/g;
  for (const m of str.matchAll(articleRe)) {
    const article = m[1].toLowerCase();
    const next = m[2];
    const want = expectedArticle(next);
    if (want && article !== want) {
      out.push({
        phrase: `${m[1]} ${next}`,
        message: `article "${m[1]}" before "${next}" looks wrong (expected "${want} ${next}")`,
      });
    }
  }

  for (const noun of DEFINITE_PROPER_NOUNS) {
    const re = new RegExp(`\\b(a|an)\\s+${noun.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    const hit = re.exec(str);
    if (hit) {
      out.push({
        phrase: `${hit[1]} ${noun}`,
        message: `indefinite article before "${noun}" is awkward (usually "the ${noun}")`,
      });
    }
  }

  return out;
}

// ── Truncation / terminal punctuation ───────────────────────────────────────
// True when the English sentence ends in sentence-terminal punctuation,
// allowing a trailing closing quote or bracket.
export function hasTerminalPunctuation(text) {
  return /[.!?][)"'”’\]]?$/.test(String(text ?? "").trim());
}

// Function words that should never end a complete sentence — a sentence
// stopping here was almost certainly cut off.
const DANGLING_TAIL = new Set([
  "and", "or", "but", "the", "a", "an", "to", "of", "with", "for", "in", "on",
  "at", "as", "by", "is", "are", "was", "were", "that", "which", "because",
]);

// Returns a message if the English text looks truncated, else null. Independent
// of the corpus — catches dangling connectives and mid-word ellipsis cutoffs.
export function looksTruncated(text) {
  const str = String(text ?? "").trim();
  if (!str) return null;
  if (/[…]$|\.\.\.$/.test(str)) {
    return "sentence ends with an ellipsis (possible cutoff)";
  }
  if (/,$/.test(str)) {
    return "sentence ends with a comma (possible cutoff)";
  }
  // A sentence-final function word only signals truncation when the sentence
  // *also* lacks terminal punctuation. Properly closed sentences legitimately
  // end this way (phrasal verbs: "try it on.", "come in?", "from now on.").
  if (!hasTerminalPunctuation(str)) {
    const lastWord = (str.split(/\s+/).pop() || "").toLowerCase();
    if (DANGLING_TAIL.has(lastWord)) {
      return `sentence ends on dangling word "${lastWord}" without terminal punctuation (possible cutoff)`;
    }
  }
  return null;
}

// ── CN / EN punctuation agreement ───────────────────────────────────────────
// A question or exclamation in one language should be one in the other. Returns
// a message on disagreement, else null.
export function punctuationMismatch(cn, en) {
  const c = String(cn ?? "").trim();
  const e = String(en ?? "").trim();

  const enQ = /\?[)"'”’\]]?$/.test(e);
  const cnQ = /[？?]$/.test(c);
  if (enQ !== cnQ) {
    return enQ
      ? "EN is a question but CN is not"
      : "CN is a question but EN is not";
  }

  const enBang = /![)"'”’\]]?$/.test(e);
  const cnBang = /[！!]$/.test(c);
  if (enBang !== cnBang) {
    return enBang
      ? "EN is an exclamation but CN is not"
      : "CN is an exclamation but EN is not";
  }

  // CN sentences should end in a CJK terminal mark; a bare/latin ending often
  // signals a malformed or truncated example.
  if (c && !/[。！？…”』」）】]$/.test(c) && !/[.!?]$/.test(c)) {
    return "CN sentence has no terminal punctuation";
  }

  return null;
}

// ── Duplicate labels ────────────────────────────────────────────────────────
// English word labels should be distinct within a topic. Returns
// [{ english, indices }] for any label used by more than one item.
export function duplicateEnglishLabels(items) {
  const byLabel = new Map();
  (items ?? []).forEach((item, i) => {
    const label = String(item?.english ?? "").trim().toLowerCase();
    if (!label) return;
    if (!byLabel.has(label)) byLabel.set(label, { english: item.english, indices: [] });
    byLabel.get(label).indices.push(i);
  });
  return [...byLabel.values()].filter((g) => g.indices.length > 1);
}

// ── Topic-level roll-up ─────────────────────────────────────────────────────
// Collects quality findings across all topics as flat, actionable strings:
// "topic <slug>: <where> — <message>". The caller decides warning vs failure.
//
// Terminal punctuation is corpus-relative: we only flag a sentence for missing
// terminal punctuation when the overwhelming majority of sentences have it, so
// datasets that deliberately omit it don't drown in noise.
export function collectQualityWarnings(topics) {
  const list = Array.isArray(topics) ? topics : [];

  let enTotal = 0;
  let enWithTerminal = 0;
  for (const topic of list) {
    for (const item of topic?.items ?? []) {
      for (const s of item?.sentences ?? []) {
        if (typeof s?.en === "string" && s.en.trim()) {
          enTotal++;
          if (hasTerminalPunctuation(s.en)) enWithTerminal++;
        }
      }
    }
  }
  const majorityTerminal = enTotal > 0 && enWithTerminal / enTotal >= 0.9;

  const warnings = [];
  for (const topic of list) {
    const slug = topic?.slug ?? "(unknown)";
    const at = (where, message) => warnings.push(`topic "${slug}" ${where}: ${message}`);

    for (const dup of duplicateEnglishLabels(topic?.items)) {
      at(
        `items[${dup.indices.join(",")}]`,
        `duplicate English label "${dup.english}" used ${dup.indices.length} times`
      );
    }

    (topic?.items ?? []).forEach((item, i) => {
      for (const a of suspiciousArticles(item?.english)) {
        at(`item[${i}].english`, a.message);
      }
      (item?.sentences ?? []).forEach((s, k) => {
        const field = `item[${i}].sentences[${k}]`;
        for (const a of suspiciousArticles(s?.en)) {
          at(`${field}.en`, a.message);
        }
        const trunc = looksTruncated(s?.en);
        if (trunc) at(`${field}.en`, trunc);
        if (majorityTerminal && typeof s?.en === "string" && s.en.trim() && !hasTerminalPunctuation(s.en)) {
          at(`${field}.en`, "EN sentence is missing terminal punctuation");
        }
        const mism = punctuationMismatch(s?.cn, s?.en);
        if (mism) at(field, mism);
      });
    });
  }

  return warnings;
}
