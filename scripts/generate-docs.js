#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const LIBRARY_DIR = path.join(__dirname, '..', 'library');

async function takeScreenshot(htmlPath, outputPath) {
  let browser;
  try {
    console.log('  Launching browser...');
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const context = await browser.newContext({
      viewport: { width: 1200, height: 800 }
    });

    const page = await context.newPage();

    const absoluteHtmlPath = path.resolve(htmlPath);
    console.log(`  Loading: file://${absoluteHtmlPath}`);

    await page.goto(`file://${absoluteHtmlPath}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000
    });

    // Wait for any animations or async content
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: outputPath,
      fullPage: true
    });

  } catch (error) {
    console.error(`  Screenshot error: ${error.message}`);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function createMinimalReadme(patternName, imageName) {
  return `# ${patternName}

![${patternName} Layout](${imageName})
`;
}

async function processPattern(patternDir, force = false) {
  const patternName = path.basename(patternDir);
  const indexPath = path.join(patternDir, 'index.html');
  const readmePath = path.join(patternDir, 'README.md');
  const imagePath = path.join(patternDir, 'screenshot.png');

  // Skip if no index.html
  if (!fs.existsSync(indexPath)) {
    console.log(`Skipping ${patternName}: no index.html found`);
    return;
  }

  // Skip if README exists and not forcing
  if (fs.existsSync(readmePath) && !force) {
    console.log(`Skipping ${patternName}: README.md already exists`);
    return;
  }

  console.log(`Processing ${patternName}...`);

  try {
    await takeScreenshot(indexPath, imagePath);
    console.log(`  ✓ Screenshot saved: ${path.basename(imagePath)}`);

    const readmeContent = createMinimalReadme(patternName, 'screenshot.png');
    fs.writeFileSync(readmePath, readmeContent);
    console.log(`  ✓ README created: ${path.basename(readmePath)}`);

  } catch (error) {
    console.error(`  ✗ Error processing ${patternName}:`, error.message);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force') || args.includes('-f');
  const specificPattern = args.find(arg => !arg.startsWith('-'));

  if (!fs.existsSync(LIBRARY_DIR)) {
    console.error('Library directory not found:', LIBRARY_DIR);
    process.exit(1);
  }

  const patterns = fs.readdirSync(LIBRARY_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  if (specificPattern) {
    if (patterns.includes(specificPattern)) {
      await processPattern(path.join(LIBRARY_DIR, specificPattern), force);
    } else {
      console.error(`Pattern "${specificPattern}" not found`);
      process.exit(1);
    }
  } else {
    console.log(`Found ${patterns.length} patterns: ${patterns.join(', ')}`);
    console.log('');

    for (const pattern of patterns) {
      await processPattern(path.join(LIBRARY_DIR, pattern), force);
      // Small delay between patterns
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);