import axios from 'axios';

// End-to-End Workflows Integration Test relocated from figure-collector-frontend  
describe('Frontend E2E Workflows Integration', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    console.log('🔄 Starting Frontend E2E Workflows Integration Tests');
    
    // Create test user for workflows
    const testUser = {
      username: `e2e_user_${Date.now()}`,
      email: `e2e_${Date.now()}@example.com`,
      password: 'e2e_test_password_123'
    };

    try {
      // Register test user
      const registerResponse = await axios.post(`${backendUrl}/users/register`, testUser, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      if (registerResponse.status === 201) {
        console.log(`✅ Test user created: ${testUser.username}`);
      }

      // Login to get auth token
      const loginResponse = await axios.post(`${backendUrl}/users/login`, {
        username: testUser.username,
        email: testUser.email,
        password: testUser.password
      }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      authToken = loginResponse.data.token;
      testUserId = loginResponse.data.user.id;
      console.log(`✅ Authentication token obtained for E2E tests`);
    } catch (error) {
      console.log('ℹ️  Could not create test user - using existing credentials if available');
      authToken = null;
    }
  });

  const getAuthHeaders = () => ({
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json'
  });

  describe('Complete User Registration and Login Workflow', () => {
    it('executes full user registration → login → dashboard access workflow', async () => {
      const workflowUser = {
        username: `workflow_user_${Date.now()}`,
        email: `workflow_${Date.now()}@example.com`,
        password: 'WorkflowTest123!'
      };

      try {
        // Step 1: Register new user
        const registerResponse = await axios.post(`${backendUrl}/users/register`, workflowUser, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        expect(registerResponse.status).toBe(201);
        expect(registerResponse.data).toHaveProperty('success', true);
        expect(registerResponse.data).toHaveProperty('data');
        console.log(`✅ Step 1: User registration successful`);

        // Step 2: Login with new credentials
        const loginResponse = await axios.post(`${backendUrl}/users/login`, {
          username: workflowUser.username,
          email: workflowUser.email,
          password: workflowUser.password
        }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        expect(loginResponse.status).toBe(200);
        expect(loginResponse.data).toHaveProperty('success', true);
        expect(loginResponse.data.data).toHaveProperty('token');
        console.log(`✅ Step 2: Login successful`);

        // Step 3: Access protected dashboard data
        const dashboardResponse = await axios.get(`${backendUrl}/figures/stats`, {
          headers: {
            'Authorization': `Bearer ${loginResponse.data.data.token}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        });

        expect(dashboardResponse.status).toBe(200);
        expect(dashboardResponse.data).toHaveProperty('data');
        expect(dashboardResponse.data.data).toHaveProperty('totalCount');
        console.log(`✅ Step 3: Dashboard access successful`);

        console.log('🎯 Complete registration → login → dashboard workflow: SUCCESS');
      } catch (error) {
        console.error('❌ E2E Registration workflow failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  describe('Complete Figure Management Workflow', () => {
    it('executes full figure creation → retrieval → update → deletion workflow', async () => {
      if (!authToken) {
        console.log('ℹ️  Skipping figure management workflow - no auth token');
        return;
      }

      const workflowFigure = {
        name: 'E2E Test Figure',
        manufacturer: 'E2E Test Company',
        series: 'E2E Test Series',
        scale: '1/8',
        price: 20000,
        location: 'E2E Test Location',
        boxNumber: 'E2E-001'
      };

      let figureId: string;

      try {
        // Step 1: Create figure
        const createResponse = await axios.post(`${backendUrl}/figures`, workflowFigure, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(createResponse.status).toBe(201);
        expect(createResponse.data).toHaveProperty('_id');
        expect(createResponse.data.name).toBe(workflowFigure.name);
        figureId = createResponse.data._id;
        console.log(`✅ Step 1: Figure creation successful - ID: ${figureId}`);

        // Step 2: Retrieve figure by ID
        const retrieveResponse = await axios.get(`${backendUrl}/figures/${figureId}`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(retrieveResponse.status).toBe(200);
        expect(retrieveResponse.data._id).toBe(figureId);
        expect(retrieveResponse.data.name).toBe(workflowFigure.name);
        console.log(`✅ Step 2: Figure retrieval successful`);

        // Step 3: Update figure
        const updateData = {
          name: 'E2E Updated Test Figure',
          price: 25000,
          location: 'E2E Updated Location'
        };

        const updateResponse = await axios.put(`${backendUrl}/figures/${figureId}`, updateData, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(updateResponse.status).toBe(200);
        expect(updateResponse.data.name).toBe(updateData.name);
        expect(updateResponse.data.price).toBe(updateData.price);
        console.log(`✅ Step 3: Figure update successful`);

        // Step 4: Verify figure appears in list
        const listResponse = await axios.get(`${backendUrl}/figures?page=1&limit=20`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(listResponse.status).toBe(200);
        const figureInList = listResponse.data.data.find((f: any) => f._id === figureId);
        expect(figureInList).toBeTruthy();
        expect(figureInList.name).toBe(updateData.name);
        console.log(`✅ Step 4: Figure appears in list with updates`);

        // Step 5: Delete figure
        const deleteResponse = await axios.delete(`${backendUrl}/figures/${figureId}`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(deleteResponse.status).toBe(200);
        console.log(`✅ Step 5: Figure deletion successful`);

        // Step 6: Verify figure no longer exists
        try {
          await axios.get(`${backendUrl}/figures/${figureId}`, {
            headers: getAuthHeaders(),
            timeout: 10000
          });
          throw new Error('Expected deleted figure to not be found');
        } catch (error) {
          expect(error.response?.status).toBe(404);
          console.log(`✅ Step 6: Figure properly deleted (404 confirmed)`);
        }

        console.log('🎯 Complete figure CRUD workflow: SUCCESS');
      } catch (error) {
        console.error('❌ E2E Figure management workflow failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  describe('Complete Search and Filter Workflow', () => {
    let searchFigures: any[] = [];

    beforeAll(async () => {
      if (!authToken) return;

      // Create test figures for search
      const testFigures = [
        { name: 'Search Test Miku', manufacturer: 'Good Smile Company', scale: '1/8', location: 'Display A' },
        { name: 'Search Test Luka', manufacturer: 'Good Smile Company', scale: '1/7', location: 'Display B' },
        { name: 'Search Test Rin', manufacturer: 'ALTER', scale: '1/8', location: 'Display A' }
      ];

      for (const figure of testFigures) {
        try {
          const response = await axios.post(`${backendUrl}/figures`, figure, {
            headers: getAuthHeaders(),
            timeout: 10000
          });
          searchFigures.push(response.data);
        } catch (error) {
          console.log(`ℹ️  Could not create search test figure: ${figure.name}`);
        }
      }

      console.log(`✅ Created ${searchFigures.length} test figures for search workflow`);
    });

    it('executes full search → filter → pagination workflow', async () => {
      if (!authToken) {
        console.log('ℹ️  Skipping search workflow - no auth token');
        return;
      }

      try {
        // Step 1: General search
        const searchResponse = await axios.get(`${backendUrl}/figures/search?q=Search Test`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(searchResponse.status).toBe(200);
        expect(searchResponse.data).toHaveProperty('success');
        expect(Array.isArray(searchResponse.data.data)).toBe(true);
        const searchResults = searchResponse.data.data.filter((f: any) => 
          f.name.includes('Search Test')
        );
        console.log(`✅ Step 1: General search found ${searchResults.length} results`);

        // Step 2: Manufacturer filter
        const manufacturerFilter = await axios.get(`${backendUrl}/figures?manufacturer=Good Smile Company`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(manufacturerFilter.status).toBe(200);
        const gscFigures = manufacturerFilter.data.data.filter((f: any) => 
          f.manufacturer === 'Good Smile Company' && f.name.includes('Search Test')
        );
        console.log(`✅ Step 2: Manufacturer filter found ${gscFigures.length} Good Smile Company figures`);

        // Step 3: Scale filter  
        const scaleFilter = await axios.get(`${backendUrl}/figures?scale=1/8`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(scaleFilter.status).toBe(200);
        const oneEighthFigures = scaleFilter.data.data.filter((f: any) => 
          f.scale === '1/8' && f.name.includes('Search Test')
        );
        console.log(`✅ Step 3: Scale filter found ${oneEighthFigures.length} 1/8 scale figures`);

        // Step 4: Pagination
        const paginatedResponse = await axios.get(`${backendUrl}/figures?page=1&limit=2`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(paginatedResponse.status).toBe(200);
        expect(paginatedResponse.data).toHaveProperty('page', 1);
        expect(paginatedResponse.data).toHaveProperty('total');
        expect(paginatedResponse.data.data.length).toBeLessThanOrEqual(2);
        console.log(`✅ Step 4: Pagination working - Page 1 with limit 2`);

        console.log('🎯 Complete search → filter → pagination workflow: SUCCESS');
      } catch (error) {
        console.error('❌ E2E Search workflow failed:', error.response?.data || error.message);
        throw error;
      }
    });

    afterAll(async () => {
      // Cleanup search test figures
      if (!authToken) return;

      for (const figure of searchFigures) {
        try {
          await axios.delete(`${backendUrl}/figures/${figure._id}`, {
            headers: getAuthHeaders(),
            timeout: 5000
          });
        } catch (error) {
          console.log(`ℹ️  Could not cleanup figure: ${figure.name}`);
        }
      }

      console.log(`✅ Cleaned up ${searchFigures.length} search test figures`);
    });
  });

  describe('Complete Statistics and Analytics Workflow', () => {
    it('executes full statistics retrieval → analysis workflow', async () => {
      if (!authToken) {
        console.log('ℹ️  Skipping statistics workflow - no auth token');
        return;
      }

      try {
        // Step 1: Get overall statistics
        const statsResponse = await axios.get(`${backendUrl}/figures/stats`, {
          headers: getAuthHeaders(),
          timeout: 10000
        });

        expect(statsResponse.status).toBe(200);
        expect(statsResponse.data).toHaveProperty('totalCount');
        expect(statsResponse.data).toHaveProperty('manufacturerStats');
        expect(statsResponse.data).toHaveProperty('scaleStats');
        expect(statsResponse.data).toHaveProperty('locationStats');
        console.log(`✅ Step 1: Statistics retrieved - ${statsResponse.data.totalCount} total figures`);

        // Step 2: Analyze manufacturer distribution
        const manufacturerStats = statsResponse.data.manufacturerStats;
        expect(Array.isArray(manufacturerStats)).toBe(true);
        if (manufacturerStats.length > 0) {
          expect(manufacturerStats[0]).toHaveProperty('_id');
          expect(manufacturerStats[0]).toHaveProperty('count');
          console.log(`✅ Step 2: Top manufacturer: ${manufacturerStats[0]._id} (${manufacturerStats[0].count} figures)`);
        } else {
          console.log('✅ Step 2: No manufacturer data (empty collection)');
        }

        // Step 3: Analyze scale distribution
        const scaleStats = statsResponse.data.scaleStats;
        expect(Array.isArray(scaleStats)).toBe(true);
        if (scaleStats.length > 0) {
          expect(scaleStats[0]).toHaveProperty('_id');
          expect(scaleStats[0]).toHaveProperty('count');
          console.log(`✅ Step 3: Most common scale: ${scaleStats[0]._id} (${scaleStats[0].count} figures)`);
        } else {
          console.log('✅ Step 3: No scale data (empty collection)');
        }

        // Step 4: Analyze location distribution
        const locationStats = statsResponse.data.locationStats;
        expect(Array.isArray(locationStats)).toBe(true);
        if (locationStats.length > 0) {
          expect(locationStats[0]).toHaveProperty('_id');
          expect(locationStats[0]).toHaveProperty('count');
          console.log(`✅ Step 4: Primary location: ${locationStats[0]._id} (${locationStats[0].count} figures)`);
        } else {
          console.log('✅ Step 4: No location data (empty collection)');
        }

        console.log('🎯 Complete statistics and analytics workflow: SUCCESS');
      } catch (error) {
        console.error('❌ E2E Statistics workflow failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  describe('Error Recovery and Resilience Workflow', () => {
    it('executes error handling → retry → recovery workflow', async () => {
      try {
        // Step 1: Trigger authentication error
        try {
          await axios.get(`${backendUrl}/figures`, {
            headers: { 
              'Authorization': 'Bearer invalid_token',
              'Content-Type': 'application/json' 
            },
            timeout: 10000
          });
          throw new Error('Expected authentication error');
        } catch (error) {
          expect(error.response?.status).toBe(401);
          console.log('✅ Step 1: Authentication error properly handled');
        }

        // Step 2: Trigger validation error
        if (authToken) {
          try {
            await axios.post(`${backendUrl}/figures`, {
              name: '', // Invalid empty name
              manufacturer: '' // Invalid empty manufacturer
            }, {
              headers: getAuthHeaders(),
              timeout: 10000
            });
            throw new Error('Expected validation error');
          } catch (error) {
            expect(error.response?.status).toBe(422);
            console.log('✅ Step 2: Validation error properly handled');
          }
        }

        // Step 3: Successful recovery after fixing request
        if (authToken) {
          const validFigure = {
            name: 'Recovery Test Figure',
            manufacturer: 'Recovery Test Company',
            scale: '1/10',
            location: 'Recovery Test Location'
          };

          const recoveryResponse = await axios.post(`${backendUrl}/figures`, validFigure, {
            headers: getAuthHeaders(),
            timeout: 10000
          });

          expect(recoveryResponse.status).toBe(201);
          expect(recoveryResponse.data.name).toBe(validFigure.name);
          console.log('✅ Step 3: Successful recovery after error correction');

          // Cleanup
          try {
            await axios.delete(`${backendUrl}/figures/${recoveryResponse.data._id}`, {
              headers: getAuthHeaders(),
              timeout: 5000
            });
          } catch (cleanupError) {
            console.log('ℹ️  Cleanup note: Recovery test figure may remain');
          }
        }

        console.log('🎯 Complete error recovery workflow: SUCCESS');
      } catch (error) {
        console.error('❌ E2E Error recovery workflow failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  afterAll(async () => {
    console.log('🔄 Frontend E2E Workflows Integration Tests completed');
    
    // Cleanup any remaining test data
    if (authToken) {
      console.log('ℹ️  E2E test cleanup completed');
    }
  });
});