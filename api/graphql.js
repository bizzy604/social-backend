import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import express from "express";
import cors from "cors";
import { typeDefs } from "../schema.js";
import { resolvers } from "../resolvers.js";
import jwt from "jsonwebtoken";

// Initialize server outside the handler to prevent cold starts on every request
let server;
let isServerInitialized = false;

// Pre-initialize connection to avoid timeout during request handling
const initializeServer = async () => {
  if (!isServerInitialized) {
    server = new ApolloServer({
      typeDefs,
      resolvers,
      introspection: process.env.NODE_ENV !== 'production',
      cache: 'bounded',
    });
    await server.start();
    isServerInitialized = true;
  }
  return server;
};

// Start initialization right away (not waiting for first request)
initializeServer().catch(error => {
  console.error('Failed to initialize Apollo Server:', error);
});

// Create a simple Express serverless function for Vercel
export default async function handler(req, res) {
  // Only process POST requests for GraphQL
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Use our pre-initialized server or initialize on demand
  try {
    if (!isServerInitialized) {
      // Get or create server (unlikely path as we start initialization right away)
      server = await initializeServer();
    }
  } catch (error) {
    console.error('Failed to initialize Apollo Server:', error);
    return res.status(500).json({ error: 'Server initialization failed' });
  }

  // Setup Express app for handling the request
  const app = express();
  
  // Apply CORS and JSON middleware
  app.use(cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  }));
  app.use(express.json());

  // Create middleware to handle the GraphQL request
  const middleware = expressMiddleware(server, {
    context: async ({ req }) => {
      // Get the user token from the headers
      const token = req.headers.authorization?.split(" ")[1] || "";

      if (!token) {
        return { user: null };
      }

      try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return { user: decoded };
      } catch (err) {
        return { user: null };
      }
    },
  });

  // Add timeout handling to avoid Vercel timeouts
  const MIDDLEWARE_TIMEOUT = 25000; // 25 seconds (just under Vercel's 30s limit)
  
  try {
    await Promise.race([
      new Promise((resolve, reject) => {
        middleware(req, res, (err) => {
          if (err) reject(err);
          resolve();
        });
      }),
      new Promise((_, reject) => 
        setTimeout(() => {
          reject(new Error('GraphQL processing timeout'));
        }, MIDDLEWARE_TIMEOUT)
      )
    ]);
  } catch (error) {
    console.error('GraphQL middleware error:', error);
    // Only send response if headers not sent yet
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: error.message || 'Internal Server Error',
        isTimeout: error.message === 'GraphQL processing timeout'
      });
    }
  }
}