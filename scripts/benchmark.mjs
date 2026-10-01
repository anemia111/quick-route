import { chromium } from '@playwright/test';
import { readFileSync,readdirSync,writeFileSync,mkdirSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { gzipSync } from 'node:zlib';
const manifest=JSON.parse(readFileSync('public/data/manifest.json','utf8'));
const packages=manifest.packages.map(p=>JSON.parse(readFileSync('public/'+p.url,'utf8')));
const catalog=JSON.parse(readFileSync('public/'+manifest.stations.url,'utf8'));
const median=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length/2)];
const browser=await chromium.launch({args:['--enable-precise-memory-info']});
const report={date:'2026-10-01',environment:'Windows desktop Chromium; 320x640; local Vite preview; no throttling; 5 samples, medians; not iPhone',startup:{}};
for(const [label,port] of [['baseline',4174],['next',4173]]) {
 const cold=[],warm=[],fcp=[],bytes=[];
 for(let i=0;i<5;i++) {
  const context=await browser.newContext({viewport:{width:320,height:640}});
  await context.addInitScript(()=>localStorage.setItem('quick-route.stations.v1',JSON.stringify({nearby:'鎌取',destination:'水道橋'})));
  const page=await context.newPage();let start=performance.now();await page.goto(`http://127.0.0.1:${port}/quick-route/`);await page.locator('.outbound').waitFor();cold.push(performance.now()-start);
  await page.waitForTimeout(1000);const timing=await page.evaluate(()=>({fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime,bytes:performance.getEntriesByType('resource').reduce((s,r)=>s+(r.transferSize||0),0)}));if(timing.fcp)fcp.push(timing.fcp);bytes.push(timing.bytes);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});start=performance.now();await page.reload();await page.locator('.outbound').waitFor();warm.push(performance.now()-start);await context.close();
 }
 report.startup[label]={coldButtonVisibleMs:median(cold),warmButtonVisibleMs:median(warm),fcpMs:median(fcp),resourceTransferBytesFirstSecond:median(bytes),samples:{cold,warm}};
}
const context=await browser.newContext({viewport:{width:320,height:640}}),page=await context.newPage();await page.goto('http://127.0.0.1:4173/quick-route/');
const plannerFile=readdirSync('dist/assets').find(f=>f.startsWith('planner-')&&f.endsWith('.js'));
report.routing=await page.evaluate(async({packages,catalog,plannerFile})=>{
 const {calculate}=await import('/quick-route/assets/'+plannerFile);
 const a=catalog.find(s=>s.name==='西馬込'&&s.operators.includes('東京都')),b=catalog.find(s=>s.name==='馬込'&&s.operators.includes('東京都'));
 const times=[],compute=[];let count=0;
 for(let i=0;i<5;i++){const start=performance.now();const result=await calculate({packages,from:a,to:b,departure:Date.parse('2026-10-01T08:00:00+09:00')});times.push(performance.now()-start);compute.push(result.elapsedMs);count=result.journeys.length;}
 return {roundTripMs:times,workerComputeMs:compute,candidates:count,packages:packages.length,trips:packages.reduce((s,p)=>s+p.trips.length,0)};
},{packages,catalog,plannerFile});
const station=page.getByLabel('最寄り駅',{exact:true});await station.fill('西馬込');const start=performance.now();await page.getByRole('button',{name:/西馬込.*東京都/}).waitFor();report.stationInputIncludingDebounceMs=performance.now()-start;
const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const before=await cdp.send('Performance.getMetrics');await page.waitForTimeout(5000);const after=await cdp.send('Performance.getMetrics');const get=(r,k)=>r.metrics.find(m=>m.name===k)?.value??0;report.idle={seconds:5,mainThreadTaskSeconds:get(after,'TaskDuration')-get(before,'TaskDuration'),jsHeapUsedBytes:get(after,'JSHeapUsedSize')};
if(process.argv.includes('--tracking')) {
 let rtRequests=0;await context.route('https://api-public.odpt.org/**',r=>{rtRequests++;return r.abort();});
 await page.getByRole('button',{name:/西馬込.*東京都/}).click();await page.getByLabel('目的地駅',{exact:true}).fill('馬込');await page.getByRole('button',{name:/^馬込.*東京都/}).click();await page.getByRole('button',{name:'保存してはじめる'}).click();await page.getByText('利用する路線の時刻表を端末に保存しました。').waitFor();await page.locator('.outbound').click();await page.getByText('この経路で移動を開始').click();
 const begin=await cdp.send('Performance.getMetrics');rtRequests=0;await page.waitForTimeout(65000);const end=await cdp.send('Performance.getMetrics');
 report.foregroundTracking={seconds:65,mainThreadTaskSeconds:get(end,'TaskDuration')-get(begin,'TaskDuration'),jsHeapUsedBytes:get(end,'JSHeapUsedSize'),realtimeFetchAttempts:rtRequests,conditions:'GPS off, station unconfirmed, realtime request intentionally failed; no battery measurement'};
 await page.getByText('追跡を終了',{exact:true}).click();
}
report.assets=readdirSync('dist/assets').filter(f=>f.endsWith('.js')).map(file=>{const b=readFileSync('dist/assets/'+file);return {file,bytes:b.length,gzipBytes:gzipSync(b).length};});
report.data={stationBytes:manifest.stations.bytes,timetableBytes:manifest.packages.reduce((s,p)=>s+p.bytes,0),stations:catalog.length};
mkdirSync('docs',{recursive:true});writeFileSync('docs/performance.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
