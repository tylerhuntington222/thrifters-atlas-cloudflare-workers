import "./styles.css";

import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { createRoot } from "react-dom/client";
import emailjs from '@emailjs/browser'; // Import EmailJS
import createGlobe from "cobe";
import usePartySocket from "partysocket/react";
import ReactCountryFlag from "react-country-flag";
import AsyncSelect from 'react-select/async'; // Import AsyncSelect
import debounce from 'lodash.debounce'; // Import debounce
import { Globe, ArrowRight, Phone, CircleArrowRight } from 'lucide-react'; // Import Globe, ArrowRight, Phone icons
import topCities from '../../world-cities-top-100.json'; // Import the city data
import allStoresData from '../../slim_gme_data_by_city.json'; // Import the slim store data
import citiesData from '../../cities-top-1000.json'; // Import the new city data for markers
// The type of messages we'll be receiving from the server
import type { OutgoingMessage } from "../shared";
import type { BraveLocalSearchResult } from "../shared"; // Import the search result type
import type { LegacyRef, FunctionComponent } from "react"; // Added FunctionComponent
import { COUNTRIES } from './mockData'; // Import COUNTRIES from the new file

// --- Types ---
interface ThriftStore {
  place_id: string | null;
  name: string | null;
  rating: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  featured_image: string | null;
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  } | null;
}

interface EmailJsConfig {
  emailJsPublicKey: string;
  emailJsServiceId: string;
  emailJsTemplateId: string;
}

// --- Helper Functions ---
const generateSvgPlaceholder = (text: string | null): string => {
  const initial = text?.trim().split(' ')[0]?.charAt(0)?.toUpperCase() || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200">
    <rect width="100%" height="100%" fill="#cccccc"/>
    <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="90" fill="#808080">${initial}</text>
  </svg>`;
  return `data:image/svg+xml;base64,${window.btoa(svg)}`;
};

const formatPhoneNumber = (phone: string | null): string | null => {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `(${digits.substring(0, 3)}) ${digits.substring(3, 6)}-${digits.substring(6)}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
     return `+1 (${digits.substring(1, 4)}) ${digits.substring(4, 7)}-${digits.substring(7)}`;
  }
  return phone;
};

// --- Components ---
interface ThriftStoreCardProps {
  store: ThriftStore;
  userCoords: { lat: number; lon: number } | null;
}

