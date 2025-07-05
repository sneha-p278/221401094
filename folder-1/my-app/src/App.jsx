import React, { createContext, useContext, useState, useEffect } from 'react';
const LoggingContext = createContext({
  logs: [],
  log: () => {},
});

const LoggingProvider = ({ children }) => {
  const [logs, setLogs] = useState([]);

  const log = (level, message, data) => {
    const entry = {
      timestamp: new Date(),
      level,
      message,
      data,
    };
    setLogs(prev => [...prev, entry]);
  };

  return (
    <LoggingContext.Provider value={{ logs, log }}>
      {children}
    </LoggingContext.Provider>
  );
};

const useLogging = () => useContext(LoggingContext);
const URLContext = createContext({
  shortLinks: [],
  addShortLinks: () => {},
  getShortLink: () => undefined,
  recordClick: () => {},
});

const URLProvider = ({ children }) => {
  const [shortLinks, setShortLinks] = useState([]);
  const { log } = useLogging();

  const addShortLinks = (links) => {
    setShortLinks(prev => [...prev, ...links]);
    log('info', `Added ${links.length} short links`, { count: links.length });
  };

  const getShortLink = (shortcode) => {
    const link = shortLinks.find(l => l.shortcode === shortcode);
    if (link && new Date() > link.expiresAt) {
      log('warning', `Link expired: ${shortcode}`, { shortcode });
      return undefined;
    }
    return link;
  };

  const recordClick = (shortcode, metadata) => {
    setShortLinks(prev => prev.map(link => {
      if (link.shortcode === shortcode) {
        return {
          ...link,
          clickCount: link.clickCount + 1,
          clicks: [...link.clicks, metadata]
        };
      }
      return link;
    }));
    log('info', `Click recorded for ${shortcode}`, { shortcode, metadata });
  };

  return (
    <URLContext.Provider value={{ shortLinks, addShortLinks, getShortLink, recordClick }}>
      {children}
    </URLContext.Provider>
  );
};

const useURL = () => useContext(URLContext);
const generateShortcode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const validateUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const validateShortcode = (shortcode) => {
  return /^[a-zA-Z0-9]{3,20}$/.test(shortcode);
};

const getSimulatedLocation = () => {
  const locations = ['New York, US', 'London, UK', 'Tokyo, JP', 'Sydney, AU', 'Toronto, CA'];
  return locations[Math.floor(Math.random() * locations.length)];
}
const AppContext = createContext({
  currentPage: 'home',
  setCurrentPage: () => {},
  shortcodeToRedirect: null,
  setShortcodeToRedirect: () => {},
});

const AppProvider = ({ children }) => {
  const [currentPage, setCurrentPage] = useState('home');
  const [shortcodeToRedirect, setShortcodeToRedirect] = useState(null);

  return (
    <AppContext.Provider value={{ currentPage, setCurrentPage, shortcodeToRedirect, setShortcodeToRedirect }}>
      {children}
    </AppContext.Provider>
  );
};

const useApp = () => useContext(AppContext);
const Header = () => {
  const { setCurrentPage } = useApp();

  return (
    <header style={{ 
      background: '#1976d2', 
      color: 'white', 
      padding: '1rem 0',
      marginBottom: '2rem'
    }}>
      <nav style={{ 
        maxWidth: '1200px', 
        margin: '0 auto', 
        padding: '0 1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setCurrentPage('home')}>
          URL Shortener
        </h1>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            onClick={() => setCurrentPage('home')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              cursor: 'pointer',
              fontSize: '1rem',
              textDecoration: 'underline'
            }}
          >
            Home
          </button>
          <button 
            onClick={() => setCurrentPage('stats')}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: 'white', 
              cursor: 'pointer',
              fontSize: '1rem',
              textDecoration: 'underline'
            }}
          >
            Statistics
          </button>
        </div>
      </nav>
    </header>
  );
};

