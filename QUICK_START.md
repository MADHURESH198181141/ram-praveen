# Quick Start Guide - Retail Billing Buddy

Get the cloud-based retail billing system up and running in minutes.

## 5-Minute Quick Start

### Prerequisites
- Node.js 18+ / Bun
- Python 3.10+
- Supabase account (free tier available)
- Git

### Step 1: Supabase Setup (2 min)

1. Go to https://supabase.com and create a new project
2. Wait for project initialization
3. Go to **Project Settings** → **Database**
4. Copy the **Connection String (psycopg2)**
5. Keep it safe - you'll need it next

### Step 2: Backend Setup (2 min)

```bash
# Navigate to project root
cd retail-billing-buddy

# Create backend environment file
cat > backend/.env.local << EOF
DATABASE_URL=YOUR_SUPABASE_CONNECTION_STRING_HERE
SECRET_KEY=change-me-to-a-random-string-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ENVIRONMENT=development
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:5173
EOF

# Install Python dependencies
pip install -r requirements.txt

# Initialize database (creates tables and seeds default data)
python -m backend.database.init_db

# Start backend server
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

**Backend running at:** http://localhost:8000
**API Docs:** http://localhost:8000/docs

### Step 3: Frontend Setup (1 min)

```bash
# In a new terminal, navigate to project root
cd retail-billing-buddy

# Install dependencies
npm install
# or if using Bun:
bun install

# Start development server
npm run dev
# or with Bun:
bun run dev
```

**Frontend running at:** http://localhost:5173

### Step 4: First Login (Done!)

1. Open http://localhost:5173
2. Login with default credentials:
   - **Admin:** username: `admin`, password: `admin123`
   - **Employee:** username: `employee`, password: `employee123`

3. Start creating bills!

## Default Test Data

After initialization, the system includes:

### Admin User
- Username: `admin`
- Password: `admin123`
- Permissions: Full access

### Employee User
- Username: `employee`
- Password: `employee123`
- Permissions: Bill creation and product search

### Default Categories
- Groceries
- Beverages
- Dairy
- Bakery
- Snacks

## Common Tasks

### Add a New Product (Admin only)

1. Login as admin
2. Go to **Products** section
3. Click **Add Product**
4. Fill in details:
   - Product Name
   - Category
   - Price
   - HSN Code (optional)
   - GST Rate (default 5%)
5. Click Save

### Create a Bill (Employee)

1. Login as employee
2. Go to **Billing** section
3. Click **Create Bill**
4. Search and add products
5. Select payment method
6. Submit bill

### View Reports (Admin)

1. Login as admin
2. Go to **Reports**
3. View daily sales, employee activity, and analytics

## Backend API Examples

### Login
```bash
curl -X POST http://localhost:8000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "store_id": 1
  }'
```

### Get Products
```bash
curl -X GET "http://localhost:8000/api/products?store_id=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Create Bill
```bash
curl -X POST http://localhost:8000/api/billing/create?store_id=1 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_name": "John Doe",
    "mobile_number": "9876543210",
    "items": [
      {
        "product_id": 1,
        "quantity": 2,
        "unit_price": 100,
        "tax_percent": 5
      }
    ],
    "payment_method": "cash"
  }'
```

## Troubleshooting

### "Cannot connect to database"
- Check DATABASE_URL is correct
- Verify Supabase project is running
- Check network connectivity

### "Authentication failed"
- Clear browser localStorage: DevTools → Application → Clear All
- Re-login with correct credentials
- Check JWT_SECRET_KEY is set

### "Port 8000 already in use"
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
# or
fuser -k 8000/tcp
```

### "CORS errors in browser"
- Ensure backend is running on http://localhost:8000
- Check CORS_ORIGINS in .env.local includes http://localhost:5173
- Clear browser cache

## Next Steps

1. ✅ **Test Billing**
   - Create a few test bills
   - Test offline mode (disable internet)
   - Test sync when back online

2. ✅ **Explore Reports**
   - View daily sales reports
   - Check employee activity

3. ✅ **Production Deployment**
   - See [ARCHITECTURE.md](ARCHITECTURE.md) for deployment guide
   - Set up production database
   - Configure environment variables

## Documentation

- **Full Architecture:** See [ARCHITECTURE.md](ARCHITECTURE.md)
- **API Endpoints:** Visit http://localhost:8000/docs (Swagger UI)
- **Database Schema:** See `backend/database/models.py`

## Support

For issues:
1. Check troubleshooting section above
2. Review logs in terminal
3. Check browser console (F12)
4. See ARCHITECTURE.md for detailed setup

## What's Included

✅ Multi-user system with role-based access
✅ PostgreSQL cloud database (Supabase)
✅ FastAPI backend with JWT authentication
✅ React frontend with Vite
✅ Offline-online synchronization
✅ Billing system with inventory tracking
✅ Customer management
✅ Reports and analytics
✅ Electron desktop wrapper

## Key Features Highlighted

| Feature | Status |
|---------|--------|
| User Authentication | ✅ JWT + bcrypt |
| Multi-user Support | ✅ Admin/Employee roles |
| Cloud Database | ✅ PostgreSQL via Supabase |
| Offline Mode | ✅ IndexedDB sync |
| Billing System | ✅ Full featured |
| Inventory Tracking | ✅ Real-time |
| Reports | ✅ Daily/Analytics |
| Desktop App | ✅ Electron |

---

**You're all set!** Happy billing! 🎉
