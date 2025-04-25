# ⚙️ PersLM – Prisma Database Configuration Guide

This guide helps you configure Prisma for either:
- 🧪 SQLite (quick setup for local development)
- 🏢 PostgreSQL (recommended for production + JSON support)

---

## 🔍 Summary of Schema Issues

Your Prisma schema originally used:
- `Json` fields (e.g. metadata, input)
- Native type annotations like `@db.Text`

🚫 These are not supported by SQLite, leading to validation errors:
- SQLite doesn't support `Json` fields
- SQLite doesn't support native types like `@db.Text`

---

## 🅰️ Option A – SQLite (Local Dev Mode)

### ✅ Schema Changes (Safe Downgrade)

Change all unsupported types in `schema.prisma`:

```prisma
// Original:
metadata    Json?
template     String @db.Text
input        Json
output       String @db.Text

// SQLite-Compatible:
metadata    String?        // Store JSON as string
template     String         // Remove native type
input        String         // Serialize JSON manually
output       String         // Remove native type
```

Use JSON.stringify() and JSON.parse() in your code:

```javascript
const json = JSON.stringify(metadataObject);
const parsed = JSON.parse(metadataString);
```

### 🌱 Migration for SQLite

```bash
npx prisma format
npx prisma migrate dev --name sqlite-fix
```

Use this if you're using the default SQLite setup (e.g., file:./dev.db in .env)

---

## 🅱️ Option B – PostgreSQL (Production-Ready)

### ✅ Schema Support

PostgreSQL supports:
- ✅ Json and JsonB types
- ✅ Native types like @db.Text

You can keep the original schema as-is:

```prisma
metadata    Json?
template     String @db.Text
input        Json
output       String @db.Text
```

### 🌐 Update .env

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/yourdb"
```

Replace with your actual PostgreSQL credentials

### 🐘 Local PostgreSQL Setup (macOS)

```bash
brew install postgresql
brew services start postgresql
createdb perslm
```

Then test connection:

```bash
psql -d perslm
```

### 🌱 Migration for PostgreSQL

```bash
npx prisma format
npx prisma migrate dev --name init-pg
```

---

## 🧠 Best Practice
- Use SQLite for lightweight dev and prototyping
- Use PostgreSQL for JSON fields, larger teams, and analytics integrations

---

## 🔄 Switching Between Modes

To switch back and forth:
- Change the DATABASE_URL in .env
- Update your schema if needed
- Run:

```bash
npx prisma db push   # For dev  
npx prisma migrate dev  # For prod with migrations
```

---

## ✅ Final Tip

Always run:

```bash
npx prisma generate
```

after switching databases or schema changes. 