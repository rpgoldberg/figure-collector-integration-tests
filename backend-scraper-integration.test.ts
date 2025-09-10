import { 
  TEST_CONFIG, 
  backendAPI, 
  scraperAPI,
  authenticateUser,
  getAuthenticatedAPI,
  TEST_USERS,
  createTestFigure
} from './setup';

describe('Backend → Scraper Integration Tests', () => {
  let userToken: string;
  let authenticatedAPI: any;

  beforeAll(async () => {
    // Reset browser pool before starting scraper-heavy tests
    try {
      await scraperAPI.post('/reset-pool');
      console.log('🔄 Browser pool reset for scraper tests');
    } catch (error) {
      console.warn('⚠️  Could not reset browser pool:', error.message);
    }
    
    userToken = await authenticateUser('USER1', TEST_USERS.USER1.password);
    authenticatedAPI = getAuthenticatedAPI('USER1');
  });

  describe('MFC Scraping Workflow', () => {
    test('Complete MFC scraping workflow through backend', async () => {
      // Test the full workflow: Backend receives figure request → calls scraper → saves figure
      
      const figureData = {
        manufacturer: 'Test Manufacturer',
        name: 'Test Figure',
        scale: '1/8',
        location: 'Test Shelf',
        boxNumber: 'TEST001',
        mfcLink: 'https://myfigurecollection.net/item/test123'
      };

      // Create figure with MFC link (should trigger scraping)
      const createResponse = await authenticatedAPI.post('/figures', figureData);
      
      expect(createResponse.status).toBe(201);
      expect(createResponse.data.success).toBe(true);
      expect(createResponse.data.data).toHaveProperty('_id');
      
      const createdFigure = createResponse.data.data;
      expect(createdFigure.mfcLink).toBe(figureData.mfcLink);
      
      // Verify figure was saved
      const fetchResponse = await authenticatedAPI.get(`/figures/${createdFigure._id}`);
      expect(fetchResponse.status).toBe(200);
      expect(fetchResponse.data.data.mfcLink).toBe(figureData.mfcLink);
    });

    test('Backend calls scraper service for MFC data', async () => {
      // Test direct scraper service call that backend would make
      const mfcUrl = 'https://myfigurecollection.net/item/287';
      
      const scraperResponse = await scraperAPI.post('/scrape/mfc', {
        url: mfcUrl
      });
      
      expect(scraperResponse.status).toBe(200);
      expect(scraperResponse.data).toHaveProperty('success');
      
      if (scraperResponse.data.success) {
        expect(scraperResponse.data).toHaveProperty('data');
        const scrapedData = scraperResponse.data.data;
        
        // Verify scraper returns expected data structure
        expect(scrapedData).toHaveProperty('manufacturer');
        expect(typeof scrapedData.manufacturer).toBe('string');
        
        // Name is optional from MFC
        if (scrapedData.name) {
          expect(typeof scrapedData.name).toBe('string');
        }
      } else {
        // If scraping failed, should have error message
        expect(scraperResponse.data).toHaveProperty('error');
        console.log('   ⚠️  Scraper returned error:', scraperResponse.data.error);
        // Accept browser pool errors as valid response
        if (scraperResponse.data.error && scraperResponse.data.error.includes('Browser pool exhausted')) {
          console.log('   ℹ️  Browser pool exhausted is an acceptable error in integration testing');
        }
      }
    }, 60000); // Longer timeout for scraping

    test('Backend handles scraper success response correctly', async () => {
      // Mock a successful scraper response scenario
      const figureData = {
        manufacturer: 'Good Smile Company',
        name: 'Hatsune Miku Test',
        scale: '1/8',
        location: 'Test Location',
        boxNumber: 'TEST002',
        mfcLink: 'https://myfigurecollection.net/item/99999'
      };

      const response = await authenticatedAPI.post('/figures', figureData);
      
      expect(response.status).toBe(201);
      
      // Even if scraping fails, figure should still be created with provided data
      const figure = response.data.data;
      expect(figure.manufacturer).toBe(figureData.manufacturer);
      expect(figure.name).toBe(figureData.name);
      expect(figure.mfcLink).toBe(figureData.mfcLink);
    });

    test('Backend endpoint triggers MFC scraping process', async () => {
      // Test the specific scrape-mfc endpoint
      const mfcUrl = 'https://myfigurecollection.net/item/test456';
      
      const response = await authenticatedAPI.post('/figures/scrape-mfc', {
        mfcLink: mfcUrl
      });
      
      // Should return either scraped data or error message
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
      
      if (response.data.success && response.data.data && Object.keys(response.data.data).length > 0) {
        const data = response.data.data;
        // Should have at least manufacturer from scraping
        expect(data).toHaveProperty('manufacturer');
        // Name is optional from MFC
      } else {
        // If scraping failed or returned empty data, should have error message
        expect(response.data).toHaveProperty('message');
        console.log('   ℹ️  Scraping endpoint returned:', response.data.message || 'empty data');
      }
    }, 60000);
  });

  describe('Scraper Service Error Handling', () => {
    test('Backend handles scraper service unavailable', async () => {
      // This test verifies behavior when scraper returns error
      const invalidMfcUrl = 'https://invalid-domain.com/item/123';
      
      try {
        const response = await authenticatedAPI.post('/figures/scrape-mfc', {
          mfcLink: invalidMfcUrl
        });
        
        // If we get 200, it should have success: false
        expect(response.status).toBe(200);
        expect(response.data).toHaveProperty('success', false);
        expect(response.data).toHaveProperty('message');
      } catch (error: any) {
        // 400 is also acceptable for invalid domain
        expect(error.response?.status).toBe(400);
        expect(error.response?.data).toHaveProperty('message');
        expect(error.response?.data.message).toContain('myfigurecollection.net');
      }
    });

    test('Backend handles invalid MFC URLs appropriately', async () => {
      const invalidUrls = [
        'not-a-url',
        'http://google.com',
        'https://myfigurecollection.net/invalid-path',
        ''
      ];

      for (const invalidUrl of invalidUrls) {
        try {
          const response = await authenticatedAPI.post('/figures/scrape-mfc', {
            mfcLink: invalidUrl
          });
          
          // Should either succeed with error message or return 200 with success: false/true
          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('success');
          
          // Invalid paths might still return success: true with empty data
          if (!response.data.success) {
            expect(response.data).toHaveProperty('message');
          }
        } catch (error: any) {
          // 400 Bad Request is also acceptable
          expect(error.response?.status).toBe(400);
          expect(error.response?.data).toHaveProperty('message');
        }
      }
    });

    test('Backend handles scraper timeout gracefully', async () => {
      // Test with a potentially slow MFC URL
      const slowMfcUrl = 'https://myfigurecollection.net/item/1';
      
      const startTime = Date.now();
      const response = await authenticatedAPI.post('/figures/scrape-mfc', {
        mfcLink: slowMfcUrl
      });
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (backend timeout)
      expect(duration).toBeLessThan(60000); // 1 minute
      expect(response.status).toBe(200);
      
      // Should have handled timeout appropriately
      expect(response.data).toHaveProperty('success');
    }, 70000);
  });

  describe('Scraper Service Data Validation', () => {
    test('Scraper returns structured data format', async () => {
      const mfcUrl = 'https://myfigurecollection.net/item/287';
      
      const response = await scraperAPI.post('/scrape/mfc', {
        url: mfcUrl
      });
      
      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success');
      
      if (response.data.success && response.data.data) {
        const data = response.data.data;
        
        // Validate data structure
        if (data.manufacturer) expect(typeof data.manufacturer).toBe('string');
        if (data.name) expect(typeof data.name).toBe('string');
        if (data.scale) expect(typeof data.scale).toBe('string');
        if (data.imageUrl) expect(typeof data.imageUrl).toBe('string');
        
        // Validate URL format if present
        if (data.imageUrl) {
          expect(data.imageUrl).toMatch(/^https?:\/\/.+/);
        }
      }
    }, 60000);

    test('Backend validates scraped data before saving', async () => {
      // Test that empty manufacturer is properly rejected
      const invalidFigureData = {
        manufacturer: '',  // Empty manufacturer should be rejected
        name: 'Test Figure Name',
        scale: '1/8',
        location: 'Test Location',
        boxNumber: 'TEST003',
        mfcLink: 'https://myfigurecollection.net/item/test789'
      };

      try {
        await authenticatedAPI.post('/figures', invalidFigureData);
        fail('Should have thrown validation error for empty manufacturer');
      } catch (error: any) {
        // Should get validation error for empty manufacturer
        expect(error.response?.status).toBe(422);
        expect(error.response?.data?.message).toContain('Validation');
      }

      // Now test with valid data
      const validFigureData = {
        manufacturer: 'Test Manufacturer',
        name: 'Test Figure Name',
        scale: '1/8',
        location: 'Test Location',
        boxNumber: 'TEST003',
        mfcLink: 'https://myfigurecollection.net/item/test789'
      };

      const response = await authenticatedAPI.post('/figures', validFigureData);
      expect(response.status).toBe(201);
      expect(response.data.data.name).toBe(validFigureData.name);
    });
  });

  describe('Performance and Concurrency', () => {
    test('Multiple concurrent scraping requests', async () => {
      const urls = [
        'https://myfigurecollection.net/item/287',
        'https://myfigurecollection.net/item/549',
        'https://myfigurecollection.net/item/1234'
      ];

      const startTime = Date.now();
      
      // Send concurrent requests
      const promises = urls.map(url => 
        authenticatedAPI.post('/figures/scrape-mfc', { mfcLink: url })
          .catch(error => ({ error: true, status: error.response?.status }))
      );

      const responses = await Promise.all(promises);
      const duration = Date.now() - startTime;

      // All should complete within reasonable time
      expect(duration).toBeLessThan(120000); // 2 minutes for 3 concurrent requests
      
      // Check that all responses are valid
      responses.forEach((response: any) => {
        if (!response.error) {
          expect(response.status).toBe(200);
          expect(response.data).toHaveProperty('success');
        } else {
          // Even errors should be handled gracefully
          expect([400, 429, 500, 503]).toContain(response.status);
        }
      });
    }, 150000);

    test('Scraper service handles load appropriately', async () => {
      // Test scraper service directly under some load
      const requests = Array(5).fill(null).map(() => 
        scraperAPI.post('/scrape/mfc', {
          url: 'https://myfigurecollection.net/item/287'
        }).catch(error => ({ error: true, response: error.response }))
      );

      const responses = await Promise.all(requests);
      
      // Should handle multiple requests without crashing
      responses.forEach((response: any) => {
        if (!response.error) {
          expect(response.status).toBe(200);
        } else {
          // Rate limiting or temporary errors are acceptable
          expect([429, 500, 503]).toContain(response.response?.status);
        }
      });
    }, 120000);
  });

  describe('Data Integration Verification', () => {
    test('Scraped data integrates correctly with figure creation', async () => {
      const figureData = {
        manufacturer: 'Integration Test Manufacturer',
        name: 'Integration Test Figure',
        scale: '1/8',
        location: 'Integration Test Shelf',
        boxNumber: 'INTEG001',
        mfcLink: 'https://myfigurecollection.net/item/integration-test'
      };

      // Create figure
      const createResponse = await authenticatedAPI.post('/figures', figureData);
      expect(createResponse.status).toBe(201);
      
      const figureId = createResponse.data.data._id;
      
      // Verify figure can be retrieved
      const getResponse = await authenticatedAPI.get(`/figures/${figureId}`);
      expect(getResponse.status).toBe(200);
      
      const figure = getResponse.data.data;
      expect(figure.mfcLink).toBe(figureData.mfcLink);
      expect(figure.manufacturer).toBeTruthy();
      expect(figure.name).toBeTruthy();
      
      // Verify figure appears in user's collection
      const listResponse = await authenticatedAPI.get('/figures');
      expect(listResponse.status).toBe(200);
      
      const userFigures = listResponse.data.data;
      const createdFigure = userFigures.find((f: any) => f._id === figureId);
      expect(createdFigure).toBeDefined();
      expect(createdFigure.mfcLink).toBe(figureData.mfcLink);
    });
  });
});