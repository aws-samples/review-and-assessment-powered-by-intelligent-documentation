#!/usr/bin/env node
/**
 * HTML to PDF Converter for add-example skill
 *
 * Usage: node convert_html_to_pdf.js <html1> <pdf1> <html2> <pdf2> ...
 *
 * Example:
 *   node convert_html_to_pdf.js \
 *     temp-example-007/checklist.html temp-example-007/checklist.pdf \
 *     temp-example-007/review.html temp-example-007/review.pdf
 */

const { chromium } = require('playwright');
const path = require('path');

async function convertToPdf(htmlPath, pdfPath) {
  const absoluteHtmlPath = path.resolve(process.cwd(), htmlPath);
  const absolutePdfPath = path.resolve(process.cwd(), pdfPath);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`file://${absoluteHtmlPath}`);
  await page.pdf({
    path: absolutePdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '10mm',
      bottom: '10mm',
      left: '10mm',
      right: '10mm'
    }
  });

  await browser.close();
  console.log(`✓ Created: ${pdfPath}`);
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.length % 2 !== 0) {
    console.error('Usage: node convert_html_to_pdf.js <html1> <pdf1> <html2> <pdf2> ...');
    console.error('Example: node convert_html_to_pdf.js input.html output.pdf');
    process.exit(1);
  }

  // Process files in pairs: [html, pdf, html, pdf, ...]
  for (let i = 0; i < args.length; i += 2) {
    const htmlFile = args[i];
    const pdfFile = args[i + 1];

    try {
      await convertToPdf(htmlFile, pdfFile);
    } catch (error) {
      console.error(`✗ Failed to convert ${htmlFile}: ${error.message}`);
      process.exit(1);
    }
  }

  console.log('\n✅ All conversions completed successfully!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
