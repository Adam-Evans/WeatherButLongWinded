import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        const response = await fetch('http://localhost:3001/weather');
        if (!response.ok) {
          throw new Error('Failed to fetch weather data');
        }
        const data = await response.json();
        setWeatherData(data);
      } catch (error) {
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };

    fetchWeatherData();
  }, []);

  if (loading) {
    return <div className="App"><h1>Loading weather...</h1></div>;
  }

  if (error) {
    return <div className="App"><h1>Error: {error}</h1></div>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Your Weekly Weather Story</h1>
      </header>
      <main>
        {weatherData && weatherData.map((day, index) => (
          <div key={index} className="weather-card">
            <h2>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
            <div className="weather-info">
              <p><strong>High:</strong> {day.weather.temperature_2m_max}°C</p>
              <p><strong>Low:</strong> {day.weather.temperature_2m_min}°C</p>
              <p><strong>Sunrise:</strong> {new Date(day.weather.sunrise).toLocaleTimeString()}</p>
              <p><strong>Sunset:</strong> {new Date(day.weather.sunset).toLocaleTimeString()}</p>
              <p><strong>UV Index:</strong> {day.weather.uv_index_max}</p>
              <p><strong>Weather:</strong> {getWeatherDescription(day.weather.weathercode)}</p>
            </div>
            <div className="story">
              <h3>A completely irrelevant story...</h3>
              <p>{day.story}</p>
            </div>
          </div>
        ))}
      </main>
    </div>
  );
}

function getWeatherDescription(code) {
  const descriptions = {
    0: 'Clear sky',
    1: 'Mainly clear',
    2: 'Partly cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Depositing rime fog',
    51: 'Drizzle: Light intensity',
    53: 'Drizzle: Moderate intensity',
    55: 'Drizzle: Dense intensity',
    56: 'Freezing Drizzle: Light intensity',
    57: 'Freezing Drizzle: Dense intensity',
    61: 'Rain: Slight intensity',
    63: 'Rain: Moderate intensity',
    65: 'Rain: Heavy intensity',
    66: 'Freezing Rain: Light intensity',
    67: 'Freezing Rain: Heavy intensity',
    71: 'Snow fall: Slight intensity',
    73: 'Snow fall: Moderate intensity',
    75: 'Snow fall: Heavy intensity',
    77: 'Snow grains',
    80: 'Rain showers: Slight intensity',
    81: 'Rain showers: Moderate intensity',
    82: 'Rain showers: Violent intensity',
    85: 'Snow showers: Slight intensity',
    86: 'Snow showers: Heavy intensity',
    95: 'Thunderstorm: Slight or moderate',
    96: 'Thunderstorm with slight hail',
    99: 'Thunderstorm with heavy hail',
  };
  return descriptions[code] || 'Unknown weather';
}

export default App;
