# Gold & Silver Accumulation Feature Guide

## Overview

The Gold and Silver accumulation pages allow you to track precious metal holdings, set goals, manage buy/sell transactions, and monitor profit/loss on sales. These features are optional modules that can be enabled/disabled in account settings.

## Features

### 1. **Enable/Disable Modules**
- Go to **Account** page
- Toggle "Gold" and/or "Silver" under "Wealth modules"
- Once enabled, navigation items appear in the header
- Disabled modules redirect to account settings

### 2. **Gold/Silver Page Overview**

The accumulation page displays four key metrics:

#### **Total Holding**
- Current accumulated grams of metal
- Average cost per gram (weighted by all purchases)

#### **Current Value**
- Real-time value based on current market rate
- Updated when you set the market rate

#### **Goal Progress**
- Visual progress bar toward your goal (if set)
- Percentage complete
- Target grams / Current grams

#### **Total Investment**
- Total amount spent on purchases
- Unrealized gain (current value - total investment)

### 3. **Managing Transactions**

#### **Buy Tab**
1. Enter the date of purchase
2. Specify grams purchased
3. Enter rate per gram
4. Add optional notes (e.g., "Purchased from jeweler")
5. Click "Add Purchase"

**Calculation**: Automatically updates average cost per gram using weighted average formula.

#### **Sell Tab**
1. Enter the date of sale
2. Specify grams sold
3. Enter selling rate per gram
4. Add optional notes (e.g., "Sold to jeweler")
5. Click "Sell"

**Validation**: Cannot sell more than current holding.

**Profit/Loss Calculation**:
- Uses weighted average cost of purchased metals
- Formula: `Realized P&L = (Grams × Selling Rate) - (Grams × Average Cost)`
- Displayed in transaction history:
  - Green ↑ for profit
  - Red ↓ for loss

### 4. **Set Market Rate**

- Go to "Set Rate" tab
- Enter current market rate per gram
- Updates current value of all holdings
- Used for buy/sell calculations

### 5. **Set Goals**

- Go to "Goal" tab
- Enter target grams to accumulate
- Optionally set target date
- Add notes about why you're accumulating
- Progress automatically updates as you make purchases/sales

### 6. **Transaction History**

Each transaction shows:
- **Type**: Buy (green) or Sell (red)
- **Amount**: Grams × Rate = Total
- **Date**: When transaction occurred
- **Notes**: Your custom notes
- **P&L** (for sells only): Realized profit or loss
- **Delete**: Remove transaction (appears on hover)

## Database Schema

### MetalHolding
Stores user's metal tracking preferences and goals:
```
- id: Unique identifier
- userId: User who owns this holding
- metalType: "gold" | "silver"
- goalGrams: Target accumulation amount
- goalDate: Target date (ISO string)
- currentRate: Current market rate per gram
- notes: Custom tracking notes
```

### MetalTransaction
Records individual buy/sell transactions:
```
- id: Unique identifier
- userId: User who made the transaction
- metalType: "gold" | "silver"
- type: "buy" | "sell"
- date: Transaction date (ISO string)
- grams: Amount of metal
- ratePerGram: Price per gram
- totalAmount: grams × ratePerGram
- note: Custom transaction notes
- realizedPL: Profit/Loss on sale (null for buys, calculated for sells)
```

## Server Actions

All metal operations are server actions for security:

### `getMetalHolding(metalType)`
Returns current holding with accumulated stats

### `getMetalTransactions(metalType)`
Returns all transactions in reverse chronological order

### `buyMetal(metalType, date, grams, ratePerGram, note)`
Add a purchase transaction

### `sellMetal(metalType, date, grams, ratePerGram, note)`
Add a sale transaction (calculates P&L)

### `setMetalGoal(metalType, goalGrams, goalDate, notes)`
Update accumulation goal

### `updateCurrentRate(metalType, rate)`
Update market rate

### `deleteMetalTransaction(id, metalType)`
Remove a transaction

## Navigation Integration

- **Desktop**: Gold/Silver links appear in header navigation (if enabled)
- **Mobile**: Links available in mobile menu
- Routes: `/gold` and `/silver`
- Automatic redirects if module is disabled

## Calculations

### Average Cost Per Gram
```
Weighted average of all purchases:
Average = Total Investment / Total Grams
```

For sells, the proportional cost is deducted from investment.

### Profit/Loss on Sale
```
P&L = (Sale Grams × Sale Rate) - (Sale Grams × Average Cost)
```

### Goal Progress
```
Progress % = (Current Grams / Goal Grams) × 100
Capped at 100% when exceeding goal
```

## Example Workflow

1. **Enable Gold Module** → Account page
2. **Set Goal** → /gold → Goal tab → 100g by Dec 2026
3. **Buy Gold** → Buy tab → 10g @ ₹5000/g on Jan 2026
4. **Buy More** → Buy tab → 15g @ ₹5100/g on Feb 2026
5. **Update Rate** → Set Rate tab → ₹5200/g
6. **Check Progress** → Overview shows 25g, 25% progress, ₹128,000 current value
7. **Sell Some** → Sell tab → 5g @ ₹5300/g
8. **View P&L** → Sell shows profit of ₹500 (5g × (₹5300 - ₹5033.33 avg))

## UI Components

### MetalPageClient
Main component with tabs:
- **Overview**: Stats and history
- **Buy**: Purchase form
- **Sell**: Sale form
- **Set Rate**: Market rate update
- **Goal**: Goal tracking

### AppShellWithModules
Extended navigation shell that includes enabled modules

## Routing & Redirects

- If module disabled: `/gold` → redirects to `/account`
- If module disabled: `/silver` → redirects to `/account`
- Navigation only shows enabled modules
- URL-based access is protected by redirect

## Notes

- All dates use ISO format (YYYY-MM-DD)
- Rates and amounts use INR currency
- Weights in grams (fractional grams supported)
- Market rates affect current value but not historical P&L
- Selling more than holding shows validation error
- All operations require authentication
- Changes revalidate relevant pages
