# Weather But Long-Winded

A literary journey through the weather forecast, turning daily weather data into 500-word creative stories with subtle narrative continuity.

## Project Overview

Weather But Long-Winded uses AI to transform ordinary weather forecasts into engaging short stories that subtly incorporate weather details while maintaining continuity between daily narratives. The application presents these stories in a book-like interface, creating a literary experience from meteorological data.

## Features

- **Daily Weather Stories**: Each day's weather is transformed into a 500-word creative story
- **Story Continuity**: Stories maintain character and plot continuity from day to day
- **Book-Like Interface**: Read stories in an elegant book-style UI
- **Weather Tracking**: Stories subtly incorporate actual weather details without explicitly stating them
- **Story Persistence**: SQLite database stores stories, locations, and weather data
- **Weather-Aware Regeneration**: Stories are regenerated when weather changes significantly

## Technology Stack

### Backend

- **Express.js**: Server framework
- **SQLite (better-sqlite3)**: Database for story persistence
- **Google Generative AI (Gemini)**: Story generation
- **IPinfo**: Geolocation service
- **Open-Meteo API**: Weather forecast data

### Frontend

- **React**: UI framework
- **CSS**: Book-style layout and responsive design
- **Custom StoryBook component**: Book interface for reading stories

## Setup Instructions

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Environment Variables

Create a `.env` file in the server directory with:

```env
IPINFO_TOKEN=your_ipinfo_token
GEMINI_API_KEY=your_gemini_api_key
```

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/weather-but-longwinded.git
cd weather-but-longwinded
```

1. Install server dependencies:

```bash
cd server
npm install
```

1. Install client dependencies:

```bash
cd ../client
npm install
```

### Running the Application

1. Start the server:

```bash
cd server
npm start
```

1. In a separate terminal, start the client:

```bash
cd client
npm start
```

1. Open [http://localhost:3000](http://localhost:3000) in your browser

## How It Works

1. The server determines user location from IP address
2. Weather data is fetched from Open-Meteo API for the user's location
3. Weather data is processed and stored in SQLite database
4. Gemini AI generates a 500-word story based on weather conditions
5. Stories maintain continuity with previous days' narratives
6. The frontend displays stories in a book-like interface

## API Endpoints

- `GET /weather`: Legacy endpoint for backward compatibility
- `GET /weather/daily`: Get today's weather story
- `GET /weather/weekly`: Get a week of connected weather stories
- `GET /story/sequence/:storyId`: Get a sequence of connected stories

## Database Schema

The application uses SQLite with the following tables:

- `locations`: Stores location information
- `weather_data`: Stores weather forecasts
- `stories`: Stores generated stories with references to locations, weather data, and previous stories

## Future Enhancements

- Story illustrations based on weather conditions
- User accounts to save favorite stories
- Expanded narrative options (mystery, romance, sci-fi)
- Social sharing features
- Historical weather stories
- Location customization

## License

[MIT License](LICENSE)
