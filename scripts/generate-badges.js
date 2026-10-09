#!/usr/bin/env node

/**
 * Script for generating local Shields.io-compatible 'for-the-badge' SVGs
 * with official embedded application logos.
 *
 * Usage:
 *   node scripts/generate-badges.js
 *   node scripts/generate-badges.js --preview
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'badges.config.json');
const OUTPUT_DIR = path.join(ROOT_DIR, 'assets', 'badges');
const DATA_DIR = path.join(__dirname, 'data');

// Ensure tables exist
const normalTablePath = path.join(DATA_DIR, 'verdana-10px-normal.json');
const boldTablePath = path.join(DATA_DIR, 'verdana-10px-bold.json');

if (!fs.existsSync(normalTablePath) || !fs.existsSync(boldTablePath)) {
  console.error('Error: Character width tables not found in', DATA_DIR);
  process.exit(1);
}

const normalTable = JSON.parse(fs.readFileSync(normalTablePath, 'utf8'));
const boldTable = JSON.parse(fs.readFileSync(boldTablePath, 'utf8'));

/**
 * Binary search consumer for Verdana 10px character width.
 * Replicates the exact algorithm used by Shields.io (anafanafo).
 */
function measureCharWidth(code, table) {
  if (code <= 31 || code === 127) return 0;
  let low = 0;
  let high = table.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const [start, end, width] = table[mid];
    if (code >= start && code <= end) {
      return width;
    } else if (code < start) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }
  return 10.0; // fallback em width
}

function measureTextWidth(text, bold = false) {
  const table = bold ? boldTable : normalTable;
  let total = 0;
  for (const char of text) {
    const code = char.codePointAt(0);
    total += measureCharWidth(code, table);
  }
  return total;
}

