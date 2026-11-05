const fs=require('fs');
const {chromium}=require('<playwright-project>/node_modules/playwright');
const url='file:///<eval-root>/guard-08/project/page.html';
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const results={source:'independent Chrome, browser touch emulation',cases:[]};
 for(const touch of [false,true]){
  const context=await browser.newContext({viewport:touch?{width:390,height:844}:{width:1440,height:900},hasTouch:touch,isMobile:touch,deviceScaleFactor:1});
  const page=await context.newPage();
  const ready=async()=>{await page.goto(url);await page.evaluate(()=>document.fonts.ready)};
  const activate=async loc=>touch?loc.tap():loc.click();
  const item={touch,links:[],metadataReveal:[],menu:{},screenshots:[]};
  for(const [label,selector,expected] of [
   ['featured all courses','.featured a','#catalog'],
   ['course 1','#catalog .course:nth-child(1) a','#lesson'],
   ['course 2','#catalog .course:nth-child(2) a','#lesson'],
   ['navigation catalog',touch?'.compact-menu a[href="#catalog"]':'.desktop-nav a[href="#catalog"]','#catalog'],
   ['navigation topics',touch?'.compact-menu a[href="#topics"]':'.desktop-nav a[href="#topics"]','#topics'],
   ['topic composition','.rail a:nth-child(1)','#catalog'],
   ['topic color','.rail a:nth-child(2)','#catalog'],
   ['topic light','.rail a:nth-child(3)','#catalog']]){
    await ready();
    if(touch && selector.startsWith('.compact-menu')) await page.locator('.compact-menu summary').tap();
    await activate(page.locator(selector));
    const hash=await page.evaluate(()=>location.hash);
    if(hash!==expected) throw new Error(label+' wrong target');
    item.links.push({label,hash,passed:true});
  }
  if(touch){
   await ready();
   const summary=page.locator('.compact-menu summary');
   item.menu.initial=await page.locator('.compact-menu').evaluate(e=>e.open);
   await summary.tap();item.menu.opened=await page.locator('.compact-menu').evaluate(e=>e.open);
   await summary.tap();item.menu.closed=await page.locator('.compact-menu').evaluate(e=>e.open);
   await ready();
   const cdp=await context.newCDPSession(page);
   const swipe=async(x1,y1,x2,y2)=>{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x1,y:y1}]});
    for(let step=1;step<=14;step++){
     await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x1+(x2-x1)*step/14,y:y1+(y2-y1)*step/14}]});
     await new Promise(r=>setTimeout(r,20));
    }
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await new Promise(r=>setTimeout(r,200));
   };
   await swipe(360,730,360,270);
   item.verticalSwipe=await page.evaluate(()=>({scrollY,hoverNone:matchMedia('(hover:none)').matches,pointerCoarse:matchMedia('(pointer:coarse)').matches,metadata:[...document.querySelectorAll('.course-meta')].map(e=>getComputedStyle(e).opacity)}));
   await page.screenshot({path:__dirname+'/verified-after-mobile-390-touch-scroll.png'});
   item.screenshots.push('verified-after-mobile-390-touch-scroll.png');
   await page.locator('.rail').scrollIntoViewIfNeeded();
   const box=await page.locator('.rail').boundingBox();
   item.horizontalSwipe={before:await page.locator('.rail').evaluate(e=>e.scrollLeft)};
   await swipe(350,box.y+box.height/2,50,box.y+box.height/2);
   await swipe(350,box.y+box.height/2,50,box.y+box.height/2);
   item.horizontalSwipe.after=await page.locator('.rail').evaluate(e=>e.scrollLeft);
   await page.screenshot({path:__dirname+'/verified-after-mobile-390-touch-rail.png'});
   item.screenshots.push('verified-after-mobile-390-touch-rail.png');
   await page.locator('.rail a').last().tap();item.horizontalSwipe.lastTopicHash=await page.evaluate(()=>location.hash);
   if(item.verticalSwipe.scrollY<=0 || item.horizontalSwipe.after<=item.horizontalSwipe.before) throw new Error('Touch gesture did not scroll');
  } else {
   for(let i=0;i<3;i++){
    await ready();
    await page.locator('.course').nth(i).hover();
    const hoverOpacity=await page.locator('.course-meta').nth(i).evaluate(e=>getComputedStyle(e).opacity);
    await page.mouse.move(0,0);
    const offOpacity=await page.locator('.course-meta').nth(i).evaluate(e=>getComputedStyle(e).opacity);
    await page.locator('.course').nth(i).locator('a').focus();
    const focusOpacity=await page.locator('.course-meta').nth(i).evaluate(e=>getComputedStyle(e).opacity);
    item.metadataReveal.push({course:i,hoverOpacity,offOpacity,focusOpacity});
    if(hoverOpacity!=='1'||offOpacity!=='0'||focusOpacity!=='1')throw new Error('Desktop reveal regression');
   }
  }
  results.cases.push(item);await context.close();
 }
 await browser.close();
 fs.writeFileSync(__dirname+'/functional-checks.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
})().catch(e=>{console.error(e);process.exit(1)});
