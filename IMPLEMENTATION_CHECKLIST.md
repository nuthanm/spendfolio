# Metal Accumulation Implementation Checklist

## Database Setup
- [x] MetalHolding model exists in schema.prisma
- [x] MetalTransaction model exists in schema.prisma
- [ ] Run `npm run db:generate` to regenerate Prisma client
- [ ] Run `npm run db:migrate dev` if tables don't exist (optional - they should already be in schema)

## Server Actions
- [x] src/lib/actions/metal.ts created
  - [x] getMetalHolding - fetches current stats
  - [x] getMetalTransactions - fetches transaction history
  - [x] buyMetal - add purchase
  - [x] sellMetal - add sale with P&L calculation
  - [x] setMetalGoal - update goal
  - [x] updateCurrentRate - set market rate
  - [x] deleteMetalTransaction - remove transaction
  - [x] Helper: calculateAccumulation - weighted average & totals
  - [x] Helper: getOrCreateHolding - ensure user has metal holding entry

## UI Components
- [x] MetalPageClient.tsx - Main component with:
  - [x] Overview tab - stats & transaction history
  - [x] Buy tab - purchase form
  - [x] Sell tab - sale form with validation
  - [x] Set Rate tab - market rate form
  - [x] Goal tab - goal tracking form
  - [x] Responsive grid layout for cards
  - [x] Animated numbers for current value
  - [x] P&L display (green/red with icons)
  - [x] Transaction deletion

## Page Routes
- [x] /gold page (src/app/gold/page.tsx)
  - [x] Requires "gold" module enabled
  - [x] Redirects to /account if disabled
- [x] /silver page (src/app/silver/page.tsx)
  - [x] Requires "silver" module enabled
  - [x] Redirects to /account if disabled

## Navigation
- [x] AppShellWithModules.tsx - navigation shell with dynamic module links
- [x] Account page updated with module toggles
  - [x] Checkboxes for gold/silver/house
  - [x] Description text for each module
  - [x] Toggle functionality with success message

## Type Safety
- [x] MetalType type defined ("gold" | "silver")
- [x] MetalHoldingData interface for return types
- [x] MetalTransactionData interface for return types
- [x] WealthModule import for modules
- [x] MODULE_ROUTES import for navigation

## Error Handling
- [x] Validation for positive amounts
- [x] Validation for sell quantity <= available
- [x] Error messages returned from server actions
- [x] Error display in UI
- [x] User permission checks (requireUser)

## Calculations
- [x] Weighted average cost per gram
- [x] Accumulated grams tracking
- [x] Profit/loss calculation on sales
- [x] Goal progress percentage
- [x] Current value calculation

## Testing Steps

1. **Setup**
   - [ ] Run `npm run db:generate` in terminal
   - [ ] Restart dev server

2. **Enable Modules**
   - [ ] Go to Account page
   - [ ] Check Gold and Silver boxes
   - [ ] See "Gold" and "Silver" appear in header navigation

3. **Gold Page - Buy**
   - [ ] Click Gold in header
   - [ ] Click "Buy" tab
   - [ ] Fill: Date, 10 grams, ₹5000/gram
   - [ ] Click "Add Purchase"
   - [ ] Verify totals update

4. **Gold Page - Set Rate**
   - [ ] Click "Set Rate" tab
   - [ ] Enter ₹5200/gram
   - [ ] Click "Update Rate"
   - [ ] Verify current value updates on overview

5. **Gold Page - Set Goal**
   - [ ] Click "Goal" tab
   - [ ] Enter 100 grams
   - [ ] Set target date (Dec 2026)
   - [ ] Add note
   - [ ] Click "Save Goal"
   - [ ] Verify progress bar shows on overview

6. **Gold Page - Buy More**
   - [ ] Click "Buy" tab
   - [ ] Fill: Date, 15 grams, ₹5100/gram
   - [ ] Click "Add Purchase"
   - [ ] Verify average cost updates
   - [ ] Verify progress bar shows 25%

7. **Gold Page - Sell**
   - [ ] Click "Sell" tab
   - [ ] Fill: Date, 5 grams, ₹5300/gram
   - [ ] Click "Sell"
   - [ ] Verify transaction shows P&L (should be ~₹500 profit)
   - [ ] Verify available grams reduced to 20

8. **Transaction History**
   - [ ] On overview, verify all 3 transactions listed
   - [ ] Verify sell shows P&L amount
   - [ ] Hover and delete a transaction
   - [ ] Verify it's removed

9. **Silver Page**
   - [ ] Repeat same steps
   - [ ] Verify Silver is independent from Gold

10. **Disable Module**
    - [ ] Go to Account page
    - [ ] Uncheck Gold
    - [ ] Try to access /gold
    - [ ] Verify redirects to /account

## Files Modified/Created
- [x] src/lib/actions/metal.ts (NEW)
- [x] src/components/MetalPageClient.tsx (NEW)
- [x] src/app/gold/page.tsx (NEW)
- [x] src/app/silver/page.tsx (NEW)
- [x] src/components/AppShellWithModules.tsx (NEW)
- [x] src/app/account/page.tsx (MODIFIED - added modules)
- [ ] test-imports.ts (can delete after testing)
- [ ] run-migration.bat (can delete after testing)

## Known Limitations
- Market rate changes don't affect historical P&L calculations (by design)
- Deleting a purchase updates average cost automatically
- Deleting a sell doesn't restore P&L reference (P&L is one-time calculation)
- No bulk import/export for metals (future enhancement)
- No metal purity tracking (assumes pure metal)
