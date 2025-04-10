import { PrismaClient } from "@prisma/client"
import { hash, compare } from "bcrypt"
import jwt from "jsonwebtoken"
import { GraphQLError } from "graphql"

const prisma = new PrismaClient()

export const resolvers = {
  Query: {
    me: async (_, __, context) => {
      if (!context.user) {
        return null
      }

      return prisma.user.findUnique({
        where: { id: context.user.id },
        include: {
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
      })
    },

    user: async (_, { id }, context) => {
      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
      })

      if (!user) {
        throw new GraphQLError("User not found")
      }

      // Check if the current user is following this user
      let isFollowing = false
      if (context.user) {
        const follow = await prisma.follow.findFirst({
          where: {
            followerId: context.user.id,
            followingId: id,
          },
        })
        isFollowing = !!follow
      }

      return {
        ...user,
        isFollowing,
      }
    },

    users: async (_, { limit = 20 }) => {
      return prisma.user.findMany({
        take: limit,
        include: {
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
      })
    },

    usersToFollow: async (_, { limit = 20 }, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      // Get users that the current user is not following
      const following = await prisma.follow.findMany({
        where: {
          followerId: context.user.id,
        },
        select: {
          followingId: true,
        },
      })

      const followingIds = following.map((follow) => follow.followingId)

      // Exclude the current user
      followingIds.push(context.user.id)

      const users = await prisma.user.findMany({
        where: {
          id: {
            notIn: followingIds,
          },
        },
        include: {
          _count: {
            select: {
              posts: true,
              followers: true,
              following: true,
            },
          },
        },
        take: limit,
      })

      return users
    },

    post: async (_, { id }, context) => {
      const post = await prisma.post.findUnique({
        where: { id },
        include: {
          author: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
      })

      if (!post) {
        throw new GraphQLError("Post not found")
      }

      // Check if the current user has liked this post
      let isLiked = false
      if (context.user) {
        const like = await prisma.like.findFirst({
          where: {
            postId: id,
            userId: context.user.id,
          },
        })
        isLiked = !!like
      }

      return {
        ...post,
        isLiked,
      }
    },

    feed: async (_, __, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      // Get posts from users the current user follows + their own posts
      const following = await prisma.follow.findMany({
        where: {
          followerId: context.user.id,
        },
        select: {
          followingId: true,
        },
      })

      const followingIds = following.map((follow) => follow.followingId)

      // Include the user's own posts in the feed
      followingIds.push(context.user.id)

      const posts = await prisma.post.findMany({
        where: {
          authorId: {
            in: followingIds,
          },
        },
        include: {
          author: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      // Check which posts the current user has liked
      const likedPosts = await prisma.like.findMany({
        where: {
          userId: context.user.id,
          postId: {
            in: posts.map((post) => post.id),
          },
        },
        select: {
          postId: true,
        },
      })

      const likedPostIds = new Set(likedPosts.map((like) => like.postId))

      return posts.map((post) => ({
        ...post,
        isLiked: likedPostIds.has(post.id),
      }))
    },

    explorePosts: async (_, __, context) => {
      // Get recent posts from all users
      const posts = await prisma.post.findMany({
        include: {
          author: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
      })

      // Check which posts the current user has liked
      let likedPostIds = new Set()
      if (context.user) {
        const likedPosts = await prisma.like.findMany({
          where: {
            userId: context.user.id,
            postId: {
              in: posts.map((post) => post.id),
            },
          },
          select: {
            postId: true,
          },
        })
        likedPostIds = new Set(likedPosts.map((like) => like.postId))
      }

      return posts.map((post) => ({
        ...post,
        isLiked: likedPostIds.has(post.id),
      }))
    },

    userPosts: async (_, { userId }, context) => {
      const posts = await prisma.post.findMany({
        where: {
          authorId: userId,
        },
        include: {
          author: true,
          _count: {
            select: {
              likes: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      // Check which posts the current user has liked
      let likedPostIds = new Set()
      if (context.user) {
        const likedPosts = await prisma.like.findMany({
          where: {
            userId: context.user.id,
            postId: {
              in: posts.map((post) => post.id),
            },
          },
          select: {
            postId: true,
          },
        })
        likedPostIds = new Set(likedPosts.map((like) => like.postId))
      }

      return posts.map((post) => ({
        ...post,
        isLiked: likedPostIds.has(post.id),
      }))
    },

    followers: async (_, { userId }, context) => {
      const followers = await prisma.follow.findMany({
        where: {
          followingId: userId,
        },
        include: {
          follower: {
            include: {
              _count: {
                select: {
                  posts: true,
                  followers: true,
                  following: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      // Check which users the current user is following
      let followingMap = new Map()
      if (context.user) {
        const following = await prisma.follow.findMany({
          where: {
            followerId: context.user.id,
          },
          select: {
            followingId: true,
          },
        })
        followingMap = new Map(following.map((follow) => [follow.followingId, true]))
      }

      return followers.map((follow) => ({
        ...follow.follower,
        isFollowing: followingMap.has(follow.follower.id),
      }))
    },

    following: async (_, { userId }, context) => {
      const following = await prisma.follow.findMany({
        where: {
          followerId: userId,
        },
        include: {
          following: {
            include: {
              _count: {
                select: {
                  posts: true,
                  followers: true,
                  following: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      })

      // Check which users the current user is following
      let followingMap = new Map()
      if (context.user) {
        const currentUserFollowing = await prisma.follow.findMany({
          where: {
            followerId: context.user.id,
          },
          select: {
            followingId: true,
          },
        })
        followingMap = new Map(currentUserFollowing.map((follow) => [follow.followingId, true]))
      }

      return following.map((follow) => ({
        ...follow.following,
        isFollowing: followingMap.has(follow.following.id),
      }))
    },
  },

  Mutation: {
    register: async (_, { name, username, email, password }) => {
      // Check if email already exists
      const existingUserByEmail = await prisma.user.findUnique({
        where: { email },
      })

      if (existingUserByEmail) {
        throw new GraphQLError("Email already in use")
      }

      // Check if username already exists
      const existingUserByUsername = await prisma.user.findUnique({
        where: { username },
      })

      if (existingUserByUsername) {
        throw new GraphQLError("Username already taken")
      }

      // Hash password
      const hashedPassword = await hash(password, 10)

      // Create user
      const user = await prisma.user.create({
        data: {
          name,
          username,
          email,
          password: hashedPassword,
        },
      })

      // Generate token
      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
      )

      return {
        token,
        user,
      }
    },

    login: async (_, { email, password }) => {
      // Find user by email
      const user = await prisma.user.findUnique({
        where: { email },
      })

      if (!user || !user.password) {
        throw new GraphQLError("Invalid email or password")
      }

      // Check password
      const valid = await compare(password, user.password)

      if (!valid) {
        throw new GraphQLError("Invalid email or password")
      }

      // Generate token
      const token = jwt.sign(
        {
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          image: user.image,
        },
        process.env.JWT_SECRET,
        { expiresIn: "30d" },
      )

      return {
        token,
        user,
      }
    },

    createPost: async (_, { content }, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      const post = await prisma.post.create({
        data: {
          content,
          authorId: context.user.id,
        },
        include: {
          author: true,
        },
      })

      return post
    },

    likePost: async (_, { postId }, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      // Check if post exists
      const post = await prisma.post.findUnique({
        where: { id: postId },
      })

      if (!post) {
        throw new GraphQLError("Post not found")
      }

      // Check if already liked
      const existingLike = await prisma.like.findFirst({
        where: {
          postId,
          userId: context.user.id,
        },
      })

      if (existingLike) {
        throw new GraphQLError("Post already liked")
      }

      // Create like
      const like = await prisma.like.create({
        data: {
          postId,
          userId: context.user.id,
        },
        include: {
          user: true,
          post: true,
        },
      })

      return like
    },

    unlikePost: async (_, { postId }, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      // Find and delete like
      const like = await prisma.like.findFirst({
        where: {
          postId,
          userId: context.user.id,
        },
      })

      if (!like) {
        throw new GraphQLError("Like not found")
      }

      await prisma.like.delete({
        where: { id: like.id },
      })

      return true
    },

    followUser: async (_, { userId }, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      const followerId = context.user.id
      const followingId = userId

      // Cannot follow yourself
      if (followerId === followingId) {
        throw new GraphQLError("Cannot follow yourself")
      }

      // Check if user exists
      const user = await prisma.user.findUnique({
        where: { id: followingId },
      })

      if (!user) {
        throw new GraphQLError("User not found")
      }

      // Check if already following
      const existingFollow = await prisma.follow.findFirst({
        where: {
          followerId,
          followingId,
        },
      })

      if (existingFollow) {
        throw new GraphQLError("Already following this user")
      }

      // Create follow
      const follow = await prisma.follow.create({
        data: {
          followerId,
          followingId,
        },
        include: {
          follower: true,
          following: true,
        },
      })

      return follow
    },

    unfollowUser: async (_, { userId }, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      const followerId = context.user.id
      const followingId = userId

      // Find and delete follow
      const follow = await prisma.follow.findFirst({
        where: {
          followerId,
          followingId,
        },
      })

      if (!follow) {
        throw new GraphQLError("Not following this user")
      }

      await prisma.follow.delete({
        where: { id: follow.id },
      })

      return true
    },

    updateProfile: async (_, { name, bio }, context) => {
      if (!context.user) {
        throw new GraphQLError("Authentication required")
      }

      const updatedUser = await prisma.user.update({
        where: { id: context.user.id },
        data: {
          ...(name && { name }),
          ...(bio !== undefined && { bio }),
        },
      })

      return updatedUser
    },
  },
}
