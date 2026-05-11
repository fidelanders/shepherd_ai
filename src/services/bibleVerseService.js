'use strict';

/**
 * BibleVerseService
 *
 * Detects scripture references in transcript text.
 * Covers all 66 canonical Bible books with common abbreviations.
 * Verse text is fetched from a bundled ESV excerpt map; unknown verses
 * are included as references without the full text.
 */

// ─── Book name → canonical name + abbreviation list ──────────────────────────

const BOOKS = [
  // Old Testament
  { name: 'Genesis', abbr: ['Gen', 'Ge', 'Gn'] },
  { name: 'Exodus', abbr: ['Exod', 'Exo', 'Ex'] },
  { name: 'Leviticus', abbr: ['Lev', 'Le', 'Lv'] },
  { name: 'Numbers', abbr: ['Num', 'Nu', 'Nm', 'Nb'] },
  { name: 'Deuteronomy', abbr: ['Deut', 'Deu', 'Dt'] },
  { name: 'Joshua', abbr: ['Josh', 'Jos', 'Jsh'] },
  { name: 'Judges', abbr: ['Judg', 'Jdg', 'Jg'] },
  { name: 'Ruth', abbr: ['Rth', 'Ru'] },
  { name: '1 Samuel', abbr: ['1 Sam', '1Sam', '1 Sm', '1Sa'] },
  { name: '2 Samuel', abbr: ['2 Sam', '2Sam', '2 Sm', '2Sa'] },
  { name: '1 Kings', abbr: ['1 Kgs', '1Kgs', '1 Ki', '1Ki'] },
  { name: '2 Kings', abbr: ['2 Kgs', '2Kgs', '2 Ki', '2Ki'] },
  { name: '1 Chronicles', abbr: ['1 Chr', '1Chr', '1 Ch', '1Ch'] },
  { name: '2 Chronicles', abbr: ['2 Chr', '2Chr', '2 Ch', '2Ch'] },
  { name: 'Ezra', abbr: ['Ezr'] },
  { name: 'Nehemiah', abbr: ['Neh', 'Ne'] },
  { name: 'Esther', abbr: ['Esth', 'Est', 'Es'] },
  { name: 'Job', abbr: ['Jb'] },
  { name: 'Psalms', abbr: ['Psalm', 'Ps', 'Psa', 'Psm'] },
  { name: 'Proverbs', abbr: ['Prov', 'Pro', 'Prv', 'Pr'] },
  { name: 'Ecclesiastes', abbr: ['Eccles', 'Eccl', 'Ecc', 'Ec', 'Qoh'] },
  { name: 'Song of Solomon', abbr: ['Song', 'Song of Songs', 'SOS', 'SS', 'Cant'] },
  { name: 'Isaiah', abbr: ['Isa', 'Is'] },
  { name: 'Jeremiah', abbr: ['Jer', 'Je', 'Jr'] },
  { name: 'Lamentations', abbr: ['Lam', 'La'] },
  { name: 'Ezekiel', abbr: ['Ezek', 'Eze', 'Ezk'] },
  { name: 'Daniel', abbr: ['Dan', 'Da', 'Dn'] },
  { name: 'Hosea', abbr: ['Hos', 'Ho'] },
  { name: 'Joel', abbr: ['Jl'] },
  { name: 'Amos', abbr: ['Am'] },
  { name: 'Obadiah', abbr: ['Obad', 'Ob'] },
  { name: 'Jonah', abbr: ['Jon', 'Jnh'] },
  { name: 'Micah', abbr: ['Mic', 'Mc'] },
  { name: 'Nahum', abbr: ['Nah', 'Na'] },
  { name: 'Habakkuk', abbr: ['Hab'] },
  { name: 'Zephaniah', abbr: ['Zeph', 'Zep', 'Zp'] },
  { name: 'Haggai', abbr: ['Hag', 'Hg'] },
  { name: 'Zechariah', abbr: ['Zech', 'Zec', 'Zc'] },
  { name: 'Malachi', abbr: ['Mal', 'Ml'] },
  // New Testament
  { name: 'Matthew', abbr: ['Matt', 'Mat', 'Mt'] },
  { name: 'Mark', abbr: ['Mk', 'Mrk', 'Mar'] },
  { name: 'Luke', abbr: ['Lk', 'Luk'] },
  { name: 'John', abbr: ['Jn', 'Jhn'] },
  { name: 'Acts', abbr: ['Act', 'Ac'] },
  { name: 'Romans', abbr: ['Rom', 'Ro', 'Rm'] },
  { name: '1 Corinthians', abbr: ['1 Cor', '1Cor', '1 Co', '1Co'] },
  { name: '2 Corinthians', abbr: ['2 Cor', '2Cor', '2 Co', '2Co'] },
  { name: 'Galatians', abbr: ['Gal', 'Ga'] },
  { name: 'Ephesians', abbr: ['Eph', 'Ep'] },
  { name: 'Philippians', abbr: ['Phil', 'Php', 'Pp'] },
  { name: 'Colossians', abbr: ['Col', 'Co'] },
  { name: '1 Thessalonians', abbr: ['1 Thess', '1Thess', '1 Th', '1Th'] },
  { name: '2 Thessalonians', abbr: ['2 Thess', '2Thess', '2 Th', '2Th'] },
  { name: '1 Timothy', abbr: ['1 Tim', '1Tim', '1 Ti', '1Ti'] },
  { name: '2 Timothy', abbr: ['2 Tim', '2Tim', '2 Ti', '2Ti'] },
  { name: 'Titus', abbr: ['Tit', 'Ti'] },
  { name: 'Philemon', abbr: ['Phlm', 'Phm', 'Pm'] },
  { name: 'Hebrews', abbr: ['Heb', 'He'] },
  { name: 'James', abbr: ['Jas', 'Jm'] },
  { name: '1 Peter', abbr: ['1 Pet', '1Pet', '1 Pe', '1Pe', '1 Pt', '1Pt'] },
  { name: '2 Peter', abbr: ['2 Pet', '2Pet', '2 Pe', '2Pe', '2 Pt', '2Pt'] },
  { name: '1 John', abbr: ['1 Jn', '1Jn', '1 Jhn', '1Jhn'] },
  { name: '2 John', abbr: ['2 Jn', '2Jn'] },
  { name: '3 John', abbr: ['3 Jn', '3Jn'] },
  { name: 'Jude', abbr: ['Jud', 'Jd'] },
  { name: 'Revelation', abbr: ['Rev', 'Re', 'Rv'] },
];

