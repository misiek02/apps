#!/usr/bin/env node

/**
 * Main Interactive Terminal Dashboard for managing apps and badges.
 *
 * Usage:
 *   node scripts/cli.js
 *   npm start
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { c, box, printHeader, select, confirm } = require('./tui');
const { runWizard } = require('./add-app');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'badges.config.json');

function listApps() {
  printHeader('LISTA KATEGORII I APLIKACJI', 'Podgląd aktualnie zarejestrowanych pozycji w repozytorium');

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`${c.red}Nie znaleziono pliku ${CONFIG_PATH}${c.reset}`);
    return;
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const apps = config.apps || [];

  const sections = Array.from(new Set(apps.map(a => a.section || 'Inne')));

  sections.forEach((section) => {
    const sectionApps = apps.filter(a => (a.section || 'Inne') === section);
    console.log(`\n${c.bold}${c.brightCyan}📁 ${section}${c.reset} ${c.dim}(${sectionApps.length} pozycji)${c.reset}`);
    console.log(`${c.dim}${'─'.repeat(64)}${c.reset}`);

    sectionApps.forEach((app, idx) => {
      const colorBox = `${c.bold}[${app.category}]${c.reset}`;
      console.log(`  ${c.dim}${String(idx + 1).padStart(2, ' ')}.${c.reset} ${c.bold}${app.name.padEnd(26, ' ')}${c.reset} ${colorBox.padEnd(20, ' ')} ${c.dim}${app.url}${c.reset}`);
    });
  });

  console.log(`\n${c.dim}${'─'.repeat(64)}${c.reset}`);
  console.log(`${c.bold}Łącznie zarejestrowanych aplikacji:${c.reset} ${c.brightGreen}${apps.length}${c.reset}\n`);
}

function runGenerate() {
  printHeader('GENEROWANIE BADGE\'Y SVG', 'Przebudowa wszystkich plików w assets/badges/');
  try {
    execSync('node scripts/generate-badges.js', { cwd: ROOT_DIR, stdio: 'inherit' });
  } catch (err) {
    console.error(`${c.red}Błąd podczas generowania badge'y!${c.reset}`);
  }
}

function runTests() {
  printHeader('TESTY WERYFIKACYJNE', 'Uruchamianie pełnego zestawu testów jakościowych');
  try {
    execSync('node scripts/test-badges.js', { cwd: ROOT_DIR, stdio: 'inherit' });
  } catch (err) {
    console.error(`${c.red}Niektóre testy zakończyły się niepowodzeniem!${c.reset}`);
  }
}

async function mainLoop() {
  while (true) {
    printHeader('APPS MANAGER • TERMINAL CLI', 'Profesjonalne zarządzanie lokalnymi badge\'ami i kategoriami aplikacji');

    const choice = await select({
      message: 'Wybierz czynność, którą chcesz wykonać:',
      choices: [
        { label: '➕ Dodaj nową aplikację (interaktywny kreator)', value: 'add' },
        { label: '📋 Przeglądaj listę kategorii i aplikacji', value: 'list' },
        { label: '🎨 Przebuduj wszystkie badge\'e SVG', value: 'generate' },
        { label: '🧪 Uruchom testy weryfikacyjne', value: 'test' },
        { label: '🚪 Wyjście', value: 'exit' }
      ]
    });

    if (choice === 'add') {
      await runWizard();
      const again = await confirm({ message: 'Czy chcesz wrócić do menu głównego?', defaultValue: true });
      if (!again) break;
    } else if (choice === 'list') {
      listApps();
      await confirm({ message: 'Naciśnij Enter, aby powrócić do menu', defaultValue: true });
    } else if (choice === 'generate') {
      runGenerate();
      await confirm({ message: 'Naciśnij Enter, aby powrócić do menu', defaultValue: true });
    } else if (choice === 'test') {
      runTests();
      await confirm({ message: 'Naciśnij Enter, aby powrócić do menu', defaultValue: true });
    } else if (choice === 'exit') {
      console.log(`\n${c.cyan}Do widzenia! 👋${c.reset}\n`);
      break;
    }
  }
}

if (require.main === module) {
  mainLoop().catch(err => {
    console.error(`${c.red}Błąd aplikacji: ${err.message}${c.reset}`);
    process.exit(1);
  });
}

module.exports = { mainLoop };
