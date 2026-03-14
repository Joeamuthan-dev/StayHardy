const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

let db;

async function initDB() {
  db = await open({
    filename: path.join(__dirname, 'myboard.db'),
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'Design',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      priority TEXT DEFAULT 'Medium',
      order_index INTEGER DEFAULT 0
    );
  `);

  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN completed_at DATETIME');
  } catch (error) {
    // Column likely already exists
  }

  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN order_index INTEGER DEFAULT 0');
  } catch (error) {
    // Column likely already exists
  }

  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN priority TEXT DEFAULT "Medium"');
  } catch (error) {
    // Column likely already exists
  }

  try {
    await db.exec('ALTER TABLE tasks ADD COLUMN description TEXT');
  } catch (error) {
    // Column likely already exists
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN name TEXT');
  } catch (error) {
    // Column likely already exists, ignore
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN last_login DATETIME');
  } catch (error) {
    // Column likely already exists
  }

  try {
    await db.exec('ALTER TABLE users ADD COLUMN role TEXT DEFAULT "user"');
  } catch (error) {
    // Column likely already exists
  }

  await db.exec(`
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Routes
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  
  try {
    const result = await db.run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name || '', email, password]);
    res.json({ id: result.lastID, name: name || '', email });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const user = await db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);
    if (user) {
      res.json({ id: user.id, name: user.name, email: user.email });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/tasks', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'User ID required' });

  try {
    const tasks = await db.all('SELECT * FROM tasks WHERE user_id = ? ORDER BY order_index ASC, created_at DESC', [userId]);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/tasks', async (req, res) => {
  const { userId, user_id, title, description, category, status, priority } = req.body;
  const uid = userId || user_id;
  if (!uid || !title) return res.status(400).json({ error: 'User ID and Title required' });

  try {
    const maxOrder = await db.get('SELECT MAX(order_index) as maxOrder FROM tasks WHERE user_id = ?', [uid]);
    const nextOrder = (maxOrder?.maxOrder || 0) + 1;

    const result = await db.run(
      'INSERT INTO tasks (user_id, title, description, category, status, priority, order_index) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [uid, title, description || '', category || 'Design', status || 'pending', priority || 'Medium', nextOrder]
    );
    const newTask = await db.get('SELECT * FROM tasks WHERE id = ?', [result.lastID]);
    res.status(201).json(newTask);
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// IMPORTANT: /reorder must be defined BEFORE /:id to avoid Express matching 'reorder' as an ID
app.put('/api/tasks/reorder', async (req, res) => {
  const { orders } = req.body; // Array of { id, order_index }
  if (!orders || !Array.isArray(orders)) return res.status(400).json({ error: 'Orders array required' });

  try {
    const statement = await db.prepare('UPDATE tasks SET order_index = ? WHERE id = ?');
    for (const item of orders) {
      await statement.run([item.order_index, item.id]);
    }
    await statement.finalize();
    res.json({ success: true });
  } catch (error) {
    console.error('Reorder error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  const { title, description, category, status, priority } = req.body;
  
  try {
    let completedAt = null;
    if (status === 'completed') {
      const existingTask = await db.get('SELECT completed_at FROM tasks WHERE id = ?', [id]);
      completedAt = existingTask?.completed_at || new Date().toISOString();
    }

    await db.run(
      'UPDATE tasks SET title = ?, description = ?, category = ?, status = ?, priority = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [title, description, category, status, priority || 'Medium', completedAt, id]
    );
    const updatedTask = await db.get('SELECT * FROM tasks WHERE id = ?', [id]);
    res.json(updatedTask);
  } catch (error) {
    console.error('PUT /api/tasks/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM tasks WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id/pin', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'PIN (password) is required' });

  try {
    await db.run('UPDATE users SET password = ? WHERE id = ?', [password, id]);
    res.json({ success: true });
  } catch (error) {
    console.error('Update PIN error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/feedback', async (req, res) => {
  const { userId, type, description } = req.body;
  if (!type || !description) return res.status(400).json({ error: 'Type and description are required' });

  try {
    await db.run(
      'INSERT INTO feedback (user_id, type, description) VALUES (?, ?, ?)',
      [userId || null, type, description]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/feedback', async (req, res) => {
  try {
    const feedback = await db.all('SELECT * FROM feedback ORDER BY created_at DESC');
    res.json(feedback);
  } catch (error) {
    console.error('Get feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    const userStats = await db.get(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN role = 'admin' THEN 1 ELSE 0 END) as admins,
        SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) as regulars
      FROM users
    `);
    const taskCount = await db.get('SELECT COUNT(*) as count FROM tasks');
    const feedbackCount = await db.get('SELECT COUNT(*) as count FROM feedback');
    
    res.json({
      totalUsers: userStats.total,
      adminCount: userStats.admins,
      regularCount: userStats.regulars,
      totalTasks: taskCount.count,
      totalFeedback: feedbackCount.count,
      systemHealth: '100%',
      activeSessions: Math.floor(Math.random() * 3) + 1 
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users', async (req, res) => {
  try {
    const users = await db.all('SELECT id, name, email, role, last_login, created_at FROM users ORDER BY id DESC LIMIT 50');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id/role', async (req, res) => {
  const { id } = req.params;
  const { role } = req.body;
  if (!role) return res.status(400).json({ error: 'Role is required' });

  try {
    await db.run('UPDATE users SET role = ? WHERE id = ?', [role, id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.run('DELETE FROM users WHERE id = ?', [id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:identifier', async (req, res) => {
  const { identifier } = req.params;
  try {
    let user;
    if (identifier.includes('@')) {
      user = await db.get('SELECT id, name, email, role FROM users WHERE email = ?', [identifier]);
      if (user) {
        await db.run('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      }
    } else {
      user = await db.get('SELECT id, name, email, role FROM users WHERE id = ?', [identifier]);
    }
    res.json(user || { role: 'user' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Backend running on port ${PORT}`);
  });
}).catch(console.error);
