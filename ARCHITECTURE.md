# Retail Billing Buddy - Cloud Architecture Upgrade

Professional retail billing system with PostgreSQL cloud database, FastAPI backend, and multi-user support.

## Architecture

```
Electron Desktop App
        ↓
React Frontend (Vite)
        ↓
FastAPI Backend
        ↓
Supabase PostgreSQL Database
        ↓
IndexedDB Offline Storage
        ↓
Sync Engine
```

## Key Features

### ✅ Multi-User Management
- Centralized PostgreSQL database
- Role-based access control (Admin/Employee)
- User authentication with JWT tokens
- Secure password hashing with bcrypt

### ✅ Billing System
- Create and manage bills
- Automatic inventory tracking
- Support for multiple payment methods
- Bill history and search functionality
- Pending amount tracking

### ✅ Product Management
- Add/edit/delete products
- Category management
- HSN code support
- GST rate configuration
- Real-time inventory updates

### ✅ Customer Management
- Customer database
- Mobile number tracking
- Payment history
- Pending amount tracking
- Customer classification (new/regular)

### ✅ Reports & Analytics
- Daily sales reports
- Employee billing activity tracking
- Sales analytics
- Customer analytics

### ✅ Offline Support
- IndexedDB local storage
- Automatic sync when online
- Prevents duplicate uploads
- Maintains billing continuity

## Technology Stack

### Backend
- **Framework**: FastAPI
- **Database**: PostgreSQL (Supabase)
- **Authentication**: JWT + bcrypt
- **ORM**: SQLAlchemy
- **Server**: Uvicorn

### Frontend
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **HTTP Client**: Axios
- **UI**: Shadcn/ui + Tailwind CSS
- **Storage**: IndexedDB for offline sync

### Desktop
- **Wrapper**: Electron
- **Build**: electron-builder

## Installation & Setup

### 1. Backend Setup

#### Install Python Dependencies
```bash
cd backend
pip install -r requirements.txt
```

#### Configure Environment
Edit `backend/.env.local`:
```env
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
SECRET_KEY=your-super-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=480
ENVIRONMENT=development
```

#### Initialize Database
```bash
python -m backend.database.init_db
```

#### Run Backend
```bash
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000
```

Backend will be available at: `http://localhost:8000`

### 2. Frontend Setup

#### Install Dependencies
```bash
npm install
# or
bun install
```

#### Configure API URL
Create `.env.local` in root:
```env
VITE_API_URL=http://localhost:8000
```

#### Run Development Server
```bash
npm run dev
```

Frontend will be available at: `http://localhost:5173`

### 3. Database Setup (Supabase)

1. Create a Supabase project at https://supabase.com
2. Get PostgreSQL connection string from project settings
3. Update `DATABASE_URL` in `backend/.env.local`
4. Run database initialization

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user

### Products
- `GET /api/products` - List products
- `GET /api/products/{id}` - Get product
- `POST /api/products` - Create product (Admin only)
- `PUT /api/products/{id}` - Update product (Admin only)
- `DELETE /api/products/{id}` - Delete product (Admin only)
- `GET /api/products/categories` - List categories

### Billing
- `POST /api/billing/create` - Create bill
- `GET /api/billing/bills` - List bills
- `GET /api/billing/{id}` - Get bill
- `GET /api/billing/search/by-number` - Search bill by number

### Customers
- `POST /api/customers` - Create customer
- `GET /api/customers` - List customers
- `GET /api/customers/{id}` - Get customer
- `PUT /api/customers/{id}` - Update customer
- `GET /api/customers/search/by-mobile` - Search by mobile

### Reports
- `GET /api/reports/daily-sales` - Daily sales report
- `GET /api/reports/employee-activity` - Employee activity
- `GET /api/reports/analytics` - Analytics summary

## Database Schema

### Core Tables
- **users** - User accounts with roles
- **stores** - Store information
- **products** - Product catalog
- **categories** - Product categories
- **inventory** - Stock management
- **customers** - Customer data
- **bills** - Bill records
- **bill_items** - Individual bill items
- **payments** - Payment records

### Analytics Tables
- **daily_sales_reports** - Daily sales summary
- **employee_billing_activity** - Employee activity log
- **sync_logs** - Sync status tracking

## Role-Based Access Control

### Admin Permissions
- ✅ Add products
- ✅ Edit products
- ✅ Delete products
- ✅ Manage inventory
- ✅ View all bills
- ✅ View all reports
- ✅ Manage employees
- ✅ Configure settings

