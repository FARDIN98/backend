# CollabSlides Backend Setup

## Prerequisites

1. Node.js (v16 or higher)
2. npm or pnpm
3. Supabase account and project

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Configuration

Create a `.env` file in the backend directory with the following variables:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

### 3. Database Setup

**IMPORTANT**: You must create the database tables manually in your Supabase dashboard.

1. Go to your Supabase dashboard: https://supabase.com/dashboard
2. Select your project
3. Navigate to the "SQL Editor" tab
4. Create a new query
5. Copy and paste the SQL from `schema.sql` file
6. Click "Run" to execute the SQL

Alternatively, you can run the manual setup script to get the SQL:

```bash
node manual-setup.js
```

### 4. Verify Database Setup

Run the database test script:

```bash
node test-database.js
```

This will verify that all tables are created and accessible.

### 5. Start the Server

```bash
npm run dev
```

The server will start on port 3001 (or the port specified in your .env file).

## Database Schema

The application uses the following tables:

- `presentations`: Stores presentation metadata
- `slides`: Stores individual slides for each presentation
- `text_blocks`: Stores text content within slides
- `presentation_users`: Manages user access and roles for presentations

## API Endpoints

- `GET /api/presentations` - Get all presentations
- `POST /api/presentations` - Create a new presentation
- `GET /api/presentations/:id` - Get a specific presentation
- `PUT /api/presentations/:id` - Update a presentation
- `DELETE /api/presentations/:id` - Delete a presentation

## Socket.IO Events

The server supports real-time collaboration through Socket.IO with