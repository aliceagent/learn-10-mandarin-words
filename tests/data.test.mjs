import test from "node:test";
import assert from "node:assert/strict";

import rawData from "../src/data/topics.json" with { type: "json" };
import {
  allWords,
  datasetSummary,
  getCategory,
  getTopic,
  isUsefulPhraseTopic,
  nextRecommendedTopic,
  nextTopicAfter,
  pathSections,
  recommendedPath,
  STARTER_SLUGS,
  topicsForCategory,
  topicCategoryHref,
  USEFUL_PHRASES_CATEGORY_SLUG,
  wordKey,
} from "../src/lib/data-logic.ts";

const topics = rawData.topics;
const categories = rawData.categories;

test("dataset has exactly 108 topics and 1080 words", () => {
  assert.equal(topics.length, 108);
  assert.equal(allWords(topics).length, 1080);
});

test("datasetSummary derives hero counts from the real topic list", () => {
  assert.deepEqual(datasetSummary(topics), {
    listCount: 108,
    wordCount: 1080,
    formattedListCount: "108",
    formattedWordCount: "1,080",
  });
});

test("Castle, positive emotions, deserts, and computer equipment topics include Jonathan's requested lists", () => {
  const expected = [
    {
      slug: "ten-things-in-a-castle",
      titleEn: "Ten Things in a Castle",
      titleCn: "城堡里的十种东西",
      categorySlug: "places-and-buildings",
      items: [
        ["castle gate", "城门", "chéngmén"],
        ["tower", "塔楼", "tǎlóu"],
        ["wall", "城墙", "chéngqiáng"],
        ["moat", "护城河", "hùchénghé"],
        ["throne", "王座", "wángzuò"],
        ["hall", "大厅", "dàtīng"],
        ["armory", "兵器库", "bīngqìkù"],
        ["dungeon", "地牢", "dìláo"],
        ["drawbridge", "吊桥", "diàoqiáo"],
        ["flag", "旗帜", "qízhì"],
      ],
    },
    {
      slug: "ten-positive-emotions",
      titleEn: "Ten Positive Emotions",
      titleCn: "十种积极情绪",
      categorySlug: "abstract-but-picturable",
      items: [
        ["joy", "喜悦", "xǐyuè"],
        ["excitement", "兴奋", "xīngfèn"],
        ["gratitude", "感激", "gǎnjī"],
        ["hope", "希望", "xīwàng"],
        ["confidence", "自信", "zìxìn"],
        ["calm", "平静", "píngjìng"],
        ["relief", "安心", "ānxīn"],
        ["contentment", "满足", "mǎnzú"],
        ["admiration", "欣赏", "xīnshǎng"],
        ["curiosity", "好奇", "hàoqí"],
      ],
    },
    {
      slug: "ten-famous-deserts",
      titleEn: "Ten Famous Deserts",
      titleCn: "十个著名沙漠",
      categorySlug: "plants-and-nature",
      items: [
        ["Sahara Desert", "撒哈拉沙漠", "Sāhālā Shāmò"],
        ["Gobi Desert", "戈壁沙漠", "Gēbì Shāmò"],
        ["Taklamakan Desert", "塔克拉玛干沙漠", "Tǎkèlāmǎgān Shāmò"],
        ["Kalahari Desert", "卡拉哈里沙漠", "Kǎlāhālǐ Shāmò"],
        ["Mojave Desert", "莫哈韦沙漠", "Mòhāwéi Shāmò"],
        ["Atacama Desert", "阿塔卡马沙漠", "ātǎkǎmǎ shāmò"],
        ["Arabian Desert", "阿拉伯沙漠", "ālābó shāmò"],
        ["Negev Desert", "内盖夫沙漠", "Nèigàifū Shāmò"],
        ["Thar Desert", "塔尔沙漠", "Tǎ'ěr Shāmò"],
        ["Sonoran Desert", "索诺兰沙漠", "Suǒnuòlán Shāmò"],
      ],
    },
    {
      slug: "ten-types-of-computer-equipment",
      titleEn: "Ten Types of Computer Equipment",
      titleCn: "十种电脑设备",
      categorySlug: "home-and-objects",
      items: [
        ["computer", "电脑", "diànnǎo"],
        ["monitor", "显示器", "xiǎnshìqì"],
        ["keyboard", "键盘", "jiànpán"],
        ["mouse", "鼠标", "shǔbiāo"],
        ["printer", "打印机", "dǎyìnjī"],
        ["scanner", "扫描仪", "sǎomiáoyí"],
        ["router", "路由器", "lùyóuqì"],
        ["hard drive", "硬盘", "yìngpán"],
        ["webcam", "摄像头", "shèxiàngtóu"],
        ["USB drive", "优盘", "yōupán"],
      ],
    },
  ];

  for (const spec of expected) {
    const topic = getTopic(topics, spec.slug);
    assert.ok(topic, `${spec.slug} exists`);
    assert.equal(topic.titleEn, spec.titleEn);
    assert.equal(topic.titleCn, spec.titleCn);
    assert.equal(topic.categorySlug, spec.categorySlug);
    assert.equal(topic.items.length, 10);
    assert.deepEqual(topic.items.map((item) => [item.english, item.hanzi, item.pinyin]), spec.items);
    for (const item of topic.items) {
      assert.equal(item.sentences.length, 2);
      for (const sentence of item.sentences) assert.ok(sentence.cn && sentence.en);
    }
  }
});

