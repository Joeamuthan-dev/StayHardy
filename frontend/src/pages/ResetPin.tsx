import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';

const ResetPin: React.FC = () => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newPin = [...pin];
    newPin[index] = value.slice(-1);
    setPin(newPin);
    if (value && index < 3) {
      document.getElementById(`reset-pin-${index + 1}`)?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !pin[index] && index > 0) {
      document.getElementById(`reset-pin-${index - 1}`)?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalPin = pin.join('');
    if (finalPin.length < 4) {
      setError('Please enter all 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const securePass = finalPin + "_secure_pin";
      const { error: authError } = await supabase.auth.updateUser({
        password: securePass
      });
      if (authError) throw authError;

      // Also update the users table plain PIN
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { error: dbError } = await supabase
          .from('users')
          .update({ 
            pin: finalPin,
            updatedAt: new Date().toISOString()
          })
          .eq('id', user.id);
        
        if (dbError) console.error('DB PIN update failed:', dbError);
      }

      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset PIN. Error: session might have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container" style={{ background: '#020617', padding: '1rem' }}>
      <div className="aurora-bg">
        <div className="aurora-gradient-1"></div>
        <div className="aurora-gradient-2"></div>
      </div>

      <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <header style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
          <button 
            onClick={() => navigate(-1)} 
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <h2 style={{ fontSize: '1rem', fontWeight: 900, letterSpacing: '0.1em', margin: 0, color: 'white' }}>StayHardy</h2>
          <div style={{ width: '24px' }}></div>
        </header>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <div style={{ marginBottom: '2rem', padding: '1.5rem', borderRadius: '999px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--primary)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '3rem' }}>lock_reset</span>
          </div>

          <h1 style={{ fontSize: '2rem', fontWeight: 900, letterSpacing: '-0.025em', margin: 0, color: 'white', textAlign: 'center' }}>Reset Your PIN</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem', marginTop: '0.75rem', textAlign: 'center', marginBottom: '3rem' }}>
            Enter your new 4-digit PIN. #StayHard
          </p>

          {success && (
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>
              PIN reset successfully! Redirecting...
            </div>
          )}

          {error && (
            <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem', width: '100%', textAlign: 'center' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '3rem' }}>
              {pin.map((digit, i) => (
                <input
                  key={i}
                  id={`reset-pin-${i}`}
                  type="password"
                  inputMode="numeric"
                  className="form-input"
                  style={{ width: '4rem', height: '4rem', textAlign: 'center', fontSize: '1.5rem', fontWeight: 900, borderRadius: '1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', boxSizing: 'border-box' }}
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  required
                />
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <button type="submit" className="glow-btn-primary" style={{ height: '4rem' }} disabled={loading || success}>
                {loading ? 'Updating...' : 'Reset PIN'}
              </button>
              <button 
                type="button" 
                onClick={() => navigate('/login')}
                style={{ height: '3.5rem', background: 'none', border: 'none', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', borderRadius: '1rem' }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <footer style={{ padding: '2rem 0', textAlign: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: '#475569', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>verified_user</span>
            <span>End-to-End Encrypted</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default ResetPin;
