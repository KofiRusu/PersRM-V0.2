export default function Home() {
  return (
    <div style={{ 
      padding: '2rem', 
      maxWidth: '800px', 
      margin: '0 auto',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ marginBottom: '1rem' }}>PersLM Task Monitor</h1>
      <p style={{ marginBottom: '1rem' }}>Welcome to the Task Monitor application.</p>
      
      <div style={{ marginTop: '2rem' }}>
        <h2>Navigation Links:</h2>
        <ul style={{ marginTop: '0.5rem' }}>
          <li>
            <a href="/test" style={{ color: 'blue', textDecoration: 'underline' }}>
              Test Page
            </a>
          </li>
          <li>
            <a href="/dashboard" style={{ color: 'blue', textDecoration: 'underline' }}>
              Dashboard
            </a>
          </li>
          <li>
            <a href="/app" style={{ color: 'blue', textDecoration: 'underline' }}>
              App Page
            </a>
          </li>
        </ul>
      </div>
      
      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#f0f0f0', borderRadius: '4px' }}>
        <h3>Debug Information:</h3>
        <p id="currentUrl">URL: Loading...</p>
        <p id="currentPath">Path: Loading...</p>
        <script dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('currentUrl').textContent = 'URL: ' + window.location.href;
            document.getElementById('currentPath').textContent = 'Path: ' + window.location.pathname;
          `
        }} />
      </div>
    </div>
  );
} 