test("Emotions topic includes 10 requested non-happy-sad-hate emotion words", () => {
  const topic = getTopic(topics, "ten-types-of-emotions");
  assert.ok(topic, "emotions topic exists");
  assert.equal(topic.titleEn, "Ten Types of Emotions");
  assert.equal(topic.titleCn, "十种情绪");
  assert.equal(topic.categorySlug, "abstract-but-picturable");
  assert.equal(topic.items.length, 10);

  assert.deepEqual(
    topic.items.map((item) => [item.english, item.hanzi, item.pinyin]),
    [
      ["dislike", "讨厌", "tǎoyàn"],
      ["like", "喜欢", "xǐhuan"],
      ["worry", "担心", "dānxīn"],
      ["nervous", "紧张", "jǐnzhāng"],
      ["embarrassed", "尴尬", "gāngà"],
      ["jealous", "嫉妒", "jídù"],
      ["proud", "骄傲", "jiāo'ào"],
      ["lonely", "孤单", "gūdān"],
      ["disappointed", "失望", "shīwàng"],
      ["bored", "无聊", "wúliáo"],
    ]
  );

  const excluded = new Set(["快乐", "开心", "悲伤", "难过", "伤心", "恨"]);
  for (const item of topic.items) {
    assert.ok(!excluded.has(item.hanzi), `excluded known emotion present: ${item.hanzi}`);
    assert.equal(item.sentences.length, 2);
    for (const sentence of item.sentences) {
      assert.ok(sentence.cn && sentence.en);
    }
  }
});

test("Hotel to Airport topic includes Jonathan's requested travel words", () => {
  const topic = getTopic(topics, "hotel-to-airport-mandarin-vocabulary");
  assert.ok(topic, "hotel-to-airport topic exists");
  assert.equal(topic.categorySlug, "travel-and-tourism");
  assert.deepEqual(
    topic.items.map((item) => [item.english, item.hanzi, item.pinyin]),
    [
      ["terminal", "航站楼", "hángzhànlóu"],
      ["airline", "航空公司", "hángkōng gōngsī"],
      ["check-in counter", "值机柜台", "zhíjī guìtái"],
      ["luggage cart", "行李车", "xíngli chē"],
      ["highway / expressway toll", "高速费", "gāosù fèi"],
      ["official receipt / tax invoice", "发票", "fāpiào"],
      ["hotel receipt / invoice", "酒店发票", "jiǔdiàn fāpiào"],
      ["check out", "退房", "tuìfáng"],
      ["boarding pass", "登机牌", "dēngjīpái"],
      ["departure level / departures", "出发层", "chūfā céng"],
    ]
  );
});

test("Useful Phrases category has 2 topics and 20 items, all well-formed", () => {
  const category = rawData.categories.find((c) => c.slug === "useful-phrases");
  assert.ok(category, "useful-phrases category exists");
  assert.equal(category.name, "Useful Phrases");
  assert.equal(category.topics.length, 2);
  assert.deepEqual(category.topics, [
    "ten-ways-to-apologize",
    "ten-good-wishes-and-social-phrases",
  ]);

  const catTopics = topics.filter((t) => t.categorySlug === "useful-phrases");
  assert.equal(catTopics.length, 2);
  // Every topic the category lists resolves, and its categorySlug agrees.
  for (const slug of category.topics) {
    const topic = getTopic(topics, slug);
    assert.ok(topic, `topic ${slug} exists`);
    assert.equal(topic.categorySlug, "useful-phrases");
    assert.equal(topic.category, "Useful Phrases");
    assert.equal(topic.items.length, 10);
    for (const item of topic.items) {
      assert.ok(item.hanzi && item.pinyin && item.english);
      // Exactly two example sentences, each with cn + en.
      assert.equal(item.sentences.length, 2);
      for (const s of item.sentences) {
        assert.ok(s.cn && s.en);
      }
    }
  }

  const items = catTopics.flatMap((t) => t.items);
  assert.equal(items.length, 20);
});

