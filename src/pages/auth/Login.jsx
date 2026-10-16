import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import './AuthPages.css';

function friendlyError(error) {
  if (error.name === 'UserNotConfirmedException') return 'Please verify your email before signing in.';
  if (error.name === 'NotAuthorizedException') return 'Your email or password is incorrect.';
  return error.message || 'We could not sign you in. Please try again.';
}

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await login(email, password);
      if (result.isSignedIn) {
        navigate('/dashboard', { replace: true });
      } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_UP') {
        navigate('/verify-email', { state: { email } });
      } else if (result.nextStep?.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
        navigate('/set-new-password');
      } else if (result.nextStep?.signInStep === 'RESET_PASSWORD') {
        navigate('/forgot-password', { state: { email, fromSignIn: true } });
      } else {
        setError(`Cognito requires ${result.nextStep?.signInStep || 'an additional sign-in step'}.`);
      }
    } catch (authError) {
      if (authError.name === 'UserNotConfirmedException') {
        navigate('/verify-email', { state: { email } });
      } else {
        setError(friendlyError(authError));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-icon">🎓</span><h1>Welcome to AI StudyClub</h1><p>Sign in to continue learning.</p></div>
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <label className="auth-field">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label className="auth-field">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required /></label>
      <button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in…' : 'Sign in'}</button>
    </form>
    <p className="auth-footer"><Link className="auth-link" to="/forgot-password">Forgot your password?</Link></p>
    <p className="auth-footer">New to AI StudyClub? <Link className="auth-link" to="/signup">Create an account</Link></p>
  </section></main>;
}
