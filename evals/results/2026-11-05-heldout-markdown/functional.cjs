const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');
const port = process.argv[2] || '5311';
const label = process.argv[3] || 'baseline';
const checkFilter = process.argv[4];
const out = path.join(__dirname, label);
fs.mkdirSync(out, { recursive: true });
const base = /^https?:/.test(port) ? port.replace(/\/?$/, "/") : `http://127.0.0.1:${port}/`;
const sample = '# Functional document 中文\n\nA **bold** phrase, _italic_ and `code`.\n\n- first\n- second\n\n| Name | Value |\n| --- | --- |\n| alpha | 42 |\n\n> quoted text\n\n```js\nconst answer = 42;\n```\n\n- [x] complete\n- [ ] pending\n\nEnd marker Ω.';
const longText = '# Long document\n\n' + Array.from({length: 90}, (_, i) => `## Section ${i + 1}\n\nParagraph ${i + 1}: 中文 Long writing and reviewing content. ${'comfortable reading '.repeat(12)}\n\n`).join('') + '\nFINAL_LONG_MARKER';
const results = [];
let browser;
(async () => {
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const target of [{name:'desktop', viewport:{width:1440,height:900}, touch:false}, {name:'phone', viewport:{width:390,height:844}, touch:true}]) {
    const context = await browser.newContext({viewport:target.viewport, isMobile:target.touch, hasTouch:target.touch, deviceScaleFactor:1, acceptDownloads:true});
    const blocked = [], errors = [];
    await context.route('**/*', route => {
      const url = route.request().url();
      if (url.startsWith(base) || url.startsWith('data:') || url.startsWith('blob:')) return route.continue();
      blocked.push(url); return route.abort();
    });
    const page = await context.newPage();
    page.on('dialog', d => d.accept());
    page.on('pageerror', e => errors.push(e.message));
    page.setDefaultTimeout(1800);
    async function reset(value=sample) {
      await page.goto(base, {waitUntil:'load'});
      await page.evaluate(() => {localStorage.clear();sessionStorage.clear();});
      await page.reload({waitUntil:'load'});
      await page.waitForFunction(() => window.editor && window.md);
      await page.evaluate(v => editor.setValue(v), value);
    }
    async function act(selector) {
      const item = page.locator(selector).first();
      if(target.touch) await item.tap(); else await item.click();
    }
    async function confirmAlert() { await page.locator('.sweet-alert.visible').waitFor({state:'visible'}); await act('.sweet-alert .confirm'); }
    async function check(name, fn) {
      if(checkFilter && name !== checkFilter) return;
      const r = {target:target.name, name};
      try {r.evidence = await fn();r.pass = true;} catch(e) {r.pass = false;r.error = e.message.split('\n').slice(0,22).join('\n');
        r.failureState=await page.evaluate(()=>({bodyClass:document.body.className,menuDisplay:getComputedStyle(document.getElementById('menu')).display,menuHit:(()=>{const e=document.getElementById('menu'),r=e.getBoundingClientRect();const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {tag:hit?.tagName,id:hit?.id,className:hit?.className};})()})).catch(()=>null);
      }
      try {await page.screenshot({path:path.join(out,`${target.name}-${name}.png`),fullPage:false});} catch(e) {r.screenshotError=e.message;}
      results.push(r);
      fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({base,label,results,blocked,errors},null,2));
      console.log(JSON.stringify(r));
    }
    const assert = (v,m) => {if(!v) throw Error(m);};
    await check('initial-layout', async () => {
      await reset();
      return await page.evaluate(() => {
        const rect = e => {const r=e.getBoundingClientRect(); const s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,display:s.display,visibility:s.visibility};};
        return {viewport:{innerWidth,innerHeight,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,screenWidth:screen.width,hover:matchMedia("(hover: hover)").matches,pointerCoarse:matchMedia("(pointer: coarse)").matches,viewportMeta:document.querySelector("meta[name=viewport]")?.content||null},panes:['in','out','navbar','menu'].map(id=>({id,...rect(document.getElementById(id))})),actions:[...document.querySelectorAll('#navbar [onclick],#navbar button')].map(e=>({id:e.id,text:e.textContent.trim(),title:e.title,...rect(e)})),preview:document.getElementById('out').innerText};
      });
    });
    await check('typing-live-preview', async () => {
      await reset('');
      await act('.CodeMirror');
      await page.keyboard.insertText('# Typed heading\n\nTyped **strong** 中文.');
      await page.waitForFunction(() => document.querySelector('#out strong')?.textContent === 'strong');
      const value=await page.evaluate(()=>editor.getValue());
      assert(value === '# Typed heading\n\nTyped **strong** 中文.','Typed text changed or missing');
      return {value,preview:await page.locator('#out').innerHTML()};
    });
    for(const [key,expected] of [['b','**selected**'],['i','_selected_'],['k','`selected`'],['l','<kbd>selected</kbd>']]) await check(`shortcut-ctrl-${key}`, async()=>{
      await reset('selected');await act('.CodeMirror');await page.keyboard.press('Control+a');await page.keyboard.press(`Control+${key}`);
      const value=await page.evaluate(()=>editor.getValue());assert(value===expected,`Expected ${expected}, got ${value}`);return {value};
    });
    await check('shortcut-list-enter',async()=>{
      await reset('- first');await act('.CodeMirror');await page.keyboard.press('Control+End');await page.keyboard.press('Enter');
      const value=await page.evaluate(()=>editor.getValue());assert(value==='- first\n- ',`List continuation differs: ${value}`);return {value};
    });
    await check('import-file-entry',async()=>{
      await reset();const fixture=path.join(out,'import.md');fs.writeFileSync(fixture,'# Imported 中文\n\nImported **content** Ω.');
      const chooser=page.waitForEvent('filechooser');chooser.catch(()=>{});await act('#openbutton');await (await chooser).setFiles(fixture);
      await page.waitForFunction(()=>editor.getValue().includes('# Imported'));
      const value=await page.evaluate(()=>editor.getValue());assert(value===fs.readFileSync(fixture,'utf8'),'Import contents differ');return {value,preview:await page.locator('#out').innerHTML()};
    });
    for(const kind of ['markdown','html']) await check(`download-${kind}`,async()=>{
      await reset();const expected=await page.evaluate(k=>k==='markdown'?editor.getValue():document.getElementById('out').innerHTML,kind);
      await act('#savebutton');
      const download=page.waitForEvent('download',{timeout:2500});download.catch(()=>{});await act(`#saveas-${kind}`);const d=await download;
      const filename=path.join(out,`${target.name}-${kind}-${d.suggestedFilename()}`);await d.saveAs(filename);const actual=fs.readFileSync(filename,'utf8');
      assert(actual===expected,`${kind} downloaded content differs`);return {filename:d.suggestedFilename(),bytes:Buffer.byteLength(actual),exactMatch:true,content:actual};
    });
    for(const kind of ['markdown','html']) await check(`reading-download-${kind}`,async()=>{
      await reset();const expected=await page.evaluate(k=>k==='markdown'?editor.getValue():document.getElementById('out').innerHTML,kind);
      await act('#readbutton');await act('#savebutton');
      const download=page.waitForEvent('download',{timeout:2500});download.catch(()=>{});await act(`#saveas-${kind}`);const d=await download;
      const filename=path.join(out,`${target.name}-reading-${kind}-${d.suggestedFilename()}`);await d.saveAs(filename);const actual=fs.readFileSync(filename,'utf8');
      assert(actual===expected,`${kind} reading downloaded content differs`);return {filename:d.suggestedFilename(),bytes:Buffer.byteLength(actual),exactMatch:true};
    });
    await check('download-close-escape',async()=>{
      await reset();await act('#savebutton');await page.keyboard.press('Escape');assert(await page.locator('#menu').isHidden(),'Escape did not close download menu');
      await act('#savebutton');await act('#close-menu');assert(await page.locator('#menu').isHidden(),'Close entry did not close download menu');return {escape:true,close:true};
    });
    await check('browser-save-reload',async()=>{
      await reset();await act('#browsersavebutton');
      await confirmAlert();
      assert(await page.evaluate(()=>localStorage.getItem('content'))===sample,'Browser save differs');
      await page.reload({waitUntil:'load'});assert(await page.evaluate(()=>editor.getValue())===sample,'Saved text missing after reload');return {restored:true,value:await page.evaluate(()=>editor.getValue())};
    });
    await check('shortcut-save',async()=>{
      await reset();await act('.CodeMirror');await page.keyboard.press('Control+s');
      assert(await page.evaluate(()=>localStorage.getItem('content'))===sample,'Ctrl+S did not save');await confirmAlert();return {saved:true};
    });
    await check('browser-save-overwrite',async()=>{
      await reset();await act('#browsersavebutton');await confirmAlert();await page.locator('.sweet-alert').waitFor({state:'hidden'});await page.waitForTimeout(400);
      await act('.CodeMirror');await page.keyboard.press('Control+End');await page.keyboard.insertText('\nSaved revision');
      await act('#browsersavebutton');await page.waitForFunction(()=>document.querySelector('.sweet-alert h2')?.textContent==='Existing Data Detected');await page.waitForTimeout(400);const warning=await page.locator('.sweet-alert').innerText();await confirmAlert();await page.waitForFunction(()=>localStorage.getItem('content')?.endsWith('Saved revision'));if(await page.locator('.sweet-alert').isVisible())await confirmAlert();
      await page.reload({waitUntil:'load'});const value=await page.evaluate(()=>editor.getValue());assert(value===sample+'\nSaved revision','Overwrite did not preserve revision');return {warning,restoredRevision:true};
    });
    await check('saved-shortcut-download-observation',async()=>{
      await reset();await act('#browsersavebutton');await confirmAlert();await act('.CodeMirror');await page.keyboard.press('Control+Shift+s');return {menuVisible:await page.locator('#menu').isVisible(),note:'Observation: baseline suppresses Ctrl+Shift+S when content equals saved content.'};
    });
    await check('shortcut-download',async()=>{
      await reset();await act('.CodeMirror');await page.keyboard.press('Control+Shift+s');assert(await page.locator('#menu').isVisible(),'Ctrl+Shift+S did not open menu');return {menuVisible:true};
    });
    await check('share-restore',async()=>{
      await reset();await act('#sharebutton');const url=page.url();assert(url.includes('#')&&url.split('#')[1].length>0,'Share did not create a fragment');
      await page.goto('about:blank');await page.goto(url,{waitUntil:'load'});await page.waitForFunction(()=>window.editor);
      const value=await page.evaluate(()=>editor.getValue());assert(value===sample,'Shared text differs after navigation');
      return {fragmentLength:url.split('#')[1].length,restored:true,reading:await page.locator('#in').isHidden(),preview:await page.locator('#out').innerText()};
    });
    await check('reading-toggle',async()=>{
      await reset();await act('#readbutton');assert(await page.locator('#in').isHidden(),'Reading does not hide writing pane');const reading=await page.locator('#out').boundingBox();await act('#readbutton');assert(await page.locator('#in').isVisible(),'Writing pane not restored');assert(await page.evaluate(()=>editor.getValue())===sample,'Reading toggle lost text');return {reading,valuePreserved:true};
    });
    await check('night-toggle',async()=>{
      await reset();const initial=await page.locator('body').getAttribute('class');await act('#nightbutton');const enabled=await page.locator('body').getAttribute('class');assert(enabled!==initial,'Night entry changed no body state');await act('#nightbutton');return {initial,enabled,restored:await page.locator('body').getAttribute('class')};
    });
    await check('spell-toggle',async()=>{
      await reset();await act('#spellbutton');assert(await page.locator('body').evaluate(e=>e.classList.contains('no-spellcheck')),'Spell toggle did not disable');await act('#spellbutton');assert(!await page.locator('body').evaluate(e=>e.classList.contains('no-spellcheck')),'Spell toggle did not enable');return {disabledAndRestored:true};
    });
    await check('long-document-scroll',async()=>{
      await reset(longText);await act('.CodeMirror');await page.keyboard.press('Control+End');await page.keyboard.insertText('\nEDITED_END');
      assert((await page.evaluate(()=>editor.getValue())).endsWith('FINAL_LONG_MARKER\nEDITED_END'),'Long text edit lost content');
      const before=await page.evaluate(()=>({root:document.documentElement.scrollWidth,client:document.documentElement.clientWidth,in:editor.getScrollInfo(),out:{height:document.getElementById('out').scrollHeight,client:document.getElementById('out').clientHeight}}));
      await act('#readbutton');const box=await page.locator('#out').boundingBox();
      if(box){await page.mouse.move(box.x+Math.min(50,box.width/2),Math.max(50,box.y+20));await page.mouse.wheel(0,100000);}
      await page.waitForTimeout(100);const after=await page.locator('#out').evaluate(e=>({top:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,last:e.innerText.slice(-70)}));
      assert(after.last.endsWith('EDITED_END'),'Preview dropped end content');return {before,after,scrollReachedBottom:Math.abs(after.top+after.clientHeight-after.scrollHeight)<3};
    });
    await check('touch-scroll-gesture',async()=>{
      if(!target.touch) return {notApplicable:true};
      await reset(longText);await act('#readbutton');const session=await context.newCDPSession(page);
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:650}]});
      for(let y=600;y>=180;y-=60) await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:180,y}]});
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
      const top=await page.locator('#out').evaluate(e=>e.scrollTop);assert(top>0,'Touch swipe did not scroll reading pane');return {scrollTop:top};
    });
    await context.close();
  }
  await browser.close();
  console.log(`Completed ${results.length} checks; ${results.filter(r=>!r.pass).length} failed.`);
})().catch(async e=>{console.error(e);if(browser)await browser.close();process.exitCode=1;});
