# Database Setup for Metal Accumulation

## Status

✅ **MetalHolding** and **MetalTransaction** models are already in `prisma/schema.prisma`

No new migrations needed - the tables should already exist in your PostgreSQL database.

## Verification Steps

### Option 1: Check Schema (Quick)
```bash
# The models are in prisma/schema.prisma:
grep -A 10 "model MetalHolding" prisma/schema.prisma
grep -A 10 "model MetalTransaction" prisma/schema.prisma
```

Both models are present with all required fields.

### Option 2: Verify Tables Exist (Safe)
```bash
# Generate Prisma Client to validate schema
npm run db:generate

# If this succeeds, your schema is valid
# Tables should already exist since models were in schema.prisma
```

### Option 3: Check Database Directly (Advanced)
```sql
-- Connect to your PostgreSQL database
-- Run these queries to verify tables:

-- Check MetalHolding table
SELECT * FROM "MetalHolding" LIMIT 1;

-- Check MetalTransaction table
SELECT * FROM "MetalTransaction" LIMIT 1;

-- Both should return 0 rows initially (no error = table exists)
```

## If Tables Don't Exist

If for some reason the tables weren't created, use one of these methods:

### Method 1: Push Schema (Recommended)
```bash
# This pushes the schema to database
# It won't recreate existing tables, only new ones
npx prisma db push
```

### Method 2: Create Migration
```bash
# Create a new migration file
npm run db:migrate

# This will:
# 1. Show what changes are needed
# 2. Create migration files
# 3. Apply to database
# 4. Regenerate Prisma Client
```

### Method 3: Deploy Migration (Production)
```bash
# For production databases
npx prisma migrate deploy
```

## Troubleshooting

### Issue: "table does not exist"
**Solution**: Run `npm run db:generate` then `npx prisma db push`

### Issue: "Prisma Client out of sync"
**Solution**: Run `npm run db:generate` to regenerate

### Issue: "permission denied" error
**Solution**: 
- Check DATABASE_URL in .env
- Verify credentials have table creation rights
- PostgreSQL user needs CREATE TABLE permission

### Issue: "column does not exist"
**Solution**: Run `npm run db:generate` to sync Prisma Client

## Schema Reference

The models should look like this:

### MetalHolding
```prisma
model MetalHolding {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  metalType   String   // gold | silver
  goalGrams   Float?
  goalDate    String?
  currentRate Float?
  notes       String   @default("")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@unique([userId, metalType])
  @@index([userId])
}
```

### MetalTransaction
```prisma
model MetalTransaction {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  metalType   String   // gold | silver
  type        String   // buy | sell
  date        String
  grams       Float
  ratePerGram Float
  totalAmount Float
  note        String   @default("")
  realizedPL  Float?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  @@index([userId, metalType])
  @@index([userId, date])
}
```

## Environment Setup

Make sure your .env has:
```bash
DATABASE_URL="postgresql://user:password@host:port/database?sslmode=require"
AUTH_SECRET="your_secret_here"
```

## Verification Checklist

- [ ] Models exist in prisma/schema.prisma
- [ ] npm run db:generate succeeds
- [ ] dev server starts without "table" errors
- [ ] Can access /account page
- [ ] Can toggle Gold/Silver modules
- [ ] Can access /gold page
- [ ] Can submit buy form without database errors
- [ ] Transaction appears in history

## After Setup

Once verified:
1. Run `npm run dev`
2. Log in
3. Go to Account
4. Enable Gold module
5. Click Gold in header
6. Try buying 10g @ 5000
7. Check overview updates

## Production Deployment

Before deploying to production:

```bash
# 1. Ensure migrations are up to date
npm run db:deploy

# 2. Verify Prisma Client is generated
npm run db:generate

# 3. Test the feature locally
npm run dev

# 4. Build
npm run build

# 5. Deploy
npm start
```

## Need Help?

If you encounter issues:

1. Check if Prisma Client is generated:
   ```bash
   ls src/generated/prisma/
   ```

2. Regenerate if missing:
   ```bash
   npm run db:generate
   ```

3. Check database connection:
   ```bash
   npx prisma studio
   ```
   This opens an admin panel to verify tables exist.

4. Review Prisma docs:
   - https://www.prisma.io/docs/
   - Specifically: Reference → Client → Querying

---

**Expected Outcome**: After setup, you should be able to:
- Enable Gold/Silver modules from Account
- Access /gold and /silver routes
- Buy/sell metals
- See transactions with P&L calculations

All without any database errors! 🎉
