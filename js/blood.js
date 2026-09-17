/* Blood group domain rules: compatibility and donation eligibility.
   Classic script (no ES modules) so index.html works when opened directly. */
window.BD = window.BD || {};

BD.blood = (function () {
  const BLOOD_GROUPS = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

  /* Red-cell compatibility: donor groups each recipient group can receive. */
  const RECEIVES_FROM = {
    'O-':  ['O-'],
    'O+':  ['O-', 'O+'],
    'A-':  ['O-', 'A-'],
    'A+':  ['O-', 'O+', 'A-', 'A+'],
    'B-':  ['O-', 'B-'],
    'B+':  ['O-', 'O+', 'B-', 'B+'],
    'AB-': ['O-', 'A-', 'B-', 'AB-'],
    'AB+': BLOOD_GROUPS.slice()
  };

  /* Minimum gap between whole-blood donations (WHO guidance: about 3 months). */
  const DONATION_GAP_DAYS = 90;

  function receivesFrom(recipientGroup) {
    return RECEIVES_FROM[recipientGroup] || [];
  }

  function donatesTo(donorGroup) {
    return BLOOD_GROUPS.filter((g) => receivesFrom(g).indexOf(donorGroup) !== -1);
  }

  function isCompatible(donorGroup, recipientGroup) {
    return receivesFrom(recipientGroup).indexOf(donorGroup) !== -1;
  }

  /* Days until a donor may give again. 0 means eligible now. */
  function daysUntilEligible(lastDonationDate, today) {
    if (!lastDonationDate) return 0;
    const last = new Date(lastDonationDate);
    if (isNaN(last.getTime())) return 0;
    const elapsed = Math.floor(((today || new Date()) - last) / 86400000);
    return Math.max(0, DONATION_GAP_DAYS - elapsed);
  }

  function eligibility(donor, today) {
    const days = daysUntilEligible(donor.lastDonation, today);
    if (donor.available === false) {
      return { ok: false, label: 'Paused', detail: 'This donor has paused requests' };
    }
    if (days > 0) {
      return { ok: false, label: 'Eligible in ' + days + 'd', detail: 'Donated within the last ' + DONATION_GAP_DAYS + ' days' };
    }
    return { ok: true, label: 'Available now', detail: 'Ready to donate' };
  }

  function nextEligibleDate(lastDonationDate) {
    if (!lastDonationDate) return null;
    const d = new Date(lastDonationDate);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + DONATION_GAP_DAYS);
    return d;
  }

  return {
    BLOOD_GROUPS: BLOOD_GROUPS,
    DONATION_GAP_DAYS: DONATION_GAP_DAYS,
    receivesFrom: receivesFrom,
    donatesTo: donatesTo,
    isCompatible: isCompatible,
    daysUntilEligible: daysUntilEligible,
    eligibility: eligibility,
    nextEligibleDate: nextEligibleDate
  };
})();
