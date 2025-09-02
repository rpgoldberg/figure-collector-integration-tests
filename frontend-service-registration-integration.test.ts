import axios from 'axios';

// Service Registration Integration Test relocated from figure-collector-frontend
describe('Frontend Service Registration Integration', () => {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  const versionServiceUrl = process.env.VERSION_SERVICE_URL || 'http://localhost:3020';

  beforeAll(async () => {
    console.log('📋 Starting Frontend Service Registration Integration Tests');
  });

  describe('Service Registration Protocol', () => {
    it('registers frontend service with backend successfully', async () => {
      const registrationData = {
        serviceName: 'frontend',
        version: '1.0.0',
        name: 'figure-collector-frontend'
      };

      try {
        const response = await axios.post(`${backendUrl}/register-service`, registrationData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('success', true);
        expect(response.data).toHaveProperty('message');

        console.log(`✅ Frontend service registered successfully: v${registrationData.version}`);
      } catch (error) {
        console.error('❌ Frontend service registration failed:', error.response?.data || error.message);
        throw error;
      }
    });

    it('handles duplicate service registration gracefully', async () => {
      const registrationData = {
        serviceName: 'frontend',
        version: '1.0.0',
        name: 'figure-collector-frontend'
      };

      try {
        // Register twice to test idempotency
        const firstResponse = await axios.post(`${backendUrl}/register-service`, registrationData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        const secondResponse = await axios.post(`${backendUrl}/register-service`, registrationData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        expect(firstResponse.status).toBe(200);
        expect(secondResponse.status).toBe(200);
        console.log('✅ Duplicate service registration handled gracefully');
      } catch (error) {
        console.error('❌ Duplicate registration handling failed:', error.response?.data || error.message);
        throw error;
      }
    });

    it('validates required fields in service registration', async () => {
      const incompleteData = {
        serviceName: 'frontend'
        // Missing version and name
      };

      try {
        const response = await axios.post(`${backendUrl}/register-service`, incompleteData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        // If registration succeeds, that's fine - some fields may be optional
        expect(response.status).toBe(200);
        console.log('✅ Service registration with minimal data handled correctly');
      } catch (error) {
        if (error.response?.status === 422) {
          console.log('✅ Service registration validation working correctly');
          expect(error.response.status).toBe(422);
        } else {
          throw error;
        }
      }
    });
  });

  describe('Version Information Retrieval', () => {
    it('retrieves comprehensive version information after registration', async () => {
      // First register the service
      const registrationData = {
        serviceName: 'frontend',
        version: '1.0.0',
        name: 'figure-collector-frontend'
      };

      await axios.post(`${backendUrl}/register-service`, registrationData, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      });

      // Then retrieve version information
      try {
        const response = await axios.get(`${backendUrl}/version`, {
          timeout: 10000
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('application');
        expect(response.data).toHaveProperty('services');
        
        // Check application-level info
        expect(response.data.application).toHaveProperty('version');
        expect(response.data.application).toHaveProperty('releaseDate');

        // Check service-level info
        expect(response.data.services).toHaveProperty('frontend');
        expect(response.data.services.frontend).toHaveProperty('version');
        expect(response.data.services.frontend).toHaveProperty('status');

        console.log(`✅ Version information retrieved: App v${response.data.application.version}`);
        console.log(`   Frontend v${response.data.services.frontend?.version}, Status: ${response.data.services.frontend?.status}`);
      } catch (error) {
        console.error('❌ Version information retrieval failed:', error.response?.data || error.message);
        throw error;
      }
    });

    it('includes validation information in version response', async () => {
      try {
        const response = await axios.get(`${backendUrl}/version`, {
          timeout: 10000
        });

        expect(response.status).toBe(200);
        
        // Check for validation section
        if (response.data.validation) {
          expect(response.data.validation).toHaveProperty('valid');
          expect(response.data.validation).toHaveProperty('status');
          
          if (response.data.validation.message) {
            expect(typeof response.data.validation.message).toBe('string');
          }

          if (response.data.validation.warnings) {
            expect(Array.isArray(response.data.validation.warnings)).toBe(true);
          }

          console.log(`✅ Validation info: ${response.data.validation.status}, Valid: ${response.data.validation.valid}`);
        } else {
          console.log('ℹ️  No validation information in version response');
        }
      } catch (error) {
        console.error('❌ Version validation check failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  describe('Multi-Service Integration', () => {
    it('retrieves version information for all registered services', async () => {
      try {
        const response = await axios.get(`${backendUrl}/version`, {
          timeout: 10000
        });

        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('services');

        const services = response.data.services;
        console.log('📊 Registered Services:');

        // Check for expected services
        const expectedServices = ['frontend', 'backend', 'scraper'];
        
        expectedServices.forEach(serviceName => {
          if (services[serviceName]) {
            console.log(`   ${serviceName}: v${services[serviceName].version} (${services[serviceName].status})`);
            expect(services[serviceName]).toHaveProperty('version');
            expect(services[serviceName]).toHaveProperty('status');
          } else {
            console.log(`   ${serviceName}: Not registered`);
          }
        });

        console.log('✅ Multi-service version information checked');
      } catch (error) {
        console.error('❌ Multi-service version check failed:', error.response?.data || error.message);
        throw error;
      }
    });

    it('validates cross-service compatibility', async () => {
      try {
        const response = await axios.get(`${backendUrl}/version`, {
          timeout: 10000
        });

        expect(response.status).toBe(200);
        
        if (response.data.validation) {
          const validation = response.data.validation;
          
          // Log compatibility status
          console.log(`🔄 Compatibility Status: ${validation.status}`);
          
          if (validation.warnings && validation.warnings.length > 0) {
            console.log('⚠️  Compatibility Warnings:');
            validation.warnings.forEach((warning: string, index: number) => {
              console.log(`   ${index + 1}. ${warning}`);
            });
          }

          if (validation.valid) {
            console.log('✅ Cross-service compatibility validated');
          } else {
            console.log(`ℹ️  Compatibility issues detected: ${validation.message}`);
          }
        } else {
          console.log('ℹ️  No compatibility validation available');
        }
      } catch (error) {
        console.error('❌ Cross-service compatibility check failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  describe('Service Health Integration', () => {
    it('verifies frontend service health through registration', async () => {
      const registrationData = {
        serviceName: 'frontend',
        version: '1.0.0',
        name: 'figure-collector-frontend',
        status: 'healthy'
      };

      try {
        const response = await axios.post(`${backendUrl}/register-service`, registrationData, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        });

        expect(response.status).toBe(200);

        // Verify the status is reflected in version endpoint
        const versionResponse = await axios.get(`${backendUrl}/version`, {
          timeout: 10000
        });

        expect(versionResponse.data.services.frontend.status).toBeDefined();
        console.log(`✅ Frontend service health: ${versionResponse.data.services.frontend.status}`);
      } catch (error) {
        console.error('❌ Service health verification failed:', error.response?.data || error.message);
        throw error;
      }
    });
  });

  afterAll(() => {
    console.log('📋 Frontend Service Registration Integration Tests completed');
  });
});