/* Matching engine.
 *
 * Ranking rules, in order of weight:
 *   1. Blood group must be compatible (hard filter, never relaxed).
 *   2. Donors who can give today rank above donors still inside the 90-day gap.
 *   3. Closer by GPS wins; donors with no coordinates fall back to a city match.
 *   4. Urgency raises a request in a donor's feed.
 */
window.BD = window.BD || {};

BD.match = (function () {
  const blood = BD.blood;
  const geo = BD.geo;

  const URGENCY_WEIGHT = { critical: 3, urgent: 2, routine: 1 };
  /* Used when neither side has GPS, so city matches still beat distant unknowns. */
  const SAME_CITY_ASSUMED_KM = 15;
  const UNKNOWN_DISTANCE_KM = 500;

  function sameCity(a, b) {
    const x = String(a || '').trim().toLowerCase();
    const y = String(b || '').trim().toLowerCase();
    return !!x && x === y;
  }

  /* Distance in km, or null when it cannot be computed. */
  function pairDistance(a, b) {
    return geo.distanceKm(a && a.location, b && b.location);
  }

  function proximity(donor, target) {
    const km = pairDistance(donor, target);
    if (km !== null) {
      return { km: km, basis: 'gps', effectiveKm: km };
    }
    if (sameCity(donor.city, target.city)) {
      return { km: null, basis: 'city', effectiveKm: SAME_CITY_ASSUMED_KM };
    }
    return { km: null, basis: 'unknown', effectiveKm: UNKNOWN_DISTANCE_KM };
  }

  function proximityLabel(prox, donor, target) {
    if (prox.basis === 'gps') return geo.formatDistance(prox.km);
    if (prox.basis === 'city') return 'Same city (' + (donor.city || target.city) + ')';
    return 'Distance unknown';
  }

  /* Donors for one request, best first. */
  function rankDonorsForRequest(request, donors, today) {
    const now = today || new Date();
    return donors
      .filter(function (d) {
        return d.role === 'donor'
          && d.id !== request.receiverId
          && blood.isCompatible(d.bloodGroup, request.bloodGroup);
      })
      .map(function (donor) {
        const prox = proximity(donor, request);
        const elig = blood.eligibility(donor, now);
        return {
          donor: donor,
          distanceKm: prox.km,
          proximityBasis: prox.basis,
          proximityLabel: proximityLabel(prox, donor, request),
          eligibility: elig,
          score: (elig.ok ? 0 : 10000) + prox.effectiveKm
        };
      })
      .sort(function (a, b) { return a.score - b.score; });
  }

  /* Open requests a donor can actually help with, best first. */
  function rankRequestsForDonor(donor, requests, today) {
    const now = today || new Date();
    return requests
      .filter(function (r) {
        return r.status === 'open'
          && r.receiverId !== donor.id
          && blood.isCompatible(donor.bloodGroup, r.bloodGroup);
      })
      .map(function (request) {
        const prox = proximity(donor, request);
        const weight = URGENCY_WEIGHT[request.urgency] || 1;
        return {
          request: request,
          distanceKm: prox.km,
          proximityBasis: prox.basis,
          proximityLabel: proximityLabel(prox, donor, request),
          daysLeft: daysUntil(request.neededBy, now),
          /* Dividing by urgency pulls critical cases forward without ever
             letting an incompatible or far-away match jump the queue. */
          score: prox.effectiveKm / weight
        };
      })
      .sort(function (a, b) { return a.score - b.score; });
  }

  function daysUntil(dateStr, today) {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    if (isNaN(target.getTime())) return null;
    const base = today || new Date();
    return Math.ceil((target - base) / 86400000);
  }

  return {
    rankDonorsForRequest: rankDonorsForRequest,
    rankRequestsForDonor: rankRequestsForDonor,
    sameCity: sameCity,
    daysUntil: daysUntil,
    URGENCY_WEIGHT: URGENCY_WEIGHT
  };
})();
