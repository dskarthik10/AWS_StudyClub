import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import './AuthPages.css';

export default function VerifyEmail() {
  const { verifyEmail, resendVerificationCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const result = await verifyEmail(email, code);
      if (result.isSignUpComplete) navigate('/login', { replace: true, state: { verified: true } });
    } catch (authError) {
      setError(authError.message || 'That verification code is not valid.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    setError('');
    setNotice('');
    try {
      await resendVerificationCode(email);
      setNotice('A new verification code has been sent.');
    } catch (authError) {
      setError(authError.message || 'We could not resend the code.');
    }
  }

  return <main className="auth-page"><section className="auth-card">
    <div className="auth-brand"><span className="auth-brand-icon">✉️</span><h1>Verify your email</h1><p>Enter the code Cognito sent to your inbox.</p></div>
    <form className="auth-form" onSubmit={handleSubmit}>
      {error && <p className="auth-error" role="alert">{error}</p>}
      {notice && <p className="auth-notice" role="status">{notice}</p>}
      <label className="auth-field">Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label className="auth-field">Verification code<input value={code} onChange={(event) => setCode(event.target.value)} autoComplete="one-time-code" inputMode="numeric" required /></label>
      <button className="auth-submit" disabled={isSubmitting}>{isSubmitting ? 'Verifying…' : 'Verify email'}</button>
    </form>
    <button className="auth-secondary-button" type="button" onClick={handleResend} disabled={!email}>Resend code</button>
    <p className="auth-footer"><Link className="auth-link" to="/login">Back to sign in</Link></p>
  </section></main>;
}
