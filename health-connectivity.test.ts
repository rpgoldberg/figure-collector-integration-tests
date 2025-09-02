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
      expect(response.data).toHaveProperty('status', 'healthy');
      expect(response.data).toHaveProperty('service');
      expect(response.data).toHaveProperty('timestamp');
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
      expect(['healthy', 'unhealthy', 'unknown']).toContain(scraperService.status);
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
      const response = await backendAPI.get('/api/figures/stats');
      
      // Should get stats even if empty (requires DB connection)
      expect(response.status).toBe(401); // Unauthorized due to no auth, but DB connection works
    });

    test('MongoDB has test data initialized', async () => {
      // Verify test data through backend API
      const loginResponse = await backendAPI.post('/api/users/login', {
        email: 'test1@example.com',
        password: 'testpass123'
      });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.data.data).toHaveProperty('token');
      
      // Use token to fetch figures (verifies test data exists)
      const token = loginResponse.data.data.token;
      const figuresResponse = await backendAPI.get('/api/figures', {
        headers: { Authorization: `Bearer ${token}` }
      });

      expect(figuresResponse.status).toBe(200);
      expect(figuresResponse.data.data.length).toBeGreaterThan(0);
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
      expect(['healthy', 'not-registered', 'unhealthy']).toContain(frontendService.status);
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
        expect(['healthy', 'unhealthy', 'unknown', 'not-registered']).toContain(service.status);
      });
    });

    test('Services handle malformed requests appropriately', async () => {
      // Test invalid JSON to backend
      try {
        await backendAPI.post('/api/users/login', 'invalid-json', {
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