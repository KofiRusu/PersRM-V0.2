import { useState } from 'react';
import { startReasoning } from 'persrm-core';

export default function Home() {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) {
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const reasoningResult = await startReasoning(query, {
        saveToMemory: true
      });
      
      setResult(reasoningResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">PersRM Reasoning UI</h1>
      
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="mb-4">
          <label htmlFor="query" className="block text-sm font-medium mb-1">
            Ask a question or provide a task:
          </label>
          <textarea
            id="query"
            className="w-full p-2 border border-gray-300 rounded"
            rows={4}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your query here..."
          />
        </div>
        
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Thinking...' : 'Ask'}
        </button>
      </form>
      
      {error && (
        <div className="p-4 mb-4 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}
      
      {result && (
        <div className="border border-gray-300 rounded p-4">
          <h2 className="text-xl font-semibold mb-2">Answer:</h2>
          <p className="mb-4">{result.result?.answer || 'No answer provided'}</p>
          
          {result.result?.reasoning && (
            <>
              <h3 className="text-lg font-semibold mb-2">Reasoning:</h3>
              <pre className="bg-gray-100 p-3 rounded whitespace-pre-wrap">
                {result.result.reasoning}
              </pre>
            </>
          )}
          
          {result.trace && (
            <div className="mt-4">
              <h3 className="text-lg font-semibold mb-2">Trace:</h3>
              <details>
                <summary className="cursor-pointer text-blue-600">
                  View reasoning trace
                </summary>
                <div className="mt-2 p-3 bg-gray-100 rounded">
                  {result.trace.steps.map((step: any, index: number) => (
                    <div key={index} className="mb-3">
                      <div className="font-semibold">{step.type}:</div>
                      <div>{step.content}</div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>
      )}
    </div>
  );
} 