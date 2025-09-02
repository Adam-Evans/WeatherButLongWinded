import React, { useState, useEffect } from 'react';
import './App.css';
import StoryBook from './components/StoryBook';

function App() {
  const [weatherData, setWeatherData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('book'); // 'book' or 'list'

  useEffect(() => {
    const fetchWeatherData = async () => {
      try {
        // Use the new weekly endpoint
        const response = await fetch('/weather/weekly');
        if (!response.ok) {
          throw new Error('Failed to fetch weather data');
        }
        const data = await response.json();
        // Sort by date ascending so today is first
        const todayStr = new Date().toISOString().split('T')[0];
        const sorted = Array.isArray(data)
          ? [...data]
              .sort((a, b) => new Date(a.date) - new Date(b.date))
              .filter(day => day.date >= todayStr)
          : data;
        setWeatherData(sorted);
      } catch (error) {
        setError(error.message);
        
        // Fallback to the old endpoint if the new one fails
        try {
          const legacyResponse = await fetch('/weather');
          if (legacyResponse.ok) {
            const legacyData = await legacyResponse.json();
            setWeatherData(legacyData);
            setError(null);
          }
        } catch (legacyError) {
          console.error('Legacy endpoint also failed:', legacyError);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchWeatherData();
  }, []);

  const toggleViewMode = () => {
    setViewMode(prev => prev === 'book' ? 'list' : 'book');
  };

  if (loading) {
    return (
      <div className="App loading">
        <div className="loading-spinner"></div>
        <h1>Loading your weather stories...</h1>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App error">
        <h1>Error</h1>
        <p>{error}</p>
        <button onClick={() => window.location.reload()}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>Weather But Long-Winded</h1>
        <p>A literary journey through the weather forecast</p>
        <button className="view-toggle" onClick={toggleViewMode}>
          Switch to {viewMode === 'book' ? 'List' : 'Book'} View
        </button>
      </header>
      
      <main>
        {viewMode === 'book' ? (
          <StoryBook stories={weatherData} />
        ) : (
          <div className="list-view">
            {weatherData && weatherData.map((day, index) => (
              <div key={index} className="weather-card">
                <h2>{new Date(day.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h2>
                <div className="weather-info">
                  <p><strong>Weather:</strong> {day.weather.description}</p>
                  <p><strong>Temperature:</strong> {day.weather.temperature_min}°C to {day.weather.temperature_max}°C</p>
                  <p><strong>Sunrise:</strong> {new Date(day.weather.sunrise).toLocaleTimeString()}</p>
                  <p><strong>Sunset:</strong> {new Date(day.weather.sunset).toLocaleTimeString()}</p>
                  <p><strong>UV Index:</strong> {day.weather.uv_index_max}</p>
                </div>
                <div className="story">
                  <h3>Today's Weather Tale</h3>
                  <div className="story-content">
                    {day.story.split('\n').map((paragraph, i) => (
                      paragraph.trim() ? <p key={i}>{paragraph}</p> : null
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      <footer>
        <p>Created with weather data from Open-Meteo and stories from Google Gemini</p>
      </footer>
    </div>
  );
}

export default App;
