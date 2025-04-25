import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { httpBatchLink } from '@trpc/client';
import { createTRPCProxyClient } from '@trpc/client';
import { AppRouter } from '@/lib/trpc/router'; // This would be your actual router
import { server } from '@/lib/trpc/server'; // This would be your actual server implementation
import supertest from 'supertest';
import { getRecommendations } from '@/lib/services/recommendation-service';

// Mock your service implementation
vi.mock('@/lib/services/recommendation-service', () => ({
  getRecommendations: vi.fn().mockImplementation((request) => {
    return {
      components: [
        {
          id: 'mock-1',
          name: 'MockComponent',
          type: 'display',
          complexity: 5,
          description: 'A mock component for testing',
          tags: ['mock', 'test'],
          useCases: ['testing']
        }
      ],
      reasoning: 'This is mock reasoning',
      score: 8.5
    };
  })
}));

// Create a type-safe client
const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/api/trpc',
    }),
  ],
});

describe('tRPC Router Integration', () => {
  let serverInstance: any;
  let mockGetRecommendations: any;
  
  beforeAll(() => {
    // Start the server before all tests
    serverInstance = server.listen(3000);
    mockGetRecommendations = getRecommendations as any;
  });
  
  afterAll(() => {
    // Close server after all tests
    serverInstance?.close();
  });
  
  test('recommendation.getByNeeds returns expected data', async () => {
    // Set up mock to return specific data for this test
    mockGetRecommendations.mockImplementationOnce((request) => {
      expect(request.userNeeds).toEqual(['dashboard']);
      
      return {
        components: [
          {
            id: 'test-1',
            name: 'TestComponent',
            type: 'layout',
            complexity: 4,
            description: 'A test component',
            tags: ['test'],
            useCases: ['dashboard']
          }
        ],
        reasoning: 'Test reasoning',
        score: 7.5
      };
    });
    
    // Make the actual request
    const result = await client.recommendation.getByNeeds.query({
      userNeeds: ['dashboard']
    });
    
    // Verify the result matches expectations
    expect(result.components.length).toBe(1);
    expect(result.components[0].name).toBe('TestComponent');
    expect(result.score).toBe(7.5);
    
    // Verify the mock was called with expected parameters
    expect(mockGetRecommendations).toHaveBeenCalledWith({
      userNeeds: ['dashboard']
    });
  });
  
  test('HTTP endpoint works correctly', async () => {
    mockGetRecommendations.mockImplementationOnce(() => ({
      components: [
        {
          id: 'http-1',
          name: 'HttpTestComponent',
          type: 'display',
          complexity: 3,
          description: 'A component for HTTP testing',
          tags: ['http', 'test'],
          useCases: ['api testing']
        }
      ],
      reasoning: 'HTTP test reasoning',
      score: 6.5
    }));
    
    // Test the HTTP endpoint directly with supertest
    const response = await supertest(serverInstance)
      .post('/api/trpc/recommendation.getByNeeds')
      .send({
        json: {
          userNeeds: ['api']
        }
      });
    
    expect(response.status).toBe(200);
    const result = JSON.parse(response.text);
    expect(result.result.data.json.components[0].name).toBe('HttpTestComponent');
  });
  
  test('handles errors appropriately', async () => {
    // Mock an error scenario
    mockGetRecommendations.mockImplementationOnce(() => {
      throw new Error('Test error');
    });
    
    // Test that the error is propagated correctly
    try {
      await client.recommendation.getByNeeds.query({
        userNeeds: ['error']
      });
      
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('Test error');
    }
  });
}); 