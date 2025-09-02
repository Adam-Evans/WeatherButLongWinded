// Database setup and schema for WeatherButLongWinded
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Ensure the data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

// Connect to SQLite database
const dbPath = path.join(dataDir, 'weather_stories.db');
const db = new Database(dbPath);

// Initialize database schema
function initializeDatabase() {
  // Create locations table
  db.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_name TEXT NOT NULL,
      country TEXT NOT NULL,
      latitude TEXT,
      longitude TEXT,
      last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(city_name, country)
    )
  `);

  // Create weather_data table
  db.exec(`
    CREATE TABLE IF NOT EXISTS weather_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      weathercode INTEGER NOT NULL,
      description TEXT NOT NULL,
      temperature_max REAL NOT NULL,
      temperature_min REAL NOT NULL,
      sunrise TEXT NOT NULL,
      sunset TEXT NOT NULL,
      uv_index_max REAL NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES locations(id),
      UNIQUE(location_id, date)
    )
  `);

  // Create stories table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location_id INTEGER NOT NULL,
      weather_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      story TEXT NOT NULL,
      previous_story_id INTEGER,
      word_count INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (location_id) REFERENCES locations(id),
      FOREIGN KEY (weather_id) REFERENCES weather_data(id),
      FOREIGN KEY (previous_story_id) REFERENCES stories(id),
      UNIQUE(location_id, date)
    )
  `);

  console.log('Database schema initialized successfully');
}

// Initialize the database
initializeDatabase();

// Prepared statements
const stmts = {
  // Location queries
  getLocationByCityCountry: db.prepare('SELECT * FROM locations WHERE city_name = ? AND country = ? LIMIT 1'),
  insertLocation: db.prepare('INSERT INTO locations (city_name, country, latitude, longitude) VALUES (?, ?, ?, ?)'),
  updateLocationAccess: db.prepare('UPDATE locations SET last_accessed = CURRENT_TIMESTAMP WHERE id = ?'),
  
  // Weather queries
  getWeatherByDate: db.prepare('SELECT * FROM weather_data WHERE location_id = ? AND date = ? LIMIT 1'),
  insertWeather: db.prepare('INSERT INTO weather_data (location_id, date, weathercode, description, temperature_max, temperature_min, sunrise, sunset, uv_index_max) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  getRecentWeather: db.prepare('SELECT * FROM weather_data WHERE location_id = ? ORDER BY date DESC LIMIT ?'),
  
  // Story queries
  getStoryByDate: db.prepare('SELECT s.*, w.* FROM stories s JOIN weather_data w ON s.weather_id = w.id WHERE s.location_id = ? AND s.date = ? LIMIT 1'),
  insertStory: db.prepare('INSERT INTO stories (location_id, weather_id, date, story, previous_story_id, word_count) VALUES (?, ?, ?, ?, ?, ?)'),
  getLatestStory: db.prepare('SELECT * FROM stories WHERE location_id = ? ORDER BY date DESC LIMIT 1'),
  getWeeklyStories: db.prepare(`
    SELECT s.*, w.* FROM stories s 
    JOIN weather_data w ON s.weather_id = w.id 
    WHERE s.location_id = ? AND s.date >= ? AND s.date <= ?
    ORDER BY s.date ASC
  `),
  getStorySequence: db.prepare(`
    WITH RECURSIVE story_chain(id, date, story, prev_id, depth) AS (
      SELECT id, date, story, previous_story_id, 0
      FROM stories
      WHERE id = ?
      UNION ALL
      SELECT s.id, s.date, s.story, s.previous_story_id, sc.depth + 1
      FROM stories s
      JOIN story_chain sc ON s.id = sc.prev_id
      WHERE sc.depth < 7
    )
    SELECT * FROM story_chain
    ORDER BY depth DESC
  `),
};

module.exports = { db, stmts };
