const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

const MONGODB_URI = 'mongodb://testuser:testpass@localhost:27017/figcollector_test?authSource=admin';

const TEST_USERS = [
  {
    _id: new ObjectId('64a0b5c8d4e5f6789abcdef0'),
    username: 'testuser1',
    email: 'test1@example.com',
    password: 'testpass123'
  },
  {
    _id: new ObjectId('64a0b5c8d4e5f6789abcdef1'),
    username: 'testuser2',
    email: 'test2@example.com',
    password: 'testpass123'
  },
  {
    _id: new ObjectId('64a0b5c8d4e5f6789abcdef2'),
    username: 'searchuser',
    email: 'search@example.com',
    password: 'testpass123'
  }
];

async function initTestData() {
  console.log('🚀 Initializing test database...');
  
  const client = new MongoClient(MONGODB_URI);
  
  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');
    
    const db = client.db('figcollector_test');
    
    // Clear existing data
    await db.collection('users').deleteMany({});
    await db.collection('figures').deleteMany({});
    console.log('🧹 Cleared existing test data');
    
    // Create users with hashed passwords
    const users = [];
    for (const user of TEST_USERS) {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      users.push({
        ...user,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    
    await db.collection('users').insertMany(users);
    console.log(`✅ Created ${users.length} test users`);
    
    // Create sample figures
    const figures = [
      {
        _id: new ObjectId(),
        userId: new ObjectId('64a0b5c8d4e5f6789abcdef0'),
        manufacturer: 'Good Smile Company',
        name: 'Hatsune Miku',
        scale: '1/8',
        location: 'Shelf A',
        boxNumber: 'BOX001',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        userId: new ObjectId('64a0b5c8d4e5f6789abcdef0'),
        manufacturer: 'Kotobukiya',
        name: 'Rem',
        scale: '1/7',
        location: 'Shelf B',
        boxNumber: 'BOX002',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        userId: new ObjectId('64a0b5c8d4e5f6789abcdef1'),
        manufacturer: 'FREEing',
        name: 'Zero Two',
        scale: '1/4',
        location: 'Display Case',
        boxNumber: 'BOX003',
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        _id: new ObjectId(),
        userId: new ObjectId('64a0b5c8d4e5f6789abcdef2'),
        manufacturer: 'Alter',
        name: 'Saber Lily',
        scale: '1/8',
        location: 'Top Shelf',
        boxNumber: 'BOX004',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];
    
    await db.collection('figures').insertMany(figures);
    console.log(`✅ Created ${figures.length} test figures`);
    
    // Create indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('figures').createIndex({ userId: 1 });
    await db.collection('figures').createIndex({ 
      manufacturer: 'text',
      name: 'text',
      location: 'text',
      boxNumber: 'text'
    });
    console.log('✅ Created database indexes');
    
    // Verify data
    const userCount = await db.collection('users').countDocuments();
    const figureCount = await db.collection('figures').countDocuments();
    
    console.log(`📊 Final verification: ${userCount} users, ${figureCount} figures`);
    console.log('🎉 Test database initialization completed!');
    
  } catch (error) {
    console.error('❌ Error initializing test database:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

initTestData();