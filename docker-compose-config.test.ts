import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Simple config validation test - no service setup needed
describe('docker-compose.integration.yml Configuration', () => {
  let composeConfig: any;

  beforeAll(() => {
    const composeFilePath = path.join(__dirname, 'docker-compose.integration.yml');
    const fileContents = fs.readFileSync(composeFilePath, 'utf8');
    composeConfig = yaml.load(fileContents);
  });

  describe('Multi-stage build configuration', () => {
    const testServices = ['backend-test', 'frontend-test', 'scraper-test', 'version-manager-test'];

    testServices.forEach(serviceName => {
      describe(`${serviceName} service`, () => {
        it('should use Dockerfile (not Dockerfile.test)', () => {
          const service = composeConfig.services[serviceName];
          expect(service).toBeDefined();
          expect(service.build).toBeDefined();
          expect(service.build.dockerfile).toBe('Dockerfile');
        });

        it('should specify target: production for multi-stage build', () => {
          const service = composeConfig.services[serviceName];
          expect(service).toBeDefined();
          expect(service.build).toBeDefined();
          expect(service.build.target).toBe('production');
        });
      });
    });

    it('should not reference Dockerfile.test anywhere', () => {
      const configString = JSON.stringify(composeConfig);
      expect(configString).not.toContain('Dockerfile.test');
    });
  });

  describe('Service integrity checks', () => {
    it('should preserve all service definitions', () => {
      const expectedServices = [
        'mongodb-test',
        'backend-test',
        'version-manager-test',
        'scraper-test',
        'frontend-test',
        'integration-tests'
      ];

      expectedServices.forEach(serviceName => {
        expect(composeConfig.services[serviceName]).toBeDefined();
      });
    });

    it('should preserve environment variables for backend-test', () => {
      const backend = composeConfig.services['backend-test'];
      expect(backend.environment).toBeDefined();
      expect(backend.environment).toContain('NODE_ENV=test');
      expect(backend.environment).toContain('PORT=5055');
    });

    it('should preserve health checks for all test services', () => {
      const servicesWithHealthChecks = ['backend-test', 'frontend-test', 'scraper-test', 'version-manager-test'];

      servicesWithHealthChecks.forEach(serviceName => {
        const service = composeConfig.services[serviceName];
        expect(service.healthcheck).toBeDefined();
        expect(service.healthcheck.test).toBeDefined();
      });
    });
  });
});
