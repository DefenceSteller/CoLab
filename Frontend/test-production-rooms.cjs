// End-to-end test against the LIVE production backend.
// create-room -> join-room -> draw relay -> room-users -> full rejection
const { io } = require('socket.io-client');

const BACKEND = process.env.BACKEND || 'https://colab-production-4bce3d39.up.railway.app';
console.log('Testing against:', BACKEND);

let passed = 0;
let failed = 0;
const assert = (cond, name) => {
  if (cond) { passed++; console.log(`  PASS ${name}`); }
  else { failed++; console.log(`  FAIL ${name}`); }
};
const eq = (a, b, name) => assert(a === b, `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);

function connect() {
  return io(BACKEND, { transports: ['websocket'], reconnection: false, timeout: 8000 });
}
function once(socket, event) {
  return new Promise((resolve) => socket.once(event, resolve));
}
function emitAck(socket, event, data) {
  return new Promise((resolve) => {
    socket.emit(event, data, (err, res) => resolve(err ? { ok: false, error: 'timeout' } : res));
  });
}

async function run() {
  const watchdog = setTimeout(() => {
    console.error('TIMEOUT — test hung');
    process.exit(2);
  }, 30000);

  const host = connect();
  const guest = connect();

  // 1. create-room
  console.log('\n[1] create-room (production)');
  const roomUsersPromise1 = once(host, 'room-users');
  const createRes = await emitAck(host, 'create-room', { username: 'Host' });
  const roomUsers1 = await roomUsersPromise1;
  eq(createRes.ok, true, 'ok');
  eq(createRes.roomId.length, 6, 'roomId length');
  eq(/^[A-Z0-9]{6}$/.test(createRes.roomId), true, 'roomId charset');
  eq(createRes.maxUsers, 5, 'maxUsers');
  eq(roomUsers1.length, 1, 'creator sees 1 member');
  host.roomId = createRes.roomId;
  console.log('  Room ID:', host.roomId);

  // 2. join-room + replay + 2 members
  console.log('\n[2] join-room (production)');
  const roomUsersPromise2 = once(guest, 'room-users');
  const joinRes = await emitAck(guest, 'join-room', { roomId: host.roomId, username: 'Guest' });
  const roomUsers2 = await roomUsersPromise2;
  eq(joinRes.ok, true, 'join ok');
  eq(joinRes.roomId, host.roomId, 'same room id');
  eq(Array.isArray(joinRes.elements), true, 'elements replayed');
  eq(roomUsers2.length, 2, 'room shows 2 members');

  // 3. draw relay
  console.log('\n[3] draw relay (production)');
  const drawPromise = once(guest, 'draw');
  host.emit('draw', { id: 's1', type: 'line', x1: 1, y1: 2, x2: 3, y2: 4, color: '#000', size: 2 });
  const drawData = await Promise.race([drawPromise, new Promise((r) => setTimeout(() => r(null), 400))]);
  if (drawData) eq(drawData.id, 's1', 'draw relayed to host');
  assert(drawData !== null, 'draw reached the guest');

  // 4. not-found
  console.log('\n[4] unknown room (production)');
  const outsider = connect();
  const nfRes = await emitAck(outsider, 'join-room', { roomId: 'ZZZZZZ', username: 'X' });
  eq(nfRes.ok, false, 'unknown room not ok');
  eq(nfRes.error, 'not-found', 'unknown room error');
  outsider.disconnect();

  // 5. full
  console.log('\n[5] 6th user rejected when full (production)');
  const extra = [connect(), connect(), connect(), connect()];
  await Promise.all(extra.map(async (c) => {
    const res = await emitAck(c, 'join-room', { roomId: host.roomId, username: 'E' });
  }));
  const sixth = connect();
  const fullRes = await emitAck(sixth, 'join-room', { roomId: host.roomId, username: 'Sixth' });
  eq(fullRes.ok, false, '6th user rejected');
  eq(fullRes.error, 'full', '6th user error');
  sixth.disconnect();
  extra.forEach((c) => c.disconnect());

  host.disconnect();
  guest.disconnect();

  clearTimeout(watchdog);
  console.log(`\n${'='.repeat(40)}\n  ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

run();