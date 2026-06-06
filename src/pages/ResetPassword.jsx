import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Lock, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Auth.css';

function ResetPassword() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionSet, setSessionSet] = useState(false);

  useEffect(() => {
    // Extract access_token from URL hash
    // Handle multiple formats:
    // 1. #/reset-password#access_token=xxx (HashRouter with nested hash)
    // 2. #access_token=xxx (Direct from email)
    const fullHash = window.location.hash;
    
    console.log('Full hash:', fullHash);
    console.log('Full URL:', window.location.href);
    
    let accessToken = null;
    let refreshToken = null;
    let tokenType = null;
    
    // Try multiple parsing strategies
    if (fullHash.includes('access_token=')) {
      // Strategy 1: Split by # and check all parts
      const parts = fullHash.split('#');
      console.log('Hash parts:', parts);
      
      for (const part of parts) {
        if (part.includes('access_token=')) {
          // Remove any leading path (like /reset-password)
          const tokenPart = part.includes('&') || part.includes('=') ? part : '';
          if (tokenPart) {
            const params = new URLSearchParams(tokenPart.split('?').pop());
            accessToken = params.get('access_token');
            refreshToken = params.get('refresh_token');
            tokenType = params.get('type');
            console.log('Found tokens:', { 
              accessToken: accessToken ? 'exists' : 'null', 
              refreshToken: refreshToken ? 'exists' : 'null',
              type: tokenType 
            });
            break;
          }
        }
      }
      
      // Strategy 2: If still not found, try parsing as query string
      if (!accessToken && fullHash.includes('access_token=')) {
        const queryPart = fullHash.substring(fullHash.indexOf('access_token='));
        const params = new URLSearchParams(queryPart);
        accessToken = params.get('access_token');
        refreshToken = params.get('refresh_token');
        tokenType = params.get('type');
        console.log('Found tokens (strategy 2):', { 
          accessToken: accessToken ? 'exists' : 'null', 
          refreshToken: refreshToken ? 'exists' : 'null',
          type: tokenType 
        });
      }
    }

    if (accessToken) {
      console.log('Setting session with access token...');
      // Set session with the tokens
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken || ''
      }).then(({ data, error }) => {
        if (error) {
          console.error('Error setting session:', error);
          setError('Invalid or expired reset link. Please request a new one.');
        } else {
          console.log('Session set successfully:', data);
          setSessionSet(true);
          setError(''); // Clear any previous errors
        }
      });
    } else {
      console.error('No access token found in URL');
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validations
    if (!newPassword || !confirmPassword) {
      setError('Please fill all fields!');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters!');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match!');
      return;
    }

    setLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) throw updateError;

      setSuccess('Password updated successfully!');
      
      // Redirect to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Password update error:', error);
      setError(error.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-large">
            <ShoppingCart size={48} />
          </div>
          <h1>Set New Password</h1>
          <p>Enter your new password below</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && (
            <div className="alert alert-danger">
              <AlertCircle size={18} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success">
              <CheckCircle size={18} />
              <span>{success}</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="new-password">
              <Lock size={16} />
              New Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showNewPassword ? 'text' : 'password'}
                id="new-password"
                className="form-control"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                disabled={!sessionSet}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword(!showNewPassword)}
                disabled={!sessionSet}
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirm-password">
              <Lock size={16} />
              Confirm Password
            </label>
            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirm-password"
                className="form-control"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={!sessionSet}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                disabled={!sessionSet}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block" 
            disabled={loading || !sessionSet}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                Updating...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <p>Remember your password? <a href="/#/login" className="link">Sign In</a></p>
        </div>
      </div>

      <div className="auth-background">
        <div className="gradient-ball ball-1"></div>
        <div className="gradient-ball ball-2"></div>
        <div className="gradient-ball ball-3"></div>
      </div>
    </div>
  );
}

export default ResetPassword;
