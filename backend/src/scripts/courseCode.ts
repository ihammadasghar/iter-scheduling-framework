// Shared course-code synthesis for real-Portuguese-named courses that don't
// come with a code of their own — used by both importIsteDataset.ts (ISCTE's
// real export has no course-code column) and generate-large-schedule.ts
// (its course names are real ISCTE names too, see nameCatalog.ts's
// ISCTE_PROGRAMS, so they need the same treatment).
const PT_STOPWORDS = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'para',
  'com', 'no', 'na', 'nos', 'nas', 'um', 'uma', 'ou', 'por', 'ao', 'aos',
]);

const stripAccents = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// Builds a short, human-scannable course code from a real course name.
// Without this, the calendar/chip label (which shows `course.code`, not
// `course.name`; see ClassChip.tsx) would fall back to a meaningless id
// remnant like "C0001". Acronym from the significant words (Portuguese
// stopwords dropped) + a sequential number disambiguates collisions
// deterministically — courses must be processed in the same order every
// call for a given input to keep output byte-identical.
export function deriveCourseCode(name: string, codeCounts: Map<string, number>): string {
  const words = stripAccents(name)
    .split(/[^A-Za-z]+/)
    .filter((w) => w.length > 0 && !PT_STOPWORDS.has(w.toLowerCase()));

  let acronym = words.map((w) => w[0]!.toUpperCase()).join('').slice(0, 4);
  if (acronym.length < 2) {
    // Degenerate name (all stopwords, or very short) — fall back to the
    // first letters of the raw name instead of an unrecognizable acronym.
    acronym = stripAccents(name).replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase() || 'CRS';
  }

  const n = (codeCounts.get(acronym) ?? 0) + 1;
  codeCounts.set(acronym, n);
  return `${acronym}${100 + n}`;
}
