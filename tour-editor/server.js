const express = require('express');
const axios = require('axios');

const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

// Endpoint to save config
app.post('/save-config', (req, res) => {
    const config = req.body;
    const filePath = path.join(__dirname, 'tour-config.json');

    fs.writeFile(filePath, JSON.stringify(config, null, 4), (err) => {
        if (err) {
            console.error('Error saving config:', err);
            return res.status(500).send('Error saving config');
        }
        res.send({ message: 'Config saved successfully', path: filePath });
    });
});

// Proxy endpoint to bypass CORS
app.get('/proxy', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('URL is required');

    try {
        const response = await axios({
            url: imageUrl,
            method: 'GET',
            responseType: 'stream'
        });

        res.set('Content-Type', response.headers['content-type']);
        response.data.pipe(res);
    } catch (err) {
        console.error('Proxy error:', err.message);
        res.status(500).send('Error fetching image');
    }
});


app.listen(PORT, async () => {
    console.log(`Editor server running at http://localhost:${PORT}`);
    console.log('Opening browser...');
    try {
        const { default: open } = await import('open');
        await open(`http://localhost:${PORT}`);
    } catch (err) {
        console.log('Could not open browser automatically. Please open http://localhost:3000 manually.');
    }
});
