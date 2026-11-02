import { appOrigin } from './origin.ts';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

type AuthEnv = { SHIVALI_AUTH_PASSWORD?: string; SHIVALI_SESSION_SECRET?: string; RENDER?: string; SHIVALI_HOST?: string; NODE_ENV?: string };
export const SESSION_COOKIE = 'shivali_session';
export const SESSION_SECONDS = 8 * 60 * 60;
const WINDOW = 15 * 60 * 1000;
let globalAttempts = {count:0,until:0};
const attempts = new Map<string, { count: number; until: number }>();
export function authMode(url: string, env: AuthEnv = process.env): 'local' | 'protected' | 'unavailable' {
 const password=env.SHIVALI_AUTH_PASSWORD, secret=env.SHIVALI_SESSION_SECRET;
 if (password || secret) return password && password.length >= 16 && secret && secret.length >= 32 ? 'protected' : 'unavailable';
 const host=new URL(url).hostname;
 return env.RENDER !== 'true' && (!env.SHIVALI_HOST || ['localhost','127.0.0.1','::1'].includes(env.SHIVALI_HOST)) && ['localhost','127.0.0.1','[::1]'].includes(host) ? 'local' : 'unavailable';
}
export function passwordMatches(candidate: string, expected: string) {
 return timingSafeEqual(createHash('sha256').update(candidate).digest(),createHash('sha256').update(expected).digest());
}
export function createSession(secret: string, now=Date.now()) {
 const timestamp=String(Math.floor(now/1000));
 return `${timestamp}.${createHmac('sha256',secret).update(timestamp).digest('base64url')}`;
}
export function validSession(token: string | undefined, secret: string, now=Date.now()) {
 if (!token || !/^\d{10,12}\.[A-Za-z0-9_-]{43}$/.test(token)) return false;
 const timestamp=Number(token.split('.')[0]), current=Math.floor(now/1000);
 if (timestamp > current || current-timestamp >= SESSION_SECONDS) return false;
 return passwordMatches(token,createSession(secret,timestamp*1000));
}
export function isAuthorizedRequest(url: string, token: string | undefined, env: AuthEnv=process.env) {
 const mode=authMode(url,env);
 return mode==='local' || (mode==='protected' && validSession(token,env.SHIVALI_SESSION_SECRET!));
}
export function isPublicPath(path: string) {
 if(path.includes('%') || path.split('/').some(part=>part==='.' || part==='..')) return false;
 return ['/login','/api/auth/login','/api/health','/favicon.ico','/icon.svg','/icon.png'].includes(path) || /^\/_next\/static\/[A-Za-z0-9_./%~-]+$/.test(path);
}
export function sameOrigin(origin: string | null, url: string) {
 try { return !!origin && new URL(origin).origin === appOrigin(url); } catch { return false; }
}
export function clientKey(headers: Headers, env: AuthEnv=process.env) {
 return env.RENDER==='true' ? (headers.get('x-forwarded-for')?.split(',')[0]?.trim().slice(0,100) || 'direct') : 'direct';
}
export function checkAttempt(key: string, now=Date.now()) {
 for (const [k,v] of attempts) if(v.until<=now) attempts.delete(k);
 if(globalAttempts.until>now && globalAttempts.count>=20) return false;
 const entry=attempts.get(key); return entry ? entry.count<5 : attempts.size<10000;
}
export function recordFailure(key: string, now=Date.now()) {
 globalAttempts=globalAttempts.until>now ? {...globalAttempts,count:globalAttempts.count+1} : {count:1,until:now+WINDOW};
 for (const [k,v] of attempts) if(v.until<=now) attempts.delete(k);
 // Bound memory; new addresses fail closed if the process is saturated.
 if(!attempts.has(key) && attempts.size>=10000) return;
 const entry=attempts.get(key);
 attempts.set(key,entry && entry.until>now ? {...entry,count:entry.count+1} : {count:1,until:now+WINDOW});
}
export function clearAttempts(key: string) { attempts.delete(key); }
export function cookieOptions(url: string) {
 return { httpOnly:true, secure:process.env.NODE_ENV==='production' || new URL(url).protocol==='https:', sameSite:'strict' as const, path:'/', maxAge:SESSION_SECONDS };
}
export async function boundedBody(request: Request): Promise<string> {
 const length=request.headers.get('content-length');
 if(length && (!/^\d+$/.test(length) || Number(length)>8192)) throw new Error('Invalid request');
 const reader=request.body?.getReader(); if(!reader) return '';
 const chunks: Uint8Array[]=[]; let size=0;
 try { for(;;) {const {done,value}=await reader.read(); if(done) break; size+=value.byteLength; if(size>8192) {await reader.cancel();throw new Error('Invalid request');} chunks.push(value);} }
 finally {reader.releaseLock();}
 return Buffer.concat(chunks).toString('utf8');
}
