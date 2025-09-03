const logIpInfo = require('./logIpInfo');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenAI } = require('@google/genai');
const { IPinfoWrapper } = require('node-ipinfo');
const dotenvResult = require('dotenv').config();
const { db, stmts } = require('./database');
const utils = require('./utils');
const path = require('path');

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());
app.set('trust proxy', true);
app.use(express.static(path.join(__dirname, '../client/build')));

const ipinfoWrapper = new IPinfoWrapper(process.env.IPINFO_TOKEN);
const ai = new GoogleGenAI({});



// Helper function to get location info from IP
async function getLocationFromIP(req) {
  try {
    let ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '';
    // Normalize and check for local/empty IPs
    if (!ip || ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1' || ip === 'localhost' || ip === '0.0.0.0') {
      ip = '83.218.135.90';
    }
    // If x-forwarded-for is a comma-separated list, take the first non-local
    if (typeof ip === 'string' && ip.includes(',')) {
      ip = ip.split(',').map(s => s.trim()).find(s => s && s !== '::1' && s !== '127.0.0.1' && s !== '::ffff:127.0.0.1' && s !== 'localhost' && s !== '0.0.0.0') || '83.218.135.90';
    }

    let ipInfo;
    try {
      ipInfo = await ipinfoWrapper.lookupIp(ip);
      logIpInfo(ipInfo);
    } catch (err) {
      ipInfo = null;
    }

    let latitude, longitude, city, country;
    if (!ipInfo || !ipInfo.loc) {
      // Default to London, UK
      latitude = '51.5074';
      longitude = '-0.1278';
      city = 'London';
      country = 'GB';
    } else {
      [latitude, longitude] = ipInfo.loc.split(',');
      city = ipInfo.city || 'London';
      country = ipInfo.country || 'GB';
    }

    // Check if location exists in database, if not insert it
    let locationRecord = stmts.getLocationByCityCountry.get(city, country);

    if (!locationRecord) {
      const result = stmts.insertLocation.run(city, country, latitude, longitude);
      locationRecord = { id: result.lastInsertRowid, city_name: city, country, latitude, longitude };
    } else {
      // Update last accessed time
      stmts.updateLocationAccess.run(locationRecord.id);
    }

    return locationRecord;
  } catch (error) {
    console.error('Error getting location from IP:', error);
    // Default to London if there's an error
    const city = 'London';
    const country = 'GB';
    const latitude = '51.5074';
    const longitude = '-0.1278';

    let locationRecord = stmts.getLocationByCityCountry.get(city, country);

    if (!locationRecord) {
      const result = stmts.insertLocation.run(city, country, latitude, longitude);
      locationRecord = { id: result.lastInsertRowid, city_name: city, country, latitude, longitude };
    }

    return locationRecord;
  }
}

// Fetch weather data from Open-Meteo API
async function fetchWeatherData(latitude, longitude, days = 7) {
  try {
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude,
        longitude,
        daily: 'weathercode,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max',
        timezone: 'auto',
        forecast_days: days,
      },
    });
    
    return response.data;
  } catch (error) {
    console.error('Error fetching weather data:', error);
    throw new Error('Failed to fetch weather data from Open-Meteo API');
  }
}

// Store weather data in database
function storeWeatherData(locationId, mappedWeather) {
  try {
    for (const day of mappedWeather) {
      // Check if weather data for this location and date already exists
      const existingWeather = stmts.getWeatherByDate.get(locationId, day.date);
      
      if (!existingWeather) {
        stmts.insertWeather.run(
          locationId,
          day.date,
          day.weathercode,
          day.description,
          day.temperature_max,
          day.temperature_min,
          day.sunrise,
          day.sunset,
          day.uv_index_max
        );
      }
    }
  } catch (error) {
    console.error('Error storing weather data:', error);
  }
}

// Generate and store story for a specific day
async function generateAndStoreStory(locationId, weatherId, date, weatherData, previousStoryId = null) {
  try {
    // Check if we have a previous story to reference for continuity
    let previousStory = null;
    if (previousStoryId) {
      const prevStoryRecord = db.prepare('SELECT story FROM stories WHERE id = ?').get(previousStoryId);
      if (prevStoryRecord) {
        previousStory = prevStoryRecord.story;
      }
    }
    // Generate the prompt for Gemini
    const prompt = utils.generateDailyPrompt(weatherData, previousStory);
    // Retry logic for Gemini API
    let response, story, wordCount;
    const maxAttempts = 3;
    let attempt = 0;
    let lastError;
    while (attempt < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        story = response.text.trim();
        wordCount = utils.countWords(story);
        break;
      } catch (err) {
        lastError = err;
        if (err && err.status === 503) {
          await new Promise(res => setTimeout(res, 5000));
          attempt++;
        } else {
          throw err;
        }
      }
    }
    if (!story) {
      throw lastError || new Error('Failed to generate story after retries');
    }
    // Store the story in the database
    const result = stmts.insertStory.run(
      locationId,
      weatherId,
      date,
      story,
      previousStoryId,
      wordCount
    );
    return {
      id: result.lastInsertRowid,
      date,
      story,
      wordCount
    };
  } catch (error) {
    console.error('Error generating/storing story:', error);
    throw error;
  }
}

