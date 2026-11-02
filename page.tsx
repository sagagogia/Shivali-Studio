import type { Metadata } from 'next';
import LoginForm from './LoginForm';
import '@/studio/tokens.css';
import './login.css';
export const metadata: Metadata={title:'Sign in',robots:{index:false,follow:false}};
export const dynamic='force-dynamic';
export default function Login() {
 return <main className="studio-login"><section className="studio-login-card">
  <p className="studio-login-brand">Shivali Studio</p>
  <h1>Your private creative studio</h1>
  <p>Enter your studio password to continue.</p>
  <LoginForm />
  <form method="post" action="/api/auth/logout" className="studio-login-logout"><button type="submit">Sign out of this browser</button></form>
 </section></main>;
}
