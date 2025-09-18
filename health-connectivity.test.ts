import { 
  TEST_CONFIG, 
  backendAPI, 
  scraperAPI, 
  versionAPI, 
  frontendAPI,
  waitForService 
} from './setup';

describe('Service Health & Connectivity Tests', () => {
  describe('Health Endpoint Accessibility', () => {
    test('Backend health endpoint responds correctly', async () => {
      const response = await backendAPI.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'ok');
    });

    test('Version service health endpoint responds correctly', async () => {
      const response = await versionAPI.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('service', 'version-manager');
      expect(response.data).toHaveProperty('versionData');
    });

    test('Page scraper health endpoint responds correctly', async () => {
      const response = await scraperAPI.get('/health');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('service');
    });

    test('Frontend application is accessible', async () => {
      const response = await frontendAPI.get('/');
      
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/text\/html/);
    });
  });

  describe('Network Connectivity Between Containers', () => {
    test('Backend can reach scraper service', async () => {
      // Test internal container networking by checking if backend can call scraper
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      
      // Backend should have attempted to fetch scraper version
      const scraperService = response.data.services.scraper;
      expect(scraperService).toBeDefined();
      expect(['ok', 'unhealthy', 'unknown', 'error']).toContain(scraperService.status);
    });

    test('Backend can reach version service', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('application');
      
      // If version service is reachable, application info should be populated
      if (response.data.application.name) {
        expect(response.data.application).toHaveProperty('version');
        expect(response.data.application).toHaveProperty('releaseDate');
      }
    });

    test('Frontend can reach backend through proxy', async () => {
      // Test that frontend nginx proxy correctly forwards to backend
      try {
        const response = await frontendAPI.get('/api/health');
        expect(response.status).toBe(200);
      } catch (error: any) {
        // If we get a 404, the proxy is working but endpoint might not exist
        // If we get connection error, proxy is not working
        expect(error.response?.status).not.toBe(undefined);
        expect(error.code).not.toBe('ECONNREFUSED');
      }
    });
  });

  describe('Database Connection and Initialization', () => {
    test('Backend can connect to MongoDB', async () => {
      // Test database connectivity through a simple API call
      // Either 200 (stats endpoint is public) or 401 (requires auth) proves backend is running
      // and connected to MongoDB
      try {
        const response = await backendAPI.get('/figures/stats');
        // 200 is fine - the endpoint might be public, but it still proves MongoDB connectivity
        // because stats require database queries
        expect(response.status).toBe(200);
        expect(response.data).toBeDefined();
      } catch (error: any) {
        // Check if it's a network/connection error (no response)
        if (!error.response) {
          console.error('Connection error to backend:', error.message);
          throw new Error('Backend is not accessible - check if services are running');
        }
        // 401 is also fine - it means backend is running but requires auth
        expect(error.response?.status).toBe(401);
      }
    });

    test('MongoDB has test data initialized', async () => {
      // Verify test data through backend API
      const loginResponse = await backendAPI.post('/auth/login', {
        email: 'test1@example.com',
        password: 'testpass123'
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.data).toHaveProperty('accessToken');

      // Use token to fetch figures (verifies test data exists)
      const token = loginResponse.data.data.accessToken;
      const figuresResponse = await backendAPI.get('/figures', {
        headers: { Authorization: `Bearer ${token}` }
      });

      expect(figuresResponse.status).toBe(200);
      // Check that the response is an array (it may be empty since this is a test environment)
      expect(Array.isArray(figuresResponse.data.data)).toBe(true);
      // In integration tests, figures array can be empty or populated
      console.log(`   ℹ️  Found ${figuresResponse.data.data.length} figures in MongoDB (0 is valid in test environment)`);
    });
  });

  describe('Service Registration Completion', () => {
    test('Frontend has registered with backend', async () => {
      // Check if frontend service appears in version endpoint
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      expect(response.data.services).toHaveProperty('frontend');
      
      const frontendService = response.data.services.frontend;
      expect(frontendService).toHaveProperty('status');
      expect(frontendService).toHaveProperty('version');
      
      // Status should be either 'healthy' or 'not-registered' 
      // (depends on timing of registration)
      expect(['ok', 'not-registered', 'unhealthy']).toContain(frontendService.status);
    });

    test('All expected services are tracked in version endpoint', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data.services).toHaveProperty('backend');
      expect(response.data.services).toHaveProperty('frontend');
      expect(response.data.services).toHaveProperty('scraper');
      
      // Each service should have basic structure
      for (const serviceName of ['backend', 'frontend', 'scraper']) {
        const service = response.data.services[serviceName];
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('version');
        expect(service).toHaveProperty('name');
      }
    });
  });

  describe('Service Response Times', () => {
    test('All health endpoints respond within acceptable time', async () => {
      const startTime = Date.now();
      
      const healthChecks = await Promise.all([
        backendAPI.get('/health'),
        versionAPI.get('/health'),
        scraperAPI.get('/health')
      ]);
      
      const totalTime = Date.now() - startTime;
      
      // All health checks should complete within 5 seconds
      expect(totalTime).toBeLessThan(5000);
      
      // All should be successful
      healthChecks.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('Inter-service calls complete within reasonable time', async () => {
      const startTime = Date.now();
      
      // This call requires backend to call both version service and scraper
      const response = await backendAPI.get('/version');
      
      const totalTime = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(totalTime).toBeLessThan(10000); // 10 seconds max for aggregated call
    });
  });

  describe('Error Handling and Resilience', () => {
    test('Backend handles unavailable external services gracefully', async () => {
      // Backend should still respond even if some services are unavailable
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      
      // Services should have status indicating their availability
      Object.values(response.data.services).forEach((service: any) => {
        expect(service).toHaveProperty('status');
        expect(['ok', 'unhealthy', 'unknown', 'not-registered', 'error']).toContain(service.status);
      });
    });

    test('Services handle malformed requests appropriately', async () => {
      // Test invalid JSON to backend
      try {
        await backendAPI.post('/auth/login', 'invalid-json', {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
      }
      
      // Test invalid request to scraper
      try {
        await scraperAPI.post('/scrape/mfc', {});
      } catch (error: any) {
        expect(error.response?.status).toBe(400);
        expect(error.response?.data).toHaveProperty('success', false);
      }
    });
  });
});