// Utility functions for weather data and story generation
const weatherCodeMap = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Drizzle: Light',
  53: 'Drizzle: Moderate',
  55: 'Drizzle: Dense',
  56: 'Freezing Drizzle: Light',
  57: 'Freezing Drizzle: Dense',
  61: 'Rain: Slight',
  63: 'Rain: Moderate',
  65: 'Rain: Heavy',
  66: 'Freezing Rain: Light',
  67: 'Freezing Rain: Heavy',
  71: 'Snow fall: Slight',
  73: 'Snow fall: Moderate',
  75: 'Snow fall: Heavy',
  77: 'Snow grains',
  80: 'Rain showers: Slight',
  81: 'Rain showers: Moderate',
  82: 'Rain showers: Violent',
  85: 'Snow showers: Slight',
  86: 'Snow showers: Heavy',
  95: 'Thunderstorm: Slight or moderate',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

// Get weather description from code
function getWeatherDescription(code) {
  let description = weatherCodeMap[code];
  
  // Handle grouped codes
  if (!description) {
    if ([1,2,3].includes(code)) description = 'Mainly clear, partly cloudy, and overcast';
    else if ([45,48].includes(code)) description = 'Fog and depositing rime fog';
    else if ([51,53,55].includes(code)) description = 'Drizzle: Light, moderate, and dense intensity';
    else if ([56,57].includes(code)) description = 'Freezing Drizzle: Light and dense intensity';
    else if ([61,63,65].includes(code)) description = 'Rain: Slight, moderate and heavy intensity';
    else if ([66,67].includes(code)) description = 'Freezing Rain: Light and heavy intensity';
    else if ([71,73,75].includes(code)) description = 'Snow fall: Slight, moderate, and heavy intensity';
    else if ([80,81,82].includes(code)) description = 'Rain showers: Slight, moderate, and violent';
    else if ([85,86].includes(code)) description = 'Snow showers slight and heavy';
    else if ([95].includes(code)) description = 'Thunderstorm: Slight or moderate';
    else if ([96,99].includes(code)) description = 'Thunderstorm with slight and heavy hail';
    else description = 'Unknown';
  }
  
  return description;
}

// Map weather data to include descriptions
function mapWeatherData(weatherData) {
  return weatherData.daily.time.map((date, index) => {
    const code = weatherData.daily.weathercode[index];
    return {
      date,
      weathercode: code,
      description: getWeatherDescription(code),
      temperature_max: weatherData.daily.temperature_2m_max[index],
      temperature_min: weatherData.daily.temperature_2m_min[index],
      sunrise: weatherData.daily.sunrise[index],
      sunset: weatherData.daily.sunset[index],
      uv_index_max: weatherData.daily.uv_index_max[index],
    };
  });
}

// Check if weather has changed significantly (3-4 degrees or weather type change)
function hasWeatherChangedSignificantly(oldWeather, newWeather) {
  // If weather code has changed, that's significant
  if (oldWeather.weathercode !== newWeather.weathercode) {
    return true;
  }
  
  // If temperature has changed by more than 3 degrees
  const tempMaxDiff = Math.abs(oldWeather.temperature_max - newWeather.temperature_max);
  const tempMinDiff = Math.abs(oldWeather.temperature_min - newWeather.temperature_min);
  
  if (tempMaxDiff > 3 || tempMinDiff > 3) {
    return true;
  }
  
  return false;
}

// Count words in a string
function countWords(str) {
  return str.trim().split(/\s+/).length;
}

// Generate a prompt for continuing the story
function generateDailyPrompt(weather, previousStory = null) {
  let prompt = `Write a delightful, creative story of EXACTLY 500 words for a specific day's weather.
The story should have an interesting beginning, middle, and end, with a subtle plot arc and character development.
Subtly weave in the following weather details without explicitly stating them as weather data:

- Weather: ${weather.description}
- High temperature: ${weather.temperature_max}°C
- Low temperature: ${weather.temperature_min}°C
- Sunrise: ${weather.sunrise}
- Sunset: ${weather.sunset}
- UV Index: ${weather.uv_index_max}

Make the story feel literary and imaginative, with a subtle wit. Don't directly mention that this is weather data.`;

  if (previousStory) {
    prompt += `

IMPORTANT: Continue the story and world-building from the previous day's narrative:
"${previousStory}"

Maintain consistency with characters and settings from this previous narrative, but advance the story with new developments or perspectives that relate to today's weather conditions.`;
  }

  prompt += `

Return ONLY the story text, exactly 500 words. No introductions, explanations, or JSON formatting.`;

  return prompt;
}

// Generate a prompt for a full week of stories
function generateWeeklyPrompt(weeklyWeather) {
  const prompt = `Create a continuous 7-day story where each day is about 500 words (3,500 words total).
The narrative should flow from day to day, developing characters and a subtle plot that relates to the changing weather.
Each day should have its own mini-arc while contributing to the overall weekly narrative.

For each day, subtly incorporate the weather details without explicitly stating them:

${weeklyWeather.map((day, index) => `
DAY ${index + 1} (${day.date}):
- Weather: ${day.description}
- Temperature range: ${day.temperature_min}°C to ${day.temperature_max}°C
- Sunrise: ${day.sunrise}, Sunset: ${day.sunset}
- UV Index: ${day.uv_index_max}`).join('\n')}

Return the story as a JSON object where each key is the date and each value is an object with a single key "story" containing the 500-word narrative for that day:

{
  "2025-09-01": { "story": "Day 1 narrative text..." },
  "2025-09-02": { "story": "Day 2 narrative text..." },
  ...and so on
}

Ensure each day's story is EXACTLY 500 words, literary in style, with imaginative details and subtle humor.`;

  return prompt;
}

module.exports = {
  weatherCodeMap,
  getWeatherDescription,
  mapWeatherData,
  hasWeatherChangedSignificantly,
  countWords,
  generateDailyPrompt,
  generateWeeklyPrompt
};
