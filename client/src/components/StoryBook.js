import React, { useState, useRef, useEffect } from 'react';
import './StoryBook.css';

const DEBUG_MODE = true; // Set to false to disable debug logs

const StoryBook = ({ stories }) => {
  // Always start on cover page (index 0)
  const [currentPage, setCurrentPage] = useState(0);
  const [pageTurn, setPageTurn] = useState(false);
  const [flipDirection, setFlipDirection] = useState('right'); // 'right' for next, 'left' for prev
  const bookpageRef = useRef(null);
  const prevPageRef = useRef(currentPage);


  // Scroll continuity: on page load, scroll to bottom if coming from previous page, otherwise scroll to top
  useEffect(() => {
    // Use requestAnimationFrame to ensure scroll happens after render
    requestAnimationFrame(() => {
      if (bookpageRef.current) {
        bookpageRef.current.scrollTop = 0;
        bookpageRef.current.scrollIntoView({ behavior: 'instant', block: 'start' });
      }
      prevPageRef.current = currentPage;
    });
  }, [currentPage]);

  // Debug: log all story dates and objects if DEBUG_MODE is on
  useEffect(() => {
    if (DEBUG_MODE && stories && stories.length > 0) {
      console.log('DEBUG: StoryBook received stories:', stories);
      console.log('DEBUG: Story dates:', stories.map(s => s.date));
    }
  }, [stories]);

  // Try to get location from first story object if available
  let locationDisplay = '';
  if (stories && stories.length > 0 && stories[0].weather && stories[0].weather.city_name) {
    locationDisplay = `${stories[0].weather.city_name}, ${stories[0].weather.country || ''}`;
  } else if (stories && stories.length > 0 && stories[0].weather && stories[0].weather.city) {
    locationDisplay = `${stories[0].weather.city}, ${stories[0].weather.country || ''}`;
  }

  if (DEBUG_MODE) {
    console.log('DEBUG: Rendering StoryBook, stories:', stories);
  }
  if (!stories || stories.length === 0) {
    return (
      <div className="storybook loading">
        <div className="book-cover">
          <h1>Weather Tales</h1>
          <p>Loading your weather stories...</p>
        </div>
      </div>
    );
  }

  const handlePrevPage = () => {
    if (currentPage === 0 || pageTurn) return;
    setFlipDirection('left');
    setPageTurn(true);
    setTimeout(() => {
      setCurrentPage(prev => Math.max(0, prev - 1));
      setPageTurn(false);
    }, 1000); // match CSS duration
  };

  const handleNextPage = () => {
    // Allow navigation up to the last story (currentPage === stories.length)
    if (currentPage === stories.length || pageTurn) return;
    setFlipDirection('right');
    setPageTurn(true);
    setTimeout(() => {
      setCurrentPage(prev => Math.min(stories.length, prev + 1));
      setPageTurn(false);
    }, 1000); // match CSS duration
  };



  // Map currentPage to correct story index: page 1 = stories[0], page 2 = stories[1], etc.
  const currentStory = currentPage > 0 ? stories[currentPage - 1] : null;
  const formattedDate = currentStory
    ? new Date(currentStory.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      })
    : '';

  // Split the story into paragraphs for better readability
  const paragraphs = currentStory && currentStory.story
    ? currentStory.story.split('\n').filter(p => p.trim() !== '')
    : [];

  return (
    <div className="storybook-container">
  <div className="storybook">
  {currentPage === 0 ? (
          <div className="book-cover">
            {locationDisplay && (
              <div style={{
                position: 'absolute',
                top: '1.5rem',
                left: '1.5rem',
                color: '#fff',
                fontSize: '1.25rem',
                fontWeight: 'bold',
                textShadow: '0 2px 8px #5d4037, 0 0 2px #333',
                background: 'rgba(93,64,55,0.5)',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
                zIndex: 10
              }}>
                <span role="img" aria-label="location">📍</span> {locationDisplay}
              </div>
            )}
            <h1>Weather Tales</h1>
            <p className="subtitle">A collection of daily weather stories</p>
            <div className="cover-decoration"></div>
            <p className="start-reading">Click to start reading</p>
          </div>
        ) : (
          currentStory && (
            <div ref={bookpageRef} className={`book-page ${pageTurn ? (flipDirection === 'left' ? ' page-turn-left' : ' page-turn') : ''}`}> 
              <div className="page-header">
                <h2>{formattedDate}</h2>
                <div className="weather-info">
                  <p>{currentStory.weather.description}</p>
                  <p>{currentStory.weather.temperature_min}°C - {currentStory.weather.temperature_max}°C</p>
                </div>
              </div>
              <div className="story-content">
                {paragraphs.map((paragraph, idx) => (
                  <p key={idx}>{paragraph}</p>
                ))}
              </div>
              <div className="page-number">{currentPage}</div>
            </div>
          )
        )}
      </div>

      <div className="book-controls">
        <button 
          onClick={handlePrevPage} 
          disabled={currentPage === 0}
          className={currentPage === 0 ? 'disabled' : ''}
        >
          Previous Page
        </button>
        <span className="page-indicator">
          {currentPage === 0 ? 'Cover' : `Page ${currentPage} of ${stories.length}`}
        </span>
        <button 
          onClick={handleNextPage} 
          disabled={currentPage === stories.length}
          className={currentPage === stories.length ? 'disabled' : ''}
        >
          Next Page
        </button>
      </div>
    </div>
  );
};

export default StoryBook;
