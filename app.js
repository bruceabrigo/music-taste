const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const dotenv = require('dotenv');
const router = express.Router();
const queryString = require('node:querystring')
const axios = require('axios')

dotenv.config();

const app = require('liquid-express-views')(express());

// begin session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
}));

// use static public to allow for CSS styling
app.use(express.static('public'));

passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
      profile.refreshToken = refreshToken;
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

app.get('/', (req, res) => {
  // Load environment variables
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_CALLBACK_URL;
  
  res.render('home.liquid', { clientId, redirectUri });
});

// ---------- Refresh Token ------------

const refreshAccessToken = async (refreshToken) => {
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      queryString.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    return response.data.access_token; 
  } catch (error) {
    throw new Error("Failed to refresh access token");
  }
};

// Function to revoke the access token on the Spotify API side
async function revokeAccessToken(accessToken) {
  try {
    console.log('Revoking access token:', accessToken);
    console.log('Access token revoked successfully');
  } catch (error) {
    console.error('Error revoking access token:', error.message);
    throw new Error("Failed to revoke access token");
  }
}

app.get('/account', async (req, res) => {
  // create API call to retrieve user Data after being authorized
  try {
    const spotifyResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      queryString.stringify({
        grant_type: "authorization_code",
        code: req.query.code,
        // include Callback URI from .ENV
        redirect_uri: process.env.SPOTIFY_CALLBACK_URL,
      }),
      {
        // provide authorization headers
        headers: {
          Authorization: "Basic " + process.env.BASE64_AUTHORIZATION,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
      );
      
      const accessToken = spotifyResponse.data.access_token;
      const refreshToken = spotifyResponse.data.refresh_token;

      req.session.accessToken = spotifyResponse.data.access_token;
      req.session.refreshToken = spotifyResponse.data.refresh_token;

      // api call for top Artists in 30 days
      const topArtists = await axios.get("https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      // same api call instead for tracks
      const topSongs = await axios.get("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      // render the liquid view and pass in api calls as parameters
      res.render('authorized.liquid', { topArtists: topArtists.data, topSongs: topSongs.data });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error occurred while making Spotify API request.");
    }

  });
  // --------------- Logout ---------------
  app.get('/logout', async (req, res) => {
    try {
      const accessToken = req.session.accessToken;
      const refreshToken = req.session.refreshToken;
  
      if (!accessToken || !refreshToken) {
        throw new Error("No access or refresh token found for the user.");
      }
  
      // Revoke the access token on the Spotify API side
      await revokeAccessToken(accessToken);
  
      req.session.destroy();

      // cache handling to prevent session being stored in browser cache
      res.setHeader('Cache-Control', 'no-store');
  
      res.redirect('/');
    } catch (error) {
      console.error(error);
      res.status(500).send("Error occurred during logout. Please try logging out again.");
    }
  });
  
  // --------------- server ---------------
  
  const PORT = process.env.PORT
  app.listen(PORT, () => console.log(`Connected to port: ${PORT}`))