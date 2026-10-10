/**
 * Terminal User Interface (TUI) utility module.
 * Provides professional ANSI styling, box borders, interactive menus,
 * input prompts and validation with zero external dependencies.
 */

const readline = require('readline');

// ANSI Color and style codes
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',

  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',

  bgBlue: '\x1b[44m',
  bgCyan: '\x1b[46m',
  bgGray: '\x1b[100m'
};

function stripAnsi(str) {
  return String(str)
    .replace(/\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '')
    .replace(/\x1b/g, '')
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/g, '');
}

/**
 * Flush any buffered input in stdin (e.g. leftover arrow keys or enters from raw mode)
 */
function flushStdin() {
  if (process.stdin.isTTY) {
    try {
      while (process.stdin.read() !== null) {}
    } catch (_) {}
  }
}

/**
 * Shared Readline Instance for piped/standard input
 */
let sharedRl = null;
let lineIterator = null;

function getLineIterator() {
  if (!lineIterator) {
    sharedRl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });
    lineIterator = sharedRl[Symbol.asyncIterator]();
  }
  return lineIterator;
}

/**
 * Draw a clean rounded box with a title and content
 */
function box(title, lines, width = 68) {
  const horizontal = '─'.repeat(width - 2);
  const top = `${c.cyan}╭${horizontal}╮${c.reset}`;
  const bottom = `${c.cyan}╰${horizontal}╯${c.reset}`;

  const renderedLines = [];
  renderedLines.push(top);

  if (title) {
    const cleanTitle = ` ${stripAnsi(title)} `;
    const leftPad = 2;
    const rightPad = Math.max(0, width - 2 - leftPad - cleanTitle.length);
    const titleBar = `${c.cyan}│${' '.repeat(leftPad)}${c.bold}${c.brightWhite}${title}${c.reset}${' '.repeat(rightPad)}${c.cyan}│${c.reset}`;
    renderedLines.push(titleBar);
    renderedLines.push(`${c.cyan}├${horizontal}┤${c.reset}`);
  }

  for (const line of lines) {
    const clean = stripAnsi(line);
    const padding = Math.max(0, width - 4 - clean.length);
    renderedLines.push(`${c.cyan}│${c.reset}  ${line}${' '.repeat(padding)}${c.cyan}│${c.reset}`);
  }

  renderedLines.push(bottom);
  return renderedLines.join('\n');
}

/**
 * Display header banner
 */
function printHeader(title = 'APPS MANAGER CLI', subtitle = 'Kreator i generator badge\'y aplikacji') {
  if (process.stdin.isTTY) {
    console.clear();
  }
  const titleText = `${c.bold}${c.brightCyan}${title}${c.reset}`;
  const subText = `${c.dim}${subtitle}${c.reset}`;
  console.log(box('', [
    ` ${titleText}`,
    ` ${subText}`
  ], 68));
  console.log();
}

/**
 * Display step header
 */
function printStep(step, total, title) {
  console.log(`${c.bold}${c.brightCyan}◆ Krok [${step}/${total}]:${c.reset} ${c.bold}${title}${c.reset}`);
  console.log(`${c.dim}${'─'.repeat(54)}${c.reset}`);
}

/**
 * Helper to read a single line from input (works in both TTY and piped streams)
 */
function readLinePrompt(promptText) {
  if (process.stdin.isTTY) {
    flushStdin();
    return new Promise((resolve) => {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true
      });
      rl.question(promptText, (answer) => {
        rl.close();
        resolve(answer);
      });
    });
  } else {
    // Non-TTY mode (piped stream)
    return new Promise(async (resolve) => {
      process.stdout.write(promptText);
      const iter = getLineIterator();
      const next = await iter.next();
      if (next.done) return resolve('');
      resolve(next.value || '');
    });
  }
}

/**
 * Interactive Single-Choice Selection Menu
 * Supports arrow keys (↑ / ↓), numbers (1, 2, 3...) and Enter in TTY,
 * or number input fallback if not TTY.
 */