// Legacy endpoint - keep for backwards compatibility
app.get('/weather', async (req, res) => {
  try {
    // Get location info from IP
    const location = await getLocationFromIP(req);
    
    // Fetch weather data from API
    const weatherData = await fetchWeatherData(location.latitude, location.longitude);
    
    // Map weather data to include descriptions
    const mappedWeather = utils.mapWeatherData(weatherData);
    
    // Store weather data in database
    storeWeatherData(location.id, mappedWeather);
    
    // Generate weekly stories using the old approach for backwards compatibility
    const prompt = `Given the following weekly weather forecast, write a delightful, completely irrelevant story for each day.
For each day, use all the mapped weather details: the human-readable weather description, temperature, sunrise, sunset, UV index, and any unusual or notable weather events.
Make sure the story references these details in a creative way, and if anything stands out (like freak weather, high UV, or odd sunrise/sunset times), make it a key part of the story.
Return the response as a single JSON object, where each key is the date and the value is an object containing the weather data and the story.
The keys of the JSON object should be the dates from the weather data.
For each date, the value should be an object with a single key "story".
Do not include any other text or explanation in your response, only the JSON object.

Weather data:
${JSON.stringify(weatherData.daily, null, 2)}`;

    // Retry logic for Gemini API
    let response, text;
    const maxAttempts = 3;
    let attempt = 0;
    let lastError;
    while (attempt < maxAttempts) {
      try {
        response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt
        });
        text = response.text.trim();
        break;
      } catch (err) {
        lastError = err;
        if (err && err.status === 503) {
          await new Promise(res => setTimeout(res, 5000));
          attempt++;
        } else {
          throw err;
        }
      }
    }
    if (!text) {
      throw lastError || new Error('Failed to generate stories after retries');
    }
    // Clean up the response to ensure it's valid JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const stories = JSON.parse(text);
    
    // Format response in the legacy format
    const combinedData = mappedWeather.map(day => {
      return {
        date: day.date,
        weather: {
          weathercode: day.weathercode,
          description: day.description,
          temperature_2m_max: day.temperature_max,
          temperature_2m_min: day.temperature_min,
          sunrise: day.sunrise,
          sunset: day.sunset,
          uv_index_max: day.uv_index_max,
        },
        story: stories[day.date] ? stories[day.date].story : "No story generated for this day.",
      };
    });
    
    res.json(combinedData);
  } catch (error) {
    console.error('Error in /weather endpoint:', error);
    res.status(500).json({ error: 'Failed to fetch weather data or generate stories.' });
  }
});

// New endpoint for daily weather story
app.get('/weather/daily', async (req, res) => {
  try {
    // Get location info from IP
    const location = await getLocationFromIP(req);
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    // Check if we already have a story for today
    let story = stmts.getStoryByDate.get(location.id, today);
    
    if (story) {
      // Return the existing story
      return res.json({
        date: story.date,
        story: story.story,
        weather: {
          description: story.description,
          temperature_max: story.temperature_max,
          temperature_min: story.temperature_min,
          sunrise: story.sunrise,
          sunset: story.sunset,
          uv_index_max: story.uv_index_max
        }
      });
    }
    
    // Fetch today's weather data
    const weatherData = await fetchWeatherData(location.latitude, location.longitude, 1);
    const mappedWeather = utils.mapWeatherData(weatherData)[0]; // Get just today's data
    
    // Store the weather data
    storeWeatherData(location.id, [mappedWeather]);
    
    // Get the weather ID from the database
    const weatherRecord = stmts.getWeatherByDate.get(location.id, today);
    
    // Get the latest story for continuity
    const latestStory = stmts.getLatestStory.get(location.id);
    
    // Generate and store the new story
    const newStory = await generateAndStoreStory(
      location.id,
      weatherRecord.id,
      today,
      mappedWeather,
      latestStory ? latestStory.id : null
    );
    
    // Return the new story
    res.json({
      date: today,
      story: newStory.story,
      weather: mappedWeather
    });
    
  } catch (error) {
    console.error('Error in /weather/daily endpoint:', error);
    res.status(500).json({ error: 'Failed to generate daily weather story.' });
  }
});

