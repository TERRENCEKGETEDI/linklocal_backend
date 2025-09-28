# LinkLocal Backend

A Node.js backend API for the LinkLocal service marketplace platform, built with Express.js, TypeScript, and PostgreSQL.

## Features

- **Authentication & Authorization**: JWT-based auth with refresh tokens
- **User Management**: Customer and provider roles
- **Service Management**: CRUD operations for services
- **Request System**: Service requests between customers and providers
- **Feedback System**: Rating and reviews for completed services
- **Categories**: Service categorization
- **Profile Management**: User profile updates

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT
- **Validation**: Zod
- **Security**: Helmet, CORS

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```

   Update the `.env` file with your configuration:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/linklocal_db?schema=public"
   JWT_SECRET="your-super-secret-jwt-key-here"
   JWT_REFRESH_SECRET="your-super-secret-refresh-key-here"
   PORT=3001
   NODE_ENV="development"
   CORS_ORIGIN="http://localhost:5173"
   ```

4. Set up the database:
   ```bash
   # Generate Prisma client
   npm run db:generate

   # Push schema to database
   npm run db:push
   ```

5. Start the development server:
   ```bash
   npm run dev
   ```

The server will start on `http://localhost:3001`

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/refresh` - Refresh access token
- `POST /register` - User registration

### Services
- `GET /services` - Get services (with filtering/pagination)
- `GET /services/:id` - Get single service
- `POST /services` - Create service (providers only)
- `PATCH /services/:id` - Update service (owner only)
- `DELETE /services/:id` - Delete service (owner only)

### Requests
- `GET /requests` - Get user requests
- `POST /requests` - Create request (customers only)
- `PATCH /requests/:id` - Update request status

### Categories
- `GET /categories` - Get all categories

### Feedback
- `POST /feedback` - Submit feedback (customers only)
- `GET /feedback/provider/:id` - Get provider feedback

### Profile
- `GET /profile` - Get user profile
- `PATCH /profile` - Update user profile

## Deployment to Render

### Prerequisites
- Render account
- PostgreSQL database on Render or external provider

### Steps

1. **Create a PostgreSQL database on Render**
   - Go to Render Dashboard → New → PostgreSQL
   - Note the connection string

2. **Deploy the backend**
   - Go to Render Dashboard → New → Web Service
   - Connect your GitHub repository
   - Configure build settings:
     - **Build Command**: `npm run build`
     - **Start Command**: `npm start`
   - Add environment variables:
     - `DATABASE_URL`: Your PostgreSQL connection string
     - `JWT_SECRET`: A secure random string
     - `JWT_REFRESH_SECRET`: Another secure random string
     - `NODE_ENV`: `production`
     - `CORS_ORIGIN`: Your frontend URL (e.g., `https://your-frontend.onrender.com`)

3. **Database Migration**
   - After deployment, the `render-postbuild` script will run `prisma db push` to set up your database schema

4. **Update Frontend**
   - Update your frontend's API base URL to point to the deployed backend

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret key for JWT access tokens | Yes |
| `JWT_REFRESH_SECRET` | Secret key for JWT refresh tokens | Yes |
| `PORT` | Server port (default: 3001) | No |
| `NODE_ENV` | Environment (development/production) | No |
| `CORS_ORIGIN` | Allowed CORS origin | No |

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run db:generate` - Generate Prisma client
- `npm run db:push` - Push schema changes to database
- `npm run db:migrate` - Run database migrations
- `npm run db:studio` - Open Prisma Studio

### Database Management

Use Prisma commands for database operations:

```bash
# View database in browser
npm run db:studio

# Create and apply migrations (development)
npm run db:migrate

# Push schema changes (development/production)
npm run db:push
```

## Project Structure

```
src/
├── lib/           # Database and configuration
├── middleware/    # Express middleware
├── routes/        # API route handlers
├── types/         # TypeScript type definitions
└── utils/         # Utility functions
prisma/
└── schema.prisma  # Database schema
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

ISC