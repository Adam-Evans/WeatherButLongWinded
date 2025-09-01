const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const IPinfoWrapper = require('node-ipinfo');
require('dotenv').config();

const app = express();
const port = 3001;

app.use(cors());
app.set('trust proxy', true);

const ipinfoWrapper = new IPinfoWrapper(process.env.IPINFO_TOKEN);

app.get('/weather', async (req, res) => {
  try {
    // In a real-world scenario, you'd get the user's IP from the request.
    // For local development, we'll use a hardcoded IP.
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '8.8.8.8';

    const ipInfo = await ipinfoWrapper.lookupIp(ip);
    const [latitude, longitude] = ipInfo.loc.split(',');

    const weatherResponse = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude,
        longitude,
        daily: 'weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',
        timezone: 'auto',
        forecast_days: 7,
      },
    });

    const weatherData = weatherResponse.data;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `
      Given the following weekly weather forecast, write a delightful, completely irrelevant story for each day.
      The story should be a fond or not-so-fond memory related to the weather of that day.
      Return the response as a single JSON object, where each key is the date and the value is an object containing the weather data and the story.
      The keys of the JSON object should be the dates from the weather data.
      For each date, the value should be an object with a single key "story".
      Do not include any other text or explanation in your response, only the JSON object.

      Example for a single day:
      {
        "2024-01-01": {
          "story": "This reminds me of the time my cat learned to play the piano."
        }
      }

      Weather data:
      ${JSON.stringify(weatherData.daily, null, 2)}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up the response to ensure it's valid JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();

    const stories = JSON.parse(text);

    const combinedData = weatherData.daily.time.map((date, index) => ({
      date,
      weather: {
        weathercode: weatherData.daily.weathercode[index],
        temperature_2m_max: weatherData.daily.temperature_2m_max[index],
        temperature_2m_min: weatherData.daily.temperature_2m_min[index],
        sunrise: weatherData.daily.sunrise[index],
        sunset: weatherData.daily.sunset[index],
        uv_index_max: weatherData.daily.uv_index_max[index],
      },
      story: stories[date] ? stories[date].story : "No story generated for this day.",
    }));

    res.json(combinedData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch weather data or generate stories.' });
  }
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
});
