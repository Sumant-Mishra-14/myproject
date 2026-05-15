const { chromium } = require('playwright');

(async () => {

  const browser = await chromium.launch({
    headless: false
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  // Console errors
  page.on('console', msg => {

    if (msg.type() === 'error') {

      console.log(`Console Error: ${msg.text()}`);

    }

  });

  // Failed requests
  page.on('requestfailed', request => {

    console.log(`Failed Request: ${request.url()}`);

  });

  // API/server errors
  page.on('response', response => {

    if (response.status() >= 400) {

      console.log(
        `API Error ${response.status()} : ${response.url()}`
      );

    }

  });

  const startUrl =
    'https://collegedunia.com/australia/university/606-monash-university-melbourne';

  await page.goto(startUrl, {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Find clickable elements
  const elements = await page.locator('a, button').all();

  console.log(`Found ${elements.length} clickable elements`);

  for (let i = 0; i < elements.length; i++) {

    try {

      const el = elements[i];

      const text =
        (await el.innerText().catch(() => ''))
        .trim()
        .replace(/\s+/g, ' ')
        .slice(0, 80);

      const href = await el.getAttribute('href');

      console.log(`Clicking: ${text || 'NO TEXT'}`);

      if (href) {

        console.log(`URL: ${href}`);

      }

      // Skip external links
      if (
        href &&
        href.startsWith('http') &&
        !href.includes('collegedunia.com')
      ) {

        console.log('Skipped external domain');

        continue;

      }

      const freshElement =
        page.locator('a, button').nth(i);

      await freshElement.scrollIntoViewIfNeeded();

      await Promise.all([

        page.waitForLoadState('domcontentloaded')
          .catch(() => {}),

        freshElement.click({
          timeout: 5000
        })

      ]);

      console.log('Click success');

      await page.waitForTimeout(2000);

      // Return back if page changed
      if (page.url() !== startUrl) {

        console.log(`Navigated to: ${page.url()}`);

        await page.goBack({
          waitUntil: 'domcontentloaded'
        });

        await page.waitForTimeout(2000);

      }

    } catch (err) {

      console.log(`Click failed: ${err.message}`);

    }

  }

  console.log('Testing completed');

})();