import assert from 'node:assert/strict';
import test from 'node:test';
import { authMode, createSession, validSession, passwordMatches, sameOrigin, isPublicPath, clientKey, checkAttempt, recordFailure, SESSION_SECONDS, boundedBody } from '../src/studio/auth.ts';
const env = { SHIVALI_AUTH_PASSWORD: 'a-secure-password-here', SHIVALI_SESSION_SECRET: 's'.repeat(40) };
test('only unconfigured loopback bypasses authentication', () => {
 assert.equal(authMode('http://localhost:3000', {}), 'local');
 assert.equal(authMode('http://127.0.0.1:3000', {NODE_ENV:'production'}), 'local');
 for (const url of ['https://studio.example','http://localhost.evil','http://192.168.1.5']) assert.equal(authMode(url, {}), 'unavailable');
 assert.equal(authMode('http://localhost', {RENDER:'true'}), 'unavailable');
 assert.equal(authMode('http://localhost', {SHIVALI_HOST:'0.0.0.0'}), 'unavailable');
 assert.equal(authMode('http://localhost', {SHIVALI_AUTH_PASSWORD:'short'}), 'unavailable');
 assert.equal(authMode('https://studio.example', env), 'protected');
});
test('sessions resist forgery, expiration, future dates, and rotation', () => {
 const now=1700000000000; const token=createSession(env.SHIVALI_SESSION_SECRET, now);
 assert.equal(validSession(token, env.SHIVALI_SESSION_SECRET, now), true);
 for (const bad of ['', token+'x', 'bad.token', token.replace(/^./,'x')]) assert.equal(validSession(bad,env.SHIVALI_SESSION_SECRET,now),false);
 assert.equal(validSession(token,env.SHIVALI_SESSION_SECRET,now+SESSION_SECONDS*1000),false);
 assert.equal(validSession(token,env.SHIVALI_SESSION_SECRET,now-1000),false);
 assert.equal(validSession(token,'different'.repeat(8),now),false);
 assert.ok(!token.includes(env.SHIVALI_AUTH_PASSWORD));
});
test('password, origin, and public path constraints', () => {
 assert.equal(passwordMatches(env.SHIVALI_AUTH_PASSWORD,env.SHIVALI_AUTH_PASSWORD),true);
 assert.equal(passwordMatches('wrong',env.SHIVALI_AUTH_PASSWORD),false);
 assert.equal(sameOrigin('https://studio.example','https://studio.example/api/auth/login'),true);
 assert.equal(sameOrigin(null,'https://studio.example'),false);
 assert.equal(sameOrigin('https://evil.example','https://studio.example'),false);
 for (const path of ['/api/blob','/api/generate','/private/a.png','/_next/image','/api/auth/logout','/login/other','/_next/static/%2e%2e/%2e%2e/api/blob','/_next/static/../../api/blob','/_next/static/%252e%252e/api/blob']) assert.equal(isPublicPath(path),false);
 for (const path of ['/login','/api/auth/login','/api/health','/_next/static/chunks/app.js','/favicon.ico']) assert.equal(isPublicPath(path),true);
});
test('rate limiting trusts forwarded IP only on Render and blocks after five failures', () => {
 const h=new Headers({'x-forwarded-for':'1.2.3.4, 5.6.7.8'});
 assert.equal(clientKey(h,{}),'direct'); assert.equal(clientKey(h,{RENDER:'true'}),'1.2.3.4');
 const key='test-key'; const now=1700000000000;
 for(let i=0;i<5;i++){ assert.equal(checkAttempt(key,now),true); recordFailure(key,now); }
 assert.equal(checkAttempt(key,now),false); assert.equal(checkAttempt(key,now+15*60*1000),true);
});

test('request body is bounded regardless of claimed length', async () => {
 assert.equal(await boundedBody(new Request('http://localhost',{method:'POST',body:'password=test'})),'password=test');
 await assert.rejects(boundedBody(new Request('http://localhost',{method:'POST',body:'x'.repeat(8193)})));
 await assert.rejects(boundedBody(new Request('http://localhost',{method:'POST',headers:{'content-length':'99999'},body:'a'})));
});

test('global failure cap survives forwarded address rotation', () => {
 const now=1800000000000;
 for(let i=0;i<20;i++){ const key=clientKey(new Headers({'x-forwarded-for':`spoof-${i}`}),{RENDER:'true'}); assert.equal(checkAttempt(key,now),true); recordFailure(key,now); }
 assert.equal(checkAttempt('another-spoof',now),false);
 assert.equal(checkAttempt('another-spoof',now+15*60*1000),true);
});
