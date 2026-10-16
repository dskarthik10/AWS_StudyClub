import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import './AuthPages.css';

export default function SetNewPassword() {
  const { completeNewPassword } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await completeNewPassword(name, newPassword);
      if (result.isSignedIn) navigate('/dashboard', { replace: true });
      else setError('Cognito requires another sign-in step. Please sign in again.');
    } catch (authError) {
      setError(authError.message || 'We could not update your password.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-icon">🔐</span><h1>Set a new password</h1><p>Your account needs your name and a new password before you can continue.</p></div>
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <label className="auth-field">Name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>
      <label className="auth-field">New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength="8" required /></label>
      <button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Updating…' : 'Set new password'}</button>
    </form>
  </section></main>;
}
