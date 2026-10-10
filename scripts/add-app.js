#!/usr/bin/env node

/**
 * Interactive CLI wizard for adding a new application badge.
 * Provides a professional terminal interface to select or create categories,
 * configure badge metadata, import/download logos, and update README.md.
 *
 * Usage:
 *   node scripts/add-app.js
 *   npm run add
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const { c, box, printHeader, printStep, select, input, confirm } = require('./tui');
const { generateBadgeSvg } = require('./generate-badges');
const { getStockIconForLabel, STOCK_ICONS, STOCK_DIR } = require('./stock-icons');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'badges.config.json');
const README_PATH = path.join(ROOT_DIR, 'README.md');
const LOGOS_DIR = path.join(ROOT_DIR, 'assets', 'logos');
const BADGES_DIR = path.join(ROOT_DIR, 'assets', 'badges');

// Standard color palette matching Shields.io
const COLOR_PRESETS = [
  { name: 'Niebieski (Blue - Project / System Tool)', value: '#007ec6', color: c.blue },
  { name: 'Czerwony (Red - Music Player / Extension)', value: '#dd4343', color: c.red },
  { name: 'Pomarańczowy (Orange - Tools / Manga Reader)', value: '#ea7233', color: c.yellow },
  { name: 'Zielony (Green - Editor / App Manager)', value: '#67ac09', color: c.green },
  { name: 'Fioletowy (Blueviolet - App Store)', value: '#8a2be2', color: c.magenta },
  { name: 'Morski (Teal - Utilities)', value: '#008080', color: c.cyan },
  { name: 'Ciemnoniebieski (Darkblue - Desktop Mode)', value: '#00008b', color: c.blue },
  { name: 'Żółty (Yellow - File Manager)', value: '#d8b800', color: c.brightYellow },
  { name: 'Błękitny (Pastel Blue - Audio Player, ciemny tekst)', value: '#99ccff', color: c.brightCyan, textColor: '#333333' },
  { name: '🎨 Własny kolor (wprowadź kod HEX)', value: '__CUSTOM__' }
];

const LICENSE_PRESETS = [
  { name: '⚡ Pomiń (Nieokreślona / Pomiń ten krok)', value: 'SKIP' },
  { name: 'GPL-3.0 (GNU General Public License v3.0)', value: 'GPL-3.0' },
  { name: 'MIT License', value: 'MIT' },
  { name: 'Apache-2.0 (Apache License 2.0)', value: 'Apache-2.0' },
  { name: 'AGPL-3.0 (GNU Affero GPL v3.0)', value: 'AGPL-3.0' },
  { name: 'MPL-2.0 (Mozilla Public License 2.0)', value: 'MPL-2.0' },
  { name: 'LGPL-3.0 (GNU Lesser GPL v3.0)', value: 'LGPL-3.0' },
  { name: 'BSD-3-Clause', value: 'BSD-3-Clause' },
  { name: 'Fair Source / Inna licencja otwarta', value: 'Fair Source' },
  { name: 'Wpisz inną licencję...', value: '__CUSTOM__' }
];

function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function downloadFile(urlStr, destPath) {
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(urlStr);
      const client = url.protocol === 'https:' ? https : http;
      const file = fs.createWriteStream(destPath);
      
      const req = client.get(urlStr, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Node.js)' }
      }, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          fs.unlinkSync(destPath);
          return resolve(downloadFile(res.headers.location, destPath));
        }
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(destPath);
          return reject(new Error(`Pobieranie nie powiodło się (HTTP ${res.statusCode})`));
        }
        res.pipe(file);
        file.on('finish', () => {
          file.close(() => resolve());
        });
      });
      req.on('error', (err) => {
        file.close();
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
        reject(err);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function insertBadgeIntoReadme(content, section, badgeMarkdown) {
  const headerRegex = new RegExp(`^(##\\s+${section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$)`, 'm');
  const match = headerRegex.exec(content);
  if (!match) {
    // Append new section to README
    return content.trimEnd() + '\n\n## ' + section + '\n' + badgeMarkdown + '\n';
  }
  const startIndex = match.index + match[0].length;
  const nextHeaderRegex = /^##\s+/m;
  const afterHeader = content.slice(startIndex);
  const nextMatch = nextHeaderRegex.exec(afterHeader);
  const sectionContent = nextMatch ? afterHeader.slice(0, nextMatch.index) : afterHeader;
  const remainder = nextMatch ? afterHeader.slice(nextMatch.index) : '';
  const lines = sectionContent.split('\n');
  let lastBadgeIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('[![')) {
      lastBadgeIndex = i;
    }
  }
  if (lastBadgeIndex >= 0) {
    lines.splice(lastBadgeIndex + 1, 0, badgeMarkdown);
  } else {
    lines.unshift(badgeMarkdown);
  }
  return content.slice(0, startIndex) + lines.join('\n') + remainder;
}

async function runWizard() {
  printHeader('KREATOR DODAWANIA APLIKACJI', 'Wybierz kategorię, wprowadź dane i wygeneruj oficjalny lokalny badge');

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`${c.red}Błąd: Nie znaleziono ${CONFIG_PATH}${c.reset}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const apps = config.apps || [];
  const style = config.style || {};

  // Find existing sections
  const existingSections = Array.from(new Set(apps.map(a => a.section).filter(Boolean)));
  if (existingSections.length === 0) {
    existingSections.push('Desktop Apps', 'Android Apps', 'Browser Extentions');
  }

  // --- KROK 1: Wybór kategorii ---
  printStep(1, 7, 'Wybór kategorii (sekcji w repozytorium)');
  console.log(`${c.dim}Wybierz istniejącą kategorię w README.md lub utwórz nową sekcję:${c.reset}`);

  const sectionChoices = existingSections.map(sec => {
    const count = apps.filter(a => a.section === sec).length;
    return {
      name: `${sec} (${count} ${count === 1 ? 'pozycja' : 'pozycji'})`,
      value: sec
    };
  });
  sectionChoices.push({
    name: '➕ Utwórz nową kategorię...',
    value: '__NEW_CATEGORY__'
  });

  const selectedSectionChoice = await select({
    message: 'Wybierz kategorię docelową:',
    choices: sectionChoices
  });

  let targetSection = selectedSectionChoice;
  if (selectedSectionChoice === '__NEW_CATEGORY__') {
    targetSection = await input({
      message: 'Wprowadź nazwę nowej kategorii (np. CLI Tools, iOS Apps, Web Apps)',
      validate: (val) => val.trim().length > 0 || 'Nazwa kategorii nie może być pusta'
    });
  }

  // --- KROK 2: Nazwa aplikacji ---
  printStep(2, 7, 'Nazwa i identyfikator aplikacji');
  const appName = await input({
    message: 'Wprowadź nazwę aplikacji (np. VLC, OBS Studio, Signal)',
    validate: (val) => val.trim().length > 0 || 'Nazwa aplikacji nie może być pusta'
  });

  const defaultId = slugify(appName);
  const appId = await input({
    message: 'Identyfikator aplikacji (kebab-case, używany w nazwach plików)',
    defaultValue: defaultId,
    validate: (val) => {
      if (!/^[a-z0-9-]+$/.test(val)) return 'Identyfikator musi zawierać tylko małe litery, cyfry i myślniki (kebab-case)';
      if (apps.some(a => a.id === val)) return `Aplikacja o identyfikatorze "${val}" już istnieje w konfiguracji!`;
      return true;
    }
  });

  // --- KROK 3: Etykieta kategorii badge'a (Badge Label) ---
  printStep(3, 7, 'Etykieta prawej sekcji badge\'a');
  console.log(`${c.dim}Tekst wyświetlany po prawej stronie na kolorowym tle (np. TOOLS, PROJECT):${c.reset}`);

  const existingBadgeCategories = Array.from(new Set(apps.map(a => a.category).filter(Boolean)));
  const categoryChoices = existingBadgeCategories.map(cat => ({ name: cat, value: cat }));
  categoryChoices.push({ name: '➕ Własna etykieta...', value: '__CUSTOM__' });

  let badgeCategory = await select({
    message: 'Wybierz etykietę badge\'a:',
    choices: categoryChoices
  });

  if (badgeCategory === '__CUSTOM__') {
    badgeCategory = await input({
      message: 'Wprowadź własną etykietę badge\'a (np. MEDIA PLAYER, DATABASE)',
      defaultValue: 'PROJECT',
      validate: (val) => val.trim().length > 0 || 'Etykieta nie może być pusta'
    });
  }
  badgeCategory = badgeCategory.toUpperCase();

  // --- KROK 4: Kolor badge'a ---
  printStep(4, 7, 'Wybór koloru prawej sekcji');
  console.log(`${c.dim}Wybierz kolor odpowiadający kategorii lub podaj kod HEX:${c.reset}`);

  const colorChoice = await select({
    message: 'Wybierz kolor badge\'a:',
    choices: COLOR_PRESETS
  });

  let badgeColor = colorChoice;
  let textColor = '#ffffff';

  if (colorChoice === '__CUSTOM__') {
    badgeColor = await input({
      message: 'Podaj kod koloru w formacie HEX (np. #10b981)',
      defaultValue: '#007ec6',
      validate: (val) => /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(val) || 'Podaj poprawny kod HEX (np. #007ec6 lub #10b981)'
    });
  } else {
    const preset = COLOR_PRESETS.find(p => p.value === colorChoice);
    if (preset && preset.textColor) {
      textColor = preset.textColor;
    }
  }

  // --- KROK 5: Link docelowy ---
  printStep(5, 7, 'Adres URL aplikacji');
  const appUrl = await input({
    message: 'Adres URL oficjalnej strony lub repozytorium (Enter = domyślny)',
    defaultValue: 'https://github.com/',
    validate: (val) => /^https?:\/\/.+/.test(val) || 'Podaj poprawny adres URL (np. https://github.com/...)'
  });

  // --- KROK 6: Logo aplikacji ---
  printStep(6, 7, 'Logo aplikacji (Oficjalne lub Stockowe)');
  console.log(`${c.dim}Możesz podać oficjalne logo lub pominąć ten krok i użyć ikony stockowej dla "${badgeCategory}":${c.reset}`);

  const suggestedStock = getStockIconForLabel(badgeCategory, targetSection);

  const logoMode = await select({
    message: 'Wybierz źródło logo aplikacji:',
    choices: [
      { name: `⚡ Pomiń / Użyj ikony stockowej dla "${badgeCategory}" (${suggestedStock.description})`, value: 'stock' },
      { name: '📁 Lokalna ścieżka do pliku (SVG / PNG)', value: 'local' },
      { name: '🌐 Pobierz automatycznie z adresu URL', value: 'url' },
      { name: '🎨 Wybierz inną ikonę z biblioteki stockowej...', value: 'pick_stock' }
    ]
  });

  fs.mkdirSync(LOGOS_DIR, { recursive: true });
  let finalLogoPath = '';
  let localSrcPath = null;
  let remoteDownloadUrl = null;
  let logoDestPath = '';
  let isStockLogo = false;
  let chosenStock = suggestedStock;

  if (logoMode === 'stock') {
    isStockLogo = true;
    const destName = `${appId}.svg`;
    logoDestPath = path.join(LOGOS_DIR, destName);
    localSrcPath = suggestedStock.path;
    finalLogoPath = `assets/logos/${destName}`;
    console.log(`  ${c.cyan}ℹ Wybrano stockową ikonę:${c.reset} ${suggestedStock.name} (${suggestedStock.filename})\n`);
  } else if (logoMode === 'pick_stock') {
    isStockLogo = true;
    const stockChoice = await select({
      message: 'Wybierz ikonę z biblioteki stockowej:',
      choices: STOCK_ICONS.map(item => ({
        name: `${item.name} — ${item.description}`,
        value: item.id
      }))
    });
    chosenStock = STOCK_ICONS.find(i => i.id === stockChoice) || suggestedStock;
    const destName = `${appId}.svg`;
    logoDestPath = path.join(LOGOS_DIR, destName);
    localSrcPath = path.join(STOCK_DIR, chosenStock.filename);
    finalLogoPath = `assets/logos/${destName}`;
    console.log(`  ${c.cyan}ℹ Wybrano stockową ikonę:${c.reset} ${chosenStock.name} (${chosenStock.filename})\n`);
  } else if (logoMode === 'local') {
    const srcPath = await input({
      message: 'Podaj ścieżkę do pliku logo (Enter = pomiń i użyj stockowej)',
      defaultValue: '',
      hint: 'SVG / PNG'
    });

    if (!srcPath.trim()) {
      isStockLogo = true;
      const destName = `${appId}.svg`;
      logoDestPath = path.join(LOGOS_DIR, destName);
      localSrcPath = suggestedStock.path;
      finalLogoPath = `assets/logos/${destName}`;
      console.log(`  ${c.yellow}ℹ Pominięto ścieżkę — użyto ikony stockowej:${c.reset} ${suggestedStock.name}\n`);
    } else {
      const absSrc = path.isAbsolute(srcPath) ? srcPath : path.resolve(ROOT_DIR, srcPath);
      if (!fs.existsSync(absSrc)) {
        console.log(`  ${c.yellow}⚠ Plik nie istnieje pod ścieżką "${absSrc}" — użyto ikony stockowej: ${suggestedStock.name}${c.reset}\n`);
        isStockLogo = true;
        const destName = `${appId}.svg`;
        logoDestPath = path.join(LOGOS_DIR, destName);
        localSrcPath = suggestedStock.path;
        finalLogoPath = `assets/logos/${destName}`;
      } else {
        const ext = path.extname(absSrc).toLowerCase() || '.svg';
        const destName = `${appId}${ext}`;
        logoDestPath = path.join(LOGOS_DIR, destName);
        localSrcPath = absSrc;
        finalLogoPath = `assets/logos/${destName}`;
      }
    }
  } else {
    // logoMode === 'url'
    const urlInput = await input({
      message: 'Wprowadź adres URL pliku logo (Enter = pomiń i użyj stockowej)',
      defaultValue: ''
    });

    if (!urlInput.trim()) {
      isStockLogo = true;
      const destName = `${appId}.svg`;
      logoDestPath = path.join(LOGOS_DIR, destName);
      localSrcPath = suggestedStock.path;
      finalLogoPath = `assets/logos/${destName}`;
      console.log(`  ${c.yellow}ℹ Pominięto URL — użyto ikony stockowej:${c.reset} ${suggestedStock.name}\n`);
    } else {
      remoteDownloadUrl = urlInput.trim();
      let ext = '.svg';
      const matchExt = remoteDownloadUrl.match(/\.(svg|png|jpg|jpeg)/i);
      if (matchExt) ext = matchExt[0].toLowerCase();
      const destName = `${appId}${ext}`;
      logoDestPath = path.join(LOGOS_DIR, destName);
      finalLogoPath = `assets/logos/${destName}`;
    }
  }

  // --- KROK 7: Licencja i metadane ---
  printStep(7, 7, 'Licencja i informacje o źródle');
  const licenseChoice = await select({
    message: 'Wybierz licencję aplikacji / grafiki (lub pomiń):',
    choices: LICENSE_PRESETS
  });

  let appLicense = licenseChoice;
  if (licenseChoice === 'SKIP') {
    appLicense = 'Not specified';
  } else if (licenseChoice === '__CUSTOM__') {
    appLicense = await input({
      message: 'Podaj nazwę licencji (Enter = Not specified)',
      defaultValue: 'Not specified'
    });
  }

  const defaultLogoSource = isStockLogo
    ? `Ikona stockowa (${chosenStock.name})`
    : `Oficjalne repozytorium: ${appUrl}`;

  let logoSource = defaultLogoSource;
  if (!isStockLogo) {
    logoSource = await input({
      message: 'Podaj źródło pochodzenia logo (Enter = użyj domyślnego)',
      defaultValue: defaultLogoSource
    });
  }

  // --- PODSUMOWANIE ---
  console.log('\n' + box('PODSUMOWANIE NOWEJ POZYCJI', [
    `${c.bold}Kategoria (sekcja):${c.reset}  ${targetSection}`,
    `${c.bold}Nazwa aplikacji:${c.reset}     ${appName}`,
    `${c.bold}Identyfikator (ID):${c.reset}  ${appId}`,
    `${c.bold}Etykieta badge'a:${c.reset}    ${badgeCategory}`,
    `${c.bold}Kolor badge'a:${c.reset}       ${badgeColor}`,
    `${c.bold}Adres URL:${c.reset}           ${appUrl}`,
    `${c.bold}Plik logo:${c.reset}           ${finalLogoPath} ${isStockLogo ? c.dim + '(stockowa: ' + chosenStock.name + ')' + c.reset : ''}`,
    `${c.bold}Licencja:${c.reset}            ${appLicense}`,
    `${c.bold}Źródło logo:${c.reset}         ${logoSource}`
  ], 68) + '\n');

  const shouldSave = await confirm({
    message: 'Czy zatwierdzić dane i dodać aplikację do repozytorium?'
  });

  if (!shouldSave) {
    console.log(`${c.yellow}Operacja anulowana. Żadne pliki nie zostały zmodyfikowane.${c.reset}`);
    return;
  }

  // --- ZAPIS I GENEROWANIE ---
  console.log(`${c.cyan}Zapisywanie zmian...${c.reset}`);

  // 0. Zapisz/pobierz plik logo
  if (localSrcPath) {
    if (path.resolve(localSrcPath) !== path.resolve(logoDestPath)) {
      fs.copyFileSync(localSrcPath, logoDestPath);
      console.log(`  ${c.green}✔ Skopiowano logo do:${c.reset} ${finalLogoPath}`);
    }
  } else if (remoteDownloadUrl) {
    console.log(`  ${c.cyan}Pobieranie grafiki...${c.reset}`);
    await downloadFile(remoteDownloadUrl, logoDestPath);
    console.log(`  ${c.green}✔ Pobrano logo do:${c.reset} ${finalLogoPath}`);
  }

  const newAppEntry = {
    id: appId,
    name: appName.toUpperCase(),
    category: badgeCategory,
    color: badgeColor,
    logo: finalLogoPath,
    url: appUrl,
    section: targetSection,
    logoSource: logoSource,
    license: appLicense
  };

  if (appLicense !== 'Not specified' && appUrl.startsWith('https://github.com/') && appUrl.length > 20) {
    newAppEntry.licenseUrl = `${appUrl.replace(/\/+$/, '')}/blob/main/LICENSE`;
  }

  if (textColor !== '#ffffff') {
    newAppEntry.textColor = textColor;
  }

  // 1. Zaktualizuj badges.config.json
  config.apps.push(newAppEntry);
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', 'utf8');
  console.log(`  ${c.green}✔ Zaktualizowano:${c.reset} badges.config.json`);

  // 2. Wygeneruj badge SVG
  fs.mkdirSync(BADGES_DIR, { recursive: true });
  const { svg, width, height } = generateBadgeSvg(newAppEntry, style);
  const badgeSvgPath = path.join(BADGES_DIR, `${appId}.svg`);
  fs.writeFileSync(badgeSvgPath, svg, 'utf8');
  console.log(`  ${c.green}✔ Wygenerowano badge:${c.reset} assets/badges/${appId}.svg (${width}x${height}px)`);

  // 3. Zaktualizuj README.md
  const readmeRaw = fs.readFileSync(README_PATH, 'utf8');
  const badgeMarkdown = `[![${appName}](assets/badges/${appId}.svg)](${appUrl})`;
  const updatedReadme = insertBadgeIntoReadme(readmeRaw, targetSection, badgeMarkdown);
  fs.writeFileSync(README_PATH, updatedReadme, 'utf8');
  console.log(`  ${c.green}✔ Zaktualizowano:${c.reset} README.md (dodano badge pod sekcją "${targetSection}")`);

  // 4. Wygeneruj odświeżony preview-badges.html
  try {
    execSync('node scripts/generate-badges.js', { cwd: ROOT_DIR, stdio: 'ignore' });
    console.log(`  ${c.green}✔ Zaktualizowano:${c.reset} preview-badges.html`);
  } catch (e) {
    // ignore
  }

  console.log('\n' + box('SUKCES! APLIKACJA ZOSTAŁA POMYŚLNIE DODANA', [
    `${c.bold}Plik badge'a:${c.reset}      assets/badges/${appId}.svg`,
    `${c.bold}Podgląd w README:${c.reset}  ${badgeMarkdown}`,
    `${c.bold}Sekcja w README:${c.reset}   ## ${targetSection}`,
    '',
    `${c.dim}Możesz uruchomić "npm test" aby sprawdzić pełną spójność repozytorium.${c.reset}`
  ], 68) + '\n');
}

if (require.main === module) {
  runWizard().catch(err => {
    console.error(`\n${c.red}Wystąpił błąd: ${err.message}${c.reset}`);
    process.exit(1);
  });
}

module.exports = { runWizard, insertBadgeIntoReadme };