// ─── Sample verse text (ESV) — expand as needed ──────────────────────────────

const VERSE_TEXT = {
  'Genesis 1:1': 'In the beginning, God created the heavens and the earth.',
  'Psalms 23:1': 'The Lord is my shepherd; I shall not want.',
  'Psalms 23:4': 'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.',
  'Proverbs 3:5': 'Trust in the Lord with all your heart, and do not lean on your own understanding.',
  'Isaiah 40:31': 'But they who wait for the Lord shall renew their strength; they shall mount up with wings like eagles.',
  'Jeremiah 29:11': 'For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.',
  'Matthew 5:3': 'Blessed are the poor in spirit, for theirs is the kingdom of heaven.',
  'Matthew 28:19': 'Go therefore and make disciples of all nations, baptizing them in the name of the Father and of the Son and of the Holy Spirit.',
  'John 1:1': 'In the beginning was the Word, and the Word was with God, and the Word was God.',
  'John 3:3': 'Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God.',
  'John 3:16': 'For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life.',
  'John 3:17': 'For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him.',
  'John 14:6': 'Jesus said to him, "I am the way, and the truth, and the life. No one comes to the Father except through me."',
  'Romans 3:23': 'For all have sinned and fall short of the glory of God.',
  'Romans 5:8': 'But God shows his love for us in that while we were still sinners, Christ died for us.',
  'Romans 6:23': 'For the wages of sin is death, but the free gift of God is eternal life in Christ Jesus our Lord.',
  'Romans 8:28': 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.',
  'Romans 10:9': 'Because, if you confess with your mouth that Jesus is Lord and believe in your heart that God raised him from the dead, you will be saved.',
  '1 Corinthians 13:4': 'Love is patient and kind; love does not envy or boast; it is not arrogant.',
  'Galatians 5:22': 'But the fruit of the Spirit is love, joy, peace, patience, kindness, goodness, faithfulness.',
  'Ephesians 2:8': 'For by grace you have been saved through faith. And this is not your own doing; it is the gift of God.',
  'Ephesians 2:10': 'For we are his workmanship, created in Christ Jesus for good works, which God prepared beforehand, that we should walk in them.',
  'Philippians 4:13': 'I can do all things through him who strengthens me.',
  'Hebrews 11:1': 'Now faith is the assurance of things hoped for, the conviction of things not seen.',
  'Hebrews 13:8': 'Jesus Christ is the same yesterday and today and forever.',
  'Revelation 21:4': 'He will wipe away every tear from their eyes, and death shall be no more, neither shall there be mourning, nor crying, nor pain anymore.',
};

// ─── Build regex patterns from BOOKS list ────────────────────────────────────

function buildPatterns() {
  const patterns = [];
  for (const book of BOOKS) {
    const names = [book.name, ...book.abbr].map(n => n.replace(/\s+/g, '\\s*'));
    const nameRegex = names.join('|');
    patterns.push({
      canonical: book.name,
      regex: new RegExp(`\\b(${nameRegex})\\s+(\\d+):(\\d+)(?:[-–](\\d+))?\\b`, 'gi'),
    });
  }
  return patterns;
}

const PATTERNS = buildPatterns();

class BibleVerseService {
  async detectVerses(text) {
    if (!text) return [];

    const found = new Map(); // ref → verse object (dedup by ref)

    for (const { canonical, regex } of PATTERNS) {
      regex.lastIndex = 0; // reset stateful regex

      let match;
      while ((match = regex.exec(text)) !== null) {
        const chapter = match[2];
        const verse = match[3];
        const ref = `${canonical} ${chapter}:${verse}`;

        if (!found.has(ref)) {
          found.set(ref, {
            ref,
            trans: 'ESV',
            time: this._extractTimeContext(text, match.index),
            type: 'quotation',
            text: VERSE_TEXT[ref] || null, // null if not in our excerpt map
          });
        }
      }
    }

    return Array.from(found.values());
  }

  _extractTimeContext(text, position) {
    const around = text.substring(Math.max(0, position - 120), Math.min(text.length, position + 120));
    const m = around.match(/(\d{1,2}):(\d{2})/);
    return m ? m[0] : '00:00';
  }
}

module.exports = BibleVerseService;
