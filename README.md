# 🎯 StayHardy - Premium Task Manager

StayHardy is a high-performance, glassmorphic task management application built for elite productivity. It uses a modern serverless stack with real-time capabilities.

## 🚀 Key Features

- **Premium Glassmorphism**: A sleek, dark-themed UI with Aurora gradients and smooth micro-animations.
- **Admin Hub**: Real-time platform oversight including:
  - User activity trends (Signups vs. Tickets).
  - Advanced user management report.
  - Remote PIN reset and account purging.
- **Responsive Dashboard**: Kanban-style priority columns with drag-and-drop functionality.
- **Support System**: Integrated user feedback and payment support (Razorpay).
- **Security**: PIN-based login persistence and permanent dark-mode protection.

## 🛠️ The Tech Stack

- **Frontend**: React 19, Vite, TypeScript.
- **Backend & DB**: Supabase (PostgreSQL, Realtime, Storage, Auth).
- **Charts**: Recharts for administrative analytics.
- **Styling**: Vanilla CSS with custom design tokens.

## 📦 Deployment Instructions

### 1. Supabase Setup
- Create a project on [Supabase](https://supabase.com/).
- Run the required migrations (create `users`, `tasks`, `feedback`, and `categories` tables).
- Enable **Storage** and create a public bucket named `avatars` and `task-images`.

### 2. Frontend (Vercel/Netlify)
- Connect this repository to your hosting provider.
- Set the **Root Directory** to `frontend`.
- Configure the following Environment Variables:
  - `VITE_SUPABASE_URL`: Your Supabase Project URL.
  - `VITE_SUPABASE_ANON_KEY`: Your Supabase Public Anon Key.
- Deploy! The `vercel.json` ensures smooth SPA routing.

## 👨‍💻 Local Development

```bash
cd frontend
npm install
npm run dev
```

## 📜 License
MIT
