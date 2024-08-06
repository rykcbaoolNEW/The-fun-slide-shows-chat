const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const passport = require('passport');
const GitHubStrategy = require('passport-github').Strategy;
const session = require('express-session');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect('mongodb://localhost:27017/chat', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const UserSchema = new mongoose.Schema({
  githubId: String,
  username: String
});

const MessageSchema = new mongoose.Schema({
  content: String,
  sender: String,
  timestamp: Date
});

const User = mongoose.model('User', UserSchema);
const Message = mongoose.model('Message', MessageSchema);

passport.use(new GitHubStrategy({
  clientID: process.env.GITHUB_CLIENT_ID,
  clientSecret: process.env.GITHUB_CLIENT_SECRET,
  callbackURL: 'http://localhost:3000/auth/github/callback'
}, async (accessToken, refreshToken, profile, done) => {
  let user = await User.findOne({ githubId: profile.id });
  if (!user) {
    user = await User.create({
      githubId: profile.id,
      username: profile.username
    });
  }
  return done(null, user);
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser((id, done) => User.findById(id, done));

app.use(session({
  secret: 'chat-app-secret',
  resave: false,
  saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));

app.get('/auth/github', passport.authenticate('github'));

app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/' }),
  (req, res) => res.redirect('/')
);

app.get('/messages', async (req, res) => {
  const messages = await Message.find().sort({ timestamp: -1 }).limit(50);
  res.json(messages.reverse());
});

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

io.on('connection', (socket) => {
  socket.on('sendMessage', async (msg) => {
    const message = new Message({
      content: msg.content,
      sender: msg.sender,
      timestamp: new Date()
    });
    await message.save();
    io.emit('newMessage', message);
  });
});

server.listen(3000, () => console.log('Server running on http://localhost:3000'));
