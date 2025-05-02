export default function Custom404() {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      fontFamily: 'Arial, sans-serif'
    }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '1rem' }}>404 - Page Not Found</h1>
      <p>The page you're looking for doesn't exist or you don't have permission to view it.</p>
      <div style={{ marginTop: '2rem' }}>
        <p><strong>Debug Info:</strong></p>
        <p>URL: <span id="currentUrl">Loading...</span></p>
        <p>Path: <span id="currentPath">Loading...</span></p>
        <p>Router Ready: <span id="routerReady">Checking...</span></p>
        <script dangerouslySetInnerHTML={{
          __html: `
            document.getElementById('currentUrl').textContent = window.location.href;
            document.getElementById('currentPath').textContent = window.location.pathname;
            document.getElementById('routerReady').textContent = 'Yes (Client Side)';
          `
        }} />
      </div>
      <div style={{ marginTop: '1rem' }}>
        <a href="/" style={{ color: 'blue', textDecoration: 'underline' }}>Go to Home</a>
        {' | '}
        <a href="/test" style={{ color: 'blue', textDecoration: 'underline' }}>Go to Test Page</a>
      </div>
    </div>
  );
} 