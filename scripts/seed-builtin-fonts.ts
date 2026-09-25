// Seeds the bundled, permissively-licensed (SIL OFL) font library as global
// PressFont rows (pressId: null), the same convention /api/superadmin/fonts
// already uses for fonts available to every press without an upload. Files
// live in public/fonts/builtin/ and are attributed in public/fonts/builtin/OFL-LICENSE.txt.
//
// Safe to re-run: existing rows are matched by name (case-sensitive) among
// the global (pressId: null) fonts and only touched if their fileUrl drifted,
// so it won't disturb unrelated global fonts a superadmin uploaded by hand.
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FONT_DIR = '/fonts/builtin';

interface BuiltinFont {
  family: string;
  regular: string;
  bold?: string;
  italic?: string;
  boldItalic?: string;
  language?: string; // defaults to 'en'
}

const BUILTIN_FONTS: BuiltinFont[] = [
  // Sans-serif
  { family: 'Fira Sans', regular: 'FiraSans-Regular.ttf', bold: 'FiraSans-Bold.ttf', italic: 'FiraSans-Italic.ttf', boldItalic: 'FiraSans-BoldItalic.ttf' },
  { family: 'Lato', regular: 'Lato-Regular.ttf', bold: 'Lato-Bold.ttf', italic: 'Lato-Italic.ttf', boldItalic: 'Lato-BoldItalic.ttf' },
  { family: 'Poppins', regular: 'Poppins-Regular.ttf', bold: 'Poppins-Bold.ttf', italic: 'Poppins-Italic.ttf', boldItalic: 'Poppins-BoldItalic.ttf' },
  { family: 'PT Sans', regular: 'PT_Sans-Web-Regular.ttf', bold: 'PT_Sans-Web-Bold.ttf', italic: 'PT_Sans-Web-Italic.ttf', boldItalic: 'PT_Sans-Web-BoldItalic.ttf' },
  { family: 'Barlow', regular: 'Barlow-Regular.ttf', bold: 'Barlow-Bold.ttf', italic: 'Barlow-Italic.ttf', boldItalic: 'Barlow-BoldItalic.ttf' },
  // Serif
  { family: 'Tinos', regular: 'Tinos-Regular.ttf', bold: 'Tinos-Bold.ttf', italic: 'Tinos-Italic.ttf', boldItalic: 'Tinos-BoldItalic.ttf' },
  { family: 'Crimson Text', regular: 'CrimsonText-Regular.ttf', bold: 'CrimsonText-Bold.ttf', italic: 'CrimsonText-Italic.ttf', boldItalic: 'CrimsonText-BoldItalic.ttf' },
  { family: 'PT Serif', regular: 'PT_Serif-Web-Regular.ttf', bold: 'PT_Serif-Web-Bold.ttf', italic: 'PT_Serif-Web-Italic.ttf', boldItalic: 'PT_Serif-Web-BoldItalic.ttf' },
  { family: 'DM Serif Display', regular: 'DMSerifDisplay-Regular.ttf', italic: 'DMSerifDisplay-Italic.ttf' },
  // Monospace
  { family: 'IBM Plex Mono', regular: 'IBMPlexMono-Regular.ttf', bold: 'IBMPlexMono-Bold.ttf', italic: 'IBMPlexMono-Italic.ttf', boldItalic: 'IBMPlexMono-BoldItalic.ttf' },
  { family: 'Cousine', regular: 'Cousine-Regular.ttf', bold: 'Cousine-Bold.ttf', italic: 'Cousine-Italic.ttf', boldItalic: 'Cousine-BoldItalic.ttf' },
  // Display / headline
  { family: 'Anton', regular: 'Anton-Regular.ttf' },
  { family: 'Bebas Neue', regular: 'BebasNeue-Regular.ttf' },
  { family: 'Abril Fatface', regular: 'AbrilFatface-Regular.ttf' },
  { family: 'Archivo Black', regular: 'ArchivoBlack-Regular.ttf' },
  { family: 'Righteous', regular: 'Righteous-Regular.ttf' },
  // Script / handwriting
  { family: 'Pacifico', regular: 'Pacifico-Regular.ttf' },
  { family: 'Great Vibes', regular: 'GreatVibes-Regular.ttf' },
  { family: 'Indie Flower', regular: 'IndieFlower-Regular.ttf' },
  { family: 'Shadows Into Light', regular: 'ShadowsIntoLight.ttf' },
  { family: 'Lobster', regular: 'Lobster-Regular.ttf' },
  { family: 'Caveat', regular: 'Caveat-Regular.ttf' },
  // Sans-serif (Google Fonts — matches the presets templates/CoordinateTable.tsx already offered)
  { family: 'Roboto', regular: 'Roboto-Regular.woff', bold: 'Roboto-Bold.woff', italic: 'Roboto-Italic.woff', boldItalic: 'Roboto-BoldItalic.woff' },
  { family: 'Open Sans', regular: 'OpenSans-Regular.woff', bold: 'OpenSans-Bold.woff', italic: 'OpenSans-Italic.woff', boldItalic: 'OpenSans-BoldItalic.woff' },
  { family: 'Montserrat', regular: 'Montserrat-Regular.woff', bold: 'Montserrat-Bold.woff', italic: 'Montserrat-Italic.woff', boldItalic: 'Montserrat-BoldItalic.woff' },
  { family: 'Raleway', regular: 'Raleway-Regular.woff', bold: 'Raleway-Bold.woff', italic: 'Raleway-Italic.woff', boldItalic: 'Raleway-BoldItalic.woff' },
  { family: 'Oswald', regular: 'Oswald-Regular.woff', bold: 'Oswald-Bold.woff' },
  { family: 'Nunito', regular: 'Nunito-Regular.woff', bold: 'Nunito-Bold.woff', italic: 'Nunito-Italic.woff', boldItalic: 'Nunito-BoldItalic.woff' },
  { family: 'Ubuntu', regular: 'Ubuntu-Regular.woff', bold: 'Ubuntu-Bold.woff', italic: 'Ubuntu-Italic.woff', boldItalic: 'Ubuntu-BoldItalic.woff' },
  // Script
  { family: 'Dancing Script', regular: 'DancingScript-Regular.woff', bold: 'DancingScript-Bold.woff' },
  // Hindi / Devanagari
  { family: 'Mukta', regular: 'Mukta-Regular.woff', bold: 'Mukta-Bold.woff', language: 'hi' },
  { family: 'Hind', regular: 'Hind-Regular.woff', bold: 'Hind-Bold.woff', language: 'hi' },
  { family: 'Tiro Devanagari Hindi', regular: 'TiroDevanagariHindi-Regular.woff', italic: 'TiroDevanagariHindi-Italic.woff', language: 'hi' },
  { family: 'Baloo 2', regular: 'Baloo2-Regular.woff', bold: 'Baloo2-Bold.woff', language: 'hi' },
  { family: 'Laila', regular: 'Laila-Regular.woff', bold: 'Laila-Bold.woff', language: 'hi' },
  { family: 'Yatra One', regular: 'YatraOne-Regular.woff', language: 'hi' },
  { family: 'Kalam', regular: 'Kalam-Regular.woff', bold: 'Kalam-Bold.woff', language: 'hi' },
];

