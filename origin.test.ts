import test from 'node:test';
import assert from 'node:assert/strict';
import { appOrigin,appUrl,incomingUrl } from '../src/studio/origin.ts';
test('Render canonical URL is used behind an internal localhost proxy',()=>{
 const env={RENDER_EXTERNAL_URL:'https://shivali-example.onrender.com'};
 assert.equal(appOrigin('http://localhost:10000/api/auth/login',env),'https://shivali-example.onrender.com');
 assert.equal(appUrl('/login','http://localhost:10000/path',env),'https://shivali-example.onrender.com/login');
 assert.equal(appOrigin('http://localhost:3001',{}),'http://localhost:3001');
});
test('configured origins cannot include credentials, paths or insecure hosted URLs',()=>{
 for(const origin of ['https://user:secret@example.com','https://example.com/path','http://example.com','https://example.com/?secret=x'])assert.throws(()=>appOrigin('http://localhost',{SHIVALI_PUBLIC_ORIGIN:origin}));
});

test('local browser Host is preserved when Next uses an internal localhost URL',()=>{const r=new Request('http://localhost:3013/api/auth/login',{headers:{Host:'127.0.0.1:3013'}});assert.equal(incomingUrl(r,{}),'http://127.0.0.1:3013/api/auth/login');assert.equal(appOrigin(incomingUrl(r,{}),{RENDER_EXTERNAL_URL:'https://studio.onrender.com'}),'https://studio.onrender.com');});
