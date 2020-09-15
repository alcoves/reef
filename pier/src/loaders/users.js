const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

async function login({ username, password }) {
  const user = await User.findOne({ username });
  if (!user) throw new Error('authentication failed');
  const passwordsMatch = await bcrypt.compare(password, user.password);
  if (!passwordsMatch) throw new Error('authentication failed');

  const token = jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    process.env.JWT_KEY,
    {
      expiresIn: '7d',
    }
  );
  return { token };
}

async function register({ email, username, password }) {
  const hashedPassword = await bcrypt.hash(password, 10);
  await new User({ email, username, password: hashedPassword }).save();
  return login({ username, password });
}

async function getUserById(id) {
  return User.findById(id);
}

module.exports = {
  login,
  register,
  getUserById,
};
