const express = require('express');
const session = require('express-session');
const passport = require('passport');
const SpotifyStrategy = require('passport-spotify').Strategy;
const dotenv = require('dotenv');
const queryString = require('node:querystring');
const axios = require('axios');

dotenv.config();

const app = require('liquid-express-views')(express());

// Begin session
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: true,
  saveUninitialized: true,
}));

// Serve static files from 'public' folder (CSS styling, etc.)
app.use(express.static('public'));

// Set up Passport with Spotify strategy
passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_CALLBACK_URL,  // still needed to handle the OAuth redirect
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

// Homepage route (rendering login link)
app.get('/', (req, res) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_CALLBACK_URL;
  
  res.render('home.liquid', { clientId, redirectUri });
});

// ---------- Spotify Token Exchange and Fetch User Data ------------

app.get('/account', async (req, res) => {
  try {
    // Exchange authorization code for access and refresh tokens
    const tokenResponse = await axios.post(
      "https://accounts.spotify.com/api/token",
      queryString.stringify({
        grant_type: "authorization_code",
        code: req.query.code,  // Authorization code from the callback
        redirect_uri: process.env.SPOTIFY_CALLBACK_URL,
      }),
      {
        headers: {
          Authorization: 'Basic ' + Buffer.from(
            `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
          ).toString('base64'), // Proper base64 encoding
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    const refreshToken = tokenResponse.data.refresh_token;

    // Store tokens in session
    req.session.accessToken = accessToken;
    req.session.refreshToken = refreshToken;

    // Retrieve user's top artists and tracks from Spotify API
    const topArtists = await axios.get('https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    const topSongs = await axios.get('https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    // Render the authorized page with user's top artists and tracks
    res.render('authorized.liquid', { topArtists: topArtists.data, topSongs: topSongs.data });

  } catch (error) {
    console.error('Error occurred while making Spotify API request:', error);
    res.status(500).send("Error occurred while making Spotify API request.");
  }
});

// ---------- Logout Route (with Token Revoke) ------------

app.get('/logout', async (req, res) => {
  try {
    const accessToken = req.session.accessToken;

    if (!accessToken) {
      throw new Error("No access token found for the user.");
    }

    // Log the token revocation (though Spotify doesn't have a direct revoke endpoint)
    console.log('Revoking access token:', accessToken);

    // Destroy session
    req.session.destroy();

    // Prevent session from being stored in browser cache
    res.setHeader('Cache-Control', 'no-store');

    // Redirect back to homepage after logout
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send("Error occurred during logout. Please try again.");
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));
