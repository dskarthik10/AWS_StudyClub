import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import './AuthPages.css';

export default function SignUp() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await register(form);
      if (result.isSignUpComplete) {
        navigate('/login', { replace: true });
      } else {
        navigate('/verify-email', { state: { email: form.email } });
      }
    } catch (authError) {
      setError(authError.message || 'We could not create your account. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-icon">🎓</span><h1>Create your account</h1><p>Start organizing your study journey.</p></div>
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <label className="auth-field">Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} autoComplete="name" required /></label>
      <label className="auth-field">Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} autoComplete="email" required /></label>
      <label className="auth-field">Password<input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" minLength="8" required /></label>
      <button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Creating account…' : 'Create account'}</button>
    </form>
    <p className="auth-footer">Already have an account? <Link className="auth-link" to="/login">Sign in</Link></p>
  </section></main>;
}