// Endpoint for weekly weather stories
app.get('/weather/weekly', async (req, res) => {
  try {
    // Get location info from IP
    const location = await getLocationFromIP(req);
    
    // Fetch 7-day weather forecast
    const weatherData = await fetchWeatherData(location.latitude, location.longitude);
  const mappedWeatherRaw = utils.mapWeatherData(weatherData);
  // Filter to only today and future dates
  const todayStr = new Date().toISOString().split('T')[0];
  const mappedWeather = mappedWeatherRaw.filter(day => day.date >= todayStr);
    
    // Store weather data in database
    storeWeatherData(location.id, mappedWeather);
    
    // Dates for the week
    const startDate = mappedWeather[0].date;
    const endDate = mappedWeather[mappedWeather.length - 1].date;
    
    // Check if we already have stories for all days this week
    const existingStories = stmts.getWeeklyStories.all(location.id, startDate, endDate);
    
    // If we have all 7 stories for the week, return those
    if (existingStories.length === 7) {
      // Attach location info to weather object for frontend
      return res.json(existingStories.map(story => ({
        date: story.date,
        story: story.story,
        weather: {
          description: story.description,
          temperature_max: story.temperature_max,
          temperature_min: story.temperature_min,
          sunrise: story.sunrise,
          sunset: story.sunset,
          uv_index_max: story.uv_index_max,
          city_name: location.city_name,
          country: location.country
        }
      })));
    }

    // Generate weekly stories with continuity
    const weeklyPrompt = utils.generateWeeklyPrompt(mappedWeather);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: weeklyPrompt
    });
    let text = response.text.trim();

    // Clean up the response to ensure it's valid JSON
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    let stories;
    try {
      stories = JSON.parse(text);
    } catch (e) {
      console.error('Error parsing Gemini response:', e);
      // Try to extract JSON from the text if it's wrapped in other text
      const jsonMatch = text.match(/{[\s\S]*}/);
      if (jsonMatch) {
        stories = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Failed to parse stories from Gemini response');
      }
    }
    
    // Store each story in the database
    const result = [];
    let previousStoryId = null;
    
    for (const day of mappedWeather) {
      if (stories[day.date] && stories[day.date].story) {
        const weatherRecord = stmts.getWeatherByDate.get(location.id, day.date);
        
        if (weatherRecord) {
          const story = stories[day.date].story;
          const wordCount = utils.countWords(story);
          
          // Insert the story with reference to previous day's story
          const storyResult = stmts.insertStory.run(
            location.id,
            weatherRecord.id,
            day.date,
            story,
            previousStoryId,
            wordCount
          );
          
          // Update previousStoryId for the next iteration
          previousStoryId = storyResult.lastInsertRowid;
          
          result.push({
            date: day.date,
            story: story,
            weather: {
              description: weatherRecord.description,
              temperature_max: weatherRecord.temperature_max,
              temperature_min: weatherRecord.temperature_min,
              sunrise: weatherRecord.sunrise,
              sunset: weatherRecord.sunset,
              uv_index_max: weatherRecord.uv_index_max,
              city_name: location.city_name,
              country: location.country
            }
          });
        }
      }
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Error in /weather/weekly endpoint:', error);
    res.status(500).json({ error: 'Failed to generate weekly weather stories.' });
  }
});

// Get a story sequence starting from a specific story ID
app.get('/story/sequence/:storyId', async (req, res) => {
  try {
    const { storyId } = req.params;
    
    // Validate storyId is a number
    if (!storyId || isNaN(parseInt(storyId))) {
      return res.status(400).json({ error: 'Invalid story ID' });
    }
    
    // Get the story chain
    const storyChain = stmts.getStorySequence.all(storyId);
    
    if (!storyChain || storyChain.length === 0) {
      return res.status(404).json({ error: 'Story not found' });
    }
    
    // Format and return the story chain
    res.json(storyChain.map(story => ({
      id: story.id,
      date: story.date,
      story: story.story,
      depth: story.depth
    })));
    
  } catch (error) {
    console.error('Error in /story/sequence endpoint:', error);
    res.status(500).json({ error: 'Failed to retrieve story sequence' });
  }
});

// Serve React frontend in production
app.get(/^\/(?!api|weather|story).*/, (req, res) => {
  res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server listening at http://localhost:${port}`);
  console.log(`Database initialized at ${path.join(__dirname, 'data', 'weather_stories.db')}`);
});
