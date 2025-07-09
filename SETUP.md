# Zendesk Dashboard Setup Instructions

## Quick Start

This dashboard integrates with Zendesk to show real performance metrics. **No dummy data is shown** - if the backend server is not running, you'll see empty states until you start the backend.

### 1. Environment Setup

Ensure your `.env` file contains:

```
VITE_ZENDESK_SUBDOMAIN=your_zendesk_subdomain
VITE_ZENDESK_EMAIL=your_email@example.com
VITE_ZENDESK_API_TOKEN=your_zendesk_api_token
```

### 2. Install Dependencies

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server && npm install && cd ..
```

### 3. Running the Application

The application now uses Vite proxy configuration to automatically route API requests to the backend.

#### Option 1: Frontend Only (No Data Mode)

```bash
npm run dev
```

This will show empty states until you start the backend server.

#### Option 2: Full Setup (Real Data) - Recommended

```bash
# Start both frontend and backend at once
npm run dev:full
```

#### Option 3: Manual Setup

```bash
# Terminal 1: Start backend server
npm run server

# Terminal 2: Start frontend with proxy
npm run dev
```

The Vite dev server will automatically proxy API requests from the frontend to the backend on port 3001.

### 4. Verify Setup

1. **Frontend**: Visit http://localhost:5173
2. **Backend Health Check**: Visit http://localhost:5173/test-api.html
3. **Backend Direct**: curl http://localhost:3001/api/health

## Troubleshooting

### "Unexpected token '<'" Error

This error means the backend server is not running. The dashboard will show empty states.

**Solution**: Start both services together:

```bash
npm run dev:full
```

Or start the backend manually:

```bash
npm run server
```

### CORS Errors

CORS is handled by Vite's proxy configuration. The frontend automatically proxies API requests to the backend on port 3001.

### Zendesk API Errors

1. Check your API credentials in `.env`
2. Verify your Zendesk subdomain is correct
3. Ensure your API token has the necessary permissions

### Empty Data States

If you see "No Data" messages, it means:

- Backend server is not running, OR
- Backend cannot connect to Zendesk API

Start the backend server to see real data.

## API Endpoints

When the backend is running:

- `GET http://localhost:3001/api/health` - Health check
- `GET http://localhost:3001/api/zendesk/users` - Zendesk users
- `GET http://localhost:3001/api/zendesk/tickets` - Zendesk tickets
- `GET http://localhost:3001/api/zendesk/satisfaction_ratings` - Satisfaction ratings

## Development Workflow

1. **Backend Development**: Edit `server/index.js` and restart server
2. **Frontend Development**: Changes auto-reload with Vite HMR
3. **Testing**: Use `/test-api.html` to verify backend connectivity

## Production Deployment

For production, you'll need to:

1. Deploy the backend server separately
2. Update the API base URL in `src/lib/zendesk-api.ts`
3. Set up proper environment variables
4. Configure CORS for your production domain