async function upsertGlobalFont(name: string, fileUrl: string, language: string) {
  const existing = await prisma.pressFont.findFirst({ where: { pressId: null, name } });
  if (existing) {
    if (existing.fileUrl !== fileUrl || existing.language !== language) {
      await prisma.pressFont.update({ where: { id: existing.id }, data: { fileUrl, language } });
      console.log(`  updated: ${name}`);
    }
    return;
  }
  await prisma.pressFont.create({ data: { pressId: null, name, fileUrl, language } });
  console.log(`  added:   ${name}`);
}

async function main() {
  console.log(`Seeding ${BUILTIN_FONTS.length} built-in font families as global fonts...\n`);

  for (const font of BUILTIN_FONTS) {
    const lang = font.language ?? 'en';
    await upsertGlobalFont(font.family, `${FONT_DIR}/${font.regular}`, lang);
    if (font.bold) await upsertGlobalFont(`${font.family} Bold`, `${FONT_DIR}/${font.bold}`, lang);
    if (font.italic) await upsertGlobalFont(`${font.family} Italic`, `${FONT_DIR}/${font.italic}`, lang);
    if (font.boldItalic) await upsertGlobalFont(`${font.family} Bold Italic`, `${FONT_DIR}/${font.boldItalic}`, lang);
  }

  const total = BUILTIN_FONTS.reduce(
    (n, f) => n + 1 + (f.bold ? 1 : 0) + (f.italic ? 1 : 0) + (f.boldItalic ? 1 : 0),
    0
  );
  console.log(`\nDone. ${total} font rows across ${BUILTIN_FONTS.length} families are now available to every press.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
