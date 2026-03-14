import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import BottomNav from '../components/BottomNav';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ users: 0, tasks: 0, feedback: 0 });
  const [users, setUsers] = useState<any[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'feedback'>('overview');
  const [resetPinModal, setResetPinModal] = useState<{ show: boolean, userId: string, userName: string }>({ show: false, userId: '', userName: '' });
  const [deleteUserModal, setDeleteUserModal] = useState<{ show: boolean, userId: string, userName: string }>({ show: false, userId: '', userName: '' });
  const [newPinInput, setNewPinInput] = useState(['', '', '', '']);
  const [timeRange, setTimeRange] = useState<7 | 30>(7);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    // Role check
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    const fetchData = async () => {
      // 1. Fetch Feedback
      const { data: feedbackData } = await supabase
        .from('feedback')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (feedbackData) {
        setFeedbacks(feedbackData.slice(0, 50));
        setStats(prev => ({ ...prev, feedback: feedbackData.length }));
      }

      // 2. Fetch Users
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (userError) console.error('Error fetching users:', userError);
      
      if (userData) {
        setUsers(userData);
        setStats(prev => ({ ...prev, users: userData.length }));
      }

      // 3. Fetch Tasks
      const { count: taskCount } = await supabase
        .from('tasks')
        .select('*', { count: 'exact', head: true });
      if (taskCount !== null) setStats(prev => ({ ...prev, tasks: taskCount }));

      // 4. Process Chart Data
      processChartData(userData || [], feedbackData || [], timeRange);
    };

    fetchData();

    // Subscribe to changes
    const feedbackChannel = supabase
      .channel('admin_feedback')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => fetchData())
      .subscribe();

    const userChannel = supabase
      .channel('admin_users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(feedbackChannel);
      supabase.removeChannel(userChannel);
    };
  }, [user, timeRange]);

  const processChartData = (users: any[], feedback: any[], days: number) => {
    const data = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const displayDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const daySignups = users.filter(u => u.created_at && u.created_at.startsWith(dateStr)).length;
      const dayTickets = feedback.filter(f => f.created_at && f.created_at.startsWith(dateStr)).length;

      data.push({
        name: displayDate,
        signups: daySignups,
        tickets: dayTickets,
      });
    }
    setChartData(data);
  };



  const updateUserStatus = async (userId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ status: newStatus })
        .eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const deleteUser = (userId: string, userName: string) => {
    setDeleteUserModal({ show: true, userId, userName });
  };

  const handleConfirmDelete = async () => {
    const { userId } = deleteUserModal;
    if (!userId) return;

    try {
      const { error: tasksError } = await supabase
        .from('tasks')
        .delete()
        .eq('userId', userId);
      
      if (tasksError) {
        console.warn('Could not delete tasks:', tasksError);
      }

      const { error: userError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userError) throw userError;

      setUsers(prev => prev.filter(u => u.id !== userId));
      setStats(prev => ({ ...prev, users: Math.max(0, prev.users - 1) }));
      
      setDeleteUserModal({ show: false, userId: '', userName: '' });
      alert('User and their data have been purged successfully.');
    } catch (err) {
      console.error('Error during user purging:', err);
      alert('Failed to delete user.');
    }
  };

  const handleResetPin = async () => {
    const pin = newPinInput.join('');
    if (pin.length !== 4) {
      alert('Please enter a 4-digit PIN');
      return;
    }

    try {
      const { error: userTableError } = await supabase
        .from('users')
        .update({ pin: pin })
        .eq('id', resetPinModal.userId);

      if (userTableError) throw userTableError;
      
      alert(`PIN for ${resetPinModal.userName} reset successfully!`);
      setResetPinModal({ show: false, userId: '', userName: '' });
      setNewPinInput(['', '', '', '']);
    } catch (err) {
      console.error('Error resetting PIN:', err);
      alert('Failed to reset PIN.');
    }
  };

  const handlePinInputChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newPin = [...newPinInput];
    newPin[index] = value;
    setNewPinInput(newPin);

    if (value && index < 3) {
      const nextInput = document.getElementById(`reset-pin-${index + 1}`);
      nextInput?.focus();
    }
  };


  if (!user || user.role !== 'admin') return null;

  return (
    <div className="page-shell">
      <div className="aurora-bg">
        <div className="aurora-gradient-1"></div>
        <div className="aurora-gradient-2"></div>
      </div>

      <header className="dashboard-header" style={{ marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, margin: 0, color: 'var(--text-main)' }}>Admin Hub</h1>
          <p style={{ color: '#BBFF00', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.25rem' }}>
            System Integrity & Oversight
          </p>
        </div>
      </header>

      {/* Admin Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '1.25rem' }}>
        {(['overview', 'users', 'feedback'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '0.75rem',
              borderRadius: '0.875rem',
              border: 'none',
              background: activeTab === tab ? '#BBFF00' : 'transparent',
              color: activeTab === tab ? '#064e3b' : '#64748b',
              fontWeight: 900,
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              cursor: 'pointer',
              transition: 'all 0.3s ease'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <main style={{ paddingBottom: '4rem' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Activity Chart Section */}
            <div className="glass-card" style={{ padding: '1.5rem', minHeight: '350px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.1em' }}>User Activity Trend</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Signups vs Tickets</p>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.05)', padding: '0.25rem', borderRadius: '0.75rem' }}>
                  {[7, 30].map(days => (
                    <button
                      key={days}
                      onClick={() => setTimeRange(days as 7 | 30)}
                      style={{
                        padding: '0.4rem 0.75rem',
                        borderRadius: '0.5rem',
                        border: 'none',
                        background: timeRange === days ? 'var(--primary)' : 'transparent',
                        color: timeRange === days ? '#064e3b' : '#64748b',
                        fontSize: '0.7rem',
                        fontWeight: 900,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {days}D
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', height: '250px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        background: '#0f172a', 
                        border: '1px solid rgba(255,255,255,0.1)', 
                        borderRadius: '0.75rem',
                        fontSize: '0.8rem',
                        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)'
                      }}
                      itemStyle={{ fontWeight: 700 }}
                    />
                    <Area type="monotone" dataKey="signups" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorSignups)" name="Signups" />
                    <Area type="monotone" dataKey="tickets" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorTickets)" name="Tickets" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', gap: '1rem' }}>
              <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#10b981', marginBottom: '0.5rem', fontSize: '20px' }}>group</span>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.users}</h4>
                <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Users</p>
              </div>
              <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#3b82f6', marginBottom: '0.5rem', fontSize: '20px' }}>task_alt</span>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.tasks}</h4>
                <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Tasks</p>
              </div>
              <div className="glass-card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                <span className="material-symbols-outlined" style={{ color: '#f59e0b', marginBottom: '0.5rem', fontSize: '20px' }}>forum</span>
                <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-main)' }}>{stats.feedback}</h4>
                <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: 900, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>Feedback</p>
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>Recent Signups</h3>
                <span style={{ fontSize: '9px', fontWeight: 900, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: '4px' }}>Live Users</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {users.slice(0, 3).map(u => (
                    <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{u.name}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Joined {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</div>
                      </div>
                      <span style={{ fontSize: '0.75rem', fontWeight: 900, color: u.role === 'admin' ? '#BBFF00' : '#64748b' }}>{u.role?.toUpperCase() || 'USER'}</span>
                    </div>
                  ))}
                  {users.length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>No users found.</div>
                  )}
              </div>
            </div>

            <div className="glass-card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '10px', fontWeight: 900, color: '#f59e0b', textTransform: 'uppercase' }}>Recent Feedback</h3>
                <span style={{ fontSize: '9px', fontWeight: 900, color: '#f59e0b', background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: '4px' }}>Live Feed</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {feedbacks.slice(0, 3).map(f => (
                    <div key={f.id} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.75rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{f.user_name || 'Anonymous'}</div>
                        <div style={{ fontSize: '0.65rem', color: '#64748b' }}>{f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}</div>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: 1.4 }}>"{f.message}"</div>
                    </div>
                  ))}
                  {feedbacks.length === 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b', textAlign: 'center' }}>No feedback received yet.</div>
                  )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="glass-card" style={{ padding: '0', overflow: 'hidden' }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 900, color: 'white' }}>User Management Report</h3>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.7rem', color: '#64748b' }}>Technical summary of all registered accounts</p>
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 900, color: 'var(--primary)', background: 'rgba(187,255,0,0.1)', padding: '0.4rem 0.8rem', borderRadius: '0.75rem' }}>
                  {users.length} TOTAL USERS
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.03)' }}>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.1em' }}>User Details</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.1em' }}>Role</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.1em' }}>Joined Date</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.1em', textAlign: 'center' }}>Status</th>
                      <th style={{ padding: '1rem 1.5rem', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.1em', textAlign: 'right' }}>Management</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u, idx) => (
                      <tr 
                        key={u.id} 
                        style={{ 
                          borderBottom: '1px solid rgba(255,255,255,0.03)', 
                          opacity: u.status === 'inactive' ? 0.6 : 1,
                          background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                          transition: 'background 0.2s'
                        }}
                      >
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <div style={{ fontWeight: 800, color: 'white', fontSize: '0.85rem' }}>{u.name}</div>
                          <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{u.email}</div>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem' }}>
                          <span style={{ 
                            fontSize: '0.65rem', 
                            fontWeight: 900, 
                            color: u.role === 'admin' ? '#BBFF00' : '#94a3b8',
                            background: u.role === 'admin' ? 'rgba(187,255,0,0.05)' : 'rgba(148,163,184,0.05)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', fontSize: '0.75rem', color: '#94a3b8', fontWeight: 600 }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'center' }}>
                          <button 
                            onClick={() => updateUserStatus(u.id, u.status === 'inactive' ? 'active' : 'inactive')}
                            style={{ 
                              padding: '4px 10px', 
                              borderRadius: '6px', 
                              border: 'none', 
                              background: u.status === 'inactive' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                              color: u.status === 'inactive' ? '#ef4444' : '#10b981',
                              fontSize: '0.6rem',
                              fontWeight: 900,
                              cursor: 'pointer',
                              letterSpacing: '0.05em'
                            }}
                          >
                            {u.status === 'inactive' ? 'PAUSED' : 'ACTIVE'}
                          </button>
                        </td>
                        <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button 
                              onClick={() => setResetPinModal({ show: true, userId: u.id, userName: u.name })}
                              style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'rgba(187,255,0,0.05)', color: '#BBFF00', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>lock_reset</span>
                            </button>
                            <button 
                              onClick={() => deleteUser(u.id, u.name)}
                              style={{ width: '30px', height: '30px', borderRadius: '8px', border: 'none', background: 'rgba(239,68,68,0.05)', color: '#ef4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {users.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 0', opacity: 0.3 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>group_off</span>
                <p style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '10px' }}>No users registered</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'feedback' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {feedbacks.map(f => (
              <div key={f.id} className="glass-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white' }}>{f.user_name || 'Anonymous'}</span>
                  <span style={{ fontSize: '0.65rem', color: '#475569' }}>{f.created_at ? new Date(f.created_at).toLocaleDateString() : ''}</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: '1.5' }}>{f.message}</p>
              </div>
            ))}
            {feedbacks.length === 0 && (
              <div style={{ textAlign: 'center', padding: '4rem 0', opacity: 0.3 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>forum</span>
                <p style={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.2em', fontSize: '10px' }}>No feedback received</p>
              </div>
            )}
          </div>
        )}
      </main>

      <BottomNav />

      {/* Reset PIN Modal */}
      {resetPinModal.show && (
        <div className="premium-modal-overlay" onClick={() => setResetPinModal({ ...resetPinModal, show: false })}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative' }}>
            <div style={{ textAlign: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '3rem', color: '#BBFF00', marginBottom: '1rem' }}>lock_reset</span>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 900 }}>Reset PIN</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>Set a new 4-digit PIN for <strong>{resetPinModal.userName}</strong></p>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              {newPinInput.map((digit, idx) => (
                <input
                  key={idx}
                  id={`reset-pin-${idx}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handlePinInputChange(idx, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Backspace' && !digit && idx > 0) {
                      document.getElementById(`reset-pin-${idx - 1}`)?.focus();
                    }
                  }}
                  style={{
                    width: '3.5rem',
                    height: '4rem',
                    borderRadius: '1rem',
                    border: '2px solid rgba(187, 255, 0, 0.1)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#BBFF00',
                    textAlign: 'center',
                    fontSize: '1.5rem',
                    fontWeight: 900,
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                onClick={() => setResetPinModal({ ...resetPinModal, show: false })}
                style={{ flex: 1, padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', fontWeight: 900, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button 
                onClick={handleResetPin}
                className="glow-btn-primary"
                style={{ flex: 2, padding: '1rem', borderRadius: '1rem', fontWeight: 900, background: '#BBFF00', color: '#064e3b' }}
              >
                Update PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteUserModal.show && (
        <div className="premium-modal-overlay" onClick={() => setDeleteUserModal({ ...deleteUserModal, show: false })}>
          <div className="glass-card" onClick={e => e.stopPropagation()} style={{ width: '90%', maxWidth: '400px', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', position: 'relative', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#ef4444' }}>warning</span>
              </div>
              <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.5rem', fontWeight: 900, color: 'white' }}>Purge Account?</h2>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#94a3b8', lineHeight: 1.6 }}>
                You are about to permanently delete <strong>{deleteUserModal.userName}</strong> and all their task history. This cannot be undone.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
              <button 
                onClick={() => setDeleteUserModal({ ...deleteUserModal, show: false })}
                style={{ flex: 1, padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'white', fontWeight: 900, cursor: 'pointer' }}
              >
                No, Keep
              </button>
              <button 
                onClick={handleConfirmDelete}
                style={{ flex: 1.5, padding: '1rem', borderRadius: '1rem', border: 'none', background: '#ef4444', color: 'white', fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 24px rgba(239, 68, 68, 0.3)' }}
              >
                Yes, Purge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
