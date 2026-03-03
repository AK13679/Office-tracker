// Run this ONCE to seed your team: node seed.js
// Change names and PINs before running!
// After seeding, you can delete this file or keep it private.

const bcrypt = require('bcryptjs');
const { pool, initDB } = require('./database');

const team = [
  { name: 'Thomas',   pin: '1111' },
  { name: 'Abhishek',     pin: '2222' },
  { name: 'Valentin',   pin: '3333' },
//   { name: 'David',   pin: '4444' },
//   { name: 'Eva',     pin: '5555' },
//   { name: 'Frank',   pin: '6666' },
//   { name: 'Grace',   pin: '7777' },
//   { name: 'Henry',   pin: '8888' },
//   { name: 'Isla',    pin: '9999' },
//   { name: 'James',   pin: '0000' },
];

async function seed() {
  await initDB();
  for (const member of team) {
    const hashed = bcrypt.hashSync(member.pin, 10);
    await pool.query(
      'INSERT INTO members (name, pin) VALUES ($1, $2) ON CONFLICT (name) DO NOTHING',
      [member.name, hashed]
    );
    console.log(`Seeded: ${member.name}`);
  }
  console.log('Done! All team members created.');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});