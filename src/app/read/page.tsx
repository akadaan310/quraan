import { ReaderShell } from "./ReaderShell";
import {
  fetchChapters,
  fetchReciters,
  fetchTranslationsCatalogue,
} from "@/lib/quran/client";
import { JUZ_START_PAGES } from "@/lib/quran/layout";

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
