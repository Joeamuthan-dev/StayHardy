import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { supabase } from '../supabase';

const ForgotPin: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-pin`,
      });
      if (error) throw error;
      setMessage('Recovery link sent! Check your email to reset your PIN.');
    } catch (err: any) {
      setError(err.message || 'Failed to send recovery email.');
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

      <div style={{ maxWidth: '400px', margin: '0 auto', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 0' }}>
          <button 
            onClick={() => navigate(-1)} 
            style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2rem' }}>lock_reset</span>
          </div>
        </header>

        <div style={{ marginTop: '3rem', marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 900, letterSpacing: '-0.025em', margin: 0, color: 'white' }}>Forgot PIN?</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', lineHeight: 1.6, maxWidth: '320px', margin: '0 auto' }}>
            Don't stop when you're tired. Stop when you're done. #StayHard
          </p>
        </div>

        {message && (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
            {message}
          </div>
        )}

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', padding: '1rem', borderRadius: '1rem', marginBottom: '1.5rem', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <div className="input-group">
            <label style={{ fontSize: '0.75rem', fontWeight: 800, color: '#64748b', letterSpacing: '0.05em', display: 'block', marginBottom: '0.75rem' }}>EMAIL ADDRESS</label>
            <div style={{ position: 'relative' }}>
              <span className="material-symbols-outlined" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--primary)', fontSize: '20px' }}>mail</span>
              <input 
                type="email" 
                className="form-input" 
                placeholder="name@company.com" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{ paddingLeft: '3.5rem', height: '4rem', borderRadius: '1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
          </div>

          <button type="submit" className="glow-btn-primary" style={{ height: '4rem' }} disabled={loading}>
            <span className="truncate">{loading ? 'Sending...' : 'Send Recovery Link'}</span>
          </button>
        </form>

        <div style={{ marginTop: 'auto', padding: '2rem 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Remember your PIN? 
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, marginLeft: '0.5rem', cursor: 'pointer' }}>Log in</button>
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '2rem 0', opacity: 0.2 }}>
          <div style={{ height: '1px', width: '6rem', background: 'linear-gradient(to right, transparent, white, transparent)' }}></div>
          <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'white' }}>Pending Secure</p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPin;
