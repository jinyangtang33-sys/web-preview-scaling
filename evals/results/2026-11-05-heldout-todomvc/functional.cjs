/* Independent UI-only functional holdout. No project internals are mutated. */
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
const url = option('--url', 'http://127.0.0.1:5111');
const label = option('--label', 'baseline');
const out = path.join(__dirname, label.replace(/[^a-z0-9_-]/gi, '_'));
fs.mkdirSync(out, { recursive: true });
const longText = 'Review the complete quarterly launch checklist with the engineering and customer support teams. '.repeat(4) + '请完整保留这段中文任务内容，确认长文本可以换行并且所有文字都能理解。'.repeat(4) + 'UNBROKEN' + 'x'.repeat(120);
const htmlText = '<img src=x onerror="window.__holdoutInjected=1"> & <script>window.__holdoutInjected=2</script> "quoted" \'单引号\' `backticks`';
const results = [];
const profiles = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
  { name: 'phone-touch', viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
];
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const profile of profiles) {
    const context = await browser.newContext(profile);
    const run = async (name, fn) => {
      const page = await context.newPage();
      page.setDefaultTimeout(2200);
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const row = { profile: profile.name, test: name, status: 'pass' };
      try {
        await page.goto(url, { waitUntil: 'networkidle' });
        const ui = {
          page,
          rows: () => page.locator('.todo-list > li'),
          input: page.locator('.new-todo'),
          click: async loc => profile.hasTouch ? loc.tap() : loc.click(),
          add: async text => { await page.locator('.new-todo').fill(text); await page.locator('.new-todo').press('Enter'); },
          texts: async () => page.locator('.todo-list > li .view > label').allTextContents(),
          filter: async route => { await ui.click(page.locator(`.filters a[href="#/${route}"]`)); await sleep(80); },
          count: async n => assert.match((await page.locator('.todo-count').innerText()).trim(), new RegExp(`^${n}\\s+items?\\s+left$`)),
          edit: async index => {
            const row = page.locator('.todo-list > li').nth(index);
            const editButton = row.getByRole('button', { name: /edit/i });
            if (await editButton.count() && await editButton.first().isVisible()) await ui.click(editButton.first());
            else if (profile.hasTouch) { await sleep(380); await row.locator('.view > label').tap(); await sleep(70); await row.locator('.view > label').tap(); }
            else await row.locator('.view > label').dblclick();
            await row.locator('.edit').waitFor({ state: 'visible' });
            return row.locator('.edit');
          },
        };
        const detail = await fn(ui);
        if (detail !== undefined) row.detail = detail;
        assert.deepEqual(errors, [], 'uncaught browser errors');
        const staleFailure = path.join(out, `${profile.name}-${name}-failure.png`);
        if (fs.existsSync(staleFailure)) fs.unlinkSync(staleFailure);
      } catch (e) {
        row.status = 'fail';
        row.error = String(e.message).slice(0, 2400);
        row.browserErrors = errors;
        await page.screenshot({ path: path.join(out, `${profile.name}-${name}-failure.png`), fullPage: true }).catch(() => {});
      }
      results.push(row);
      process.stdout.write(JSON.stringify(row) + '\n');
      await page.close();
    };
    await run('add-trim-blank', async ui => {
      await ui.add(''); await ui.add('   '); assert.equal(await ui.rows().count(), 0);
      await ui.add('  Buy milk 买牛奶  '); assert.deepEqual(await ui.texts(), ['Buy milk 买牛奶']); await ui.count(1);
      assert.equal(await ui.input.inputValue(), '');
      await ui.input.fill('Added on blur'); await ui.click(ui.page.locator('h1')); assert.equal(await ui.rows().count(), 2); await ui.count(2);
    });
    await run('html-literal-escaping', async ui => {
      await ui.add(htmlText); assert.deepEqual(await ui.texts(), [htmlText]);
      assert.equal(await ui.rows().locator('img,script').count(), 0);
      assert.equal(await ui.page.evaluate(() => window.__holdoutInjected), undefined);
      const input = await ui.edit(0); assert.equal(await input.inputValue(), htmlText);
      await input.fill(htmlText + ' edited'); await input.press('Enter');
      assert.deepEqual(await ui.texts(), [htmlText + ' edited']);
    });
    await run('long-text-layout', async ui => {
      await ui.add(longText); assert.deepEqual(await ui.texts(), [longText]);
      const metrics = await ui.page.locator('.todo-list li .view > label').evaluate(el => {
        const range = document.createRange(); range.selectNodeContents(el);
        const r = el.getBoundingClientRect(); const rects = [...range.getClientRects()];
        return { viewportWidth: innerWidth, documentWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, label: {x:r.x,y:r.y,width:r.width,height:r.height}, textRects: rects.map(r => ({x:r.x,y:r.y,width:r.width,height:r.height})), style: { overflow: getComputedStyle(el).overflow, textOverflow: getComputedStyle(el).textOverflow, whiteSpace: getComputedStyle(el).whiteSpace } };
      });
      await ui.page.screenshot({ path: path.join(out, `${profile.name}-long-text.png`), fullPage: true });
      assert.ok(metrics.documentWidth <= metrics.clientWidth + 1, `horizontal page overflow: ${JSON.stringify(metrics)}`);
      assert.ok(metrics.textRects.every(r => r.x >= -1 && r.x + r.width <= metrics.viewportWidth + 1), 'text leaves horizontal viewport');
      assert.ok(metrics.textRects.every(r => r.y >= metrics.label.y - 1 && r.y + r.height <= metrics.label.y + metrics.label.height + 1), 'long text exceeds its label box and may be clipped or overlap following content');
      const input = await ui.edit(0); assert.equal(await input.inputValue(), longText); await input.press('Escape');
      assert.deepEqual(await ui.texts(), [longText]); return metrics;
    });
    await run('edit-enter-escape-blur', async ui => {
      await ui.add('Original'); let edit = await ui.edit(0); await edit.fill('  Saved by Enter  '); await edit.press('Enter');
      assert.deepEqual(await ui.texts(), ['Saved by Enter']);
      edit = await ui.edit(0); await edit.fill('Must cancel'); await edit.press('Escape'); assert.deepEqual(await ui.texts(), ['Saved by Enter']);
      edit = await ui.edit(0); await edit.fill('Saved by blur 中文'); await ui.click(ui.input); assert.deepEqual(await ui.texts(), ['Saved by blur 中文']); await ui.count(1);
    });
    await run('edit-empty-removes', async ui => {
      await ui.add('Delete through blank edit'); const edit = await ui.edit(0); await edit.fill('  '); await edit.press('Enter'); assert.equal(await ui.rows().count(), 0);
    });
    await run('complete-count-filter', async ui => {
      await ui.add('Alpha'); await ui.add('Beta'); await ui.count(2);
      await ui.click(ui.rows().nth(0).locator('.toggle')); await ui.count(1); assert.ok(await ui.rows().nth(0).locator('.toggle').isChecked());
      await ui.filter('active'); assert.deepEqual(await ui.texts(), ['Beta']); await ui.count(1);
      await ui.filter('completed'); assert.deepEqual(await ui.texts(), ['Alpha']); await ui.count(1);
      await ui.click(ui.rows().nth(0).locator('.toggle')); assert.equal(await ui.rows().count(), 0); await ui.count(2);
      await ui.filter(''); assert.deepEqual(await ui.texts(), ['Alpha', 'Beta']);
      for (const route of ['', 'active', 'completed']) { await ui.filter(route); assert.ok((await ui.page.locator(`.filters a[href="#/${route}"]`).getAttribute('class') || '').includes('selected')); }
    });
    await run('toggle-all-across-filter', async ui => {
      await ui.add('Alpha'); await ui.add('Beta'); await ui.filter('active');
      await ui.click(ui.page.locator('.toggle-all-label')); assert.equal(await ui.rows().count(), 0); await ui.count(0);
      await ui.filter('completed'); assert.deepEqual(await ui.texts(), ['Alpha', 'Beta']);
      await ui.click(ui.page.locator('.toggle-all-label')); assert.equal(await ui.rows().count(), 0); await ui.count(2);
      await ui.filter(''); assert.equal(await ui.rows().locator('.toggle:checked').count(), 0);
    });
    await run('delete-single', async ui => {
      await ui.add('Keep'); await ui.add('Delete');
      const row = ui.rows().nth(1);
      if (profile.hasTouch) { if (!(await row.locator('.destroy').isVisible())) await row.locator('.view > label').tap(); }
      else await row.hover();
      await ui.click(row.locator('.destroy')); assert.deepEqual(await ui.texts(), ['Keep']); await ui.count(1);
    });
    await run('clear-completed', async ui => {
      await ui.add('Keep'); await ui.add('Done 1'); await ui.add('Done 2');
      await ui.click(ui.rows().nth(1).locator('.toggle')); await ui.click(ui.rows().nth(2).locator('.toggle')); await ui.count(1);
      await ui.filter('active'); await ui.click(ui.page.locator('.clear-completed')); assert.deepEqual(await ui.texts(), ['Keep']);
      await ui.filter('completed'); assert.equal(await ui.rows().count(), 0); await ui.filter(''); assert.deepEqual(await ui.texts(), ['Keep']);
      assert.equal(await ui.page.locator('.clear-completed').isVisible(), false); await ui.count(1);
    });
    await run('keyboard-complete-filter-clear', async ui => {
      await ui.add('Keyboard'); await ui.rows().first().locator('.toggle').focus(); await ui.page.keyboard.press('Space'); await ui.count(0);
      await ui.page.locator('.filters a[href="#/completed"]').focus(); await ui.page.keyboard.press('Enter'); await sleep(80); assert.deepEqual(await ui.texts(), ['Keyboard']);
      await ui.page.locator('.clear-completed').focus(); await ui.page.keyboard.press('Enter'); assert.equal(await ui.rows().count(), 0);
    });
    await run('keyboard-bulk-toggle', async ui => {
      await ui.add('Keyboard bulk'); await ui.page.locator('.toggle-all').focus(); await ui.page.keyboard.press('Space');
      assert.ok(await ui.rows().first().locator('.toggle').isChecked()); await ui.count(0);
    });
    await run('keyboard-edit-discoverability', async ui => {
      await ui.add('Keyboard editing');
      const focusables = []; await ui.input.focus();
      for (let i=0;i<14;i++) { await ui.page.keyboard.press('Tab'); focusables.push(await ui.page.evaluate(() => ({ tag:document.activeElement.tagName, cls:document.activeElement.className, text:document.activeElement.tagName==='BODY' ? '' : document.activeElement.textContent, label:document.activeElement.getAttribute('aria-label') }))); }
      assert.ok(focusables.some(x => (['BUTTON','A'].includes(x.tag) && /edit/i.test((x.label || '') + ' ' + x.text + ' ' + x.cls)) || /(^|\s)edit(\s|$)/.test(x.cls)), `No keyboard edit entry: ${JSON.stringify(focusables)}`);
      return focusables;
    });
    await run('keyboard-delete-discoverability', async ui => {
      await ui.add('Keyboard deleting'); await ui.input.focus();
      let found = false;
      for(let i=0;i<14;i++) { await ui.page.keyboard.press('Tab'); if(await ui.page.evaluate(() => document.activeElement.matches('.destroy'))) { found = true; break; } }
      assert.ok(found, 'Delete button is not reachable via Tab without pointer hover'); await ui.page.keyboard.press('Enter'); assert.equal(await ui.rows().count(), 0);
    });
    await run('credits-branding-actions-layout', async ui => {
      await ui.add('Short task'); await ui.add('Completed task'); await ui.click(ui.rows().nth(1).locator('.toggle'));
      for (const text of ['Oscar Godson', 'Christoph Burgmer', 'TodoMVC']) assert.ok(await ui.page.getByText(text, {exact:false}).first().isVisible(), `Missing credit ${text}`);
      assert.match(await ui.page.locator('h1').innerText(), /todos/i);
      const geometry = await ui.page.locator('.new-todo,.toggle-all-label,.filters a,.clear-completed,.todo-count').evaluateAll(els => els.map(el => {
        const r=el.getBoundingClientRect(), s=getComputedStyle(el); return {selector:el.className || el.textContent, text:el.textContent, x:r.x,y:r.y,width:r.width,height:r.height, display:s.display, visibility:s.visibility};
      }));
      assert.ok(geometry.every(r => r.display !== 'none' && r.visibility !== 'hidden' && r.width>0 && r.height>0), JSON.stringify(geometry));
      assert.ok(geometry.every(r => r.x>=-1 && r.x+r.width<=profile.viewport.width+1), JSON.stringify(geometry));
      await ui.page.screenshot({path:path.join(out,`${profile.name}-normal.png`),fullPage:true}); return geometry;
    });
    await run('in-memory-reload-semantics', async ui => { await ui.add('Ephemeral'); await ui.page.reload({waitUntil:'networkidle'}); assert.equal(await ui.rows().count(), 0); });
    await context.close();
  }
  await browser.close();
  const report = {label,url,createdAt:new Date().toISOString(), scope:'Independent functional verification; no visual preference scoring; native baseline limitations distinguished by comparison.', results};
  fs.writeFileSync(path.join(out,'results.json'), JSON.stringify(report,null,2));
  process.stdout.write(`RESULT ${results.filter(r=>r.status==='pass').length}/${results.length} ${path.join(out,'results.json')}\n`);
})().catch(e => { console.error(e); process.exitCode = 1; });
