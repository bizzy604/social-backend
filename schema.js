import gql from "graphql-tag"

export const typeDefs = gql`
  type User {
    id: ID!
    name: String
    username: String
    email: String
    image: String
    bio: String
    createdAt: String!
    updatedAt: String!
    posts: [Post!]!
    followers: [Follow!]!
    following: [Follow!]!
    _count: UserCount!
    isFollowing: Boolean
  }

  type UserCount {
    posts: Int!
    followers: Int!
    following: Int!
  }

  type Post {
    id: ID!
    content: String!
    createdAt: String!
    updatedAt: String!
    author: User!
    authorId: String!
    likes: [Like!]!
    _count: PostCount!
    isLiked: Boolean
  }

  type PostCount {
    likes: Int!
  }

  type Like {
    id: ID!
    createdAt: String!
    user: User!
    userId: String!
    post: Post!
    postId: String!
  }

  type Follow {
    id: ID!
    createdAt: String!
    follower: User!
    followerId: String!
    following: User!
    followingId: String!
  }

  type AuthPayload {
    token: String!
    user: User!
  }

  type Query {
    me: User
    user(id: ID!): User
    users(limit: Int): [User!]!
    usersToFollow(limit: Int): [User!]!
    post(id: ID!): Post
    feed: [Post!]!
    explorePosts: [Post!]!
    userPosts(userId: ID!): [Post!]!
    followers(userId: ID!): [User!]!
    following(userId: ID!): [User!]!
  }

  type Mutation {
    register(name: String!, username: String!, email: String!, password: String!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    createPost(content: String!): Post!
    likePost(postId: ID!): Like!
    unlikePost(postId: ID!): Boolean!
    followUser(userId: ID!): Follow!
    unfollowUser(userId: ID!): Boolean!
    updateProfile(name: String, bio: String): User!
  }
`
