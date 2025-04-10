import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import express from "express";
import cors from "cors";
import { typeDefs } from "../schema.js";
import { resolvers } from "../resolvers.js";
import jwt from "jsonwebtoken";

// Create a simple Express serverless function for Vercel
export default async function handler(req, res) {
  // Only process POST requests for GraphQL
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  // Create a minimal Apollo Server
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: process.env.NODE_ENV !== 'production',
    cache: 'bounded',
  });

  // Start the server (required once)
  await server.start();

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

  // Use middleware to handle the request
  try {
    await new Promise((resolve, reject) => {
      middleware(req, res, (err) => {
        if (err) reject(err);
        resolve();
      });
    });
  } catch (error) {
    console.error('GraphQL middleware error:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}