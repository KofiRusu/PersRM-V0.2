'use client'

export default function GlobalError({ error, reset }) {
  console.error('Global error occurred:', error);
  
  return (
    <html>
      <body>
        <div style={{ 
          padding: '2rem',
          maxWidth: '800px',
          margin: '0 auto',
          fontFamily: 'Arial, sans-serif',
          textAlign: 'center'
        }}>
          <h1 style={{ color: 'red' }}>Something went wrong!</h1>
          <p>Error details: {error.message || 'Unknown error'}</p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'blue',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginTop: '1rem'
            }}
          >
            Try again
          </button>
          
          <div style={{ marginTop: '2rem' }}>
            <a 
              href="/test"
              style={{ color: 'blue', textDecoration: 'underline' }}
            >
              Go to test page
            </a>
            {' | '}
            <a 
              href="/"
              style={{ color: 'blue', textDecoration: 'underline' }}
            >
              Go to home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
} 