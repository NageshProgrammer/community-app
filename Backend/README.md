# Community Website Backend

This is the backend API for the Community Website frontend.

## Setup

1. Navigate to the Backend directory:
   ```
   cd Backend
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. For production, build and run:
   ```
   npm run build
   npm start
   ```

## API Endpoints

- `GET /api/posts` - Get all posts
- `POST /api/posts` - Create a new post (body: { title, content, author })
- `GET /api/posts/:id` - Get a specific post by ID
- `GET /api/health` - Health check

## Environment Variables

- `PORT` - Server port (default: 5000)

## Notes

- Currently uses in-memory storage. For production, integrate a database like MongoDB or PostgreSQL.
- Add authentication and validation as needed.