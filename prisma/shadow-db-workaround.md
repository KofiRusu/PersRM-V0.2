# Prisma Shadow Database Permission Issues

When running `prisma migrate dev`, you may encounter the following error:

```
Error: P3014

Prisma Migrate could not create the shadow database. Please make sure the database user has permission to create databases.

Original error: 
ERROR: permission denied to create database
```

## Why This Happens

Prisma Migrate requires a "shadow database" when performing migrations. This is a temporary database that Prisma creates to:
1. Apply your migrations to verify they work correctly
2. Generate SQL statements for the actual migration
3. Drop the shadow database once the migration is complete

The error occurs when your database user doesn't have `CREATE DATABASE` permission, which is often the case with shared hosting or when using non-admin database users.

## Solutions

### Option 1: Use the `--create-only` flag with `db push` (Recommended)

This approach avoids the need for a shadow database by:
1. Creating migration files without trying to verify them
2. Directly pushing schema changes to your database

```bash
# Step 1: Generate migration files only
npx prisma migrate dev --create-only --name add_comment_permissions

# Step 2: Apply the changes directly
npx prisma db push
```

**Pros:** Simple, works with limited permissions
**Cons:** Less verification of migration integrity

### Option 2: Provide a Separate Shadow Database URL

If you can create a shadow database manually:

1. Create a second database (e.g., `perslm_data_shadow`)
2. Update your `schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  shadowDatabaseUrl = env("SHADOW_DATABASE_URL")
}
```

3. Add to your `.env` file:

```
DATABASE_URL="postgresql://user:password@localhost:5432/perslm_data"
SHADOW_DATABASE_URL="postgresql://user:password@localhost:5432/perslm_data_shadow"
```

**Pros:** Preserves full migration verification
**Cons:** Requires manual setup of a second database

### Option 3: Use Admin Credentials Temporarily

For migration operations only, you can temporarily update your `.env` file to use a database user with higher privileges.

1. Update `.env` temporarily (DO NOT COMMIT):
```
DATABASE_URL="postgresql://postgres:adminpassword@localhost:5432/perslm_data"
```

2. Run the migration:
```bash
npx prisma migrate dev
```

3. Revert `.env` to original user after migration

**Pros:** Uses standard migration process
**Cons:** Requires admin credentials, potential security risk

## Database-Specific Instructions

### PostgreSQL

To give a user `CREATE DATABASE` permission:
```sql
-- Connect as postgres admin
ALTER USER youruser WITH CREATEDB;
```

### MySQL

To give a user database creation rights:
```sql
GRANT CREATE ON *.* TO 'youruser'@'localhost';
```

## Additional Resources

- [Prisma Documentation on Shadow Databases](https://www.prisma.io/docs/concepts/components/prisma-migrate/shadow-database)
- [Troubleshooting Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate/troubleshooting) 