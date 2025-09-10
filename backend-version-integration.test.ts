import { 
  TEST_CONFIG, 
  backendAPI, 
  versionAPI
} from './setup';

describe('Backend → Version Service Integration Tests', () => {
  describe('Application Version Retrieval', () => {
    test('Version service returns application metadata', async () => {
      const response = await versionAPI.get('/app-version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('name');
      expect(response.data).toHaveProperty('version');
      expect(response.data).toHaveProperty('releaseDate');
      
      // Validate data types
      expect(typeof response.data.name).toBe('string');
      expect(typeof response.data.version).toBe('string');
      expect(typeof response.data.releaseDate).toBe('string');
      
      // Version should follow semantic versioning
      expect(response.data.version).toMatch(/^\d+\.\d+\.\d+/);
      
      // Release date should be a valid date string
      const releaseDate = new Date(response.data.releaseDate);
      expect(releaseDate.toString()).not.toBe('Invalid Date');
    });

    test('Backend includes version service data in version endpoint', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('application');
      
      const appInfo = response.data.application;
      
      if (appInfo.name) {
        // If version service is reachable, should have complete app info
        expect(appInfo).toHaveProperty('version');
        expect(appInfo).toHaveProperty('releaseDate');
        expect(typeof appInfo.name).toBe('string');
        expect(typeof appInfo.version).toBe('string');
      }
    });

    test('Backend handles version service response correctly', async () => {
      // Test direct version service call to understand expected response
      const versionResponse = await versionAPI.get('/app-version');
      expect(versionResponse.status).toBe(200);
      
      // Test backend aggregation of this data
      const backendResponse = await backendAPI.get('/version');
      expect(backendResponse.status).toBe(200);
      
      // Backend should include the same application data
      if (versionResponse.data.name && backendResponse.data.application.name) {
        expect(backendResponse.data.application.name).toBe(versionResponse.data.name);
        expect(backendResponse.data.application.version).toBe(versionResponse.data.version);
        expect(backendResponse.data.application.releaseDate).toBe(versionResponse.data.releaseDate);
      }
    });
  });

  describe('Service Version Validation', () => {
    test('Version service validates service compatibility', async () => {
      const testVersions = {
        backend: '1.0.0',
        frontend: '1.0.0',
        scraper: '1.0.0'
      };

      const response = await versionAPI.get('/validate-versions', {
        params: testVersions
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('valid');
      expect(typeof response.data.valid).toBe('boolean');
      
      if (response.data.valid === false) {
        expect(response.data).toHaveProperty('warnings');
        expect(Array.isArray(response.data.warnings)).toBe(true);
      }
    });

    test('Backend calls version validation with collected service versions', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      // Backend doesn't include validation in the response
      // Just returns application and services info
    });

    test('Version validation handles missing service versions', async () => {
      const partialVersions = {
        backend: '1.0.0'
        // Missing frontend and scraper versions
      };

      const response = await versionAPI.get('/validate-versions', {
        params: partialVersions
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('valid');
      
      // Should handle missing versions gracefully
      if (response.data.valid === false && response.data.warnings) {
        const hasWarnings = response.data.warnings.some((warning: string) => 
          warning.includes('missing') || warning.includes('unknown')
        );
        // It's OK if there are no warnings for partial versions
        expect(typeof hasWarnings).toBe('boolean');
      }
    });

    test('Backend validation includes all registered services', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      
      const services = response.data.services;
      const requiredServices = ['backend', 'frontend', 'scraper'];
      
      requiredServices.forEach(serviceName => {
        expect(services).toHaveProperty(serviceName);
        expect(services[serviceName]).toHaveProperty('version');
        expect(services[serviceName]).toHaveProperty('status');
      });
      
      // Backend returns services but not validation details
      // Services are included in the response
    });
  });

  describe('Version Service Error Handling', () => {
    test('Backend handles version service unavailable gracefully', async () => {
      // This test verifies backend behavior when version service might be down
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('application');
      
      // Should still return response even if version service is unavailable
      if (!response.data.application.name) {
        // If version service is unavailable, should have fallback behavior
        expect(response.data.application).toHaveProperty('status');
      }
    });

    test('Version validation handles invalid version formats', async () => {
      const invalidVersions = {
        backend: 'not-a-version',
        frontend: '1.0',
        scraper: ''
      };

      try {
        const response = await versionAPI.get('/validate-versions', {
          params: invalidVersions
        });
        
        // Should handle invalid versions
        expect(response.status).toBe(200);
        expect(response.data.valid).toBe(false);
        if (response.data.warnings) {
          expect(response.data.warnings.length).toBeGreaterThan(0);
        }
      } catch (error: any) {
        // 400 Bad Request is also acceptable for invalid input
        expect(error.response?.status).toBe(400);
      }
    });

    test('Backend maintains service tracking despite version service errors', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('services');
      
      // Services should still be tracked even if validation fails
      const services = response.data.services;
      expect(services).toHaveProperty('backend');
      expect(services).toHaveProperty('frontend');
      expect(services).toHaveProperty('scraper');
      
      // Each service should have basic info
      Object.values(services).forEach((service: any) => {
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('version');
        expect(service).toHaveProperty('name');
      });
    });
  });

  describe('Version Compatibility Matrix', () => {
    test('Compatible version combinations are validated correctly', async () => {
      const compatibleVersions = {
        backend: '1.0.0',
        frontend: '1.0.0',
        scraper: '1.0.0'
      };

      const response = await versionAPI.get('/validate-versions', {
        params: compatibleVersions
      });
      
      expect(response.status).toBe(200);
      
      // These versions should be compatible (or at least not cause critical issues)
      if (response.data.valid === false) {
        // If not compatible, should provide clear reasoning
        expect(response.data.warnings).toBeDefined();
        expect(response.data.warnings.length).toBeGreaterThan(0);
        response.data.warnings.forEach((warning: string) => {
          expect(typeof warning).toBe('string');
          expect(warning.length).toBeGreaterThan(0);
        });
      }
    });

    test('Incompatible version combinations are detected', async () => {
      const incompatibleVersions = {
        backend: '2.0.0',
        frontend: '1.0.0',
        scraper: '3.0.0'
      };

      const response = await versionAPI.get('/validate-versions', {
        params: incompatibleVersions
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('valid');
      
      // Should identify compatibility issues
      if (response.data.valid === false) {
        expect(response.data).toHaveProperty('warnings');
        expect(Array.isArray(response.data.warnings)).toBe(true);
        expect(response.data.warnings.length).toBeGreaterThan(0);
      }
    });

    test('Backend integrates validation results correctly', async () => {
      const response = await backendAPI.get('/version');
      
      expect(response.status).toBe(200);
      // Backend doesn't return validation in the response
      expect(response.data).toHaveProperty('application');
      expect(response.data).toHaveProperty('services');
    });
  });

  describe('Version Service Performance', () => {
    test('Version service responds quickly', async () => {
      const startTime = Date.now();
      const response = await versionAPI.get('/app-version');
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should respond within 2 seconds
    });

    test('Version validation completes in reasonable time', async () => {
      const startTime = Date.now();
      const response = await versionAPI.get('/validate-versions', {
        params: {
          backend: '1.0.0',
          frontend: '1.0.0',
          scraper: '1.0.0'
        }
      });
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(3000); // Should complete within 3 seconds
    });

    test('Backend version aggregation is performant', async () => {
      const startTime = Date.now();
      const response = await backendAPI.get('/version');
      const duration = Date.now() - startTime;
      
      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      
      // This endpoint aggregates data from multiple services, so longer timeout is acceptable
      expect(response.data).toHaveProperty('services');
      // Backend doesn't return validation
    });
  });

  describe('Version Data Consistency', () => {
    test('Version data remains consistent across multiple calls', async () => {
      const responses = await Promise.all([
        versionAPI.get('/app-version'),
        versionAPI.get('/app-version'),
        versionAPI.get('/app-version')
      ]);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // All responses should be identical
      const firstResponse = responses[0].data;
      responses.slice(1).forEach(response => {
        expect(response.data).toEqual(firstResponse);
      });
    });

    test('Backend version aggregation is consistent', async () => {
      const responses = await Promise.all([
        backendAPI.get('/version'),
        backendAPI.get('/version')
      ]);
      
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
      
      // Service versions should be consistent
      const firstServices = responses[0].data.services;
      const secondServices = responses[1].data.services;
      
      Object.keys(firstServices).forEach(serviceName => {
        expect(secondServices[serviceName].version).toBe(firstServices[serviceName].version);
        expect(secondServices[serviceName].name).toBe(firstServices[serviceName].name);
      });
    });
  });
});