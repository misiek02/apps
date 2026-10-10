const path = require('path');
const fs = require('fs');

const STOCK_DIR = path.resolve(__dirname, '..', 'assets', 'logos', 'stock');

const STOCK_ICONS = [
  {
    id: 'tools',
    name: 'Narzędzia / System / Projekt',
    filename: 'tools.svg',
    keywords: ['PROJECT', 'SYSTEM', 'TOOL', 'TOOLS', 'UTILITIES', 'DEV', 'DEVELOPER', 'SERVICE', 'CLI'],
    description: 'Klucz i narzędzia serwisowe'
  },
  {
    id: 'music',
    name: 'Muzyka / Audio',
    filename: 'music.svg',
    keywords: ['MUSIC', 'AUDIO', 'SOUND', 'SONG', 'TRACK'],
    description: 'Nuta muzyczna'
  },
  {
    id: 'media',
    name: 'Odtwarzacz wideo / Media',
    filename: 'media.svg',
    keywords: ['MEDIA', 'VIDEO', 'MOVIE', 'STREAM', 'STREAMING', 'PLAYER'],
    description: 'Przycisk odtwarzania'
  },
  {
    id: 'editor',
    name: 'Edytor kodu / Tekstu',
    filename: 'editor.svg',
    keywords: ['EDITOR', 'CODE', 'TEXT', 'MARKDOWN', 'NOTE', 'NOTES', 'IDE', 'WRITER'],
    description: 'Ołówek i edycja'
  },
  {
    id: 'store',
    name: 'Sklep / Pobieranie',
    filename: 'store.svg',
    keywords: ['STORE', 'SHOP', 'MARKET', 'DOWNLOAD', 'APP STORE'],
    description: 'Torba zakupowa / sklep'
  },
  {
    id: 'package',
    name: 'Menedżer aplikacji / Pakiet',
    filename: 'package.svg',
    keywords: ['APP MANAGER', 'PACKAGE', 'MODULE', 'SYSTEM TOOL', 'CORE'],
    description: 'Sześcian / moduł / paczka'
  },
  {
    id: 'folder',
    name: 'Menedżer plików / Dysk',
    filename: 'folder.svg',
    keywords: ['FILE', 'FILES', 'FOLDER', 'STORAGE', 'DISK', 'DIRECTORY', 'EXPLORER', 'PIPE', 'FILE MANAGER'],
    description: 'Folder katalogu'
  },
  {
    id: 'reader',
    name: 'Czytnik książek / Mangi / Dokumentów',
    filename: 'reader.svg',
    keywords: ['READER', 'BOOK', 'MANGA', 'COMIC', 'DOCUMENT', 'PDF', 'READ'],
    description: 'Otwarta książka'
  },
  {
    id: 'desktop',
    name: 'Tryb pulpitu / Ekran / Monitor',
    filename: 'desktop.svg',
    keywords: ['DESKTOP', 'SCREEN', 'MONITOR', 'DISPLAY', 'WORKSPACE'],
    description: 'Monitor stacjonarny'
  },
  {
    id: 'extension',
    name: 'Rozszerzenie przeglądarki / Wtyczka',
    filename: 'extension.svg',
    keywords: ['EXTENSION', 'BROWSER', 'WEB', 'PLUGIN', 'ADDON', 'CHROME', 'FIREFOX'],
    description: 'Element puzzla'
  },
  {
    id: 'app',
    name: 'Aplikacja ogólna (Domyślna)',
    filename: 'app.svg',
    keywords: ['APP', 'DEFAULT', 'OTHER', 'MISC'],
    description: 'Uniwersalna gwiazda / ikona aplikacji'
  }
];

/**
 * Find the best matching stock icon for a given badge label and section
 */
function getStockIconForLabel(label = '', section = '') {
  const norm = `${label} ${section}`.toUpperCase().trim();

  for (const item of STOCK_ICONS) {
    if (item.id === 'app') continue;
    for (const kw of item.keywords) {
      if (norm.includes(kw)) {
        return {
          ...item,
          path: path.join(STOCK_DIR, item.filename),
          relPath: `assets/logos/stock/${item.filename}`
        };
      }
    }
  }

  const def = STOCK_ICONS.find(i => i.id === 'app') || STOCK_ICONS[0];
  return {
    ...def,
    path: path.join(STOCK_DIR, def.filename),
    relPath: `assets/logos/stock/${def.filename}`
  };
}

module.exports = {
  STOCK_DIR,
  STOCK_ICONS,
  getStockIconForLabel
};
