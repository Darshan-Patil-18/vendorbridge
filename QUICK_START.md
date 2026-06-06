# 🚀 VendorBridge - Quick Start Guide

## ✅ Prerequisites Complete

✅ Supabase project created
✅ Database tables created (all 9 tables)
✅ RLS policies enabled
✅ Supabase client configured
✅ All dependencies installed

---

## 🏃 Running the Application

### 1. Start Development Server

```bash
cd vendorbridge
npm run dev
```

The app will start at `http://localhost:5173`

---

## 👥 Creating Your First Users

### Step 1: Sign Up as Admin
1. Go to `http://localhost:5173`
2. Click "Get Started" or navigate to `/login`
3. Click "Sign Up"
4. Fill in the form:
   - **Full Name**: Your Name
   - **Email**: admin@yourcompany.com
   - **Organization**: Your Company
   - **Role**: Administrator
   - **Password**: (min 6 characters)
5. Click "Create Account"
6. You'll be logged in automatically!

### Step 2: Create More Users
You can create more users for testing different roles:

**Procurement Officer:**
- Email: officer@yourcompany.com
- Role: Procurement Officer

**Manager:**
- Email: manager@yourcompany.com
- Role: Manager/Approver

**Vendor:**
- Email: vendor@vendorcompany.com
- Role: Vendor
- Organization: Vendor Company Name

---

## 📝 Complete Workflow Example

### As Admin/Procurement Officer:

#### 1. **Add Vendors** (Vendor Management)
```
Navigate to: Vendor Management
Click: Add Vendor
Fill in:
- Name: Tech Supplies Inc
- Category: IT & Hardware
- Email: contact@techsupplies.com
- Phone: +1234567890
- GST Number: GST123456789
- Address: 123 Tech Street
- Status: Active
```

#### 2. **Create RFQ** (RFQ Creation)
```
Navigate to: Create RFQ
Fill in:
- Title: Q1 2026 Office Laptops
- Category: IT & Hardware
- Priority: High
- Deadline: (select future date)
- Description: Need 10 laptops for new hires

Add Items:
- Product: Dell XPS 15
- Quantity: 10
- Unit: Pieces
- Specifications: i7, 16GB RAM, 512GB SSD

Select Vendors: (check the vendors you want)
Click: Send RFQ to Vendors
```

### As Vendor:

#### 3. **Submit Quotation** (Quotation Submission)
```
Login as vendor user
Navigate to: Submit Quotation
Click on available RFQ
Fill in pricing:
- Unit Price: $1200 per laptop
- Delivery Timeline: 7-10 business days
- Validity Period: 30 days
- Notes: (optional)
Click: Submit Quotation
```

### As Procurement Officer:

#### 4. **Compare Quotations** (Quotation Comparison)
```
Navigate to: Compare Quotations
Select RFQ from dropdown
Review all vendor quotations
Compare prices and delivery times
Click: Select This Quote (on preferred vendor)
```

### As Manager:

#### 5. **Approve Request** (Approval Workflow)
```
Login as manager
Navigate to: Approval Workflow
Click: Review Details on pending approval
Read quotation details
Add Remarks: "Approved for budget"
Click: Approve Request
```

### As Admin/Procurement Officer:

#### 6. **View Purchase Order** (Purchase Orders)
```
Navigate to: Purchase Orders
See generated PO with 15% tax calculated
Click: Generate Invoice
Click: Download PDF / Print / Send Email
```

#### 7. **View Reports** (Reports & Analytics)
```
Navigate to: Reports
See monthly spending charts
View category distribution
Check vendor performance
Export reports if needed
```

#### 8. **Check Activity Logs** (Activity Logs)
```
Navigate to: Activity Logs
See all actions taken in the system
Filter by type or date
Track who did what and when
```

---

## 🎯 Testing Different Roles

### Admin Role
- ✅ Full access to everything
- ✅ Manage vendors
- ✅ Create RFQs
- ✅ Compare quotations
- ✅ View reports
- ✅ Access activity logs

### Procurement Officer Role
- ✅ Manage vendors
- ✅ Create RFQs
- ✅ Compare quotations
- ✅ View purchase orders
- ✅ View reports

### Manager Role
- ✅ Approve/reject quotations
- ✅ View purchase orders
- ✅ View reports
- ✅ Dashboard access

### Vendor Role
- ✅ View assigned RFQs
- ✅ Submit quotations
- ✅ View own quotation status
- ✅ Dashboard access

---

## 🔍 Checking Data in Supabase

1. Go to your Supabase project dashboard
2. Click on "Table Editor"
3. Browse each table to see the data:
   - **profiles**: All registered users
   - **vendors**: All vendors you created
   - **rfqs**: All RFQs with selected_vendors array
   - **rfq_items**: Line items for each RFQ
   - **quotations**: All vendor quotations
   - **quotation_items**: Quotation line items
   - **approvals**: Approval requests
   - **purchase_orders**: Generated POs
   - **activity_logs**: All system activities

---

## 🐛 Troubleshooting

### "Invalid email or password" on login
- Make sure the user is signed up first
- Check Supabase Auth dashboard for user list
- Verify email is correct (case-sensitive)

### "Error loading data"
- Check browser console for detailed error
- Verify Supabase URL and anon key in `src/lib/supabase.js`
- Check RLS policies are enabled
- Verify you're logged in (session exists)

### Data not showing
- Check if you're logged in
- Verify data exists in Supabase Table Editor
- Check browser console for errors
- Clear cache and refresh page

### Build errors
- Run `npm install` to ensure all dependencies
- Check that `@supabase/supabase-js` is installed
- Run `npm run build` to test production build

---

## 📦 Production Build

When ready to deploy:

```bash
npm run build
```

This creates a `dist` folder with optimized production files.

### Deploy to:
- **Vercel**: `vercel deploy`
- **Netlify**: Drag & drop `dist` folder
- **GitHub Pages**: Use GitHub Actions
- **Your own server**: Upload `dist` folder contents

---

## 🔐 Security Notes

- ✅ Never commit `.env` files with secrets
- ✅ Use Supabase environment variables for production
- ✅ Enable email confirmation in Supabase Auth settings
- ✅ Configure allowed domains in Supabase Auth
- ✅ Review and update RLS policies as needed
- ✅ Enable 2FA for Supabase dashboard access

---

## 🎉 You're All Set!

Your VendorBridge application is now fully functional with:

✅ Real authentication
✅ Persistent database
✅ Full CRUD operations
✅ Role-based access
✅ Activity logging
✅ Reports & analytics
✅ Beautiful UI maintained

Start by signing up users and creating vendors!

---

## 📚 Additional Resources

- **Supabase Docs**: https://supabase.com/docs
- **React Router**: https://reactrouter.com
- **Recharts**: https://recharts.org
- **Lucide Icons**: https://lucide.dev

Need help? Check the browser console for detailed error messages!
