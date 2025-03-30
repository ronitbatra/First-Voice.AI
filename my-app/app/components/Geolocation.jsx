'use client';

import { useState, useEffect } from 'react';

const Geolocation = ({ onLocationUpdate }) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [requested, setRequested] = useState(false);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      console.error('Geolocation is not supported by your browser');
      setError('Geolocation is not supported by your browser');
      if (onLocationUpdate) {
        onLocationUpdate(null);
      }
      return;
    }

    setRequested(true);
    
    // Set a timeout to handle case where user doesn't respond to permission prompt
    const timeoutId = setTimeout(() => {
      if (!location && !error) {
        console.warn('Geolocation request timed out');
        if (onLocationUpdate) {
          onLocationUpdate(null); // Send null if timed out
        }
      }
    }, 10000); // 10 second timeout
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const locationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        
        setLocation(locationData);
        clearTimeout(timeoutId);
        
        // Pass location up to parent component
        if (onLocationUpdate) {
          onLocationUpdate(locationData);
        }
      },
      (error) => {
        console.error('Geolocation error:', error.message);
        setError(`Unable to retrieve your location: ${error.message}`);
        clearTimeout(timeoutId);
        
        // If there's an error, pass null to the parent to indicate location access failed
        if (onLocationUpdate) {
          onLocationUpdate(null);
        }
      },
      { 
        enableHighAccuracy: false, // Lower accuracy is fine for this use case
        timeout: 8000, // 8 second timeout
        maximumAge: 0 // Want fresh position 
      }
    );
  };

  useEffect(() => {
    // Request location immediately when component mounts
    requestLocation();
    
    // Cleanup function to prevent memory leaks
    return () => {
      // Any cleanup code if needed
    };
  }, []);

  return null; // No UI as requested
};

export default Geolocation; 