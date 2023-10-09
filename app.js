const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const dotenv = require('dotenv');
const router = express.Router();
const queryString = require('node:querystring')
const axios = require('axios')
// const spotifyAuthLink = document.getElementById('spotify-auth-link');

dotenv.config();

const app = require('liquid-express-views')(express());

app.use(session({ secret: process.env.SESSION_SECRET, resave: true, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());

passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      // Store user data in your database or perform other actions here.
      return done(null, profile);
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user, done) => {
  done(null, user);
});

// spotifyAuthLink.href = `https://accounts.spotify.com/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=user-top-read`;


// Define your routes here...

const port = 3000;
app.listen(port, () => {
  console.log(`App is listening on http://localhost:${port}!`);
});


app.get('/', (req, res) => {
  // Load environment variables
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_CALLBACK_URL;

  // Render the view with dynamic URL
  res.render('home.liquid', { clientId, redirectUri });
});


app.get('/account', async (req, res) => {
  console.log('Spotify response code: ' + req.query.code)
  const spotifyResponse = await axios.post(
    "https://accounts.spotify.com/api/token",
    queryString.stringify({
      grant_type: "authorization_code",
      code: req.query.code,
      redirect_uri: process.env.SPOTIFY_CALLBACK_URL,
    }),
    {
      headers: {
        Authorization: "Basic " + process.env.BASE64_AUTHORIZATION,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

console.log(spotifyResponse.data);
  res.render(`authorized.liquid`)
})