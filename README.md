# LifeTrak

> "This app is inspired by our pregnancy journey — Tara & Rahul"

A mobile-first personal expense tracker for life events. Built with PHP + MySQL on Hostinger.

## Stack
- **Frontend**: Vanilla JS, mobile-first CSS, PWA (installable, offline)
- **Backend**: PHP 8+ REST API
- **Database**: MySQL (Hostinger)
- **Auth**: PHP sessions + httpOnly cookies
- **Hosting**: Hostinger shared hosting with Git deployment

## Releases
| Tag | Description |
|-----|-------------|
| `v1.0.0` | Login, signup, welcome screen, full expense tracker |

## Local setup (dev)

```bash
# 1. Clone
git clone https://github.com/tronologic/lifetrak.git
cd lifetrak

# 2. Set up local PHP + MySQL (XAMPP / Laragon / Herd)
# Create a database called 'lifetrak'
# Import db/schema.sql

# 3. Set credentials
cp api/config/db.php api/config/db.local.php
# Edit db.local.php with your local DB creds

# 4. Serve from project root
php -S localhost:8080
# Open http://localhost:8080
```

## Hostinger deployment

### One-time setup
1. Create MySQL DB in Hostinger hPanel → Databases
2. Import `db/schema.sql` via phpMyAdmin
3. In hPanel → Git → connect your GitHub repo (`main` branch)
4. Set environment vars in hPanel → PHP Config or create a `.env` file:
   ```
   DB_HOST=localhost
   DB_NAME=your_db_name
   DB_USER=your_db_user
   DB_PASS=your_db_password
   APP_SECRET=your-random-64-char-secret
   APP_ENV=production
   ```
5. Point your domain to the project root (not `/public`)

### Deploy a new version
```bash
git add .
git commit -m "feat: your change"
git tag v1.0.1
git push origin main --tags
# Hostinger pulls automatically
```

## Project structure
```
lifetrak/
├── api/
│   ├── auth/          register.php, login.php, logout.php, me.php
│   ├── events/        index.php (list/create), item.php (get/update/delete)
│   ├── expenses/      index.php (list/create), item.php (update/delete)
│   └── config/        db.php, auth.php, default_events.php
├── public/            Frontend SPA
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js
│   ├── icons/
│   └── src/           api.js, store.js, render.js, app.js, style.css, data.js
├── db/
│   └── schema.sql
├── .htaccess          URL rewriting + security headers
├── .gitignore
└── README.md
```

## API reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Create account |
| POST | `/api/auth/login` | — | Sign in |
| POST | `/api/auth/logout` | ✓ | Sign out |
| GET  | `/api/auth/me` | ✓ | Current user |
| GET  | `/api/events` | ✓ | List events |
| POST | `/api/events` | ✓ | Create event |
| PUT  | `/api/events/:id` | ✓ | Update event |
| DELETE | `/api/events/:id` | ✓ | Delete event |
| GET  | `/api/expenses?event_id=N` | ✓ | List expenses |
| POST | `/api/expenses` | ✓ | Create expense |
| PUT  | `/api/expenses/:id` | ✓ | Update expense |
| DELETE | `/api/expenses/:id` | ✓ | Delete expense |
