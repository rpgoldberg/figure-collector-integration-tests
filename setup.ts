import { MongoClient } from 'mongodb';
import axios from 'axios';

// Environment configuration
export const TEST_CONFIG = {
  BACKEND_URL: process.env.BACKEND_URL || 'http://backend-test:5055',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://frontend-test:5056',
  SCRAPER_URL: process.env.SCRAPER_URL || 'http://scraper-test:3005',
  VERSION_MANAGER_URL: process.env.VERSION_MANAGER_URL || 'http://version-manager-test:3006',
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://testuser:testpass@mongodb-test:27017/figcollector_test?authSource=admin',
  TEST_TIMEOUT: parseInt(process.env.TEST_TIMEOUT || '180000'),
  COVERAGE_ENABLED: process.env.COVERAGE_ENABLED === 'true'
};

// Global test state
let mongoClient: MongoClient;
let testUsers: any[] = [];
let authTokens: { [username: string]: string } = {};

// Test user credentials
export const TEST_USERS = {
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

// Axios instances for each service
export const backendAPI = axios.create({
  baseURL: TEST_CONFIG.BACKEND_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const scraperAPI = axios.create({
  baseURL: TEST_CONFIG.SCRAPER_URL,
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const versionAPI = axios.create({
  baseURL: TEST_CONFIG.VERSION_MANAGER_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Frontend requests (simulating browser)
export const frontendAPI = axios.create({
  baseURL: TEST_CONFIG.FRONTEND_URL,
  timeout: 30000,
  headers: {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
  }
});

// Utility functions with enhanced retry logic
export const waitForService = async (url: string, maxRetries = 45, interval = 3000): Promise<boolean> => {
  console.log(`Waiting for service: ${url}`);
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await axios.get(url, { 
        timeout: 8000,
        validateStatus: (status) => status < 500 // Accept 200-499 as "service running"
      });
      if (response.status < 400) {
        console.log(`✅ Service ready: ${url} (${response.status})`);
        return true;
      }
    } catch (error: any) {
      if (i % 10 === 0) { // Log every 10th attempt
        console.log(`⏳ Attempt ${i + 1}/${maxRetries} for ${url}: ${error.code || error.message}`);
      }
    }
    
    if (i < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }
  console.log(`❌ Service failed to become ready: ${url}`);
  return false;
};

export const authenticateUser = async (username: string, password: string): Promise<string> => {
  try {
    const response = await backendAPI.post('/users/login', {
      username: username,
      email: TEST_USERS[username as keyof typeof TEST_USERS]?.email || `${username}@example.com`,
      password
    });
    
    const token = response.data.data.token;
    authTokens[username] = token;
    
    // Set default authorization header for future requests
    backendAPI.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    
    return token;
  } catch (error) {
    console.error(`Failed to authenticate user ${username}:`, error);
    throw error;
  }
};

export const getAuthenticatedAPI = (username: string) => {
  const token = authTokens[username];
  if (!token) {
    throw new Error(`No auth token found for user ${username}. Call authenticateUser first.`);
  }
  
  return axios.create({
    baseURL: TEST_CONFIG.BACKEND_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  });
};

export const cleanupTestData = async (): Promise<void> => {
  if (!mongoClient) return;
  
  try {
    const db = mongoClient.db('figure_collector_test');
    
    // Clean up any figures created during tests (preserve test fixtures)
    await db.collection('figures').deleteMany({
      createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } // Last hour
    });
    
    // Clean up any users created during tests (preserve test fixtures)
    await db.collection('users').deleteMany({
      email: { $regex: /test-.*@example\.com/ } // Only test emails with timestamp
    });
    
    console.log('Test data cleanup completed');
  } catch (error) {
    console.error('Error during test data cleanup:', error);
  }
};

export const createTestFigure = async (username: string, figureData: any) => {
  const api = getAuthenticatedAPI(username);
  const response = await api.post('/api/figures', figureData);
  return response.data.data;
};

export const getMongoClient = (): MongoClient => {
  if (!mongoClient) {
    throw new Error('MongoDB client not initialized. Run setup first.');
  }
  return mongoClient;
};

// Jest setup hooks with enhanced service coordination
beforeAll(async () => {
  console.log('🚀 Starting integration test suite setup...');
  console.log('🔧 Configuration:', {
    backend: TEST_CONFIG.BACKEND_URL,
    frontend: TEST_CONFIG.FRONTEND_URL,
    scraper: TEST_CONFIG.SCRAPER_URL,
    version: TEST_CONFIG.VERSION_MANAGER_URL,
    mongodb: TEST_CONFIG.MONGODB_URI,
    timeout: TEST_CONFIG.TEST_TIMEOUT
  });
  
  // Wait for infrastructure services first (in dependency order)
  console.log('🏗️  Phase 1: Infrastructure services...');
  
  const infrastructureServices = [
    { name: 'Version Service', url: `${TEST_CONFIG.VERSION_MANAGER_URL}/health`, timeout: 60000 },
    { name: 'Page Scraper', url: `${TEST_CONFIG.SCRAPER_URL}/health`, timeout: 90000 }
  ];
  
  for (const service of infrastructureServices) {
    console.log(`  📡 Checking ${service.name}...`);
    const isReady = await waitForService(service.url, 30, 3000);
    if (!isReady) {
      throw new Error(`❌ ${service.name} failed to become ready within timeout`);
    }
    console.log(`  ✅ ${service.name} is ready`);
  }
  
  // Wait for core application services
  console.log('🚀 Phase 2: Core application services...');
  
  const coreServices = [
    { name: 'Backend', url: `${TEST_CONFIG.BACKEND_URL}/health` },
    { name: 'Frontend', url: TEST_CONFIG.FRONTEND_URL }
  ];
  
  for (const service of coreServices) {
    console.log(`  📡 Checking ${service.name}...`);
    const isReady = await waitForService(service.url, 45, 3000);
    if (!isReady) {
      throw new Error(`❌ ${service.name} failed to become ready within timeout`);
    }
    console.log(`  ✅ ${service.name} is ready`);
  }
  
  // Initialize MongoDB connection
  console.log('📊 Connecting to MongoDB...');
  mongoClient = new MongoClient(TEST_CONFIG.MONGODB_URI);
  await mongoClient.connect();
  console.log('✅ MongoDB connected');
  
  // Verify test data exists
  const db = mongoClient.db('figcollector_test');
  const userCount = await db.collection('users').countDocuments();
  const figureCount = await db.collection('figures').countDocuments();
  
  console.log(`📋 Test data verification: ${userCount} users, ${figureCount} figures`);
  
  if (userCount === 0 || figureCount === 0) {
    throw new Error('❌ Test data not found. Ensure MongoDB initialization completed.');
  }
  
  // Pre-authenticate test users for performance
  console.log('🔐 Pre-authenticating test users...');
  try {
    for (const [key, user] of Object.entries(TEST_USERS)) {
      await authenticateUser(key, user.password);
      console.log(`  ✅ ${user.username} authenticated`);
    }
  } catch (error) {
    console.error('❌ Failed to pre-authenticate users:', error);
    throw error;
  }
  
  console.log('🎉 Integration test suite setup completed!');
}, 300000); // 5 minute timeout for setup with proper service coordination

afterAll(async () => {
  console.log('🧹 Cleaning up integration test suite...');
  
  // Clean up test data
  await cleanupTestData();
  
  // Close MongoDB connection
  if (mongoClient) {
    await mongoClient.close();
    console.log('✅ MongoDB connection closed');
  }
  
  console.log('✨ Integration test suite cleanup completed');
}, 60000); // Increased cleanup timeout

afterEach(async () => {
  // Clean up any test-specific data after each test
  await cleanupTestData();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export everything for use in tests
export {
  mongoClient,
  testUsers,
  authTokens
};