### Employee Permissions
- ✅ Create bills
- ✅ Search products
- ✅ View customers
- ✅ Print bills
- ✗ Cannot edit/delete products
- ✗ Cannot modify thresholds
- ✗ Cannot view admin reports

## Development Guide

### Adding New API Endpoints

1. Create route file in `backend/{module}/`
```python
from fastapi import APIRouter, Depends
from ..database.db import get_db
from ..utils.auth import get_current_user

router = APIRouter(prefix="/api/endpoint", tags=["module"])

@router.get("")
async def get_data(db: Session = Depends(get_db), 
                   current_user: User = Depends(get_current_user)):
    # Your logic here
    pass
```

2. Include in `backend/main.py`
```python
from backend.{module}.routes import router
app.include_router(router)
```

### Adding New Frontend Services

1. Create service in `src/services/{service}.ts`
```typescript
import { apiRequest } from './api';

class MyService {
  async getData(): Promise<any> {
    return apiRequest('GET', '/api/endpoint');
  }
}

export default new MyService();
```

2. Use in components
```typescript
import myService from '@/services/{service}';

const data = await myService.getData();
```

## Deployment

### Backend Deployment (Production)

1. Use production database URL
2. Set strong SECRET_KEY
3. Set ENVIRONMENT=production
4. Configure CORS_ORIGINS
5. Deploy using:
   - Docker
   - Railway.app
   - Render.com
   - AWS EC2

### Frontend Deployment

```bash
npm run build
# Upload dist/ folder to hosting
```

## Offline-Online Sync

### How It Works

1. **Online**: Bill saved directly to PostgreSQL
2. **Offline**: Bill saved to IndexedDB locally
3. **Auto-Sync**: When connection returns, syncs to PostgreSQL
4. **No Duplicates**: Unique bill IDs prevent duplicate uploads

### Sync Service Usage

```typescript
import syncService from '@/services/syncService';

// Check connection
if (syncService.isOnline()) {
  // Save directly to cloud
} else {
  // Save locally and queue for sync
  await syncService.addToQueue({
    entity_type: 'bill',
    entity_id: bill.bill_id,
    data: bill
  });
}

// Sync when back online
syncService.setupListeners(() => {
  syncService.syncQueue(storeId);
});
```

## Troubleshooting

### Database Connection Issues
```bash
# Test connection
python -c "from backend.database.db import check_db_connection; check_db_connection()"
```

### Frontend API Errors
- Check `VITE_API_URL` in `.env.local`
- Verify backend is running on correct port
- Check browser console for CORS errors

### Authentication Failed
- Verify JWT_SECRET_KEY is set
- Check token expiration
- Clear localStorage and re-login

## Production Checklist

- [ ] Set strong SECRET_KEY
- [ ] Update CORS_ORIGINS for production domain
- [ ] Set DATABASE_URL to production database
- [ ] Enable HTTPS
- [ ] Set up database backups
- [ ] Configure error logging (Sentry/DataDog)
- [ ] Set up monitoring
- [ ] Test offline sync thoroughly
- [ ] Create admin user account
- [ ] Test all role permissions

## Project Structure

```
retail-billing-buddy/
├── backend/
│   ├── auth/
│   │   ├── routes.py
│   │   └── security.py
│   ├── billing/
│   │   └── __init__.py
│   ├── customers/
│   │   └── __init__.py
│   ├── products/
│   │   ├── routes.py
│   │   └── __init__.py
│   ├── reports/
│   │   └── __init__.py
│   ├── database/
│   │   ├── db.py
│   │   ├── models.py
│   │   └── init_db.py
│   ├── utils/
│   │   └── auth.py
│   ├── main.py
│   └── .env.local
│
├── src/
│   ├── services/
│   │   ├── api.ts
│   │   ├── authService.ts
│   │   ├── billingService.ts
│   │   ├── customerService.ts
│   │   ├── productsService.ts
│   │   └── syncService.ts
│   ├── pages/
│   ├── components/
│   └── contexts/
│
├── electron/
│   └── main.cjs
│
└── package.json
```

## Support & Documentation

- API Documentation: `http://localhost:8000/docs`
- FastAPI: https://fastapi.tiangolo.com
- SQLAlchemy: https://www.sqlalchemy.org
- React: https://react.dev
- Supabase: https://supabase.com/docs

## License

Commercial - Proprietary
