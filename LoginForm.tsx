'use client';
import { useState, type FormEvent } from 'react';
export default function LoginForm() {
 const [error,setError]=useState('');
 const [pending,setPending]=useState(false);
 async function submit(event: FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError(''); setPending(true);
  const form=event.currentTarget;
  try {
   const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({password:String(new FormData(form).get('password') || '')}),credentials:'same-origin'});
   if(response.ok) { window.location.assign('/'); return; }
   setError(response.status===429 ? 'Too many attempts. Please try again in 15 minutes.' : response.status===503 ? 'Studio access is not configured. Please contact the studio owner.' : 'Unable to sign in. Check your password and try again.');
  } catch {setError('Unable to sign in. Please try again.');}
  finally {setPending(false);}
 }
 return <form method="post" action="/api/auth/login" onSubmit={submit}>
  <label htmlFor="password">Studio password</label>
  <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={4096} aria-describedby={error ? 'login-error' : undefined}/>
  {error && <p id="login-error" className="studio-login-error" role="alert">{error}</p>}
  <button className="studio-login-submit" type="submit" disabled={pending}>{pending ? 'Signing in…' : 'Sign in'}</button>
 </form>;
}
