// MongoDB Initialization Script for Integration Tests
// Creates test users, figures, and Atlas Search indices

print('Starting MongoDB test data initialization...');

// Switch to test database
db = db.getSiblingDB('figure_collector_test');

// Drop existing collections to ensure clean state
db.users.drop();
db.figures.drop();

print('Creating test users...');

// Hash for password 'testpass123' using bcrypt
const testPasswordHash = '$2b$10$rQY8Jl7Gql0wY6FJQXk5aOHc7X8J3kR2Ks9vLm8Qn7Pp5WwEt6Uu.'; 

const testUsers = [
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    username: 'testuser1',
    email: 'test1@example.com',
    password: testPasswordHash,
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z')
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcdef1'),
    username: 'testuser2',
    email: 'test2@example.com',
    password: testPasswordHash,
    createdAt: new Date('2024-01-01T11:00:00Z'),
    updatedAt: new Date('2024-01-01T11:00:00Z')
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcdef2'),
    username: 'searchuser',
    email: 'search@example.com',
    password: testPasswordHash,
    createdAt: new Date('2024-01-01T12:00:00Z'),
    updatedAt: new Date('2024-01-01T12:00:00Z')
  }
];

db.users.insertMany(testUsers);
print(`Inserted ${testUsers.length} test users`);

print('Creating test figures...');

const testFigures = [
  // User 1 figures
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde01'),
    manufacturer: 'Good Smile Company',
    name: 'Hatsune Miku Racing Ver.',
    scale: '1/8',
    location: 'Shelf A',
    boxNumber: 'BOX001',
    imageUrl: 'https://example.com/miku-racing.jpg',
    mfcLink: 'https://myfigurecollection.net/item/123456',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    createdAt: new Date('2024-01-15T10:30:00Z'),
    updatedAt: new Date('2024-01-15T10:30:00Z')
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde02'),
    manufacturer: 'Kotobukiya',
    name: 'Asuka Langley Shikinami',
    scale: '1/7',
    location: 'Shelf A',
    boxNumber: 'BOX002',
    imageUrl: 'https://example.com/asuka.jpg',
    mfcLink: 'https://myfigurecollection.net/item/789012',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    createdAt: new Date('2024-01-16T14:20:00Z'),
    updatedAt: new Date('2024-01-16T14:20:00Z')
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde03'),
    manufacturer: 'Alter',
    name: 'Rem Swimsuit Ver.',
    scale: '1/7',
    location: 'Shelf B',
    boxNumber: 'BOX003',
    imageUrl: 'https://example.com/rem-swimsuit.jpg',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    createdAt: new Date('2024-01-17T09:15:00Z'),
    updatedAt: new Date('2024-01-17T09:15:00Z')
  },
  
  // User 2 figures  
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde04'),
    manufacturer: 'Good Smile Company',
    name: 'Nezuko Kamado',
    scale: '1/8',
    location: 'Display Case',
    boxNumber: 'BOX004',
    imageUrl: 'https://example.com/nezuko.jpg',
    mfcLink: 'https://myfigurecollection.net/item/345678',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef1'),
    createdAt: new Date('2024-01-18T16:45:00Z'),
    updatedAt: new Date('2024-01-18T16:45:00Z')
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde05'),
    manufacturer: 'Banpresto',
    name: 'Tanjiro Kamado DXF',
    scale: 'Prize',
    location: 'Shelf C',
    boxNumber: 'BOX005',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef1'),
    createdAt: new Date('2024-01-19T13:30:00Z'),
    updatedAt: new Date('2024-01-19T13:30:00Z')
  },
  
  // Search test user figures (for Atlas Search testing)
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde06'),
    manufacturer: 'Max Factory',
    name: 'Figma Saber',
    scale: 'Figma',
    location: 'Premium Shelf',
    boxNumber: 'PREM001',
    imageUrl: 'https://example.com/figma-saber.jpg',
    mfcLink: 'https://myfigurecollection.net/item/567890',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef2'),
    createdAt: new Date('2024-01-20T11:00:00Z'),
    updatedAt: new Date('2024-01-20T11:00:00Z')
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde07'),
    manufacturer: 'Orange Rouge',
    name: 'Nendoroid Goku',
    scale: 'Nendoroid',
    location: 'Nendo Corner',
    boxNumber: 'NENDO001',
    imageUrl: 'https://example.com/nendo-goku.jpg',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef2'),
    createdAt: new Date('2024-01-21T15:45:00Z'),
    updatedAt: new Date('2024-01-21T15:45:00Z')
  },
  
  // Figures for testing edge cases
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde08'),
    manufacturer: 'Unique Characters',
    name: 'Special Edition テスト Figure', // Contains Japanese characters
    scale: '1/6',
    location: 'Special Display',
    boxNumber: 'SPEC001',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef2'),
    createdAt: new Date('2024-01-22T08:20:00Z'),
    updatedAt: new Date('2024-01-22T08:20:00Z')
  },
  {
    _id: ObjectId('64a0b5c8d4e5f6789abcde09'),
    manufacturer: 'Test Company & Co.', // Contains special characters
    name: 'Figure with "Quotes" and (Parentheses)',
    scale: '1/10',
    location: 'Test Area',
    boxNumber: 'TEST999',
    userId: ObjectId('64a0b5c8d4e5f6789abcdef0'),
    createdAt: new Date('2024-01-23T19:30:00Z'),
    updatedAt: new Date('2024-01-23T19:30:00Z')
  }
];

db.figures.insertMany(testFigures);
print(`Inserted ${testFigures.length} test figures`);

print('Creating database indices...');

// Create text index for basic text search (fallback for Atlas Search)
db.figures.createIndex({
  'manufacturer': 'text',
  'name': 'text',
  'location': 'text',
  'boxNumber': 'text'
}, {
  name: 'figures_text_index',
  weights: {
    'name': 10,
    'manufacturer': 5,
    'location': 2,
    'boxNumber': 1
  }
});

// Create individual field indices for filtering
db.figures.createIndex({ 'manufacturer': 1 }, { name: 'manufacturer_index' });
db.figures.createIndex({ 'scale': 1 }, { name: 'scale_index' });
db.figures.createIndex({ 'location': 1 }, { name: 'location_index' });
db.figures.createIndex({ 'boxNumber': 1 }, { name: 'boxNumber_index' });
db.figures.createIndex({ 'userId': 1 }, { name: 'userId_index' });
db.figures.createIndex({ 'createdAt': 1 }, { name: 'createdAt_index' });

// Create compound indices for common query patterns
db.figures.createIndex({ 'userId': 1, 'manufacturer': 1 }, { name: 'user_manufacturer_index' });
db.figures.createIndex({ 'userId': 1, 'createdAt': -1 }, { name: 'user_recent_index' });

// Create user indices
db.users.createIndex({ 'email': 1 }, { unique: true, name: 'email_unique_index' });
db.users.createIndex({ 'username': 1 }, { unique: true, name: 'username_unique_index' });

print('Database indices created successfully');

// Verify data integrity
const userCount = db.users.countDocuments();
const figureCount = db.figures.countDocuments();

print(`Data verification:`);
print(`  Users: ${userCount}`);
print(`  Figures: ${figureCount}`);

// Test a basic search to ensure indices work
const searchTest = db.figures.find({ $text: { $search: 'Miku' } }).count();
print(`  Search test (Miku): ${searchTest} results`);

if (userCount === 3 && figureCount === 9 && searchTest > 0) {
  print('✅ MongoDB initialization completed successfully');
} else {
  print('❌ MongoDB initialization had issues - check data counts');
}