// MongoDB Initialization Script for Integration Tests
// This script runs during MongoDB container initialization via docker-entrypoint-initdb.d
// Uses native MongoDB shell capabilities without external Node.js dependencies

print('🚀 Initializing Figure Collector test database...');

// Switch to the test database
db = db.getSiblingDB('figure_collector_test');

print('🧹 Clearing existing test data...');
db.users.deleteMany({});
db.figures.deleteMany({});

print('👥 Creating test users...');

// Pre-hashed password for 'testpass123' using bcrypt with salt rounds 10
const hashedPassword = '$2a$10$Xv5tXAWk7qBwES1G4ahTHuMzSd.y0Cmd3NuBKGfXBR7UGXJzgspRS';

const testUsers = [
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    username: 'testuser1',
    email: 'test1@example.com',
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcdef1'),
    username: 'testuser2',
    email: 'test2@example.com',
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcdef2'),
    username: 'searchuser',
    email: 'search@example.com',
    password: hashedPassword,
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

db.users.insertMany(testUsers);
print(`✅ Created ${testUsers.length} test users`);

print('🏺 Creating test figures...');

const testFigures = [
  {
    _id: ObjectId(),
    userId: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    manufacturer: 'Good Smile Company',
    name: 'Hatsune Miku',
    scale: '1/8',
    location: 'Shelf A',
    boxNumber: 'BOX001',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    userId: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    manufacturer: 'Kotobukiya',
    name: 'Rem',
    scale: '1/7',
    location: 'Shelf B',
    boxNumber: 'BOX002',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    userId: ObjectId('64a0b5c8d4e5f6789abcdef1'),
    manufacturer: 'FREEing',
    name: 'Zero Two',
    scale: '1/4',
    location: 'Display Case',
    boxNumber: 'BOX003',
    createdAt: new Date(),
    updatedAt: new Date()
  },
  {
    _id: ObjectId(),
    userId: ObjectId('64a0b5c8d4e5f6789abcdef2'),
    manufacturer: 'Alter',
    name: 'Saber Lily',
    scale: '1/8',
    location: 'Top Shelf',
    boxNumber: 'BOX004',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

db.figures.insertMany(testFigures);
print(`✅ Created ${testFigures.length} test figures`);

print('📚 Creating database indexes...');

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.figures.createIndex({ userId: 1 });
db.figures.createIndex({ 
  manufacturer: 'text',
  name: 'text',
  location: 'text',
  boxNumber: 'text'
});

print('✅ Created database indexes');

// Verify data
const userCount = db.users.countDocuments();
const figureCount = db.figures.countDocuments();

print(`📊 Final verification: ${userCount} users, ${figureCount} figures`);
print('🎉 Test database initialization completed successfully!');

// Ensure we're using the correct database for the test environment
db = db.getSiblingDB('figure_collector_test');