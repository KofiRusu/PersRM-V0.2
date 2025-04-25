import React, { useState } from 'react';
import { createUIPlugin, UIPluginBase } from '../component_base';

// Props interface for the LoginForm component
interface LoginFormProps {
  title?: string;
  buttonText?: string;
  onLogin?: (username: string, password: string) => Promise<boolean>;
  onLoginSuccess?: (username: string) => void;
  onLoginFailure?: (error: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

// Settings interface for the LoginForm plugin
interface LoginFormSettings {
  appearance: {
    primaryColor: string;
    secondaryColor: string;
    borderRadius: number;
    fontFamily: string;
  };
  behavior: {
    rememberMe: boolean;
    autoFocus: boolean;
    requireUsername: boolean;
    requirePassword: boolean;
  };
  validation: {
    minUsernameLength: number;
    minPasswordLength: number;
    showValidation: boolean;
  };
}

// State interface for the LoginForm plugin
interface LoginFormState {
  username: string;
  password: string;
  rememberMe: boolean;
  isLoggingIn: boolean;
  error: string | null;
  success: boolean;
}

/**
 * LoginForm component implementation
 */
const LoginFormComponent: React.FC<
  LoginFormProps & {
    settings: LoginFormSettings;
    state: LoginFormState;
    setState: (state: Partial<LoginFormState>) => void;
  }
> = (props) => {
  const {
    title = 'Login',
    buttonText = 'Sign In',
    onLogin,
    onLoginSuccess,
    onLoginFailure,
    className = '',
    style = {},
    settings,
    state,
    setState,
  } = props;

  // Handle form input changes
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ username: e.target.value });
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ password: e.target.value });
  };

  const handleRememberMeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setState({ rememberMe: e.target.checked });
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation
    if (
      settings.behavior.requireUsername &&
      (!state.username || state.username.length < settings.validation.minUsernameLength)
    ) {
      setState({
        error: `Username must be at least ${settings.validation.minUsernameLength} characters`,
      });
      return;
    }

    if (
      settings.behavior.requirePassword &&
      (!state.password || state.password.length < settings.validation.minPasswordLength)
    ) {
      setState({
        error: `Password must be at least ${settings.validation.minPasswordLength} characters`,
      });
      return;
    }

    // Set loading state
    setState({ isLoggingIn: true, error: null });

    try {
      // Call the onLogin callback if provided
      if (onLogin) {
        const success = await onLogin(state.username, state.password);
        
        if (success) {
          setState({ isLoggingIn: false, success: true });
          if (onLoginSuccess) {
            onLoginSuccess(state.username);
          }
        } else {
          throw new Error('Invalid username or password');
        }
      } else {
        // Mock login success for demo purposes
        setTimeout(() => {
          setState({ isLoggingIn: false, success: true });
          if (onLoginSuccess) {
            onLoginSuccess(state.username);
          }
        }, 1000);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      setState({ isLoggingIn: false, error: errorMessage, success: false });
      
      if (onLoginFailure) {
        onLoginFailure(errorMessage);
      }
    }
  };

  // Generate dynamic styles from settings
  const dynamicStyles = {
    formContainer: {
      fontFamily: settings.appearance.fontFamily,
      ...style,
    },
    input: {
      borderRadius: `${settings.appearance.borderRadius}px`,
    },
    button: {
      backgroundColor: settings.appearance.primaryColor,
      borderRadius: `${settings.appearance.borderRadius}px`,
    },
  };

  // Render success message if login was successful
  if (state.success) {
    return (
      <div
        className={`login-form-success ${className}`}
        style={dynamicStyles.formContainer}
      >
        <h2>Login Successful</h2>
        <p>Welcome, {state.username}!</p>
      </div>
    );
  }

  // Render login form
  return (
    <div
      className={`login-form-container ${className}`}
      style={dynamicStyles.formContainer}
    >
      <h2>{title}</h2>
      
      {state.error && (
        <div className="login-form-error">
          {state.error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="username">Username</label>
          <input
            type="text"
            id="username"
            name="username"
            value={state.username}
            onChange={handleUsernameChange}
            autoFocus={settings.behavior.autoFocus}
            disabled={state.isLoggingIn}
            style={dynamicStyles.input}
            required={settings.behavior.requireUsername}
          />
          {settings.validation.showValidation && state.username.length > 0 && state.username.length < settings.validation.minUsernameLength && (
            <div className="validation-message">
              Username must be at least {settings.validation.minUsernameLength} characters
            </div>
          )}
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            name="password"
            value={state.password}
            onChange={handlePasswordChange}
            disabled={state.isLoggingIn}
            style={dynamicStyles.input}
            required={settings.behavior.requirePassword}
          />
          {settings.validation.showValidation && state.password.length > 0 && state.password.length < settings.validation.minPasswordLength && (
            <div className="validation-message">
              Password must be at least {settings.validation.minPasswordLength} characters
            </div>
          )}
        </div>
        
        {settings.behavior.rememberMe && (
          <div className="form-group checkbox">
            <input
              type="checkbox"
              id="rememberMe"
              name="rememberMe"
              checked={state.rememberMe}
              onChange={handleRememberMeChange}
              disabled={state.isLoggingIn}
            />
            <label htmlFor="rememberMe">Remember me</label>
          </div>
        )}
        
        <button
          type="submit"
          className="login-button"
          disabled={state.isLoggingIn}
          style={dynamicStyles.button}
        >
          {state.isLoggingIn ? 'Logging in...' : buttonText}
        </button>
      </form>
    </div>
  );
};

/**
 * Create the LoginForm plugin
 */
export const LoginFormPlugin: UIPluginBase<LoginFormProps, LoginFormSettings, LoginFormState> = createUIPlugin({
  metadata: {
    id: 'perslm-ui-login-form',
    name: 'Login Form',
    description: 'A customizable login form component',
    version: '1.0.0',
    author: 'PersLM Team',
    category: 'authentication',
    tags: ['login', 'auth', 'form', 'user'],
    extensionPoints: ['login', 'auth-page'],
  },
  
  component: LoginFormComponent,
  
  defaultProps: {
    title: 'Sign In',
    buttonText: 'Login',
  },
  
  defaultSettings: {
    appearance: {
      primaryColor: '#3498db',
      secondaryColor: '#e74c3c',
      borderRadius: 4,
      fontFamily: 'Arial, sans-serif',
    },
    behavior: {
      rememberMe: true,
      autoFocus: true,
      requireUsername: true,
      requirePassword: true,
    },
    validation: {
      minUsernameLength: 3,
      minPasswordLength: 6,
      showValidation: true,
    },
  },
  
  defaultState: {
    username: '',
    password: '',
    rememberMe: false,
    isLoggingIn: false,
    error: null,
    success: false,
  },
  
  lifecycle: {
    init: () => {
      console.log('LoginForm plugin initialized');
    },
    mount: () => {
      console.log('LoginForm plugin mounted');
    },
    unmount: () => {
      console.log('LoginForm plugin unmounted');
    },
    stateChange: (prevState, currentState) => {
      if (prevState.error !== currentState.error && currentState.error) {
        console.error('Login error:', currentState.error);
      }
      
      if (!prevState.success && currentState.success) {
        console.log('Login successful for user:', currentState.username);
      }
    },
  },
  
  applyTheme: (theme) => {
    // Apply theme settings to component props
    return {
      style: {
        backgroundColor: theme.colors?.background || 'white',
        color: theme.colors?.text || 'black',
      },
    };
  },
});

export default LoginFormPlugin; 