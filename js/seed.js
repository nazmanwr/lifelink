/* Demo data, loaded once on first run so the app is not empty.
 * Every seeded account uses the password: demo1234
 * Clearing data from the profile screen wipes these too. */
window.BD = window.BD || {};

BD.seed = (function () {
  const store = BD.store;
  const DEMO_PASSWORD = 'demo1234';

  /* Coordinates are real Dhaka neighbourhoods so the distance sort is
     visibly meaningful. Change these to your own city if you prefer. */
  const PLACES = {
    dhanmondi:   { area: 'Dhanmondi',    lat: 23.7461, lng: 90.3742 },
    gulshan:     { area: 'Gulshan',      lat: 23.7925, lng: 90.4078 },
    banani:      { area: 'Banani',       lat: 23.7936, lng: 90.4043 },
    mirpur:      { area: 'Mirpur',       lat: 23.8223, lng: 90.3654 },
    uttara:      { area: 'Uttara',       lat: 23.8759, lng: 90.3795 },
    mohammadpur: { area: 'Mohammadpur',  lat: 23.7657, lng: 90.3588 },
    motijheel:   { area: 'Motijheel',    lat: 23.7330, lng: 90.4172 },
    bashundhara: { area: 'Bashundhara',  lat: 23.8223, lng: 90.4265 }
  };

  function at(key) {
    const p = PLACES[key];
    return { area: p.area, location: { lat: p.lat, lng: p.lng } };
  }

  function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function daysAhead(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  const DONORS = [
    { name: 'Rafiq Hasan',    bloodGroup: 'O-',  place: 'dhanmondi',   lastDonation: daysAgo(140), donationCount: 6 },
    { name: 'Nusrat Jahan',   bloodGroup: 'O+',  place: 'gulshan',     lastDonation: daysAgo(200), donationCount: 3 },
    { name: 'Imran Chowdhury',bloodGroup: 'A+',  place: 'banani',      lastDonation: daysAgo(20),  donationCount: 9 },
    { name: 'Tania Rahman',   bloodGroup: 'B+',  place: 'mirpur',      lastDonation: '',           donationCount: 0 },
    { name: 'Sabbir Ahmed',   bloodGroup: 'O-',  place: 'uttara',      lastDonation: daysAgo(365), donationCount: 12 },
    { name: 'Mehjabin Karim', bloodGroup: 'AB+', place: 'mohammadpur', lastDonation: daysAgo(45),  donationCount: 2 },
    { name: 'Arif Mahmud',    bloodGroup: 'A-',  place: 'motijheel',   lastDonation: daysAgo(110), donationCount: 4 },
    { name: 'Farhana Akter',  bloodGroup: 'B-',  place: 'bashundhara', lastDonation: daysAgo(95),  donationCount: 7 },
    { name: 'Shakil Islam',   bloodGroup: 'O+',  place: 'mirpur',      lastDonation: daysAgo(10),  donationCount: 5 },
    { name: 'Priya Das',      bloodGroup: 'A+',  place: 'dhanmondi',   lastDonation: daysAgo(180), donationCount: 1 }
  ];

  const RECEIVERS = [
    { name: 'Kamal Uddin',   bloodGroup: 'A+',  place: 'dhanmondi' },
    { name: 'Roksana Begum', bloodGroup: 'O+',  place: 'uttara' }
  ];

  function phoneFor(i) {
    return '+8801' + String(700000000 + i * 1111111).slice(0, 9);
  }

  function emailFor(name) {
    return name.toLowerCase().split(' ')[0] + '@demo.app';
  }

  async function makeUser(person, role, index) {
    const place = at(person.place);
    const salt = store.randomSalt();
    const passwordHash = await store.hashPassword(DEMO_PASSWORD, salt);
    return store.users.create({
      name: person.name,
      email: emailFor(person.name),
      phone: phoneFor(index),
      passwordHash: passwordHash,
      salt: salt,
      role: role,
      bloodGroup: person.bloodGroup,
      city: 'Dhaka',
      area: place.area,
      location: place.location,
      available: role === 'donor',
      lastDonation: person.lastDonation || '',
      donationCount: person.donationCount || 0,
      demo: true
    });
  }

  async function run() {
    if (store.isSeeded()) return;

    const donors = [];
    for (let i = 0; i < DONORS.length; i++) {
      donors.push(await makeUser(DONORS[i], 'donor', i));
    }
    const receivers = [];
    for (let i = 0; i < RECEIVERS.length; i++) {
      receivers.push(await makeUser(RECEIVERS[i], 'receiver', DONORS.length + i));
    }

    const r1 = await store.requests.create({
      receiverId: receivers[0].id,
      patientName: 'Kamal Uddin (self)',
      bloodGroup: 'A+',
      units: 2,
      hospital: 'Dhaka Medical College Hospital',
      city: 'Dhaka',
      area: 'Dhanmondi',
      location: at('dhanmondi').location,
      urgency: 'urgent',
      neededBy: daysAhead(2),
      contactPhone: receivers[0].phone,
      notes: 'Scheduled surgery on Thursday morning. Two units needed before 9 AM.',
      status: 'open'
    });

    const r2 = await store.requests.create({
      receiverId: receivers[1].id,
      patientName: 'Md. Salim (father)',
      bloodGroup: 'O+',
      units: 3,
      hospital: 'Uttara Adhunik Medical College',
      city: 'Dhaka',
      area: 'Uttara',
      location: at('uttara').location,
      urgency: 'critical',
      neededBy: daysAhead(1),
      contactPhone: receivers[1].phone,
      notes: 'Road accident, patient in ICU. Please call before coming.',
      status: 'open'
    });

    await store.requests.create({
      receiverId: receivers[0].id,
      patientName: 'Ayesha Kamal (daughter)',
      bloodGroup: 'B+',
      units: 1,
      hospital: 'Square Hospital, Panthapath',
      city: 'Dhaka',
      area: 'Dhanmondi',
      location: at('dhanmondi').location,
      urgency: 'routine',
      neededBy: daysAhead(12),
      contactPhone: receivers[0].phone,
      notes: 'Thalassaemia transfusion, monthly. Regular donor preferred.',
      status: 'open'
    });

    /* One donor has already offered, so the receiver view is not empty. */
    const oNeg = donors.find(function (d) { return d.bloodGroup === 'O-'; });
    if (oNeg) {
      await store.responses.create({
        requestId: r2.id,
        donorId: oNeg.id,
        status: 'offered',
        message: 'I can reach Uttara within an hour. Call me any time.'
      });
    }
    const aPlus = donors.find(function (d) { return d.bloodGroup === 'A+' && d.name === 'Priya Das'; });
    if (aPlus) {
      await store.responses.create({
        requestId: r1.id,
        donorId: aPlus.id,
        status: 'offered',
        message: 'Available Thursday morning, I work nearby.'
      });
    }

    store.markSeeded();
  }

  return { run: run, DEMO_PASSWORD: DEMO_PASSWORD };
})();
