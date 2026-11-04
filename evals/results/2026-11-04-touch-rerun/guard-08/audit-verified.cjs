const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('<playwright-project>/node_modules/playwright');
const root = __dirname;
const stage = process.argv[2] || 'before';
const url = pathToFileURL(path.join(root, stage === 'before' ? 'page.before.html' : 'project/page.html')).href;
const cases = [{name:'desktop-1440',width:1440,height:900,touch:false},{name:'mobile-390',width:390,height:844,touch:true}];
if(stage === 'after') cases.push({name:'touch-600',width:600,height:844,touch:true},{name:'touch-601',width:601,height:844,touch:true},{name:'mouse-390',width:390,height:844,touch:false});
async function readings(page) {
 return await page.evaluate(() => {
  function info(el) {
   const s=getComputedStyle(el), b=el.getBoundingClientRect();
   let opacity=1, hiddenAncestor=false;
   for(let p=el;p;p=p.parentElement){const c=getComputedStyle(p);opacity*=Number(c.opacity);hiddenAncestor ||= c.display==='none';}
   return {text:el.textContent.trim(),display:s.display,visibility:s.visibility,opacity:s.opacity,effectiveOpacity:opacity,hiddenAncestor,fontSize:s.fontSize,box:{x:b.x,y:b.y,width:b.width,height:b.height},color:s.color};
  }
  return {url:location.href,innerWidth,innerHeight,devicePixelRatio,rootClientWidth:document.documentElement.clientWidth,rootScrollWidth:document.documentElement.scrollWidth,scrollX,scrollY,media:{hoverNone:matchMedia('(hover:none)').matches,hoverHover:matchMedia('(hover:hover)').matches,pointerCoarse:matchMedia('(pointer:coarse)').matches,pointerFine:matchMedia('(pointer:fine)').matches,maxTouchPoints:navigator.maxTouchPoints},fontsStatus:document.fonts.status,
  main:info(document.querySelector('main')),title:info(document.querySelector('h1')),coursesGrid:getComputedStyle(document.querySelector('.courses')).gridTemplateColumns,
  metadata:[...document.querySelectorAll('.course-meta')].map(info),courseTitles:[...document.querySelectorAll('.course-meta h2')].map(info),
  desktopNav:info(document.querySelector('.desktop-nav')),compactMenu:info(document.querySelector('.compact-menu')),futureNote:info(document.querySelector('#future-note')),
  rail:{...info(document.querySelector('.rail')),scrollWidth:document.querySelector('.rail').scrollWidth,clientWidth:document.querySelector('.rail').clientWidth,scrollLeft:document.querySelector('.rail').scrollLeft}};
 });
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const result={stage,source:'independent Chrome via Playwright, file URL, not Codex preview, not a physical phone',browserVersion:browser.version(),cases:[]};
 for(const spec of cases){
  const context=await browser.newContext({viewport:{width:spec.width,height:spec.height},hasTouch:spec.touch,isMobile:spec.touch,deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(String(e)));
  await page.goto(url);await page.evaluate(()=>document.fonts.ready);
  const prefix=path.join(root,'verified-'+stage+'-'+spec.name);
  const item={spec,initial:await readings(page),screenshots:[],screenshotStates:[],interactions:{},errors};
  const takeShot=async options=>{
   const before=await readings(page);
   await page.screenshot(options);
   const after=await readings(page);
   item.screenshotStates.push({file:path.basename(options.path),before,after});
   if(before.media.hoverNone!==after.media.hoverNone || before.media.pointerCoarse!==after.media.pointerCoarse) throw new Error('Screenshot changed input media');
  };
  if(spec.name==='desktop-1440'||spec.name==='mobile-390'){
   await takeShot({path:prefix+'-initial.png',fullPage:false});item.screenshots.push(path.basename(prefix+'-initial.png'));
   await page.evaluate(()=>window.scrollTo(0,document.querySelector('#catalog').offsetTop-16));
   item.catalogUnhovered=await readings(page);
   await takeShot({path:prefix+'-catalog-unhovered.png'});item.screenshots.push(path.basename(prefix+'-catalog-unhovered.png'));
   if(!spec.touch){
    await page.locator('#catalog .course').first().hover();
    item.catalogHovered=await readings(page);
    await takeShot({path:prefix+'-catalog-hovered.png'});item.screenshots.push(path.basename(prefix+'-catalog-hovered.png'));
    await page.mouse.move(0,0);
    await page.locator('.desktop-nav a[href="#topics"]').click();
    item.interactions.desktopTopics={hash:await page.evaluate(()=>location.hash),targetVisible:await page.locator('#topics h2').isVisible()};
   }else{
    await page.evaluate(()=>window.scrollTo(0,0));
    item.interactions.menuInitiallyOpen=await page.locator('.compact-menu').evaluate(e=>e.open);
    await page.locator('.compact-menu summary').tap();
    item.interactions.menuAfterTap=await page.locator('.compact-menu').evaluate(e=>e.open);
    await takeShot({path:prefix+'-menu-open.png'});item.screenshots.push(path.basename(prefix+'-menu-open.png'));
    await page.locator('.compact-menu a[href="#topics"]').tap();
    item.interactions.mobileTopics={hash:await page.evaluate(()=>location.hash),targetVisible:await page.locator('#topics h2').isVisible()};
    await page.locator('.rail').evaluate(e=>e.scrollTo({left:e.scrollWidth}));
    item.interactions.railAtEnd=await page.locator('.rail').evaluate(e=>({scrollLeft:e.scrollLeft,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth}));
    await takeShot({path:prefix+'-topics-scrolled.png'});item.screenshots.push(path.basename(prefix+'-topics-scrolled.png'));
    await page.locator('.rail a').last().tap();
    item.interactions.lastTopic={hash:await page.evaluate(()=>location.hash)};
   }
   await page.goto(url);await page.evaluate(()=>document.fonts.ready);
   const action=page.locator('#catalog .course a').first();
   if(spec.touch) await action.tap(); else await action.click();
   item.interactions.courseEntry={hash:await page.evaluate(()=>location.hash),lessonText:await page.locator('#lesson').innerText()};
   await takeShot({path:prefix+'-lesson.png'});item.screenshots.push(path.basename(prefix+'-lesson.png'));
   await page.goto(url);await page.evaluate(()=>document.fonts.ready);
   const featured=page.locator('.featured a');
   if(spec.touch) await featured.tap(); else await featured.click();
   item.interactions.featuredEntry={hash:await page.evaluate(()=>location.hash)};
  }
  result.cases.push(item);await context.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(root,'verified-'+stage+'-measurements.json'),JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify({stage,browserVersion:result.browserVersion,cases:result.cases.map(c=>({name:c.spec.name,viewport:[c.initial.innerWidth,c.initial.innerHeight],media:c.initial.media,root:[c.initial.rootClientWidth,c.initial.rootScrollWidth],grid:c.initial.coursesGrid,metadata:c.initial.metadata.map(m=>({text:m.text,opacity:m.effectiveOpacity})),interactions:c.interactions,errors:c.errors}))},null,2));
})().catch(e=>{console.error(e);process.exit(1)});