function select({ message, choices, defaultIndex = 0 }) {
  const items = choices.map((ch) => {
    if (typeof ch === 'string') {
      return { label: ch, value: ch, hint: '' };
    }
    return {
      label: ch.label || ch.name,
      value: ch.value !== undefined ? ch.value : ch.name,
      hint: ch.hint || '',
      color: ch.color || null
    };
  });

  let selectedIndex = Math.max(0, Math.min(defaultIndex, items.length - 1));

  // Non-TTY mode (e.g. piped or automated)
  if (!process.stdin.isTTY) {
    return new Promise(async (resolve) => {
      console.log(`\n${c.bold}? ${message}${c.reset}`);
      items.forEach((item, idx) => {
        console.log(`  [${idx + 1}] ${item.label} ${item.hint ? `(${item.hint})` : ''}`);
      });
      const ans = await readLinePrompt(`Wybierz numer (1-${items.length}, domyślnie ${selectedIndex + 1}): `);
      const num = parseInt(ans.trim(), 10);
      if (!isNaN(num) && num >= 1 && num <= items.length) {
        console.log(`  ${c.green}✔${c.reset} Wybrano: ${c.bold}${items[num - 1].label}${c.reset}\n`);
        resolve(items[num - 1].value);
      } else {
        console.log(`  ${c.green}✔${c.reset} Wybrano: ${c.bold}${items[selectedIndex].label}${c.reset}\n`);
        resolve(items[selectedIndex].value);
      }
    });
  }

  // TTY interactive mode with rawMode
  return new Promise((resolve) => {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.setRawMode(true);
    process.stdin.resume();

    let firstRender = true;
    let linesRendered = 0;

    function render() {
      if (!firstRender) {
        process.stdout.write(`\x1b[${linesRendered}A\x1b[0J`);
      }
      firstRender = false;

      const outputLines = [];
      outputLines.push(`${c.bold}${c.brightCyan}?${c.reset} ${c.bold}${message}${c.reset} ${c.dim}(użyj strzałek ↑/↓ lub numeru, naciśnij Enter)${c.reset}`);

      items.forEach((item, idx) => {
        const isSelected = idx === selectedIndex;
        const prefix = isSelected ? `${c.brightCyan}❯${c.reset} ` : '  ';
        const numStr = `${c.dim}[${idx + 1}]${c.reset}`;
        let labelStr = item.label;

        if (item.color) {
          labelStr = `${item.color}■${c.reset} ${item.label}`;
        }

        if (isSelected) {
          outputLines.push(`${prefix}${numStr} ${c.bold}${c.brightCyan}${labelStr}${c.reset} ${item.hint ? `${c.dim}(${item.hint})${c.reset}` : ''}`);
        } else {
          outputLines.push(`${prefix}${numStr} ${labelStr} ${item.hint ? `${c.dim}(${item.hint})${c.reset}` : ''}`);
        }
      });

      linesRendered = outputLines.length;
      process.stdout.write(outputLines.join('\n') + '\n');
    }

    render();

    function onKeypress(str, key) {
      if (key) {
        if (key.ctrl && key.name === 'c') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          console.log(`\n${c.yellow}Operacja anulowana przez użytkownika.${c.reset}`);
          process.exit(0);
        }

        if (key.name === 'up') {
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          render();
          return;
        }

        if (key.name === 'down') {
          selectedIndex = (selectedIndex + 1) % items.length;
          render();
          return;
        }

        if (key.name === 'return' || key.name === 'enter') {
          cleanup();
          resolve(items[selectedIndex].value);
          return;
        }

        // Direct numeric selection (1-9)
        const num = parseInt(str, 10);
        if (!isNaN(num) && num >= 1 && num <= items.length) {
          selectedIndex = num - 1;
          cleanup();
          resolve(items[selectedIndex].value);
          return;
        }
      }
    }

    function cleanup() {
      process.stdin.removeListener('keypress', onKeypress);
      process.stdin.setRawMode(false);
      flushStdin();
      console.log(`  ${c.green}✔${c.reset} Wybrano: ${c.bold}${items[selectedIndex].label}${c.reset}\n`);
    }

    process.stdin.on('keypress', onKeypress);
  });
}

/**
 * Text Input Prompt with Default and Validator
 */
async function input({ message, defaultValue = '', validate = null, hint = '' }) {
  const defaultHint = defaultValue ? ` ${c.dim}(domyślnie: ${defaultValue})${c.reset}` : '';
  const extraHint = hint ? ` ${c.dim}[${hint}]${c.reset}` : '';
  const promptText = `${c.bold}${c.brightCyan}?${c.reset} ${c.bold}${message}${c.reset}${defaultHint}${extraHint}: `;

  while (true) {
    const rawAnswer = await readLinePrompt(promptText);
    const clean = stripAnsi(rawAnswer).replace(/[\x00-\x1f\x7f-\x9f]/g, '').trim();
    const val = clean || defaultValue;
    if (validate) {
      const result = validate(val);
      if (result !== true) {
        console.log(`  ${c.red}✖ ${result || 'Niepoprawna wartość, spróbuj ponownie.'}${c.reset}`);
        continue;
      }
    }
    console.log(`  ${c.green}✔${c.reset} Wprowadzono: ${c.bold}${val}${c.reset}\n`);
    return val;
  }
}

/**
 * Yes / No Confirmation Prompt
 */
async function confirm({ message, defaultValue = true }) {
  const optionsHint = defaultValue ? `${c.bold}T${c.reset}/n` : `t/${c.bold}N${c.reset}`;
  const promptText = `${c.bold}${c.brightCyan}?${c.reset} ${c.bold}${message}${c.reset} (${optionsHint}): `;

  const rawAns = await readLinePrompt(promptText);
  const trimmed = stripAnsi(rawAns).trim().toLowerCase();
  let res = defaultValue;
  if (trimmed === 't' || trimmed === 'y' || trimmed === 'tak' || trimmed === 'yes') {
    res = true;
  } else if (trimmed === 'n' || trimmed === 'nie' || trimmed === 'no') {
    res = false;
  }
  console.log(`  ${res ? c.green + '✔ Tak' : c.yellow + '✖ Nie'}${c.reset}\n`);
  return res;
}

module.exports = {
  c,
  box,
  stripAnsi,
  printHeader,
  printStep,
  select,
  input,
  confirm
};
