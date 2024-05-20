const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const querystring = require('querystring');

const hostname = 'localhost';
const port = 3000;

const anthropicApiKey = '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';
const serviceAccount = JSON.parse(fs.readFileSync('tokens.json', 'utf8'));
const privateKey = serviceAccount.private_key;
const clientEmail = serviceAccount.client_email;
const tokenURI = serviceAccount.token_uri;

const serveStaticFile = (res, filePath, contentType) => {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    }
  });
};

// JWT for the service account
const createJWT = (header, claimSet, privateKey) => {
  const encodeBase64URL = (str) => {
    return Buffer.from(str)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  };

  const headerEncoded = encodeBase64URL(JSON.stringify(header));
  const claimSetEncoded = encodeBase64URL(JSON.stringify(claimSet));

  const signatureInput = `${headerEncoded}.${claimSetEncoded}`;
  const signature = crypto
    .createSign('RSA-SHA256')
    .update(signatureInput)
    .sign(privateKey, 'base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return `${signatureInput}.${signature}`;
};

// Function for JWT for an access token
const getAccessToken = (jwt, afterGetAccessToken) => {
  const postData = querystring.stringify({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  });

  const options = {
    hostname: 'oauth2.googleapis.com',
    path: '/token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      const response = JSON.parse(data);
      afterGetAccessToken(null, response.access_token);
    });
  });

  req.on('error', (e) => {
    afterGetAccessToken(e);
  });

  req.write(postData);
  req.end();
};

// Create and start the server
const server = http.createServer((req, res) => {
  console.log(`Received request: ${req.method} ${req.url}`);

  if (req.url === '/' && req.method === 'GET') {
    // Serve the HTML form
    serveStaticFile(res, path.join(__dirname, 'index.html'), 'text/html');
  } else if (req.url === '/styles.css' && req.method === 'GET') {
    // Serve the CSS file
    serveStaticFile(res, path.join(__dirname, 'styles.css'), 'text/css');
  } else if (req.url === '/generate-story' && req.method === 'POST') {
    // Handle form submission
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      const postData = new URLSearchParams(body);
      const userPrompt = postData.get('prompt');
      const prompt = `Write a bedtime story aimed towards a 7 year old child about ${userPrompt}`;
      console.log(`Received prompt: ${prompt}`);

      // Generate bedtime story 
      generateBedtimeStory(prompt, (story) => {
        if (story) {
          // Convert story to speech 
          const now = Math.floor(Date.now() / 1000);
          const expiry = now + 3600;
          const claimSet = {
            iss: clientEmail,
            scope: 'https://www.googleapis.com/auth/cloud-platform',
            aud: tokenURI,
            exp: expiry,
            iat: now
          };

          const jwt = createJWT({ alg: 'RS256', typ: 'JWT' }, claimSet, privateKey);
          getAccessToken(jwt, (err, accessToken) => {
            if (err) {
              console.error('Error obtaining access token:', err);
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Failed to obtain access token');
            } else {
              console.log(`Using access token: ${accessToken}`);
              convertTextToSpeech(accessToken, story, (audioFile) => {
                if (audioFile) {
                  // Save the audio file and send a download link to the user
                  const filePath = path.join(__dirname, 'story.mp3');
                  fs.writeFile(filePath, audioFile, 'binary', (err) => {
                    if (err) {
                      res.writeHead(500, { 'Content-Type': 'text/plain' });
                      res.end('Failed to save audio file');
                    } else {
                      res.writeHead(200, { 'Content-Type': 'text/html' });
                      res.end(`
                        <html>
                          <head>
                            <link rel="stylesheet" href="/styles.css">
                          </head>
                          <body>
                            <div id="storyPopup" class="popup" style="display: block;">
                              <div class="popup-content">
                                <h1>Your bedtime story is ready!</h1>
                                <p>${story}</p>
                                <a href="/download-story">Download the story</a>
                              </div>
                            </div>
                          </body>
                        </html>
                      `);
                    }
                  });
                } else {
                  res.writeHead(500, { 'Content-Type': 'text/plain' });
                  res.end('Failed to convert text to speech');
                }
              });
            }
          });
        } else {
          res.writeHead(503, { 'Content-Type': 'text/plain' });
          res.end('Service Unavailable: API is overloaded.');
        }
      });
    });
  } else if (req.url === '/download-story' && req.method === 'GET') {
    // Serve the MP3 file for download
    const filePath = path.join(__dirname, 'story.mp3');
    res.writeHead(200, {
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'attachment; filename=story.mp3'
    });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(port, hostname, () => {
  console.log(`Server running at http://${hostname}:${port}/`);
});

// Function to generate bedtime story using Anthropic API
function generateBedtimeStory(prompt, afterGenerateBedtimeStory) {
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    }
  };

  const postData = JSON.stringify({
    model: 'claude-3-opus-20240229',
    max_tokens: 1024,
    messages: [
      { role: 'user', content: prompt }
    ]
  });

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      const response = JSON.parse(data);
      console.log('Anthropic API response:', response);
      if (response.content && response.content.length > 0) {
        const story = response.content[0].text;
        afterGenerateBedtimeStory(story);
      } else {
        console.error('Error: Invalid response from Anthropic API', response);
        afterGenerateBedtimeStory(null);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });

  req.write(postData);
  req.end();
}

// Function to convert text to speech using Google Text-to-Speech API
function convertTextToSpeech(accessToken, text, afterTextToSpeech) {
  console.log(`Using access token: ${accessToken}`);

  const options = {
    hostname: 'texttospeech.googleapis.com',
    path: '/v1/text:synthesize',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`
    }
  };

  const postData = JSON.stringify({
    input: { text: text },
    voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
    audioConfig: { audioEncoding: 'MP3' }
  });

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      try {
        const parsedData = JSON.parse(data);
        if (parsedData.audioContent) {
          const audioFile = Buffer.from(parsedData.audioContent, 'base64');
          afterTextToSpeech(audioFile);
        } else {
          console.error('Error: Invalid response from Text-to-Speech API', parsedData);
          afterTextToSpeech(null);
        }
      } catch (err) {
        console.error('Error parsing response from Text-to-Speech API', err);
        afterTextToSpeech(null);
      }
    });
  });

  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
    afterTextToSpeech(null);
  });

  req.write(postData);
  req.end();
}