test("isUsefulPhraseTopic is true only for the two Useful Phrases topics", () => {
  // The constant matches a real category slug.
  assert.ok(getCategory(categories, USEFUL_PHRASES_CATEGORY_SLUG), "constant is a real slug");

  const phraseTopics = topics.filter((t) => isUsefulPhraseTopic(t));
  assert.deepEqual(
    phraseTopics.map((t) => t.slug),
    ["ten-ways-to-apologize", "ten-good-wishes-and-social-phrases"]
  );
  // Every other topic classifies as non-phrasebook.
  const others = topics.filter((t) => !isUsefulPhraseTopic(t));
  assert.equal(others.length, topics.length - 2);
});

test("isUsefulPhraseTopic keys off categorySlug, not item text or title", () => {
  // A topic whose words happen to look like phrases but sits in another
  // category is NOT phrasebook; category membership is the only signal.
  assert.equal(isUsefulPhraseTopic({ categorySlug: "food-and-drink" }), false);
  assert.equal(isUsefulPhraseTopic({ categorySlug: USEFUL_PHRASES_CATEGORY_SLUG }), true);
});

test("getCategory resolves every category slug and rejects unknown ones", () => {
  assert.equal(categories.length, 14);
  for (const category of categories) {
    const found = getCategory(categories, category.slug);
    assert.ok(found, `category ${category.slug} resolves`);
    assert.equal(found.slug, category.slug);
    assert.equal(found.name, category.name);
  }
  assert.equal(getCategory(categories, "no-such-category-slug"), undefined);
});

test("topicsForCategory returns the two Useful Phrases topics", () => {
  const phraseTopics = topicsForCategory(topics, "useful-phrases");
  assert.equal(phraseTopics.length, 2);
  assert.deepEqual(
    phraseTopics.map((t) => t.slug),
    ["ten-ways-to-apologize", "ten-good-wishes-and-social-phrases"]
  );
  for (const topic of phraseTopics) {
    assert.equal(topic.categorySlug, "useful-phrases");
  }
});

test("topicsForCategory covers all topics and matches each category's declared count", () => {
  let total = 0;
  for (const category of categories) {
    const catTopics = topicsForCategory(topics, category.slug);
    // Every topic filtered by categorySlug is listed in the category, and the
    // counts agree — so the category page and the dataset never drift.
    assert.equal(catTopics.length, category.topics.length, `count for ${category.slug}`);
    for (const topic of catTopics) {
      assert.ok(category.topics.includes(topic.slug), `${topic.slug} listed in ${category.slug}`);
    }
    total += catTopics.length;
  }
  // Categories partition every topic exactly once.
  assert.equal(total, topics.length);
});

test("topicsForCategory returns an empty array for an unknown slug", () => {
  assert.deepEqual(topicsForCategory(topics, "no-such-category-slug"), []);
});

test("allWords annotates each word with its topic + category", () => {
  const words = allWords(topics);
  const first = words[0];
  const topic = topics[0];
  assert.equal(first.topicSlug, topic.slug);
  assert.equal(first.topicTitle, topic.titleEn);
  assert.equal(first.category, topic.category);
  // Ten words per topic, so global count is topics * 10.
  assert.equal(words.length, topics.length * 10);
});

test("getTopic finds a real slug and returns undefined otherwise", () => {
  const known = topics[0].slug;
  assert.equal(getTopic(topics, known)?.slug, known);
  assert.equal(getTopic(topics, "no-such-topic-slug"), undefined);
});

test("wordKey is topic.slug + ':' + hanzi", () => {
  const topic = topics[0];
  const item = topic.items[0];
  assert.equal(wordKey(topic, item), `${topic.slug}:${item.hanzi}`);
});

test("topicCategoryHref returns the category page for topic back navigation", () => {
  const topic = getTopic(topics, "hotel-to-airport-mandarin-vocabulary");
  assert.ok(topic);
  assert.equal(topicCategoryHref(topic), "/categories/travel-and-tourism");
});

test("recommendedPath returns the starter slugs when present", () => {
  const path = recommendedPath(topics);
  const slugs = path.map((t) => t.slug);
  // Every starter slug that exists in data should appear, in order.
  const expected = STARTER_SLUGS.filter((s) => getTopic(topics, s));
  assert.deepEqual(slugs, expected);
  assert.ok(path.length >= 3);
});

