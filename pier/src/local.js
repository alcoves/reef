require('dotenv').config();

const express = require('express');
const { ApolloServer } = require('apollo-server-express');

const app = express();

const server = new ApolloServer({
  modules: [
    require('./schema/Users'),
    require('./schema/Videos'),
    require('./schema/Uploads'),
  ],
  context: require('./context'),
  tracing: true,
  playground: true,
  introspection: true,
});

server.applyMiddleware({
  app,
  path: '/api',
  cors: {
    credentials: true,
    origin: 'http://localhost:3000',
  },
});

app.listen({ port: 4000 }, () =>
  console.log(`🚀 Server ready at http://localhost:4000/api`)
);
