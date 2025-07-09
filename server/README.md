# Zendesk Proxy Server

This is a simple Express.js server that acts as a proxy for Zendesk API calls, solving CORS issues when making requests from the frontend.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables from parent directory:

```bash
cp ../.env .env
```

3. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/zendesk/users` - Get Zendesk users with agent role
- `GET /api/zendesk/tickets?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` - Get tickets with optional date filtering
- `GET /api/zendesk/satisfaction_ratings?start_time=UNIX_TIMESTAMP&end_time=UNIX_TIMESTAMP` - Get satisfaction ratings with optional time filtering

## Environment Variables

Required environment variables in `.env` file:

- `VITE_ZENDESK_SUBDOMAIN` - Your Zendesk subdomain
- `VITE_ZENDESK_EMAIL` - Your Zendesk email
- `VITE_ZENDESK_API_TOKEN` - Your Zendesk API token

## Running Both Frontend and Backend

From the main project directory, you can run both services simultaneously:

```bash
npm run dev:full
```