test("recommendedPath falls back to first 6 topics when starters are missing", () => {
  // Synthetic topics with none of the starter slugs -> data-order fallback.
  const synthetic = Array.from({ length: 8 }, (_, i) => ({
    slug: `topic-${i}`,
    items: [],
  }));
  const path = recommendedPath(synthetic);
  assert.equal(path.length, 6);
  assert.deepEqual(path.map((t) => t.slug), ["topic-0", "topic-1", "topic-2", "topic-3", "topic-4", "topic-5"]);
});

test("nextRecommendedTopic skips learned recommended topics", () => {
  const path = recommendedPath(topics);
  const learned = [path[0].slug];
  assert.equal(nextRecommendedTopic(topics, learned).slug, path[1].slug);
});

test("nextRecommendedTopic falls back to first unlearned topic overall", () => {
  // Learn every recommended topic; the next pick is the first unlearned in data.
  const learned = recommendedPath(topics).map((t) => t.slug);
  const next = nextRecommendedTopic(topics, learned);
  assert.ok(!learned.includes(next.slug));
  const firstUnlearned = topics.find((t) => !learned.includes(t.slug));
  assert.equal(next.slug, firstUnlearned.slug);
});

test("nextRecommendedTopic falls back to topic 1 when everything is learned", () => {
  const learned = topics.map((t) => t.slug);
  assert.equal(nextRecommendedTopic(topics, learned).slug, topics[0].slug);
});

test("nextTopicAfter never returns the just-finished topic", () => {
  const path = recommendedPath(topics);
  // Finishing the first recommended topic (not marked learned) points onward.
  const next = nextTopicAfter(topics, [], path[0].slug);
  assert.ok(next);
  assert.notEqual(next.slug, path[0].slug);
  assert.equal(next.slug, path[1].slug);
});

test("nextTopicAfter treats the current topic as done alongside learnedTopics", () => {
  const path = recommendedPath(topics);
  // First recommended already learned, and we just finished the second one:
  // the suggestion skips both to the third recommended topic.
  const next = nextTopicAfter(topics, [path[0].slug], path[1].slug);
  assert.equal(next.slug, path[2].slug);
});

test("nextTopicAfter falls back to the first unfinished topic overall", () => {
  const learned = recommendedPath(topics).map((t) => t.slug);
  const current = topics.find((t) => !learned.includes(t.slug));
  const next = nextTopicAfter(topics, learned, current.slug);
  assert.ok(next);
  assert.notEqual(next.slug, current.slug);
  const firstUnfinished = topics.find(
    (t) => !learned.includes(t.slug) && t.slug !== current.slug,
  );
  assert.equal(next.slug, firstUnfinished.slug);
});

test("nextTopicAfter returns null when every topic is finished", () => {
  const learned = topics.map((t) => t.slug);
  assert.equal(nextTopicAfter(topics, learned, topics[0].slug), null);
});

test("pathSections starts with the starter essentials from recommendedPath", () => {
  const sections = pathSections(topics);
  assert.ok(sections.length > 0);
  assert.equal(sections[0].key, "starter-essentials");
  assert.deepEqual(
    sections[0].topics.map((t) => t.slug),
    recommendedPath(topics).map((t) => t.slug)
  );
});

test("pathSections includes a Useful Phrases section with the two phrase topics", () => {
  const sections = pathSections(topics);
  const phrases = sections.find((s) => s.key === "useful-phrases");
  assert.ok(phrases, "useful-phrases section exists");
  assert.deepEqual(
    phrases.topics.map((t) => t.slug),
    ["ten-ways-to-apologize", "ten-good-wishes-and-social-phrases"]
  );
});

test("pathSections places every topic in exactly one section", () => {
  const sections = pathSections(topics);
  const slugs = sections.flatMap((s) => s.topics.map((t) => t.slug));
  // No duplicates: starter topics are not repeated inside their categories.
  assert.equal(new Set(slugs).size, slugs.length);
  // Complete coverage: the path reaches every topic in the dataset.
  assert.equal(slugs.length, topics.length);
  assert.deepEqual(new Set(slugs), new Set(topics.map((t) => t.slug)));
});

test("pathSections only references real topics and drops empty sections", () => {
  const sections = pathSections(topics);
  const known = new Set(topics.map((t) => t.slug));
  for (const section of sections) {
    assert.ok(section.topics.length > 0, `${section.key} is non-empty`);
    assert.ok(section.title && section.blurb, `${section.key} is labelled`);
    for (const topic of section.topics) {
      assert.ok(known.has(topic.slug), `${topic.slug} is a real topic`);
    }
  }
});
