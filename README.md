# Social Media Backend

This is the backend for the Social Media application built with:

- Express.js
- Apollo Server
- GraphQL
- Prisma ORM
- PostgreSQL

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Create a `.env` file with the following variables:
\`\`\`
DATABASE_URL="postgresql://user:password@localhost:5432/socialmedia?schema=public"
JWT_SECRET="your-secret-key-here"
PORT=4000
CORS_ORIGIN="http://localhost:5173"
\`\`\`

3. Generate Prisma client:
\`\`\`bash
npm run prisma:generate
\`\`\`

4. Run migrations:
\`\`\`bash
npm run prisma:migrate
\`\`\`

5. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

## Project Structure

- `index.js`: Server entry point
- `schema.js`: GraphQL schema
- `resolvers.js`: GraphQL resolvers
- `prisma/`: Prisma schema and migrations

## API Endpoints

- GraphQL API: `http://localhost:4000/graphql`
- Health Check: `http://localhost:4000/health`

## Features

- User authentication
- Post creation and retrieval
- Like/unlike posts
- Follow/unfollow users
- User profiles