const URLShortenerForm = () => {
  const [url, setUrl] = useState({
    originalUrl: '',
    validityMinutes: 30,
    customShortcode: ''
  });
  const [errors, setErrors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);
  const { addShortLinks, shortLinks } = useURL();
  const { log } = useLogging();
  const handleUrlChange = (field, value) => {
    setUrl(prev => ({ ...prev, [field]: value }));
    setSuccessMessage(null);
  };
  const validateForm = () => {
    const newErrors = [];
    const usedShortcodes = new Set(shortLinks.map(link => link.shortcode));

    if (!url.originalUrl) {
      newErrors.push('URL is required');
    } else if (!validateUrl(url.originalUrl)) {
      newErrors.push('Invalid URL format');
    }

    if (url.validityMinutes && (!Number.isInteger(Number(url.validityMinutes)) || Number(url.validityMinutes) < 1)) {
      newErrors.push('Validity must be a positive integer');
    }

    if (url.customShortcode) {
      if (!validateShortcode(url.customShortcode)) {
        newErrors.push('Shortcode must be 3-20 alphanumeric characters');
      } else if (usedShortcodes.has(url.customShortcode)) {
        newErrors.push('Shortcode already exists');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      log('error', 'Form validation failed', { errors });
      return;
    }

    setLoading(true);

    try {
      let shortcode = url.customShortcode;
      const usedShortcodes = new Set(shortLinks.map(link => link.shortcode));
      if (!shortcode) {
        do {
          shortcode = generateShortcode();
        } while (usedShortcodes.has(shortcode));
      }

      const createdAt = new Date();
      const expiresAt = new Date(createdAt.getTime() + (url.validityMinutes * 60 * 1000));

      const newShortLink = {
        id: Math.random().toString(36).substr(2, 9),
        originalUrl: url.originalUrl,
        shortcode,
        validityMinutes: url.validityMinutes,
        createdAt,
        expiresAt,
        clickCount: 0,
        clicks: []
      };

      addShortLinks([newShortLink]);
      setUrl({
        originalUrl: '',
        validityMinutes: 30,
        customShortcode: ''
      });

      setSuccessMessage('Successfully created short link!');
      log('info', 'Successfully created short link', { shortcode });
    } catch (error) {
      log('error', 'Failed to create short link', { error });
    } finally {
      setLoading(false);
    }
  };

  const testRedirect = (shortcode) => {
    const { setCurrentPage, setShortcodeToRedirect } = useApp();
    setShortcodeToRedirect(shortcode);
    setCurrentPage('redirect');
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem' }}>
      <h2>Create Short Link</h2>

      {successMessage && (
        <div style={{
          background: '#e8f5e8',
          color: '#2e7d32',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {successMessage}
        </div>
      )}

      {errors.length > 0 && (
        <div style={{
          background: '#ffebee',
          color: '#c62828',
          padding: '1rem',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {errors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '1rem',
          marginBottom: '1rem',
          background: '#f9f9f9'
        }}>
          <h4>URL</h4>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
              Original URL:
            </label>
            <input
              type="url"
              value={url.originalUrl}
              onChange={(e) => handleUrlChange('originalUrl', e.target.value)}
              placeholder="https://example.com"
              style={{
                width: '100%',
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '4px',
                fontSize: '1rem',
                boxSizing: 'border-box'
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Validity (minutes):
              </label>
              <input
                type="number"
                value={url.validityMinutes}
                onChange={(e) => handleUrlChange('validityMinutes', parseInt(e.target.value) || 30)}
                min="1"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Custom Shortcode (optional):
              </label>
              <input
                type="text"
                value={url.customShortcode}
                onChange={(e) => handleUrlChange('customShortcode', e.target.value)}
                placeholder="mylink123"
                style={{
                  width: '100%',
                  padding: '0.5rem',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '1rem',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            background: '#1976d2',
            color: 'white',
            padding: '1rem 2rem',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Creating...' : 'Create Short Link'}
        </button>
      </form>

      {shortLinks.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3>Recently Created Links</h3>
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {shortLinks.slice(-3).map(link => (
              <div key={link.id} style={{
                padding: '0.5rem',
                background: '#e3f2fd',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <strong>{window.location.origin}/{link.shortcode}</strong>
                  <div style={{ fontSize: '0.8rem', color: '#666' }}>
                    → {link.originalUrl.substring(0, 50)}...
                  </div>
                </div>
                <button
                  onClick={() => testRedirect(link.shortcode)}
                  style={{
                    background: '#1976d2',
                    color: 'white',
                    border: 'none',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  Test
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const RedirectHandler = () => {
  const { shortcodeToRedirect, setCurrentPage } = useApp();
  const { getShortLink, recordClick } = useURL();
  const { log } = useLogging();
  const [error, setError] = useState(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!shortcodeToRedirect) {
      setError('Invalid shortcode');
      return;
    }

    const link = getShortLink(shortcodeToRedirect);
    
    if (!link) {
      setError('Link not found or expired');
      log('warning', 'Link not found or expired', { shortcode: shortcodeToRedirect });
      return;
    }
    const clickMetadata = {
      timestamp: new Date(),
      referrer: 'Direct',
      location: getSimulatedLocation()
    };

    recordClick(shortcodeToRedirect, clickMetadata);
    
    setRedirecting(true);
    setTimeout(() => {
      window.open(link.originalUrl, '_blank');
      setCurrentPage('home');
    }, 1000);
  }, [shortcodeToRedirect, getShortLink, recordClick, log, setCurrentPage]);

  if (error) {
    return (
      <div style={{ 
        maxWidth: '600px', 
        margin: '2rem auto', 
        padding: '2rem',
        textAlign: 'center'
      }}>
        <h2 style={{ color: '#c62828' }}>Error</h2>
        <p>{error}</p>
        <button 
          onClick={() => setCurrentPage('home')}
          style={{ 
            color: '#1976d2', 
            background: 'none',
            border: '1px solid #1976d2',
            padding: '0.5rem 1rem',
            borderRadius: '4px',
            cursor: 'pointer',
            marginTop: '1rem'
          }}
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '2rem auto', 
      padding: '2rem',
      textAlign: 'center'
    }}>
      <h2>{redirecting ? 'Redirecting...' : 'Processing...'}</h2>
      <p>{redirecting ? 'Opening your link in a new tab...' : 'Please wait while we process your request.'}</p>
      <div style={{ 
        width: '50px', 
        height: '50px', 
        border: '3px solid #f3f3f3',
        borderTop: '3px solid #1976d2',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        margin: '1rem auto'
      }} />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const StatisticsPage = () => {
  const { shortLinks } = useURL();
  const { log } = useLogging();
  const { setCurrentPage } = useApp();

  useEffect(() => {
    log('info', 'Statistics page viewed', { linkCount: shortLinks.length });
  }, [log, shortLinks.length]);

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const isExpired = (link) => {
    return new Date() > link.expiresAt;
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 1rem' }}>
      <h2>Statistics</h2>
      
      {shortLinks.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '2rem' }}>
          <p>No short links created yet.</p>
          <button 
            onClick={() => setCurrentPage('home')}
            style={{ 
              color: '#1976d2', 
              background: 'none',
              border: '1px solid #1976d2',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Create Your First Link
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {shortLinks.map(link => (
            <div 
              key={link.id} 
              style={{ 
                border: '1px solid #ddd',
                borderRadius: '8px',
                padding: '1.5rem',
                background: isExpired(link) ? '#f5f5f5' : '#fff'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 0.5rem 0', color: isExpired(link) ? '#666' : '#333' }}>
                    {window.location.origin}/{link.shortcode}
                  </h3>
                  <p style={{ margin: '0 0 0.5rem 0', color: '#666', wordBreak: 'break-all' }}>
                    → {link.originalUrl}
                  </p>
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.9rem', color: '#666' }}>
                    <span>Created: {formatDate(link.createdAt)}</span>
                    <span>Expires: {formatDate(link.expiresAt)}</span>
                    <span style={{ color: isExpired(link) ? '#c62828' : '#666' }}>
                      {isExpired(link) ? 'EXPIRED' : 'ACTIVE'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1976d2' }}>
                    {link.clickCount}
                  </div>
                  <div style={{ fontSize: '0.9rem', color: '#666' }}>
                    clicks
                  </div>
                </div>
              </div>

              {link.clicks.length > 0 && (
                <div>
                  <h4 style={{ margin: '1rem 0 0.5rem 0', color: '#333' }}>Click History</h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                    {link.clicks.map((click, index) => (
                      <div 
                        key={index} 
                        style={{ 
                          padding: '0.5rem',
                          borderBottom: '1px solid #eee',
                          fontSize: '0.9rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{formatDate(click.timestamp)}</span>
                        <span>{click.location}</span>
                        <span style={{ color: '#666' }}>{click.referrer}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const App = () => {
  return (
    <AppProvider>
      <LoggingProvider>
        <URLProvider>
          <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <Header />
            <main>
              <AppContent />
            </main>
          </div>
        </URLProvider>
      </LoggingProvider>
    </AppProvider>
  );
};

const AppContent = () => {
  const { currentPage } = useApp();

  switch (currentPage) {
    case 'home':
      return <URLShortenerForm />;
    case 'stats':
      return <StatisticsPage />;
    case 'redirect':
      return <RedirectHandler />;
    default:
      return <URLShortenerForm />;
  }
};

export default App;