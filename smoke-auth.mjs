import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
const dir=await mkdtemp(path.join(tmpdir(),'shivali-auth-'));
const password=randomBytes(24).toString('hex'),secret=randomBytes(32).toString('hex');
const base='http://127.0.0.1:3013';let logs='';let browser;
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3013'],{env:{...process.env,NODE_ENV:'production',SHIVALI_DATA_DIR:dir,SHIVALI_AUTH_PASSWORD:password,SHIVALI_SESSION_SECRET:secret,SHIVALI_ENABLE_PAID_GENERATION:'false',SHIVALI_ENABLE_ADVANCED_GENERATOR:'false',NEXT_TELEMETRY_DISABLED:'1'},stdio:['ignore','pipe','pipe']});
server.stdout.on('data',b=>logs+=b);server.stderr.on('data',b=>logs+=b);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
try{
 for(let n=0;n<100;n++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}if(server.exitCode!==null)throw Error('Server failed');await pause(100);}
 for(const route of ['/api/studio','/api/studio/assets/unknown','/api/blob','/api/studio/export/unknown'])assert.equal((await fetch(base+route)).status,401,route);
 assert.equal((await fetch(base,{redirect:'manual'})).status,307);
 const health=await(await fetch(base+'/api/health')).json();assert.deepEqual(health,{ok:true});
 assert.equal((await fetch(base+'/api/studio',{headers:{Cookie:'shivali_session=forged'}})).status,401);
 const login=async(pass,origin=base)=>fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded',Origin:origin},body:new URLSearchParams({password:pass}),redirect:'manual'});
 assert.equal((await login(password,'https://other.example')).status,403);
 assert.equal((await login('incorrect')).status,401);
 const signed=await login(password);assert.equal(signed.status,303);const raw=signed.headers.get('set-cookie');assert.ok(raw&&/HttpOnly/i.test(raw)&&/Secure/i.test(raw)&&/SameSite=strict/i.test(raw));const cookie=raw.split(';')[0];
 const authorized=await fetch(base+'/api/studio',{headers:{Cookie:cookie}});assert.equal(authorized.status,200);assert.equal((await authorized.json()).garments[0].designNumber,'MF03162');
 const loggedOut=await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:base},redirect:'manual'});assert.equal(loggedOut.status,303);assert.match(loggedOut.headers.get('set-cookie'),/Max-Age=0/i);
 browser=await puppeteer.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();await page.setViewport({width:390,height:844});
 await page.goto(base+'/login',{waitUntil:'networkidle0'});await page.type('#password','incorrect');await page.click('button[type=submit]');await page.waitForSelector('[role=alert]');assert.match(await page.$eval('[role=alert]',n=>n.textContent),/Unable to sign in/);
 await page.$eval('#password',n=>n.value='');await page.type('#password',password);await page.click('button[type=submit]');await page.waitForSelector('.workbench',{timeout:15000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mkdir('artifacts',{recursive:true});await writeFile('artifacts/auth-smoke.json',JSON.stringify({passed:true,checks:['protected page redirect','unauthenticated APIs and files denied','forged cookie denied','minimal public health','cross-origin login denied','bad password denied','secure signed cookie','authenticated snapshot','logout clears cookie','mobile login errors and successful sign-in'],credentialsPrinted:false},null,2));
 console.log('Authentication API and mobile browser smoke passed. No credentials printed or saved.');
}catch(error){await mkdir('artifacts',{recursive:true});await writeFile('artifacts/auth-smoke-server.log',logs);throw error;}
finally{if(browser)await browser.close();server.kill('SIGTERM');await new Promise(r=>server.once('exit',r));await rm(dir,{recursive:true,force:true});}
