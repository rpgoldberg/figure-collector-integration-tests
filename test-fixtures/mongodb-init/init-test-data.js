const { MongoClient } = require('mongodb');
const bcrypt = require('bcryptjs');

const TEST_USERS = {
  USER1: {
    username: 'testuser1',
    email: 'test1@example.com',
    password: 'testpass123',
    id: '64a0b5c8d4e5f6789abcdef0'
  },
  USER2: {
    username: 'testuser2',
    email: 'test2@example.com',
    password: 'testpass123',
    id: '64a0b5c8d4e5f6789abcdef1'
  },
  SEARCH_USER: {
    username: 'searchuser',
    email: 'search@example.com',
    password: 'testpass123',
    id: '64a0b5c8d4e5f6789abcdef2'
  }
};

const SAMPLE_FIGURES = [
  {
    _id: '64b0c5d9e6f7a8b9c0d1e2f3',
    name: 'Test Figure 1',
    manufacturer: 'Test Manufacturer 1',
    userId: TEST_USERS.USER1.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    boxNumber: 'BOX-TEST-1',
    location: 'Shelf A',
    inProduction: true,
    estimatedValue: 100.50
  },
  {
    _id: '64b0c5d9e6f7a8b9c0d1e2f4',
    name: 'Test Figure 2',
    manufacturer: 'Test Manufacturer 2',
    userId: TEST_USERS.USER2.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    boxNumber: 'BOX-TEST-2',
    location: 'Shelf B',
    inProduction: false,
    estimatedValue: 75.25
  },
  {
    _id: '64b0c5d9e6f7a8b9c0d1e2f5',
    name: 'Search Test Figure',
    manufacturer: 'Search Manufacturer',
    userId: TEST_USERS.SEARCH_USER.id,
    createdAt: new Date(),
    updatedAt: new Date(),
    boxNumber: 'BOX-SEARCH',
    location: 'Search Shelf',
    inProduction: true,
    estimatedValue: 200.75
  }
];

async function initializeTestData() {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://testuser:testpass@mongodb-test:27017/figure_collector_test?authSource=admin';
  const client = new MongoClient(mongoUri);

  try {
    await client.connect();
    console.log('Connected to MongoDB for test data initialization');

    const db = client.db('figure_collector_test');
    const usersCollection = db.collection('users');
    const figuresCollection = db.collection('figures');

    // Clear existing test data
    await usersCollection.deleteMany({
      $or: [
        { email: 'test1@example.com' },
        { email: 'test2@example.com' },
        { email: 'search@example.com' }
      ]
    });
    await figuresCollection.deleteMany({
      _id: { $in: SAMPLE_FIGURES.map(fig => fig._id) }
    });

    // Hash passwords
    const saltRounds = 10;
    const hashedUsers = await Promise.all(
      Object.values(TEST_USERS).map(async (user) => ({
        ...user,
        password: await bcrypt.hash(user.password, saltRounds)
      }))
    );

    // Insert test users
    const insertUsersResult = await usersCollection.insertMany(hashedUsers);
    console.log(`Inserted ${insertUsersResult.insertedCount} test users`);

    // Insert sample figures
    const insertFiguresResult = await figuresCollection.insertMany(SAMPLE_FIGURES);
    console.log(`Inserted ${insertFiguresResult.insertedCount} sample figures`);

    // Create indexes
    await usersCollection.createIndex({ email: 1 }, { unique: true });
    await figuresCollection.createIndex({ userId: 1 });
    await figuresCollection.createIndex({ name: 'text', manufacturer: 'text' });

    console.log('Test data initialization complete');
  } catch (error) {
    console.error('Error initializing test data:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

initializeTestData();