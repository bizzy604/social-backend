import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { ApolloServerPluginLandingPageDisabled } from '@apollo/server/plugin/disabled'
import express from "express"
import http from "http"
import cors from "cors"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import { typeDefs } from "./schema.js"
import { resolvers } from "./resolvers.js"

// Load environment variables
dotenv.config()

// Determine if we're in a serverless environment (Vercel)
const isServerless = process.env.VERCEL === '1'

// The PrismaClient is handled in resolvers.js to allow for connection pooling
// This avoids repeated cold starts in serverless environments

// Function to set up and start the server
async function startServer() {
  // Create Express app and HTTP server
  const app = express()
  const httpServer = http.createServer(app)
  
  // Create Apollo Server with optimized configuration for serverless
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    // Use minimal plugins in serverless environment to reduce cold start time
    plugins: isServerless 
      ? [ApolloServerPluginLandingPageDisabled()]
      : [ApolloServerPluginDrainHttpServer({ httpServer })],
    introspection: process.env.NODE_ENV !== 'production', // Disable introspection in production for security
    cache: 'bounded', // Use bounded in-memory cache for better performance
  })
  
  // Start the server
  await server.start()
  
  // Apply middleware
  app.use(
    "/graphql",
    cors({
      origin: process.env.CORS_ORIGIN || "http://localhost:5173",
      credentials: true,
    }),
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        // Get the user token from the headers
        const token = req.headers.authorization?.split(" ")[1] || ""
  
        if (!token) {
          return { user: null }
        }
  
        try {
          // Verify the token
          const decoded = jwt.verify(token, process.env.JWT_SECRET)
          return { user: decoded }
        } catch (err) {
          return { user: null }
        }
      },
    }),
  )
  
  // Health check endpoint
  app.get("/health", (req, res) => {
    res.status(200).send("Server is running")
  })
  
  // This conditional is important for Vercel deployment
  if (!isServerless) {
    // Only start the HTTP server in non-serverless environment
    const PORT = process.env.PORT || 4000
    await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve))
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
  }
  
  return app
}

// Start the server
const app = await startServer()

// For serverless environment, export the Express app
export default app
