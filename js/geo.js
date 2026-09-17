/* Location capture and distance maths. */
window.BD = window.BD || {};

BD.geo = (function () {
  const EARTH_RADIUS_KM = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;

  function hasCoords(p) {
    return !!p && typeof p.lat === 'number' && typeof p.lng === 'number'
      && isFinite(p.lat) && isFinite(p.lng);
  }

  /* Great-circle distance in km between two {lat, lng} points. */
  function distanceKm(a, b) {
    if (!hasCoords(a) || !hasCoords(b)) return null;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
  }

  function formatDistance(km) {
    if (km === null || km === undefined) return 'Distance unknown';
    if (km < 1) return Math.round(km * 1000) + ' m away';
    if (km < 10) return km.toFixed(1) + ' km away';
    return Math.round(km) + ' km away';
  }

  function geoErrorMessage(err) {
    switch (err.code) {
      case 1: return 'Location permission denied. You can still match by city.';
      case 2: return 'Location unavailable right now. You can still match by city.';
      case 3: return 'Getting your location took too long. Try again, or match by city.';
      default: return 'Could not get your location. You can still match by city.';
    }
  }

  /* Ask the browser for the current position. Resolves to {lat, lng, accuracy}. */
  function currentPosition(opts) {
    opts = opts || {};
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('This browser does not support location access.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString()
        }),
        (err) => reject(new Error(geoErrorMessage(err))),
        {
          enableHighAccuracy: true,
          timeout: opts.timeout || 12000,
          maximumAge: opts.maximumAge || 300000
        }
      );
    });
  }

  return {
    hasCoords: hasCoords,
    distanceKm: distanceKm,
    formatDistance: formatDistance,
    currentPosition: currentPosition
  };
})();
