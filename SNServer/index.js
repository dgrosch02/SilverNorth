const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { PrismaClient } = require('@prisma/client');
const twilio = require('twilio');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const prisma = new PrismaClient();

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const serviceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

// We only initialize twilio client if variables are present
let twilioClient;
if (accountSid && authToken) {
  try {
    twilioClient = twilio(accountSid, authToken);
  } catch (e) {
    console.warn('Twilio could not be initialized. Check your credentials.');
  }
}

// POST /api/auth/send-code
app.post('/api/auth/send-code', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) {
    return res.status(400).json({ error: 'Phone number is required' });
  }
  
  if (!twilioClient || !serviceSid) {
    return res.status(500).json({ error: 'Twilio is not configured properly on the server.' });
  }

  try {
    const verification = await twilioClient.verify.v2
      .services(serviceSid)
      .verifications.create({ to: phoneNumber, channel: 'sms' });

    res.json({ success: true, status: verification.status });
  } catch (error) {
    console.error('Error sending code:', error);
    res.status(500).json({ error: 'Failed to send verification code', details: error.message });
  }
});

// POST /api/auth/verify-code
app.post('/api/auth/verify-code', async (req, res) => {
  const { phoneNumber, code, name, username, email, pictureKey, bio, color } = req.body;
  if (!phoneNumber || !code) {
    return res.status(400).json({ error: 'Phone number and verification code are required' });
  }

  if (!twilioClient || !serviceSid) {
    return res.status(500).json({ error: 'Twilio is not configured properly on the server.' });
  }

  try {
    const verificationCheck = await twilioClient.verify.v2
      .services(serviceSid)
      .verificationChecks.create({ to: phoneNumber, code: code });

    if (verificationCheck.status !== 'approved') {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }

    // Code is valid. Find or create the user.
    let user = await prisma.user.findUnique({
      where: { phoneNumber },
    });

    const isNewUser = !user;

    if (!user) {
      // Only include optional profile fields if they were provided
      const data = { phoneNumber };
      if (name !== undefined) data.name = name;
      if (username !== undefined) data.username = username;
      if (email !== undefined) data.email = email;
      if (pictureKey !== undefined) data.pictureKey = pictureKey;
      if (bio !== undefined) data.bio = bio;
      if (color !== undefined) data.color = color;

      user = await prisma.user.create({ data });
    }

    // Normally here you would create and return a JWT token for the session
    res.json({
      success: true,
      message: 'Phone number verified successfully',
      isNewUser,
      user,
    });
  } catch (error) {
    console.error('Error verifying code:', error);

    // Handle unique constraint violations (e.g. username/email already taken)
    if (error.code === 'P2002') {
      const fields = Array.isArray(error.meta?.target) ? error.meta.target.join(', ') : error.meta?.target;
      return res.status(409).json({ error: `A user with that ${fields} already exists.` });
    }

    res.status(500).json({ error: 'Failed to verify code', details: error.message });
  }
});

// --- Sights (historical detections) ---

// Maps a UI "type" filter to the underlying detection labels.
const LABEL_GROUPS = {
  bird: ['Bird', 'Eagle', 'Falcon', 'Hawk', 'Owl'],
  drone: ['Drone'],
  animal: [
    'Tiger', 'Lion', 'Bear', 'Wolf', 'Fox', 'Deer', 'Elk', 'Moose',
    'Dog', 'Cat', 'Horse', 'Cow', 'Pig', 'Sheep', 'Goat',
  ],
};

function periodToSince(period) {
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  switch (period) {
    case 'day':
      return new Date(now - DAY);
    case 'week':
      return new Date(now - 7 * DAY);
    case 'month':
      return new Date(now - 30 * DAY);
    default:
      return null; // all time
  }
}

// Prisma returns Decimal fields as Decimal objects; send plain numbers instead.
const toNum = (v) => (v === null || v === undefined ? null : Number(v));

// GET /api/sights?period=day|week|month&type=bird|drone|animal
// Returns past sightings (with each object's ordered position track) so the
// map can replay markers and trajectory lines.
app.get('/api/sights', async (req, res) => {
  try {
    const { period, type } = req.query;
    const since = periodToSince(period);
    const labels = LABEL_GROUPS[type] || null;

    const where = {};
    if (since) where.startTime = { gte: since };
    // Only return sights that contain at least one object of the requested type
    if (labels) where.instances = { some: { label: { in: labels } } };

    const sights = await prisma.sight.findMany({
      where,
      orderBy: { startTime: 'desc' },
      include: {
        instances: {
          // When a type filter is set, only include matching instances
          where: labels ? { label: { in: labels } } : undefined,
          include: {
            observations: { orderBy: { timestamp: 'asc' } },
          },
        },
      },
    });

    const payload = sights.map((s) => ({
      id: s.id,
      uuid: s.uuid,
      title: s.title,
      userId: s.userId,
      startTime: s.startTime,
      endTime: s.endTime,
      lat: toNum(s.lat),
      lon: toNum(s.lon),
      alt: toNum(s.alt),
      instances: s.instances.map((inst) => ({
        id: inst.id,
        label: inst.label,
        confidence: toNum(inst.confidence),
        timestamp: inst.timestamp,
        observations: inst.observations.map((o) => ({
          lat: toNum(o.lat),
          lon: toNum(o.lon),
          alt: toNum(o.alt),
          accuracyM: toNum(o.accuracyM),
          timestamp: o.timestamp,
        })),
      })),
    }));

    res.json({ sights: payload });
  } catch (error) {
    console.error('Error fetching sights:', error);
    res.status(500).json({ error: 'Failed to fetch sights', details: error.message });
  }
});

const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
  console.log(`SNServer is running on port ${PORT}`);
});