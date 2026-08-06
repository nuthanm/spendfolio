# Quick Start: Gold & Silver Accumulation

## 🚀 Getting Started (5 minutes)

### Step 1: Regenerate Prisma Client
```bash
npm run db:generate
```

### Step 2: Restart Dev Server
```bash
npm run dev
```

### Step 3: Enable Modules
1. Log in to Spendfolio
2. Click **Account** in the header
3. Find "Wealth modules" section
4. Check ✓ **Gold** and ✓ **Silver**
5. See "Gold enabled." and "Silver enabled." messages

### Step 4: Verify Navigation
- Look at header navigation
- Should now show: Dashboard → Income → Expenses → **Gold** → **Silver** → Import → Account

## 📊 Using Gold Tracking

### Track Your First Purchase
1. Click **Gold** in header
2. Click **Buy** tab
3. Fill in:
   - Date: Today's date
   - Grams: `10` (or your amount)
   - Rate: `6000` (₹/gram)
   - Note: "Initial purchase"
4. Click **Add Purchase**
5. See overview update with totals

### Set Your Goal
1. Click **Goal** tab
2. Fill in:
   - Goal: `100` grams
   - Target Date: End of year
   - Notes: "My gold savings plan"
3. Click **Save Goal**
4. See progress bar on overview (10% complete)

### Update Market Rate
1. Click **Set Rate** tab
2. Enter current rate: `6100` (₹/gram)
3. Click **Update Rate**
4. See "Current Value" card update on overview

### Sell Some Gold
1. Click **Sell** tab
2. Fill in:
   - Date: Today
   - Grams: `3`
   - Rate: `6150` (₹/gram)
   - Note: "Sold to jeweler"
3. Click **Sell**
4. See transaction with P&L calculation

## 🔄 Repeat for Silver
Same process as Gold - enable, track, set goals, buy, sell

## 📈 Understanding the Overview

The Overview tab shows 4 key cards:

| Card | Shows | Formula |
|------|-------|---------|
| **Total** | Grams you hold | Sum of buys - sum of sells |
| **Current Value** | Worth at current rate | Total Grams × Current Rate |
| **Goal Progress** | % toward target | (Current / Goal) × 100 |
| **Investment** | Total spent + gain/loss | Sum of all purchase costs |

## 📝 Transaction History

Each transaction shows:
- **[BUY]** or **[SELL]** tag
- Grams × Rate = Total Amount
- Transaction date
- Your notes
- **P&L** (for sells only) - profit ↑ or loss ↓

## ⚙️ Common Actions

### Delete a Transaction
1. Go to **Overview** tab
2. Hover over transaction
3. Click **✕** button
4. Transaction removed

### Update Goal
1. Go to **Goal** tab
2. Change grams or date
3. Click **Save Goal**
4. Overview updates instantly

### See Current Value
- Visible on Overview cards
- Calculation: Grams × Current Rate
- Updates when you change the rate

## 🚫 Restrictions

- ❌ Can't sell more than you hold
- ❌ Grams and rates must be positive
- ❌ Both fields are required
- ❌ Module disabled? Gets redirected to Account

## 💡 Pro Tips

1. **Update rate regularly** → More accurate current value
2. **Add notes** → Remember where you bought/sold
3. **Set a goal** → Stay motivated and track progress
4. **Check transaction history** → See your P&L patterns
5. **Disable unused modules** → Cleaner interface

## 📱 Mobile

- Fully responsive design
- All features work on mobile
- Touch-friendly buttons
- Forms stack vertically

## 🔐 Security

- All data is your own
- Calculations happen server-side
- Session required
- 2FA supported

## ❓ FAQs

### Q: Can I have fractional grams?
**A:** Yes! Enter `0.5` for half a gram.

### Q: Does selling update average cost?
**A:** Yes, proportionally. Selling 5g from 10g costs average cost.

### Q: Can I have negative grams?
**A:** No, validation prevents it.

### Q: What if I disable and re-enable Gold?
**A:** All data persists. Everything is still there.

### Q: Does market rate affect past P&L?
**A:** No, P&L is calculated at sale time and locked in.

### Q: Can I export metals data?
**A:** Not yet - but you can see everything on the page.

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Gold link not showing | Check Account → enable Gold module |
| Can't buy | Check if grams/rate are positive |
| Can't sell more | Don't have enough grams (shows in Sell tab) |
| P&L wrong | Check average cost in overview |
| Page blank | Refresh or check if logged in |

## 📞 Support

Check these docs for more details:
- `METAL_ACCUMULATION_GUIDE.md` - Complete feature guide
- `UI_WALKTHROUGH.md` - Visual layout guide
- `IMPLEMENTATION_SUMMARY.md` - Technical details

---

**Ready to track gold?** Click on Gold in the header and start buying! 🏆
