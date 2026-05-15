const { chromium, devices } = require('playwright');
const fs = require('fs');

(async () => {

  // =====================================================
  // CONFIG
  // =====================================================

  const START_URL =
    'https://collegedunia.com/australia/university/606-monash-university-melbourne';

  const MAX_PAGES = 10;

  // =====================================================
  // BROWSER
  // =====================================================

  const browser = await chromium.launch({
    headless: false,
    slowMo: 200,
    devtools: true
  });

  const context = await browser.newContext({
    ...devices['Desktop Chrome'],
    ignoreHTTPSErrors: true,
    acceptDownloads: true
  });

  const page = await context.newPage();

  // =====================================================
  // STORAGE
  // =====================================================

  const visited = new Set();
  const queue = [START_URL];

  const results = {
    pages: [],
    buttons: [],
    dropdowns: [],
    tabs: [],
    accordions: [],
    forms: [],
    sliders: [],
    apiErrors: [],
    consoleErrors: [],
    jsErrors: [],
    accessibility: [],
    downloads: [],
    redirects: [],
    screenshots: [],
    iframes: [],
    shadowDom: [],
    brokenLinks: [],
    mobile: [],
    storage: [],
    performance: [],
    summary: {}
  };

  // =====================================================
  // EVENT LISTENERS
  // =====================================================

  page.on('response', async response => {

    try {

      if (response.status() >= 400) {

        const entry = {
          status: response.status(),
          url: response.url()
        };

        results.apiErrors.push(entry);

        console.log(
          `API ERROR ${response.status()} => ${response.url()}`
        );

      }

    } catch {}

  });

  page.on('console', msg => {

    if (msg.type() === 'error') {

      results.consoleErrors.push(msg.text());

      console.log(`CONSOLE ERROR => ${msg.text()}`);

    }

  });

  page.on('pageerror', error => {

    results.jsErrors.push(error.message);

    console.log(`PAGE ERROR => ${error.message}`);

  });

  page.on('dialog', async dialog => {

    console.log(`DIALOG => ${dialog.message()}`);

    await dialog.dismiss();

  });

  // =====================================================
  // REMOVE POPUPS / ADS
  // =====================================================

  async function removeOverlays() {

    await page.evaluate(() => {

      const selectors = [
        '.popup',
        '.modal',
        '.overlay',
        '.sticky',
        '.cookie',
        '.banner',
        '.ad',
        '.advertisement',
        '[id*=ad]',
        '[class*=popup]',
        '[class*=overlay]',
        '[class*=modal]'
      ];

      selectors.forEach(selector => {

        document.querySelectorAll(selector)
          .forEach(el => {

            try {
              el.remove();
            } catch {}

          });

      });

      document.body.style.overflow = 'auto';

    });

  }

  // =====================================================
  // AUTO SCROLL
  // =====================================================

  async function autoScroll() {

    await page.evaluate(async () => {

      await new Promise(resolve => {

        let totalHeight = 0;
        const distance = 800;

        const timer = setInterval(() => {

          window.scrollBy(0, distance);

          totalHeight += distance;

          if (
            totalHeight >= document.body.scrollHeight
          ) {

            clearInterval(timer);

            resolve();

          }

        }, 400);

      });

    });

  }

  // =====================================================
  // SAFE CLICK
  // =====================================================

  async function safeClick(locator) {

    try {

      await locator.scrollIntoViewIfNeeded();

      await page.waitForTimeout(300);

      if (!(await locator.isVisible())) {

        return {
          status: 'HIDDEN'
        };

      }

      if (!(await locator.isEnabled())) {

        return {
          status: 'DISABLED'
        };

      }

      try {

        await locator.click({
          timeout: 4000
        });

      } catch {

        await locator.click({
          force: true,
          timeout: 4000
        });

      }

      await page.waitForTimeout(1000);

      return {
        status: 'PASS'
      };

    } catch (err) {

      return {
        status: 'FAIL',
        error: err.message
      };

    }

  }

  // =====================================================
  // ACCESSIBILITY
  // =====================================================

  async function accessibilityTest() {

    const issues = await page.evaluate(() => {

      const problems = [];

      document.querySelectorAll('img')
        .forEach(img => {

          if (!img.alt) {

            problems.push({
              type: 'MISSING_ALT',
              src: img.src
            });

          }

        });

      document.querySelectorAll('button')
        .forEach(btn => {

          if (!btn.innerText.trim()) {

            problems.push({
              type: 'EMPTY_BUTTON'
            });

          }

        });

      return problems;

    });

    results.accessibility.push(...issues);

  }

  // =====================================================
  // STORAGE TEST
  // =====================================================

  async function storageTest() {

    const storage = await page.evaluate(() => {

      return {
        localStorage: localStorage.length,
        sessionStorage: sessionStorage.length,
        cookies: document.cookie
      };

    });

    results.storage.push(storage);

  }

  // =====================================================
  // PERFORMANCE TEST
  // =====================================================

  async function performanceTest() {

    const perf = await page.evaluate(() => {

      const nav =
        performance.getEntriesByType('navigation')[0];

      return {
        domComplete: nav.domComplete,
        responseEnd: nav.responseEnd,
        loadEventEnd: nav.loadEventEnd
      };

    });

    results.performance.push(perf);

  }

  // =====================================================
  // MOBILE TEST
  // =====================================================

  async function mobileTest() {

    const mobileContext =
      await browser.newContext({
        ...devices['iPhone 13']
      });

    const mobilePage =
      await mobileContext.newPage();

    await mobilePage.goto(START_URL);

    await mobilePage.screenshot({
      path: 'mobile.png',
      fullPage: true
    });

    results.mobile.push({
      status: 'PASS'
    });

    await mobileContext.close();

  }

  // =====================================================
  // FORM TESTING
  // =====================================================

  async function validateForms() {

    const formCount =
      await page.locator('form').count();

    for (let i = 0; i < formCount; i++) {

      try {

        const form =
          page.locator('form').nth(i);

        const inputs =
          form.locator('input, textarea');

        const inputCount =
          await inputs.count();

        for (let j = 0; j < inputCount; j++) {

          try {

            const input =
              inputs.nth(j);

            await input.fill('');

            await input.fill(
              '<script>alert(1)</script>'
            );

            await input.fill(
              "' OR 1=1 --"
            );

            await input.fill(
              '@@@@@@@@@@@@@@@'
            );

            await input.fill(
              '999999999999999999999999999'
            );

            results.forms.push({
              form: i,
              input: j,
              status: 'TESTED'
            });

          } catch {}

        }

      } catch {}

    }

  }

  // =====================================================
  // CRAWLER
  // =====================================================

  while (
    queue.length > 0 &&
    visited.size < MAX_PAGES
  ) {

    const current = queue.shift();

    if (visited.has(current)) {
      continue;
    }

    visited.add(current);

    console.log(`\nCRAWLING => ${current}\n`);

    try {

      await page.goto(current, {
        waitUntil: 'domcontentloaded',
        timeout: 60000
      });

      await page.waitForTimeout(3000);

      await removeOverlays();

      await autoScroll();

      // =====================================
      // SCREENSHOT
      // =====================================

      const screenshot =
        `page-${visited.size}.png`;

      await page.screenshot({
        path: screenshot,
        fullPage: true
      });

      results.screenshots.push(screenshot);

      // =====================================
      // BUTTONS / LINKS
      // =====================================

      const clickable =
        page.locator(
          'button, a, [role="button"], input[type="submit"]'
        );

      const count =
        await clickable.count();

      console.log(
        `CLICKABLE FOUND => ${count}`
      );

      for (let i = 0; i < count; i++) {

        try {

          const el =
            clickable.nth(i);

          const text =
            (
              await el.innerText()
                .catch(() => '')
            )
              .trim()
              .replace(/\s+/g, ' ')
              .slice(0, 80);

          const href =
            await el.getAttribute('href')
              .catch(() => '');

          const beforeUrl =
            page.url();

          const result =
            await safeClick(el);

          const afterUrl =
            page.url();

          if (beforeUrl !== afterUrl) {

            results.redirects.push({
              from: beforeUrl,
              to: afterUrl
            });

            console.log(
              `REDIRECT => ${afterUrl}`
            );

            await page.goBack({
              waitUntil: 'domcontentloaded'
            });

            await page.waitForTimeout(2000);

          }

          results.buttons.push({
            page: current,
            text,
            href,
            ...result
          });

          console.log(
            `${text} => ${result.status}`
          );

        } catch (err) {

          results.buttons.push({
            page: current,
            status: 'FAIL',
            error: err.message
          });

        }

      }

      // =====================================
      // DROPDOWNS
      // =====================================

      const dropdowns =
        page.locator(
          'select, [aria-haspopup="true"]'
        );

      const dropdownCount =
        await dropdowns.count();

      for (let i = 0; i < dropdownCount; i++) {

        try {

          const dd =
            dropdowns.nth(i);

          await dd.hover();

          const result =
            await safeClick(dd);

          results.dropdowns.push(result);

        } catch {}

      }

      // =====================================
      // TABS
      // =====================================

      const tabs =
        page.locator(
          '[role="tab"], .tab'
        );

      const tabCount =
        await tabs.count();

      for (let i = 0; i < tabCount; i++) {

        try {

          const tab =
            tabs.nth(i);

          const result =
            await safeClick(tab);

          results.tabs.push(result);

        } catch {}

      }

      // =====================================
      // ACCORDIONS
      // =====================================

      const accordions =
        page.locator(
          '[aria-expanded]'
        );

      const accordionCount =
        await accordions.count();

      for (let i = 0; i < accordionCount; i++) {

        try {

          const accordion =
            accordions.nth(i);

          const before =
            await accordion.getAttribute(
              'aria-expanded'
            );

          await safeClick(accordion);

          const after =
            await accordion.getAttribute(
              'aria-expanded'
            );

          results.accordions.push({
            before,
            after,
            status:
              before !== after
                ? 'PASS'
                : 'FAIL'
          });

        } catch {}

      }

      // =====================================
      // SLIDERS
      // =====================================

      const sliders =
        page.locator(
          '.swiper, .slider, .carousel'
        );

      const sliderCount =
        await sliders.count();

      for (let i = 0; i < sliderCount; i++) {

        try {

          const slider =
            sliders.nth(i);

          await slider.hover();

          await page.mouse.down();

          await page.mouse.move(500, 0);

          await page.mouse.up();

          results.sliders.push({
            index: i,
            status: 'PASS'
          });

        } catch {

          results.sliders.push({
            index: i,
            status: 'FAIL'
          });

        }

      }

      // =====================================
      // IFRAMES
      // =====================================

      const frames = page.frames();

      for (const frame of frames) {

        try {

          results.iframes.push({
            url: frame.url(),
            status: 'PASS'
          });

        } catch {}

      }

      // =====================================
      // SHADOW DOM
      // =====================================

      try {

        const shadowHosts =
          await page.locator('*')
            .evaluateAll(elements => {

              return elements.filter(
                el => el.shadowRoot
              ).length;

            });

        results.shadowDom.push({
          shadowHosts
        });

      } catch {}

      // =====================================
      // LINK DISCOVERY
      // =====================================

      const links =
        await page.evaluate(() => {

          return Array.from(
            document.querySelectorAll('a')
          )
            .map(a => a.href)
            .filter(Boolean);

        });

      for (const link of links) {

        if (
          link.startsWith(
            'https://collegedunia.com'
          ) &&
          !visited.has(link)
        ) {

          queue.push(link);

        }

      }

      // =====================================
      // EXTRA TESTS
      // =====================================

      await validateForms();

      await accessibilityTest();

      await storageTest();

      await performanceTest();

      // =====================================
      // DOWNLOAD TEST
      // =====================================

      const pdfs =
        page.locator('a[href$=".pdf"]');

      const pdfCount =
        await pdfs.count();

      results.downloads.push({
        page: current,
        files: pdfCount
      });

      // =====================================
      // PAGE DATA
      // =====================================

      results.pages.push({
        url: current,
        title: await page.title()
      });

    } catch (err) {

      results.brokenLinks.push({
        url: current,
        error: err.message
      });

      console.log(
        `BROKEN => ${current}`
      );

    }

  }

  // =====================================================
  // MOBILE
  // =====================================================

  await mobileTest();

  // =====================================================
  // SUMMARY
  // =====================================================

  results.summary = {

    pagesCrawled:
      results.pages.length,

    buttonsTested:
      results.buttons.length,

    dropdownsTested:
      results.dropdowns.length,

    tabsTested:
      results.tabs.length,

    accordionsTested:
      results.accordions.length,

    slidersTested:
      results.sliders.length,

    formsTested:
      results.forms.length,

    apiErrors:
      results.apiErrors.length,

    consoleErrors:
      results.consoleErrors.length,

    jsErrors:
      results.jsErrors.length,

    screenshots:
      results.screenshots.length

  };

  // =====================================================
  // SAVE REPORT
  // =====================================================

  fs.writeFileSync(
    'enterprise-report.json',
    JSON.stringify(results, null, 2)
  );

  console.log('\n================================');
  console.log('ENTERPRISE QA REPORT GENERATED');
  console.log('================================');

  console.log(results.summary);

  console.log(
    '\nREPORT SAVED => enterprise-report.json'
  );

  await browser.close();

})();