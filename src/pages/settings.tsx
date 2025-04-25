import React, { useState, useEffect } from 'react';
import { 
  isNotionConfigured, 
  getNotionConfig, 
  updateNotionConfig 
} from '../lib/integrations/notion-sync';
import { 
  isSlackConfigured, 
  getSlackConfig, 
  updateSlackConfig 
} from '../lib/integrations/slack-sync';

const SettingsPage = () => {
  // Notion settings
  const [notionToken, setNotionToken] = useState('');
  const [notionDbId, setNotionDbId] = useState('');
  const [notionEnabled, setNotionEnabled] = useState(false);
  const [notionAutoSync, setNotionAutoSync] = useState(false);
  
  // Slack settings
  const [slackWebhook, setSlackWebhook] = useState('');
  const [slackChannel, setSlackChannel] = useState('');
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackAutoSync, setSlackAutoSync] = useState(false);
  const [slackMinSeverity, setSlackMinSeverity] = useState('warning');
  
  // Status
  const [saveStatus, setSaveStatus] = useState('');
  const [notionTestStatus, setNotionTestStatus] = useState('');
  const [slackTestStatus, setSlackTestStatus] = useState('');
  
  // Load existing configurations
  useEffect(() => {
    try {
      // Load Notion config
      const notionConfig = getNotionConfig();
      if (notionConfig) {
        setNotionToken(notionConfig.token || '');
        setNotionDbId(notionConfig.databaseId || '');
        setNotionEnabled(notionConfig.enabled || false);
        setNotionAutoSync(notionConfig.autoSync || false);
      }
      
      // Load Slack config
      const slackConfig = getSlackConfig();
      if (slackConfig) {
        setSlackWebhook(slackConfig.webhookUrl || '');
        setSlackChannel(slackConfig.channel || '');
        setSlackEnabled(slackConfig.enabled || false);
        setSlackAutoSync(slackConfig.autoSync || false);
        setSlackMinSeverity(slackConfig.minSeverity || 'warning');
      }
    } catch (error) {
      console.error('Error loading configurations:', error);
    }
  }, []);
  
  // Save Notion settings
  const saveNotionSettings = async () => {
    try {
      await updateNotionConfig({
        token: notionToken,
        databaseId: notionDbId,
        enabled: notionEnabled,
        autoSync: notionAutoSync
      });
      
      setSaveStatus('Notion settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus(`Error saving Notion settings: ${error.message}`);
    }
  };
  
  // Save Slack settings
  const saveSlackSettings = async () => {
    try {
      await updateSlackConfig({
        webhookUrl: slackWebhook,
        channel: slackChannel,
        enabled: slackEnabled,
        autoSync: slackAutoSync,
        minSeverity: slackMinSeverity
      });
      
      setSaveStatus('Slack settings saved successfully!');
      setTimeout(() => setSaveStatus(''), 3000);
    } catch (error) {
      setSaveStatus(`Error saving Slack settings: ${error.message}`);
    }
  };
  
  // Test Notion connection
  const testNotionConnection = async () => {
    try {
      setNotionTestStatus('Testing connection...');
      const { testNotionConnection } = await import('../lib/integrations/notion-sync');
      const result = await testNotionConnection();
      
      if (result) {
        setNotionTestStatus('Connection successful! Notion is properly configured.');
      } else {
        setNotionTestStatus('Connection failed. Please check your Notion credentials.');
      }
      
      setTimeout(() => setNotionTestStatus(''), 5000);
    } catch (error) {
      setNotionTestStatus(`Error testing Notion: ${error.message}`);
    }
  };
  
  // Test Slack connection
  const testSlackConnection = async () => {
    try {
      setSlackTestStatus('Testing connection...');
      const { testSlackConnection } = await import('../lib/integrations/slack-sync');
      const result = await testSlackConnection();
      
      if (result) {
        setSlackTestStatus('Connection successful! Slack is properly configured.');
      } else {
        setSlackTestStatus('Connection failed. Please check your Slack webhook URL.');
      }
      
      setTimeout(() => setSlackTestStatus(''), 5000);
    } catch (error) {
      setSlackTestStatus(`Error testing Slack: ${error.message}`);
    }
  };
  
  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>PersRM Settings</h1>
      
      {saveStatus && (
        <div style={styles.notification}>
          {saveStatus}
        </div>
      )}
      
      <div style={styles.section}>
        <h2 style={styles.subheading}>Notion Integration</h2>
        
        <div style={styles.row}>
          <label style={styles.label}>
            API Token:
            <input
              type="password"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              style={styles.input}
              placeholder="Enter Notion API token"
            />
          </label>
        </div>
        
        <div style={styles.row}>
          <label style={styles.label}>
            Database ID:
            <input
              type="text"
              value={notionDbId}
              onChange={(e) => setNotionDbId(e.target.value)}
              style={styles.input}
              placeholder="Enter Notion database ID"
            />
          </label>
        </div>
        
        <div style={styles.row}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={notionEnabled}
              onChange={(e) => setNotionEnabled(e.target.checked)}
            />
            Enable Notion Integration
          </label>
        </div>
        
        <div style={styles.row}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={notionAutoSync}
              onChange={(e) => setNotionAutoSync(e.target.checked)}
            />
            Auto-sync analyses to Notion
          </label>
        </div>
        
        <div style={styles.buttonContainer}>
          <button onClick={saveNotionSettings} style={styles.button}>
            Save Notion Settings
          </button>
          
          <button
            onClick={testNotionConnection}
            disabled={!notionToken || !notionDbId}
            style={{
              ...styles.button,
              ...((!notionToken || !notionDbId) ? styles.disabledButton : {})
            }}
          >
            Test Connection
          </button>
        </div>
        
        {notionTestStatus && (
          <div style={{
            ...styles.notification,
            backgroundColor: notionTestStatus.includes('successful') ? '#dff0d8' : '#f2dede'
          }}>
            {notionTestStatus}
          </div>
        )}
      </div>
      
      <div style={styles.divider} />
      
      <div style={styles.section}>
        <h2 style={styles.subheading}>Slack Integration</h2>
        
        <div style={styles.row}>
          <label style={styles.label}>
            Webhook URL:
            <input
              type="password"
              value={slackWebhook}
              onChange={(e) => setSlackWebhook(e.target.value)}
              style={styles.input}
              placeholder="Enter Slack webhook URL"
            />
          </label>
        </div>
        
        <div style={styles.row}>
          <label style={styles.label}>
            Channel:
            <input
              type="text"
              value={slackChannel}
              onChange={(e) => setSlackChannel(e.target.value)}
              style={styles.input}
              placeholder="Enter Slack channel (e.g., #ux-alerts)"
            />
          </label>
        </div>
        
        <div style={styles.row}>
          <label style={styles.label}>
            Minimum Severity:
            <select
              value={slackMinSeverity}
              onChange={(e) => setSlackMinSeverity(e.target.value)}
              style={styles.select}
            >
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="error">Error</option>
              <option value="critical">Critical</option>
            </select>
          </label>
        </div>
        
        <div style={styles.row}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={slackEnabled}
              onChange={(e) => setSlackEnabled(e.target.checked)}
            />
            Enable Slack Integration
          </label>
        </div>
        
        <div style={styles.row}>
          <label style={styles.checkbox}>
            <input
              type="checkbox"
              checked={slackAutoSync}
              onChange={(e) => setSlackAutoSync(e.target.checked)}
            />
            Auto-send alerts to Slack
          </label>
        </div>
        
        <div style={styles.buttonContainer}>
          <button onClick={saveSlackSettings} style={styles.button}>
            Save Slack Settings
          </button>
          
          <button
            onClick={testSlackConnection}
            disabled={!slackWebhook}
            style={{
              ...styles.button,
              ...(!slackWebhook ? styles.disabledButton : {})
            }}
          >
            Test Connection
          </button>
        </div>
        
        {slackTestStatus && (
          <div style={{
            ...styles.notification,
            backgroundColor: slackTestStatus.includes('successful') ? '#dff0d8' : '#f2dede'
          }}>
            {slackTestStatus}
          </div>
        )}
      </div>
    </div>
  );
};

// Styles
const styles = {
  container: {
    maxWidth: '800px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  heading: {
    fontSize: '24px',
    marginBottom: '20px',
    color: '#333',
  },
  subheading: {
    fontSize: '20px',
    marginBottom: '15px',
    color: '#444',
  },
  section: {
    marginBottom: '30px',
  },
  row: {
    marginBottom: '15px',
  },
  label: {
    display: 'block',
    marginBottom: '5px',
    color: '#555',
  },
  input: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    marginTop: '5px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
  },
  select: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    marginTop: '5px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    backgroundColor: 'white',
  },
  checkbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    color: '#555',
  },
  buttonContainer: {
    display: 'flex',
    gap: '10px',
    marginTop: '15px',
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  notification: {
    padding: '10px 15px',
    marginBottom: '15px',
    backgroundColor: '#dff0d8',
    borderRadius: '4px',
    color: '#3c763d',
  },
  divider: {
    height: '1px',
    backgroundColor: '#eee',
    margin: '30px 0',
  },
};

export default SettingsPage; 