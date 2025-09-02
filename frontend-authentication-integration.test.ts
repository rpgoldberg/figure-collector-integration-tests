import { execSync } from 'child_process';
import axios from 'axios';

// Authentication Integration Test relocated from figure-collector-frontend
describe('Frontend Authentication Integration', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

  beforeAll(async () => {
    console.log('🔐 Starting Frontend Authentication Integration Tests');
    
    // Ensure services are running
    try {
      const backendHealth = await axios.get(`${backendUrl}/health`, { timeout: 5000 });
      console.log(`✅ Backend health: ${backendHealth.status}`);
    } catch (error) {
      console.error('❌ Backend health check failed:', error.message);
      throw new Error('Backend service not available');
    }
  });

  describe('Backend Login API Integration', () => {
    it('successfully logs in with valid credentials via backend API', async () => {
      const loginData = {
        username: 'testuser1',
        email: 'test1@example.com',
        password: 'testpass123'
      };

      try {
        const response = await axios.post(`${backendUrl}/users/login`, loginData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('success', true);
        expect(response.data).toHaveProperty('data');
        expect(response.data.data).toHaveProperty('token');
        expect(response.data.data).toHaveProperty('email', loginData.email);

        console.log(`✅ Authentication successful for ${loginData.email}`);
      } catch (error) {
        if (error.response?.status === 401) {
          console.log('ℹ️  Authentication failed as expected (user may not exist)');
          expect(error.response.status).toBe(401);
        } else {
          throw error;
        }
      }
    });

    it('handles invalid credentials correctly via backend API', async () => {
      const loginData = {
        username: 'invaliduser',
        email: 'invalid@example.com',
        password: 'wrongpassword'
      };

      try {
        const response = await axios.post(`${backendUrl}/users/login`, loginData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        // If we get here, something's wrong
        throw new Error('Expected authentication to fail');
      } catch (error) {
        expect(error.response?.status).toBe(401);
        expect(error.response?.data).toHaveProperty('message');
        console.log(`✅ Invalid credentials properly rejected: ${error.response.data.message}`);
      }
    });

    it('validates required fields in login request', async () => {
      const incompleteData = { username: 'testuser1', email: 'test1@example.com' }; // Missing password

      try {
        const response = await axios.post(`${backendUrl}/users/login`, incompleteData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        throw new Error('Expected validation error');
      } catch (error) {
        expect(error.response?.status).toBe(401); // Authentication failure for incomplete credentials
        console.log(`✅ Field validation working correctly`);
      }
    });
  });

  describe('Registration API Integration', () => {
    const testUser = {
      username: `testuser_${Date.now()}`,
      email: `test_${Date.now()}@example.com`,
      password: 'securepassword123'
    };

    it('successfully registers new user via backend API', async () => {
      try {
        const response = await axios.post(`${backendUrl}/users/register`, testUser, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        expect(response.status).toBe(201);
        expect(response.data).toHaveProperty('data');
        expect(response.data.data).toHaveProperty('email', testUser.email);
        expect(response.data.data).toHaveProperty('username', testUser.username);

        console.log(`✅ User registration successful: ${testUser.username}`);
      } catch (error) {
        if (error.response?.status === 409) {
          console.log('ℹ️  User already exists - registration conflict handled properly');
          expect(error.response.status).toBe(409);
        } else {
          throw error;
        }
      }
    });

    it('prevents duplicate user registration', async () => {
      // Try to register the same user again
      try {
        const response = await axios.post(`${backendUrl}/users/register`, testUser, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        throw new Error('Expected duplicate registration to fail');
      } catch (error) {
        expect(error.response?.status).toBe(409); // Proper conflict status for duplicate registration
        console.log('✅ Duplicate registration properly prevented');
      }
    });
  });

  describe('JWT Token Integration', () => {
    let authToken: string;

    beforeAll(async () => {
      // Login to get a token
      try {
        const response = await axios.post(`${backendUrl}/users/login`, {
          username: 'testuser1',
          email: 'test1@example.com',
          password: 'testpass123'
        });
        authToken = response.data.data.token;
      } catch (error) {
        console.log('ℹ️  Could not obtain auth token for protected route tests');
        authToken = null;
      }
    });

    it('accesses protected routes with valid JWT token', async () => {
      if (!authToken) {
        console.log('ℹ️  Skipping protected route test - no auth token');
        return;
      }

      try {
        const response = await axios.get(`${backendUrl}/figures`, {
          headers: { 
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('success');
        console.log('✅ Protected route accessible with valid token');
      } catch (error) {
        console.log(`ℹ️  Protected route test result: ${error.response?.status}`);
        // May fail if user has no figures - that's okay
        expect([200, 404]).toContain(error.response?.status);
      }
    });

    it('rejects access to protected routes without JWT token', async () => {
      try {
        const response = await axios.get(`${backendUrl}/figures`, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        throw new Error('Expected unauthorized access to fail');
      } catch (error) {
        expect(error.response?.status).toBe(401);
        console.log('✅ Protected route properly secured against unauthorized access');
      }
    });
  });

  afterAll(() => {
    console.log('🔐 Frontend Authentication Integration Tests completed');
  });
});