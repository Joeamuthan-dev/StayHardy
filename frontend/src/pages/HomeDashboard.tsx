import React, { useState, useEffect, useMemo } from 'react';
import BottomNav from '../components/BottomNav';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '../supabase';

interface Task {
  id: string;
  title: string;
  status: 'pending' | 'completed';
  priority: 'High' | 'Medium' | 'Low';
  createdAt: string;
  updatedAt?: string;
  category: string;
}

interface Routine {
  id: string;
  title: string;
  days: string[];
}

interface RoutineLog {
  routine_id: string;
  completed_at: string;
}

interface Goal {
  id: string;
  name: string;
  targetDate: string;
  status: 'pending' | 'completed';
  progress: number;
}

const HomeDashboard: React.FC = () => {
  const [isSidebarHidden, setIsSidebarHidden] = useState(() => localStorage.getItem('sidebarHidden') === 'true');
  const toggleSidebar = () => { setIsSidebarHidden(prev => { const next = !prev; localStorage.setItem('sidebarHidden', next.toString()); return next; }); };
  const { language } = useLanguage();
  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return language === 'Tamil' ? 'காலை வணக்கம்' : 'Good Morning';
    if (hour < 18) return language === 'Tamil' ? 'மதிய வணக்கம்' : 'Good Afternoon';
    return language === 'Tamil' ? 'மாலை வணக்கம்' : 'Good Evening';
  };
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [routineLogs, setRoutineLogs] = useState<RoutineLog[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);

  // ── Reminders from Calendar (localStorage) ──
  const upcomingReminders = useMemo(() => {
    try {
      const key = `reminders_${user?.id || 'guest'}`;
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      const all: { id: string; date: string; title: string }[] = JSON.parse(stored);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayStr = now.toISOString().split('T')[0];
      const plusThree = new Date(now); plusThree.setDate(plusThree.getDate() + 3);
      const limitStr = plusThree.toISOString().split('T')[0];
      return all
        .filter(r => r.date >= todayStr && r.date <= limitStr)
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch { return []; }
  }, [user?.id]);

  const getDueLabel = (dateStr: string) => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const rem = new Date(dateStr + 'T00:00:00'); rem.setHours(0, 0, 0, 0);
    const diff = Math.round((rem.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      // Fetch Tasks
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('userId', user.id);
      if (tasksData) setTasks(tasksData);

      // Fetch Routines
      const { data: routinesData } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', user.id);
      if (routinesData) setRoutines(routinesData);

      // Fetch Routine Logs for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDayStr = thirtyDaysAgo.getFullYear() + '-' + String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0') + '-' + String(thirtyDaysAgo.getDate()).padStart(2, '0');

      const { data: logsData } = await supabase
        .from('routine_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('completed_at', startDayStr);
      if (logsData) setRoutineLogs(logsData);

      // Fetch Goals
      const { data: goalsData } = await supabase
        .from('goals')
        .select('*')
        .eq('userId', user.id)
        .order('createdAt', { ascending: false });
      if (goalsData) setGoals(goalsData);
    };

    fetchData();
  }, [user]);

  // Derived Data
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const localTodayStr = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];

  const pendingTasks = tasks.filter(t => t.status === 'pending');

  const topPendingTasks = [...pendingTasks].sort((a, b) => {
    const pA = a.priority === 'High' ? 3 : a.priority === 'Medium' ? 2 : 1;
    const pB = b.priority === 'High' ? 3 : b.priority === 'Medium' ? 2 : 1;
    return pB - pA;
  }).slice(0, 3);

  const totalUserTasks = tasks.length;
  const completedUserTasks = tasks.filter(t => t.status === 'completed').length;
  const taskCompletionRate = totalUserTasks > 0 ? Math.floor((completedUserTasks / totalUserTasks) * 100) : 0;
  
  const totalGoals = goals.length;
  const avgGoalProgress = totalGoals > 0 ? Math.round(goals.reduce((acc, g) => acc + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / totalGoals) : 0;

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDate = new Date();
  const currentDayName = daysOfWeek[todayDate.getDay()];
  const activeRoutinesTodayCount = routines.filter(r => r.days?.includes(currentDayName)).length;

  const completedRoutinesToday = routineLogs.filter(l => l.completed_at === localTodayStr).length;
  const todayRoutineRate = activeRoutinesTodayCount > 0 ? (completedRoutinesToday / activeRoutinesTodayCount) * 100 : 0;

  let currentStreak = 0;
  const uniqueLogDaysSet = new Set(routineLogs.map(l => l.completed_at));
  for (let i = 0; i < 365; i++) {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - i);
    const checkStr = new Date(checkDate.getTime() - (checkDate.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    const checkDayName = daysOfWeek[checkDate.getDay()];
    const scheduledThatDay = routines.filter(r => r.days?.includes(checkDayName)).length;
    
    if (uniqueLogDaysSet.has(checkStr)) {
      currentStreak++;
    } else {
      if (i === 0) continue; // Today missing doesn't break streak yet
      if (scheduledThatDay === 0) continue; // Not scheduled, doesn't break streak
      break; // Scheduled but missed
    }
  }

  let weightTasks = totalUserTasks > 0 ? 0.5 : 0;
  let weightRoutines = activeRoutinesTodayCount > 0 ? 0.3 : 0;
  let weightGoals = totalGoals > 0 ? 0.2 : 0;
  let totalWeight = weightTasks + weightRoutines + weightGoals;

  const productivityScore = totalWeight > 0 
    ? Math.round(((taskCompletionRate * weightTasks) + (todayRoutineRate * weightRoutines) + (avgGoalProgress * weightGoals)) / totalWeight)
    : 0;

  let scoreMessage = "Solid work. Keep pushing forward.";
  if (productivityScore === 0) scoreMessage = "Start your journey by adding tasks.";
  else if (productivityScore < 40) scoreMessage = "Warming up. The momentum is building.";
  else if (productivityScore > 80) scoreMessage = "Elite performance. You are outperforming the rest.";

  const activeGoals = goals.filter(g => g.status === 'pending').slice(0, 3);

  const chartData = useMemo(() => {
    const data = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const goalScore = totalGoals > 0 ? (goals.reduce((acc, g) => acc + (g.status === 'completed' ? 100 : (g.progress || 0)), 0) / totalGoals) : 0;
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
      const dayStart = d.getTime();
      const nextDayStart = dayStart + 24 * 60 * 60 * 1000;
      const localDayStr = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const checkDayName = daysOfWeek[d.getDay()];

      const totalTasksUpToDay = tasks.filter((t: Task) => new Date(t.createdAt).getTime() < nextDayStart).length;
      const compTasksUpToDay = tasks.filter((t: Task) => t.status === 'completed' && t.updatedAt && new Date(t.updatedAt).getTime() < nextDayStart).length;
      const cumulativeTaskRate = totalTasksUpToDay > 0 ? (compTasksUpToDay / totalTasksUpToDay) * 100 : 0;

      const scheduledThatDay = routines.filter(r => r.days?.includes(checkDayName)).length;
      const routinesCompletedThatDay = routineLogs.filter(l => l.completed_at === localDayStr).length;
      const dailyRoutineRate = scheduledThatDay > 0 ? (routinesCompletedThatDay / scheduledThatDay) * 100 : 0;
      
      let wTasks = totalTasksUpToDay > 0 ? 0.5 : 0;
      let wRoutines = scheduledThatDay > 0 ? 0.3 : 0;
      let wGoals = totalGoals > 0 ? 0.2 : 0;
      let wTotal = wTasks + wRoutines + wGoals;

      const combined = wTotal > 0 
        ? Math.round(((cumulativeTaskRate * wTasks) + (dailyRoutineRate * wRoutines) + (goalScore * wGoals)) / wTotal)
        : 0;

      data.push({
        day: dayStr,
        completed: combined,
        score: combined
      });
    }
    return data;
  }, [tasks, routines, routineLogs, goals]);



  const handleCompleteTask = async (taskId: string) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'completed', updatedAt: new Date().toISOString() } : t));
    const { error } = await supabase
      .from('tasks')
      .update({ status: 'completed', updatedAt: new Date().toISOString() })
      .eq('id', taskId);
    if (error) {
      console.error('Error completing task:', error);
      setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: 'pending' } : t));
    }
  };
  
  return (
    <div className={`page-shell ${isSidebarHidden ? 'sidebar-hidden' : ''}`}>
      <style>{`
        @media (min-width: 769px) { .shortcut-btn-label { display: block !important; } }
        @media (max-width: 768px) { 
          .shortcut-btn-label { display: none !important; } 
          .shortcut-btn { position: relative; }
          .shortcut-btn:active::after { content: attr(data-label); position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%); background: #0b0f19; color: #fff; padding: 6px 12px; border-radius: 8px; font-size: 0.7rem; white-space: nowrap; z-index: 100; font-weight: 800; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        }

        .today-focus-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }
        @media (max-width: 600px) {
          .today-focus-grid { grid-template-columns: 1fr; }
        }

        .focus-tile {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: #000000 !important;
          padding: 1rem;
          border-radius: 1.25rem;
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          cursor: pointer;
          position: relative;
        }
        .focus-tile:hover {
          transform: translateY(-4px) scale(1.02);
          background: #050508 !important;
        }

        /* Border Glow Accents */
        .tasks-tile { border-color: rgba(59, 130, 246, 0.2); }
        .tasks-tile:hover { 
          border-color: rgba(59, 130, 246, 0.6); 
          box-shadow: 0 0 20px rgba(59, 130, 246, 0.15); 
        }
        .routine-tile { border-color: rgba(168, 85, 247, 0.2); }
        .routine-tile:hover { 
          border-color: rgba(168, 85, 247, 0.6); 
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.15); 
        }
        .goals-tile { border-color: rgba(245, 158, 11, 0.2); }
        .goals-tile:hover { 
          border-color: rgba(245, 158, 11, 0.6); 
          box-shadow: 0 0 20px rgba(245, 158, 11, 0.15); 
        }

        .focus-icon-bg {
          width: 44px;
          height: 44px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: transform 0.3s ease;
        }
        .focus-tile:hover .focus-icon-bg {
          transform: scale(1.1) rotate(5deg);
        }

        .tasks-tile .focus-icon-bg { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .routine-tile .focus-icon-bg { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
        .goals-tile .focus-icon-bg { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }

        .focus-icon-bg .material-symbols-outlined {
          font-size: 1.5rem;
          font-variation-settings: 'FILL' 1;
        }

        .focus-content { text-align: left; }
        .focus-value {
          font-size: 1.5rem;
          font-weight: 900;
          color: #ffffff;
          line-height: 1;
        }
        .focus-label {
          font-size: 0.6rem;
          font-weight: 900;
          text-transform: uppercase;
          color: #94a3b8;
          letter-spacing: 0.1em;
          margin-top: 0.3rem;
        }
      `}</style>
      <div className="aurora-bg">
        <div className="aurora-gradient-1"></div>
        <div className="aurora-gradient-2"></div>
      </div>
      
      <header className="dashboard-header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-main)', margin: 0 }}>
             {getTimeGreeting()}, {user?.name?.split(' ')[0] || 'User'}
          </h1>
          <p style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: 900, letterSpacing: '0.05em', marginTop: '0.3rem', textTransform: 'uppercase' }}>
            {(() => {
              const now = new Date();
              const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
              const month = now.toLocaleDateString('en-US', { month: 'long' });
              const day = now.getDate();
              return `Today is ${dayName}, ${month} ${day}`;
            })()}
          </p>
          <p style={{ color: '#10b981', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.03em', marginTop: '0.2rem', opacity: 0.8 }}>
            {(() => {
              const now = new Date();
              const year = now.getFullYear();
              const endOfYear = new Date(year, 11, 31);
              const diff = Math.ceil((endOfYear.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
              return `${diff} days left in ${year} — make them count.`;
            })()}
          </p>
          
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={toggleSidebar}
            className="notification-btn desktop-only-btn"
            title={isSidebarHidden ? "Show Sidebar" : "Hide Sidebar (Focus Mode)"}
            data-tooltip={isSidebarHidden ? "Show Sidebar" : "Hide Sidebar"}
            style={{
              ...(isSidebarHidden ? { background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' } : {}),
              opacity: 0.5
            }}
          >
            <span className="material-symbols-outlined">
              {isSidebarHidden ? 'side_navigation' : 'fullscreen'}
            </span>
          </button>
        </div>
      </header>

      <main style={{ paddingBottom: '6rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '0 0.5rem' }}>
        
        {/* 1. Today Focus Section */}
        <section className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-main)' }}>Today's Focus</h2>
          </div>
          <div className="today-focus-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="focus-tile tasks-tile" onClick={() => navigate('/dashboard')}>
              <div className="focus-icon-bg">
                <span className="material-symbols-outlined">check_circle</span>
              </div>
              <div className="focus-content">
                <div className="focus-value" style={{ color: '#ffffff' }}>{pendingTasks.length}</div>
                <div className="focus-label">Tasks</div>
              </div>
            </div>

            <div className="focus-tile routine-tile" onClick={() => navigate('/routine')}>
              <div className="focus-icon-bg">
                <span className="material-symbols-outlined">calendar_check</span>
              </div>
              <div className="focus-content">
                <div className="focus-value" style={{ color: '#ffffff' }}>{completedRoutinesToday}/{activeRoutinesTodayCount}</div>
                <div className="focus-label">Routine</div>
              </div>
            </div>

            <div className="focus-tile goals-tile" onClick={() => navigate('/goals')}>
              <div className="focus-icon-bg">
                <span className="material-symbols-outlined">flag</span>
              </div>
              <div className="focus-content">
                <div className="focus-value" style={{ color: '#ffffff' }}>{activeGoals.length}</div>
                <div className="focus-label">Goals</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
            {topPendingTasks.length > 0 ? topPendingTasks.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '1rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem', borderRadius: '0.75rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                 <div 
                   onClick={() => handleCompleteTask(t.id)}
                   style={{ 
                     width: '1rem', 
                     height: '1rem', 
                     borderRadius: '50%', 
                     border: '2px solid rgba(255,255,255,0.2)',
                     cursor: 'pointer',
                     transition: 'all 0.2s',
                   }}
                   onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)'; }}
                   onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'; e.currentTarget.style.background = 'transparent'; }}
                 ></div>
                 <div style={{ flex: 1, fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                 <div style={{ fontSize: '0.7rem', color: t.priority === 'High' ? '#ef4444' : t.priority === 'Medium' ? '#f59e0b' : '#10b981', fontWeight: 900, background: t.priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : t.priority === 'Medium' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.5rem' }}>{t.priority}</div>
              </div>
            )) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No pending tasks found.</div>
            )}
          </div>

          {/* ── Upcoming Reminders ── */}
          {upcomingReminders.length > 0 && (
            <div style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.6rem' }}>Upcoming Reminders</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {upcomingReminders.map(r => (
                  <div
                    key={r.id}
                    onClick={() => navigate('/calendar')}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', borderRadius: '0.75rem', padding: '0.6rem 0.875rem', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#ef4444', flexShrink: 0 }}>event</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
                    </div>
                    <span style={{ fontSize: '0.65rem', fontWeight: 900, color: '#ef4444', background: 'rgba(239,68,68,0.12)', borderRadius: '6px', padding: '2px 7px', flexShrink: 0 }}>{getDueLabel(r.date)}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: '#64748b', flexShrink: 0 }}>chevron_right</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '1rem' }}>
            <button onClick={() => navigate('/dashboard?action=new-task')} className="shortcut-btn" data-label="Add Task" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', transition: 'background 0.2s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#10b981' }}>add_task</span>
              <span className="shortcut-btn-label" style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>Task</span>
            </button>
            <button onClick={() => navigate('/goals?action=new-goal')} className="shortcut-btn" data-label="Add Goal" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', transition: 'background 0.2s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#a855f7' }}>star</span>
              <span className="shortcut-btn-label" style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>Goal</span>
            </button>
            <button onClick={() => navigate('/routine?action=new-routine')} className="shortcut-btn" data-label="Add Routine" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', transition: 'background 0.2s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#3b82f6' }}>calendar_today</span>
              <span className="shortcut-btn-label" style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>Routine</span>
            </button>
            <button onClick={() => navigate('/stats')} className="shortcut-btn" data-label="View Stats" style={{ background: 'rgba(255,255,255,0.05)', border: 'none', padding: '0.75rem 0.5rem', borderRadius: '0.75rem', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem', cursor: 'pointer', transition: 'background 0.2s' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: '#f59e0b' }}>insights</span>
              <span className="shortcut-btn-label" style={{ fontSize: '0.6rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-main)' }}>Stats</span>
            </button>
          </div>
        </section>

        {/* 2. Productivity Score Card */}
        <section className="glass-card" style={{ padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', right: '-1rem', top: '-1rem', opacity: 0.05, transform: 'rotate(15deg)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '10rem' }}>bolt</span>
          </div>
          <h2 style={{ margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ color: '#f59e0b' }}>military_tech</span>
            Productivity Score
          </h2>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }}>
            <div style={{ fontSize: '3rem', fontWeight: 900, lineHeight: 1, color: '#10b981' }}>{productivityScore}</div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-secondary)', paddingBottom: '0.3rem' }}>/ 100</div>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', marginBottom: '1rem' }}>
            <div style={{ width: `${productivityScore}%`, height: '100%', background: 'linear-gradient(90deg, #10b981, #BBFF00)', borderRadius: '4px', transition: 'width 1s ease-in-out' }}></div>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, fontStyle: 'italic' }}>
            "{scoreMessage}"
          </p>
        </section>

        {/* 3. Routine Snapshot */}
        <section className="glass-card" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-main)' }}>Routine Snapshot</h2>
            <button onClick={() => navigate('/routine')} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>View Routine</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1rem 0.75rem', borderRadius: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>task_alt</span>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>{completedRoutinesToday} / {activeRoutinesTodayCount}</div>
                <div style={{ fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Today</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.02)', padding: '1rem 0.75rem', borderRadius: '1rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b', flexShrink: 0 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.25rem' }}>local_fire_department</span>
              </div>
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: 900, color: 'var(--text-main)' }}>{currentStreak} Days</div>
                <div style={{ fontSize: '0.55rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Streak</div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Goals Progress */}
        <section className="glass-card" style={{ padding: '1.5rem' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-main)' }}>Active Goals</h2>
            {activeGoals.length > 0 ? (
              <button onClick={() => navigate('/goals')} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>View Goals</button>
            ) : (
              <button onClick={() => navigate('/goals?action=new-goal')} style={{ background: 'none', border: 'none', color: '#10b981', fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', cursor: 'pointer' }}>Create Goal</button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {activeGoals.length > 0 ? activeGoals.map(goal => {
              // Calculate days left
              let daysLeftStr = 'No due date';
              let isOverdue = false;
              if (goal.targetDate) {
                const diffTime = new Date(goal.targetDate).getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays < 0) {
                  isOverdue = true;
                  daysLeftStr = `${Math.abs(diffDays)} Days Overdue`;
                } else {
                  daysLeftStr = `${diffDays} Days Left`;
                }
              }

              return (
                <div key={goal.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '1rem', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>{goal.name}</div>
                    <div style={{ fontSize: '0.7rem', fontWeight: 900, color: isOverdue ? '#ef4444' : '#10b981', background: isOverdue ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '0.5rem' }}>{daysLeftStr}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px' }}>
                      <div style={{ width: `${goal.progress || 0}%`, height: '100%', background: '#3b82f6', borderRadius: '3px', transition: 'width 1s ease-in-out' }}></div>
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, color: '#3b82f6' }}>{goal.progress || 0}%</span>
                  </div>
                </div>
              );
            }) : (
              <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No active goals. Time to set some!</div>
            )}
          </div>
        </section>

        {/* 5. Weekly Activity Chart */}
        <section className="glass-card" style={{ padding: '1.5rem' }}>
          <h2 style={{ margin: '0 0 1.5rem 0', fontSize: '1rem', fontWeight: 900, textTransform: 'uppercase', color: 'var(--text-main)' }}>Productivity Trend</h2>
          <div style={{ width: '100%', height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', fontSize: '0.75rem', fontWeight: 700, color: 'white' }} />
                <Area type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorCompleted)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 6. Motivation Card */}
        <section className="glass-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(6, 78, 59, 0.3))', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#10b981' }}>psychology</span>
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Daily Discipline</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, fontStyle: 'italic' }}>
                "Success isn't about greatness. It's about consistency. Consistent hard work leads to success. Greatness will come."
              </p>
            </div>
          </div>
        </section>



      </main>
      <BottomNav isHidden={isSidebarHidden} />
    </div>
  );
};

export default HomeDashboard;
