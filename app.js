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

app.use(express.static('public'));
passport.use(
  new SpotifyStrategy(
    {
      clientID: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      callbackURL: process.env.SPOTIFY_CALLBACK_URL,
    },
    (accessToken, refreshToken, profile, done) => {
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

app.get('/logout', (req, res) => {
  delete req.session.accessToken; // For example, delete the accessToken from the session
  req.session.destroy((err) => {
    if (err) {
      console.error(err);
    } else {
      res.redirect('/'); 
    }
  });
});
app.get('/', (req, res) => {
  // Load environment variables
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_CALLBACK_URL;
  
  // Render the view with dynamic URL
  res.render('home.liquid', { clientId, redirectUri });
});

// ---------- Refresh Token ------------
const storedRefreshToken = "your_stored_refresh_token_here"; // Retrieve this securely

const refreshAccessToken = async () => {
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      queryString.stringify({
        grant_type: "refresh_token",
        refresh_token: storedRefreshToken,
        client_id: process.env.SPOTIFY_CLIENT_ID,
        client_secret: process.env.SPOTIFY_CLIENT_SECRET
      }),
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        }
      }
    );
    return response.data.access_token; // Return the new access token
  } catch (error) {
    throw new Error("Failed to refresh access token");
  }
};


// Includes Spotify RedirectURI 
// Accesses spotify access token required to make Api request
app.get('/account', async (req, res) => {
  console.log('Spotify response code: ' + req.query.code);
  
  try {
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
      
      const accessToken = spotifyResponse.data.access_token;
      
      const topArtists = await axios.get("https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=5", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const topArtist = await axios.get("https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=1", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
      const topSongs = await axios.get("https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=5", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      // Assuming topArtists.data contains the response data
      

      
      // Log topArtist
      // console.log(topArtists.data);
      // console.log(topArtists.data);
      // Log topSongs
      // console.log(topSongs.data)
      
      res.render('authorized.liquid', { topArtists: topArtists.data, topSongs: topSongs.data });
    } catch (error) {
      console.error(error);
      res.status(500).send("Error occurred while making Spotify API request.");
    }
  });
  // --------------- Logout ---------------
  app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error(err);
      }
      res.redirect('/'); // Redirect to the home page after logging out
    });
  });
  // --------------- server ---------------
  
  const port = 3000;
  app.listen(port, () => {
    console.log(`App is listening on http://localhost:${port}!`);
  });