import { ReaderShell } from "./ReaderShell";
import {
  fetchChapters,
  fetchReciters,
  fetchTranslationsCatalogue,
} from "@/lib/quran/client";

/**
 * The reader's catalogues are fetched once on the server and handed down. Page
 * content itself is fetched per page through the route handlers, so turning a
 * page never re-sends the sūrah list.
 */
export default async function ReadPage() {
  const [chapters, translations, reciters] = await Promise.all([
    fetchChapters(),
    fetchTranslationsCatalogue().catch(() => []),
    fetchReciters().catch(() => []),
  ]);

  return (
    <ReaderShell
      chapters={chapters}
      juzStarts={juzStartPages()}
      translations={pickEnglish(translations)}
      reciters={reciters}
    />
  );
}

/**
 * The opening page of each juzʾ in the Madani Muṣḥaf. These are fixed points
 * of the printed edition rather than anything derivable from the text, so
 * they are stated outright.
 */
const JUZ_START_PAGES = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302,
  322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
] as const;

function juzStartPages(): { id: number; page: number }[] {
  return JUZ_START_PAGES.map((page, index) => ({ id: index + 1, page }));
}

function pickEnglish(
  translations: {
    id: number;
    name: string;
    authorName: string;
    languageName: string;
  }[],
) {
  const english = translations.filter((t) => t.languageName === "english");
  return (english.length ? english : translations)
    .slice(0, 40)
    .map(({ id, name, authorName }) => ({ id, name, authorName }));
}
