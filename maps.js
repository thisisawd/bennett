'use strict';

const mapRegions = {
  'new-hampshire': {
    ...(typeof module !== 'undefined' && module.exports ? require('./nh-map') : window.BENNETT_MAP),
    name: 'New Hampshire',
    place: 'town',
    step: .01,
    distanceScaleKm: 75,
  },
  europe: {
    name: 'Europe',
    place: 'city',
    bounds: { west: -25, east: 45, south: 34, north: 72 },
    width: 700,
    height: 540,
    step: .1,
    distanceScaleKm: 750,
    outlines: typeof module !== 'undefined' && module.exports ? require('./europe-map') : window.BENNETT_EUROPE_OUTLINE,
    towns: [
      { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
      { name: 'Athens', lat: 37.9838, lng: 23.7275 },
      { name: 'Barcelona', lat: 41.3874, lng: 2.1686 },
      { name: 'Berlin', lat: 52.52, lng: 13.405 },
      { name: 'Brussels', lat: 50.8503, lng: 4.3517 },
      { name: 'Copenhagen', lat: 55.6761, lng: 12.5683 },
      { name: 'Dublin', lat: 53.3498, lng: -6.2603 },
      { name: 'Florence', lat: 43.7696, lng: 11.2558 },
      { name: 'Helsinki', lat: 60.1699, lng: 24.9384 },
      { name: 'Lisbon', lat: 38.7223, lng: -9.1393 },
      { name: 'London', lat: 51.5074, lng: -.1278 },
      { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
      { name: 'Oslo', lat: 59.9139, lng: 10.7522 },
      { name: 'Paris', lat: 48.8566, lng: 2.3522 },
      { name: 'Prague', lat: 50.0755, lng: 14.4378 },
      { name: 'Reykjavik', lat: 64.1466, lng: -21.9426 },
      { name: 'Rome', lat: 41.9028, lng: 12.4964 },
      { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
      { name: 'Vienna', lat: 48.2082, lng: 16.3738 },
      { name: 'Warsaw', lat: 52.2297, lng: 21.0122 },
    ],
  },
};

mapRegions['new-hampshire'].outlines = mapRegions['new-hampshire'].outline ? [mapRegions['new-hampshire'].outline] : [];

if (typeof module !== 'undefined' && module.exports) module.exports = mapRegions;
else window.BENNETT_MAPS = mapRegions;