function escapeXml(unsafe) {
  return String(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate standalone SVG badge identical to Shields.io 'for-the-badge'
 */
function generateBadgeSvg(app, style) {
  const BADGE_HEIGHT = style.height || 28;
  const LABEL_BG = style.labelBackgroundColor || '#555';
  const DEFAULT_TEXT_COLOR = style.defaultTextColor || '#fff';
  const FONT_FAMILY = style.fontFamily || 'Verdana,Geneva,DejaVu Sans,sans-serif';
  const LETTER_SPACING = style.letterSpacing !== undefined ? style.letterSpacing : 1.25;
  const LOGO_MARGIN = style.logoMargin || 9;
  const LOGO_SIZE = style.logoSize || 14;
  const LOGO_TEXT_GUTTER = style.logoTextGutter || 6;
  const TEXT_MARGIN = style.textMargin || 12;

  const label = (app.name || '').toUpperCase();
  const message = (app.category || '').toUpperCase();

  // Width calculations matching Shields.io for-the-badge
  const labelTextWidth = label.length
    ? (measureTextWidth(label, false) | 0) + LETTER_SPACING * label.length
    : 0;

  const messageTextWidth = message.length
    ? (measureTextWidth(message, true) | 0) + LETTER_SPACING * message.length
    : 0;

  const logoMinX = LOGO_MARGIN;
  const labelTextMinX = logoMinX + LOGO_SIZE + LOGO_TEXT_GUTTER;
  const labelRectWidth = labelTextMinX + labelTextWidth + TEXT_MARGIN;
  const messageTextMinX = labelRectWidth + TEXT_MARGIN;
  const messageRectWidth = 2 * TEXT_MARGIN + messageTextWidth;
  const totalWidth = labelRectWidth + messageRectWidth;

  const labelMidX = labelTextMinX + 0.5 * labelTextWidth;
  const messageMidX = messageTextMinX + 0.5 * messageTextWidth;

  // Read logo and encode as base64 data URI
  const logoAbsPath = path.isAbsolute(app.logo)
    ? app.logo
    : path.join(ROOT_DIR, app.logo);

  if (!fs.existsSync(logoAbsPath)) {
    throw new Error(`Logo file not found: ${app.logo} (${logoAbsPath})`);
  }

  const logoBuffer = fs.readFileSync(logoAbsPath);
  const ext = path.extname(logoAbsPath).toLowerCase();
  let mimeType = 'image/png';
  if (ext === '.svg') {
    mimeType = 'image/svg+xml';
  } else if (ext === '.jpg' || ext === '.jpeg') {
    mimeType = 'image/jpeg';
  }

  const logoBase64 = `data:${mimeType};base64,${logoBuffer.toString('base64')}`;
  const accessibleText = `${label}: ${message}`;

  const messageTextColor = app.textColor || DEFAULT_TEXT_COLOR;
  const messageFillAttr = messageTextColor !== DEFAULT_TEXT_COLOR ? ` fill="${messageTextColor}"` : '';

  // Logo Y coordinate centers the icon vertically
  const logoY = Math.round((BADGE_HEIGHT - LOGO_SIZE) / 2);

  // Scale up coordinates by 10 for font rendering precision (matching Shields scale(.1))
  const leftX10 = (labelMidX * 10).toFixed(2).replace(/\.00$/, '');
  const rightX10 = (messageMidX * 10).toFixed(2).replace(/\.00$/, '');
  const labelLen10 = (labelTextWidth * 10).toFixed(1).replace(/\.0$/, '');
  const messageLen10 = (messageTextWidth * 10).toFixed(1).replace(/\.0$/, '');
  const totalWidthStr = totalWidth.toFixed(2).replace(/\.00$/, '');
  const leftRectWidthStr = labelRectWidth.toFixed(2).replace(/\.00$/, '');
  const rightRectWidthStr = messageRectWidth.toFixed(2).replace(/\.00$/, '');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidthStr}" height="${BADGE_HEIGHT}" role="img" aria-label="${escapeXml(accessibleText)}">` +
    `<title>${escapeXml(accessibleText)}</title>` +
    `<g shape-rendering="crispEdges">` +
    `<rect width="${leftRectWidthStr}" height="${BADGE_HEIGHT}" fill="${LABEL_BG}"/>` +
    `<rect x="${leftRectWidthStr}" width="${rightRectWidthStr}" height="${BADGE_HEIGHT}" fill="${app.color}"/>` +
    `</g>` +
    `<g fill="${DEFAULT_TEXT_COLOR}" text-anchor="middle" font-family="${escapeXml(FONT_FAMILY)}" text-rendering="geometricPrecision" font-size="100">` +
    `<image x="${logoMinX}" y="${logoY}" width="${LOGO_SIZE}" height="${LOGO_SIZE}" href="${logoBase64}"/>` +
    `<text transform="scale(.1)" x="${leftX10}" y="175" textLength="${labelLen10}">${escapeXml(label)}</text>` +
    `<text transform="scale(.1)" x="${rightX10}" y="175" textLength="${messageLen10}" font-weight="bold"${messageFillAttr}>${escapeXml(message)}</text>` +
    `</g>` +
    `</svg>\n`;

  return {
    svg,
    width: totalWidth,
    height: BADGE_HEIGHT,
    leftWidth: labelRectWidth,
    rightWidth: messageRectWidth
  };
}

function main() {
  console.log('Badge Generator: Migrating to local SVGs with official logos...');

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Config not found at ${CONFIG_PATH}`);
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const style = config.style || {};
  const apps = config.apps || [];

  if (!Array.isArray(apps) || apps.length === 0) {
    console.error('No apps configured in badges.config.json');
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const generated = [];
  const errors = [];

  for (const app of apps) {
    try {
      if (!app.id || !app.name || !app.category || !app.color || !app.logo) {
        throw new Error(`Missing required fields in app config: ${JSON.stringify(app)}`);
      }

      const { svg, width, height } = generateBadgeSvg(app, style);
      const outPath = path.join(OUTPUT_DIR, `${app.id}.svg`);
      fs.writeFileSync(outPath, svg, 'utf8');

      generated.push({
        id: app.id,
        name: app.name,
        category: app.category,
        file: `assets/badges/${app.id}.svg`,
        width,
        height
      });
      console.log(`  ✓ Generated: assets/badges/${app.id}.svg (${width}x${height}px) - ${app.name}`);
    } catch (err) {
      errors.push({ id: app.id || 'unknown', error: err.message });
      console.error(`  ✗ Failed: ${app.id || 'unknown'}: ${err.message}`);
    }
  }

  console.log('\n--- Summary Report ---');
  console.log(`Total configured apps : ${apps.length}`);
  console.log(`Successfully generated: ${generated.length}`);
  console.log(`Errors                : ${errors.length}`);

  // Generate preview HTML if requested or by default
  const previewHtmlPath = path.join(ROOT_DIR, 'preview-badges.html');
  const previewHtml = generatePreviewHtml(apps, generated);
  fs.writeFileSync(previewHtmlPath, previewHtml, 'utf8');
  console.log(`Preview generated     : preview-badges.html`);

  if (errors.length > 0) {
    process.exit(1);
  }
}

function generatePreviewHtml(apps, generated) {
  const rows = apps.map(app => {
    const badgePath = `assets/badges/${app.id}.svg`;
    const logoPath = app.logo;
    return `
      <tr>
        <td style="padding: 10px; font-weight: bold;">${escapeXml(app.name)}</td>
        <td style="padding: 10px;"><code>${escapeXml(app.section || '-')}</code></td>
        <td style="padding: 10px; text-align: center;"><img src="${escapeXml(logoPath)}" height="24" alt="${escapeXml(app.name)} Logo"/></td>
        <td style="padding: 10px; text-align: center;"><img src="${escapeXml(badgePath)}" alt="${escapeXml(app.name)} Badge"/></td>
        <td style="padding: 10px; font-size: 12px;"><a href="${escapeXml(app.url)}" target="_blank" rel="noopener">${escapeXml(app.url)}</a></td>
        <td style="padding: 10px; font-size: 11px;">${escapeXml(app.license || '-')}</td>
      </tr>
    `;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Badges Preview</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; background: #0d1117; color: #c9d1d9; margin: 2rem; }
    h1 { color: #58a6ff; }
    table { border-collapse: collapse; width: 100%; margin-top: 1.5rem; background: #161b22; border-radius: 6px; overflow: hidden; }
    th { background: #21262d; color: #f0f6fc; text-align: left; padding: 12px 10px; }
    td { border-top: 1px solid #30363d; }
    tr:hover { background: #1f242c; }
    a { color: #58a6ff; text-decoration: none; }
    a:hover { text-decoration: underline; }
    .light-preview { background: #ffffff; padding: 1rem; border-radius: 6px; margin-top: 2rem; }
    .light-preview h2 { color: #24292f; }
  </style>
</head>
<body>
  <h1>Badges Preview (Dark Background)</h1>
  <p>Visual verification of generated SVG badges with embedded official icons.</p>
  <table>
    <thead>
      <tr>
        <th>App Name</th>
        <th>Section</th>
        <th>Official Icon</th>
        <th>Generated Badge</th>
        <th>Target URL</th>
        <th>License</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>

  <div class="light-preview">
    <h2>Badges on Light Background</h2>
    <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 1rem;">
      ${apps.map(app => `<a href="${escapeXml(app.url)}"><img src="assets/badges/${app.id}.svg" alt="${escapeXml(app.name)}"/></a>`).join('\n      ')}
    </div>
  </div>
</body>
</html>
`;
}

if (require.main === module) {
  main();
}

module.exports = { generateBadgeSvg, measureTextWidth };