const ThriftStoreCard: FunctionComponent<ThriftStoreCardProps> = ({ store, userCoords }) => {
  const imageUrl = store.featured_image || generateSvgPlaceholder(store.name);
  const formattedPhone = formatPhoneNumber(store.phone);

  return (
    <div className="thrift-store-card">
      <img
        src={imageUrl}
        alt={store.name || 'Thrift Store'}
        className="thrift-store-image"
        loading="lazy"
        onError={(e) => {
          const target = e.target as HTMLImageElement;
          target.onerror = null;
          target.src = generateSvgPlaceholder(store.name);
        }}
      />
      <div className="thrift-store-details">
        <div className="thrift-store-header">
          <h4 className="thrift-store-name">{store.name || 'Unknown Store'}</h4>
          {typeof store.rating === 'number' && (
            <div className="thrift-store-rating">
              <svg xmlns="http://www.w3.org/2000/svg" className="star-icon" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span>{store.rating.toFixed(1)}</span>
            </div>
          )}
        </div>
        {store.address && <div className="thrift-store-address-text">{store.address}</div>}
        {formattedPhone && store.phone && (
          <a href={`tel:${store.phone}`} className="phone-badge-link" title={`Call ${formattedPhone}`}>
            <div className="phone-badge">
              <Phone size={14} className="inline-icon" /> Phone: {formattedPhone}
            </div>
          </a>
        )}
        <div className="thrift-store-actions">
          {store.website && (
            <a href={store.website.startsWith('http') ? store.website : `http://${store.website}`} target="_blank" rel="noopener noreferrer" className="action-button simplified-button" title={store.website}>
              <Globe size={16} className="button-icon" /> Website
            </a>
          )}
          {store.address && userCoords && (
             <a href={`https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lon}&destination=${encodeURIComponent(store.address)}&travelmode=driving`} target="_blank" rel="noopener noreferrer" className="action-button simplified-button" title="Get Driving Directions">
              Directions <CircleArrowRight size={16} className="button-icon" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

interface CityCardProps {
  city: string;
  country: string;
}

const CityCard: FunctionComponent<CityCardProps> = ({ city, country }) => {
  const countryData = COUNTRIES.find(c => c.name.toLowerCase() === country.toLowerCase());
  const countryCode = countryData?.code;

  const handleCardClick = () => {
    const locationName = `${city}, ${country}`;
    const searchQuery = `thrift, vintage, consignment shops in ${locationName}`;
    const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="city-card listing-item" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      {countryCode && (
        <ReactCountryFlag countryCode={countryCode} svg style={{ width: '1.2em', height: '1.2em', marginRight: '8px', verticalAlign: 'middle' }} title={country} />
      )}
      <span className="city-name">{city}</span>
      <span className="country-name">, {country === 'United States' ? 'U.S.A.' : country}</span>
    </div>
  );
};

interface NominatimResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>();
  const [counter, setCounter] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalEmail, setModalEmail] = useState('');
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [selectedLocation, setSelectedLocation] = useState<{ label: string; value: any } | null>(null);
  const carouselTrackRef = useRef<HTMLDivElement>(null);
  const [userCity, setUserCity] = useState<string | null>(null);
  const [userState, setUserState] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [nearbyStores, setNearbyStores] = useState<ThriftStore[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState<boolean>(true);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [emailJsConfig, setEmailJsConfig] = useState<EmailJsConfig | null>(null); // State for EmailJS config
  const [configError, setConfigError] = useState<string | null>(null); // State for config loading error

  const positions = useRef<Map<string, { location: [number, number]; size: number; city?: string; country?: string; }>>(new Map());

  // --- Fetch EmailJS Config ---
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const response = await fetch('/api/config'); // Fetch from the new endpoint
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const configData = await response.json();
        if (!configData.emailJsPublicKey || !configData.emailJsServiceId || !configData.emailJsTemplateId) {
          throw new Error('Incomplete configuration received from server.');
        }
        setEmailJsConfig(configData);
        setConfigError(null); // Clear previous errors
        console.log("EmailJS config loaded successfully.");
      } catch (error) {
        console.error("Error fetching EmailJS config:", error);
        setConfigError("Could not load email configuration. Please try again later.");
        setEmailJsConfig(null);
      }
    };
    fetchConfig();
  }, []); // Empty dependency array ensures this runs only once on mount

  // Calculate city/country counts for the carousel
  const locationCounts = useMemo(() => {
    const counts: { [key: string]: { city: string; countryCode: string; countryName: string; count: number } } = {};
    for (const pos of positions.current.values()) {
      if (pos.city && pos.country) {
        const key = `${pos.city}-${pos.country}`;
        if (!counts[key]) {
          const countryData = COUNTRIES.find(c => c.code === pos.country);
          counts[key] = { city: pos.city, countryCode: pos.country, countryName: countryData?.name || pos.country, count: 0 };
        }
        counts[key].count++;
      }
    }
    return Object.values(counts).sort((a, b) => {
      const countryCompare = a.countryName.localeCompare(b.countryName);
      return countryCompare !== 0 ? countryCompare : a.city.localeCompare(b.city);
    });
  }, [counter]);

  // Effect for carousel scrolling
  useEffect(() => {
    const trackElement = carouselTrackRef.current;
    const containerElement = trackElement?.parentElement;
    if (trackElement && containerElement && locationCounts.length > 0) {
      const containerWidth = containerElement.offsetWidth;
      let uniqueContentWidth = 0;
      const items = Array.from(trackElement.children).slice(0, locationCounts.length);
      if (items.length > 0) {
        uniqueContentWidth = items.reduce((sum, item) => sum + (item as HTMLElement).offsetWidth, 0);
        const gap = 15;
        uniqueContentWidth += Math.max(0, locationCounts.length - 1) * gap;
      }
      const isOverflowing = uniqueContentWidth > containerWidth;
      if (isOverflowing !== shouldScroll) {
        setShouldScroll(isOverflowing);
        return;
      }
      if (shouldScroll) {
        const pixelsPerSecond = 50;
        const minDuration = 10;
        let calculatedDuration = minDuration;
        if (uniqueContentWidth > 0 && pixelsPerSecond > 0) {
          calculatedDuration = Math.max(uniqueContentWidth / pixelsPerSecond, minDuration);
        }
        trackElement.style.animationDuration = `${calculatedDuration}s`;
        trackElement.style.animationPlayState = 'running';
        trackElement.classList.remove('carousel-static-centered');
      } else {
        trackElement.style.animationDuration = '0s';
        trackElement.style.animationPlayState = 'paused';
        trackElement.classList.add('carousel-static-centered');
      }
    } else if (trackElement) {
      trackElement.style.animationDuration = '0s';
      trackElement.style.animationPlayState = 'paused';
      trackElement.classList.add('carousel-static-centered');
      if (shouldScroll) setShouldScroll(false);
    }
  }, [locationCounts, shouldScroll]);

  // Fetch user location (CF Headers + Geolocation)
  useEffect(() => {
    const fetchCfLocation = async () => {
      try {
        const response = await fetch("/api/location");
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        setUserCity(data.city || "Unknown");
        setUserState(data.state || "Location");
      } catch (error) {
        console.error("Error fetching location from API:", error);
        setUserCity("Error");
        setUserState("Fetching");
      }
    };
    fetchCfLocation();

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({ lat: position.coords.latitude, lon: position.coords.longitude });
          setLocationError(null);
          console.log("User coordinates obtained:", position.coords.latitude, position.coords.longitude);
        },
        (error) => {
          console.error("Error getting user location:", error);
          setLocationError(`Error (${error.code}): ${error.message}`);
          setUserCoords(null);
        },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 }
      );
    } else {
      console.error("Geolocation is not supported by this browser.");
      setLocationError("Geolocation is not supported by this browser.");
      setUserCoords(null);
    }
  }, []);

  // Load nearby stores based on user city
  useEffect(() => {
    const loadNearbyStores = () => {
      setNearbyLoading(true);
      setNearbyError(null);
      if (userCity && userCity !== "Unknown" && userCity !== "Error") {
        try {
          const normalizedUserCity = userCity.toUpperCase();
          const cityData = (allStoresData as Record<string, ThriftStore[]>)[normalizedUserCity];
          if (cityData && Array.isArray(cityData)) {
            setNearbyStores(cityData);
          } else {
            setNearbyStores([]);
          }
        } catch (error) {
          console.error("Error accessing or processing store data:", error);
          setNearbyError("Could not load store data for your location.");
          setNearbyStores([]);
        }
      } else if (userCity === "Unknown" || userCity === "Error") {
        setNearbyError("Could not determine your location to find nearby stores.");
        setNearbyStores([]);
      } else {
        return; // Still waiting for userCity
      }
      setNearbyLoading(false);
    };
    loadNearbyStores();
  }, [userCity]);

  // Connect to PartyKit WebSocket
  const socket = usePartySocket({
    room: "default",
    party: "globe",
    onMessage(evt) {
      const message = JSON.parse(evt.data as string) as OutgoingMessage;
      if (message.type === "add-marker") {
        positions.current.set(message.position.id, {
          location: [message.position.lat, message.position.lng],
          size: message.position.id === socket.id ? 0.1 : 0.05,
          city: message.position.city,
          country: message.position.country,
        });
        setCounter((c) => c + 1);
      } else {
        positions.current.delete(message.id);
        setCounter((c) => c - 1);
      }
    },
  });

  // Globe rendering effect
  useEffect(() => {
    let phi = 0;
    let theta = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    const canvas = canvasRef.current as HTMLCanvasElement;

    const handleMouseDown = (e: MouseEvent) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - lastX;
      const deltaY = e.clientY - lastY;
      phi += deltaX * 0.01;
      theta = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, theta + deltaY * 0.01));
      lastX = e.clientX; lastY = e.clientY;
    };
    const handleMouseUp = () => { isDragging = false; };

    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mouseleave', handleMouseUp);

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2, width: 600 * 2, height: 600 * 2, phi: 0, theta: 0, dark: 1, scale: 1.15, diffuse: 0.8,
      mapSamples: 97000, mapBrightness: 6, baseColor: [0.3, 0.3, 0.3], markerColor: [0.8, 0.1, 0.1],
      glowColor: [0.2, 0.2, 0.2], markers: [], opacity: 0.9,
      onRender: (state) => {
        const time = Date.now();
        const updatedMarkers = [];
        for (const [id, markerData] of positions.current.entries()) {
          const baseSize = id === socket.id ? 0.1 : 0.05;
          const sizeFactor = (Math.sin(time / 800 + markerData.location[0]) + 1) / 2 * 0.4 + 0.5;
          const newSize = baseSize * sizeFactor;
          updatedMarkers.push({ ...markerData, size: newSize });
        }
        state.markers = updatedMarkers;
        const globalMarkerBrightness = (Math.sin(time / 1200) + 1) / 2 * 0.2 + 0.8;
        state.markerColor = [1.0 * globalMarkerBrightness, 0.1 * globalMarkerBrightness, 0.1 * globalMarkerBrightness];
        if (!isDragging) { state.phi = phi; phi += 0.003; } else { state.phi = phi; state.theta = theta; }
      },
    });

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      globe.destroy();
    };
  }, []); // Note: socket dependency removed as it's stable via usePartySocket hook

  // Modal handlers
  const openModal = useCallback(() => {
    setModalEmail('');
    setSubmissionStatus('idle');
    setIsModalOpen(true);
  }, []);
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
  }, []);

  // Nominatim Autocomplete
  // Removed 'async' keyword as fetch returns a promise and we call the callback
  const fetchNominatim = (inputValue: string, callback: (options: { label: string; value: NominatimResult }[]) => void) => {
    if (!inputValue || inputValue.length < 3) { callback([]); return; }
    try {
       fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(inputValue)}&limit=5`, { headers: { 'User-Agent': 'ThriftersAtlas/1.0 (contact@example.com)' } })
        .then(response => {
           if (!response.ok) throw new Error(`Nominatim API error: ${response.status}`);
           return response.json();
        })
        .then((data: NominatimResult[]) => {
           callback(data.map((item) => ({ label: item.display_name, value: item })));
        })
        .catch(error => {
           console.error("Error fetching from Nominatim:", error);
           callback([]);
        });
    } catch (error) { // Catch potential synchronous errors during fetch setup (unlikely here)
      console.error("Error setting up Nominatim fetch:", error);
      callback([]);
    }
  };
  const debouncedLoadOptions = useMemo(() => debounce(fetchNominatim, 300), []);

  // Filter globe markers based on search
  const filteredPositions = Array.from(positions.current.entries()).filter(([id, pos]) => {
    if (!selectedLocation) return true;
    const searchTerm = selectedLocation.label.toLowerCase();
    const markerCountryData = COUNTRIES.find(c => c.code === pos.country);
    const markerCountryName = markerCountryData?.name.toLowerCase() || '';
    const markerCityName = pos.city?.toLowerCase() || '';
    return searchTerm.includes(markerCityName) || (markerCountryName && searchTerm.includes(markerCountryName));
  });

  // Handle Email Submission
  const handleEmailSubmit = () => {
    if (modalEmail.trim() === '') {
      alert('Please enter your email address.');
      return;
    }
    if (!emailJsConfig) {
      console.error('EmailJS config not loaded yet.');
      setConfigError("Email configuration is still loading. Please wait a moment and try again."); // Provide user feedback
      setSubmissionStatus('error'); // Set error status
      return;
    }
    if (configError) { // Prevent submission if config failed to load
        setSubmissionStatus('error');
        return;
    }

    setSubmissionStatus('submitting');
    const templateParams = { user_email: modalEmail };

    emailjs.send(
      emailJsConfig.emailJsServiceId,
      emailJsConfig.emailJsTemplateId,
      templateParams,
      emailJsConfig.emailJsPublicKey
    )
      .then((response) => {
         console.log('EmailJS SUCCESS!', response.status, response.text);
         setSubmissionStatus('success');
         setModalEmail('');
      }, (error) => {
         console.error('EmailJS FAILED...', error);
         setSubmissionStatus('error');
      });
  };


  return (
    <div className="App">
      {/* Header */}
      <h1>Thrifters Atlas</h1>
      <p>Empowering the <a href="https://en.wikipedia.org/wiki/Circular_economy" target="_blank" rel="noopener noreferrer">circular economy</a></p>
      <button className="cta-button" onClick={openModal}>Join Us</button>

      {/* Main Content */}
      <div className="main-content">
        {/* Left Panel */}
        <div className="left-panel">
          <h3 className="panel-heading">Find thrifts in...</h3>
          <div className="search-container">
            <AsyncSelect
              cacheOptions loadOptions={debouncedLoadOptions} defaultOptions
              placeholder={ <span style={{ display: 'flex', alignItems: 'center', color: '#888' }}> <svg xmlns="http://www.w3.org/2000/svg" className="inline-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ marginRight: '8px', height: '1em', width: '1em' }}> <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /> </svg> Search locations </span> }
              onChange={(selectedOption) => {
                setSelectedLocation(selectedOption);
                if (selectedOption && selectedOption.label) {
                  const googleMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(`thrift, vintage, consignment shops in ${selectedOption.label}`)}`;
                  window.open(googleMapsUrl, '_blank', 'noopener,noreferrer');
                }
              }}
              value={selectedLocation} className="location-search-select" classNamePrefix="react-select"
              isClearable noOptionsMessage={() => 'Type to search...'} loadingMessage={() => 'Loading...'}
            />
          </div>
          <div className="city-card-list listings-list">
            {topCities.filter(cityData => COUNTRIES.some(country => country.name.toLowerCase() === cityData.country.toLowerCase()))
              .map((cityData, index) => <CityCard key={index} city={cityData.city} country={cityData.country} />)}
          </div>
        </div>

        {/* Map Area */}
        <div className="map-area">
          <div className="globe-container">
            <canvas ref={canvasRef as LegacyRef<HTMLCanvasElement>} style={{ width: 600, height: 600, maxWidth: "100%", aspectRatio: 1 }} />
          </div>
          {counter !== 0 ? <p className="mb-0 online-counter"> <span className="online-dot"></span> <b>{counter}</b> {counter === 1 ? "person" : "people"} online </p> : <p>&nbsp;</p>}
          <div className="cities-carousel-container">
            <div className="cities-carousel-track" ref={carouselTrackRef}>
              {locationCounts.length > 0 ? (
                <>
                  {locationCounts.map((locData, index) => ( <div key={`${locData.city}-${locData.countryCode}-1-${index}`} className="city-item-horizontal"> <ReactCountryFlag countryCode={locData.countryCode} svg style={{ width: '1.5em', height: '1.5em', marginRight: '8px', verticalAlign: 'middle' }} title={locData.countryName} /> {locData.city}, {locData.countryName} ({locData.count}) </div> ))}
                  {shouldScroll && locationCounts.map((locData, index) => ( <div key={`${locData.city}-${locData.countryCode}-2-${index}`} className="city-item-horizontal"> <ReactCountryFlag countryCode={locData.countryCode} svg style={{ width: '1.5em', height: '1.5em', marginRight: '8px', verticalAlign: 'middle' }} title={locData.countryName} /> {locData.city}, {locData.countryName} ({locData.count}) </div> ))}
                </>
              ) : ( <div className="city-item-horizontal" style={{ fontStyle: 'italic', color: '#888' }}>Waiting for users...</div> )}
            </div>
          </div>
        </div>

        {/* Right Panel */}
        <div className="right-panel">
          <h3 className="panel-heading"> Trending near me{" "} <div className="user-location"> <svg xmlns="http://www.w3.org/2000/svg" className="inline-icon location-pin-icon" viewBox="0 0 20 20" fill="currentColor" style={{ marginRight: '4px', verticalAlign: 'middle' }}> <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /> </svg> {userCity && userState ? `${userCity}, ${userState}` : "Loading Location..."} </div> </h3>
          <div className="thrift-store-list">
            {nearbyLoading ? <p>Loading nearby stores...</p> : nearbyError ? <p style={{ color: 'red' }}>{nearbyError}</p> : nearbyStores.length > 0 ? nearbyStores.map(store => <ThriftStoreCard key={store.place_id || Math.random()} store={store} userCoords={userCoords} />) : <p>No stores found for {userCity || 'your location'}.</p>}
          </div>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-button" onClick={closeModal}>&times;</button>
            {submissionStatus === 'success' ? (
              <>
                <h2>Thank You!</h2>
                <p>Welcome to the the community!</p>
                <button className="modal-submit-button" onClick={closeModal}>Close</button>
              </>
            ) : (
              <>
                <h2>Join Us</h2>
                <p>Become part of the global thrifting community</p>
                {(submissionStatus === 'error' || configError) && ( // Show error if submission failed OR config failed to load
                  <p style={{ color: 'red', fontWeight: 'bold' }}>
                    {configError || 'Failed to submit email. Please try again.'}
                  </p>
                )}
                <input
                  type="email" placeholder="Email Address" className="modal-input"
                  value={modalEmail} onChange={(e) => setModalEmail(e.target.value)}
                  disabled={submissionStatus === 'submitting' || !emailJsConfig || !!configError} // Disable if submitting, config not loaded, or config error
                />
                <button
                  className="modal-submit-button"
                  onClick={handleEmailSubmit}
                  disabled={submissionStatus === 'submitting' || !emailJsConfig || !!configError} // Disable if submitting, config not loaded, or config error
                >
                  {submissionStatus === 'submitting' ? 'Submitting...' : 'Submit'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
createRoot(document.getElementById("root")!).render(<App />);
