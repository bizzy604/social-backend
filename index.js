import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import express from "express"
import http from "http"
import cors from "cors"
import dotenv from "dotenv"
import jwt from "jsonwebtoken"
import { typeDefs } from "./schema.js"
import { resolvers } from "./resolvers.js"

// Load environment variables
dotenv.config()

// Create Express app and HTTP server
const app = express()
const httpServer = http.createServer(app)

// Create Apollo Server
const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
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

// Start the HTTP server
const PORT = process.env.PORT || 4000
await new Promise((resolve) => httpServer.listen({ port: PORT }, resolve))
console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`)
