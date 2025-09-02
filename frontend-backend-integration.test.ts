import { 
  TEST_CONFIG, 
  backendAPI, 
  frontendAPI,
  authenticateUser,
  getAuthenticatedAPI,
  TEST_USERS,
  createTestFigure
} from './setup';

describe('Frontend → Backend Integration Tests', () => {
  let userToken: string;
  let authenticatedAPI: any;

  beforeAll(async () => {
    userToken = await authenticateUser('USER1', TEST_USERS.USER1.password);
    authenticatedAPI = getAuthenticatedAPI('USER1');
  });

  describe('Complete User Authentication Workflow', () => {
    test('User registration through frontend to backend', async () => {
      const newUser = {
        username: `testuser_${Date.now()}`,
        email: `test_${Date.now()}@example.com`,
        password: 'testpass123'
      };

      // Frontend would send this registration request to backend
      const response = await backendAPI.post('/api/users/register', newUser);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('token');
      expect(response.data.data).toHaveProperty('username', newUser.username);
      expect(response.data.data).toHaveProperty('email', newUser.email);
      
      // Verify password is not returned
      expect(response.data.data).not.toHaveProperty('password');
    });

    test('User login through frontend to backend', async () => {
      const loginData = {
        email: TEST_USERS.USER1.email,
        password: TEST_USERS.USER1.password
      };

      const response = await backendAPI.post('/api/users/login', loginData);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('token');
      expect(response.data.data).toHaveProperty('username', TEST_USERS.USER1.username);
      
      // Token should be a valid JWT format
      const token = response.data.data.token;
      expect(token).toMatch(/^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*$/);
    });

    test('JWT token persistence and validation', async () => {
      // First login to get token
      const loginResponse = await backendAPI.post('/api/users/login', {
        email: TEST_USERS.USER1.email,
        password: TEST_USERS.USER1.password
      });
      
      const token = loginResponse.data.data.token;
      
      // Use token to access protected endpoint
      const protectedResponse = await backendAPI.get('/api/users/profile', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      expect(protectedResponse.status).toBe(200);
      expect(protectedResponse.data.data).toHaveProperty('username', TEST_USERS.USER1.username);
      expect(protectedResponse.data.data).toHaveProperty('email', TEST_USERS.USER1.email);
    });

    test('Authentication state persistence across requests', async () => {
      // Verify that authenticated API instance maintains session
      const profileResponse = await authenticatedAPI.get('/api/users/profile');
      expect(profileResponse.status).toBe(200);
      
      // Make multiple requests to verify token persistence
      const requests = await Promise.all([
        authenticatedAPI.get('/api/figures'),
        authenticatedAPI.get('/api/figures/stats'),
        authenticatedAPI.get('/api/users/profile')
      ]);
      
      requests.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Figure Management Workflow', () => {
    test('Create figure through frontend to backend', async () => {
      const figureData = {
        manufacturer: 'Frontend Test Manufacturer',
        name: 'Frontend Test Figure',
        scale: '1/8',
        location: 'Frontend Test Shelf',
        boxNumber: 'FRONTEND001'
      };

      const response = await authenticatedAPI.post('/api/figures', figureData);
      
      expect(response.status).toBe(201);
      expect(response.data.success).toBe(true);
      expect(response.data.data).toHaveProperty('_id');
      expect(response.data.data.manufacturer).toBe(figureData.manufacturer);
      expect(response.data.data.name).toBe(figureData.name);
      expect(response.data.data).toHaveProperty('userId');
    });

    test('Fetch figure list through frontend API calls', async () => {
      // First ensure we have at least one figure
      await createTestFigure('USER1', {
        manufacturer: 'List Test Manufacturer',
        name: 'List Test Figure',
        scale: '1/10',
        location: 'List Test Location',
        boxNumber: 'LIST001'
      });

      const response = await authenticatedAPI.get('/api/figures');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);
      
      // Verify pagination structure
      expect(response.data).toHaveProperty('pagination');
      expect(response.data.pagination).toHaveProperty('currentPage');
      expect(response.data.pagination).toHaveProperty('totalPages');
    });

    test('Update figure through frontend to backend', async () => {
      // Create a figure first
      const figure = await createTestFigure('USER1', {
        manufacturer: 'Update Test Original',
        name: 'Update Test Figure',
        scale: '1/8',
        location: 'Original Location',
        boxNumber: 'UPDATE001'
      });

      const updateData = {
        manufacturer: 'Update Test Modified',
        name: 'Updated Test Figure',
        scale: '1/7',
        location: 'New Location',
        boxNumber: 'UPDATE001'
      };

      const response = await authenticatedAPI.put(`/api/figures/${figure._id}`, updateData);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.data.manufacturer).toBe(updateData.manufacturer);
      expect(response.data.data.name).toBe(updateData.name);
      expect(response.data.data.scale).toBe(updateData.scale);
    });

    test('Delete figure through frontend to backend', async () => {
      // Create a figure first
      const figure = await createTestFigure('USER1', {
        manufacturer: 'Delete Test Manufacturer',
        name: 'Delete Test Figure',
        scale: '1/8',
        location: 'Delete Test Location',
        boxNumber: 'DELETE001'
      });

      const deleteResponse = await authenticatedAPI.delete(`/api/figures/${figure._id}`);
      
      expect(deleteResponse.status).toBe(200);
      expect(deleteResponse.data.success).toBe(true);
      
      // Verify figure is deleted
      try {
        await authenticatedAPI.get(`/api/figures/${figure._id}`);
        fail('Should have thrown 404 error');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });

    test('Figure validation through frontend submissions', async () => {
      const invalidFigureData = {
        // Missing required fields
        manufacturer: '',
        name: '',
        scale: 'invalid-scale',
        location: 'a'.repeat(101), // Too long
        boxNumber: ''
      };

      try {
        await authenticatedAPI.post('/api/figures', invalidFigureData);
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data).toHaveProperty('success', false);
        expect(error.response?.data).toHaveProperty('message');
      }
    });
  });

  describe('Atlas Search Integration', () => {
    test('Search figures through frontend API', async () => {
      // Ensure we have searchable test data
      await createTestFigure('USER1', {
        manufacturer: 'Searchable Manufacturer',
        name: 'Unique Searchable Figure Name',
        scale: '1/8',
        location: 'Search Test Location',
        boxNumber: 'SEARCH001'
      });

      const searchQuery = 'Searchable';
      const response = await authenticatedAPI.get(`/api/figures/search?query=${encodeURIComponent(searchQuery)}`);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('data');
      expect(Array.isArray(response.data.data)).toBe(true);
      
      // Should find our test figure
      const searchResults = response.data.data;
      const foundFigure = searchResults.find((f: any) => 
        f.manufacturer.includes('Searchable') || f.name.includes('Searchable')
      );
      expect(foundFigure).toBeDefined();
    });

    test('Search with complex queries', async () => {
      const complexQueries = [
        'Good Smile',
        'Miku',
        '1/8',
        'BOX001'
      ];

      for (const query of complexQueries) {
        const response = await authenticatedAPI.get(`/api/figures/search?query=${encodeURIComponent(query)}`);
        
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('data');
        expect(Array.isArray(response.data.data)).toBe(true);
        
        // Each result should be relevant to the query
        response.data.data.forEach((figure: any) => {
          const searchableText = [
            figure.manufacturer,
            figure.name,
            figure.scale,
            figure.location,
            figure.boxNumber
          ].join(' ').toLowerCase();
          
          // At least one field should contain the search term
          expect(searchableText).toMatch(new RegExp(query.toLowerCase()));
        });
      }
    });

    test('Search performance and accuracy', async () => {
      const startTime = Date.now();
      const response = await authenticatedAPI.get('/api/figures/search?query=Miku');
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
      
      // Results should be relevant
      const results = response.data.data;
      if (results.length > 0) {
        results.forEach((figure: any) => {
          const hasRelevantContent = [
            figure.manufacturer,
            figure.name,
            figure.location,
            figure.boxNumber
          ].some(field => field && field.toLowerCase().includes('miku'));
          
          expect(hasRelevantContent).toBe(true);
        });
      }
    });
  });

  describe('Frontend Service Registration', () => {
    test('Frontend startup registration with backend', async () => {
      // Simulate frontend registration call
      const registrationData = {
        serviceName: 'frontend',
        version: '1.0.0',
        name: 'figure-collector-frontend',
        status: 'healthy',
        startupTime: new Date().toISOString()
      };

      const response = await backendAPI.post('/register-service', registrationData);
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message');
      
      // Verify registration appears in version endpoint
      const versionResponse = await backendAPI.get('/version');
      expect(versionResponse.status).toBe(200);
      expect(versionResponse.data.services).toHaveProperty('frontend');
      
      const frontendService = versionResponse.data.services.frontend;
      expect(frontendService.version).toBe(registrationData.version);
      expect(frontendService.name).toBe(registrationData.name);
    });

    test('Frontend version reporting in service aggregation', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      expect(response.data.services).toHaveProperty('frontend');
      
      const frontendService = response.data.services.frontend;
      expect(frontendService).toHaveProperty('status');
      expect(frontendService).toHaveProperty('version');
      expect(frontendService).toHaveProperty('name');
      expect(frontendService).toHaveProperty('lastSeen');
    });
  });

  describe('Error Handling and User Experience', () => {
    test('Frontend handles backend API errors gracefully', async () => {
      // Test various error scenarios that frontend would encounter
      
      // Unauthorized access
      try {
        await backendAPI.get('/api/figures');
        fail('Should have thrown unauthorized error');
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
        expect(error.response?.data).toHaveProperty('success', false);
      }
      
      // Invalid resource ID
      try {
        await authenticatedAPI.get('/api/figures/invalid-id');
        fail('Should have thrown invalid ID error');
      } catch (error: any) {
        expect([400, 404]).toContain(error.response?.status);
      }
      
      // Malformed request data
      try {
        await authenticatedAPI.post('/api/figures', { invalid: 'data' });
        fail('Should have thrown validation error');
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
      }
    });

    test('Token expiration handling', async () => {
      // Test with an invalid/expired token
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      
      try {
        await backendAPI.get('/api/users/profile', {
          headers: { Authorization: `Bearer ${expiredToken}` }
        });
        fail('Should have thrown unauthorized error');
      } catch (error: any) {
        expect(error.response?.status).toBe(401);
        expect(error.response?.data).toHaveProperty('success', false);
      }
    });

    test('Network error resilience', async () => {
      // Test timeout handling
      const timeoutAPI = authenticatedAPI;
      timeoutAPI.defaults.timeout = 1; // Very short timeout
      
      try {
        await timeoutAPI.get('/api/figures');
        // If it succeeds, that's fine - server was very fast
      } catch (error: any) {
        // Should be timeout error, not server error
        expect(['ECONNABORTED', 'ETIMEDOUT']).toContain(error.code);
      }
    });
  });

  describe('Data Consistency and Synchronization', () => {
    test('Create-Read-Update-Delete consistency', async () => {
      // Create
      const createData = {
        manufacturer: 'CRUD Test Manufacturer',
        name: 'CRUD Test Figure',
        scale: '1/8',
        location: 'CRUD Test Location',
        boxNumber: 'CRUD001'
      };
      
      const createResponse = await authenticatedAPI.post('/api/figures', createData);
      expect(createResponse.status).toBe(201);
      const figureId = createResponse.data.data._id;
      
      // Read
      const readResponse = await authenticatedAPI.get(`/api/figures/${figureId}`);
      expect(readResponse.status).toBe(200);
      expect(readResponse.data.data.manufacturer).toBe(createData.manufacturer);
      
      // Update
      const updateData = { ...createData, name: 'Updated CRUD Figure' };
      const updateResponse = await authenticatedAPI.put(`/api/figures/${figureId}`, updateData);
      expect(updateResponse.status).toBe(200);
      expect(updateResponse.data.data.name).toBe(updateData.name);
      
      // Verify update persisted
      const readAfterUpdate = await authenticatedAPI.get(`/api/figures/${figureId}`);
      expect(readAfterUpdate.data.data.name).toBe(updateData.name);
      
      // Delete
      const deleteResponse = await authenticatedAPI.delete(`/api/figures/${figureId}`);
      expect(deleteResponse.status).toBe(200);
      
      // Verify deletion
      try {
        await authenticatedAPI.get(`/api/figures/${figureId}`);
        fail('Should have thrown 404');
      } catch (error: any) {
        expect(error.response?.status).toBe(404);
      }
    });

    test('User data isolation between sessions', async () => {
      // Create figure as User1
      const user1Figure = await createTestFigure('USER1', {
        manufacturer: 'User1 Manufacturer',
        name: 'User1 Figure',
        scale: '1/8',
        location: 'User1 Location',
        boxNumber: 'USER1_001'
      });
      
      // Authenticate as User2
      const user2Token = await authenticateUser('USER2', TEST_USERS.USER2.password);
      const user2API = getAuthenticatedAPI('USER2');
      
      // User2 should not see User1's figure
      const user2Figures = await user2API.get('/api/figures');
      expect(user2Figures.status).toBe(200);
      
      const user2FigureList = user2Figures.data.data;
      const user1FigureFound = user2FigureList.find((f: any) => f._id === user1Figure._id);
      expect(user1FigureFound).toBeUndefined();
      
      // User2 should not be able to access User1's figure directly
      try {
        await user2API.get(`/api/figures/${user1Figure._id}`);
        fail('Should have thrown 404 or 403');
      } catch (error: any) {
        expect([403, 404]).toContain(error.response?.status);
      }
    });
  });
});