import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShoppingCart, Mail, Lock, User, Briefcase, ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './Auth.css';

function Auth({ onLogin }) {
  const location = useLocation();
  const navigate = useNavigate();
  const frontRef = useRef(null);
  const backRef = useRef(null);
  
  // Derive flip state directly from location
  const isFlipped = location.pathname === '/signup';

  // Forgot password modal
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);

  // Update container height based on active card
  useEffect(() => {
    const updateHeight = () => {
      const activeCard = isFlipped ? backRef.current : frontRef.current;
      if (activeCard) {
        const height = activeCard.offsetHeight;
        document.documentElement.style.setProperty('--flipper-height', `${height}px`);
      }
    };

    // Update height after render and on window resize
    updateHeight();
    window.addEventListener('resize', updateHeight);
    
    // Small delay to ensure content is rendered
    setTimeout(updateHeight, 100);

    return () => window.removeEventListener('resize', updateHeight);
  }, [isFlipped]);
  
  // Login state
  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Signup state
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'procurement_officer',
    organization: ''
  });
  const [signupError, setSignupError] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  const handleFlip = (e) => {
    e.preventDefault();
    setLoginError('');
    setSignupError('');
    // Navigate to the other route to trigger flip
    navigate(isFlipped ? '/login' : '/signup');
  };

  // Login handlers
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginData.email,
        password: loginData.password,
      });

      if (error) throw error;

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) throw profileError;

      const userData = {
        id: profile.id,
        name: profile.full_name,
        email: profile.email,
        role: profile.role,
        organization: profile.organization
      };

      // Store in localStorage
      localStorage.setItem('userId', userData.id);
      localStorage.setItem('userName', userData.name);
      localStorage.setItem('userEmail', userData.email);
      localStorage.setItem('userRole', userData.role);

      onLogin(userData);
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      setLoginError('Invalid email or password!');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLoginChange = (e) => {
    setLoginData({
      ...loginData,
      [e.target.name]: e.target.value
    });
  };

  // Signup handlers
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');

    // Validation
    if (!signupData.name || !signupData.email || !signupData.password || !signupData.confirmPassword || !signupData.organization) {
      setSignupError('Please fill all fields!');
      return;
    }

    if (signupData.password !== signupData.confirmPassword) {
      setSignupError('Passwords do not match!');
      return;
    }

    if (signupData.password.length < 6) {
      setSignupError('Password must be at least 6 characters!');
      return;
    }

    setSignupLoading(true);

    try {
      // Sign up user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupData.email,
        password: signupData.password,
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('Email already registered!');
        }
        throw authError;
      }

      if (!authData.user) {
        throw new Error('Signup failed. Please try again.');
      }

      // Insert profile data using upsert
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: signupData.name,
          email: signupData.email,
          organization: signupData.organization,
          role: signupData.role,
        });

      if (profileError) throw profileError;

      const userData = {
        id: authData.user.id,
        name: signupData.name,
        email: signupData.email,
        role: signupData.role,
        organization: signupData.organization
      };

      // Store in localStorage
      localStorage.setItem('userId', userData.id);
      localStorage.setItem('userName', userData.name);
      localStorage.setItem('userEmail', userData.email);
      localStorage.setItem('userRole', userData.role);

      onLogin(userData);
      navigate('/dashboard');
    } catch (error) {
      console.error('Signup error:', error);
      setSignupError(error.message || 'Signup failed. Please try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleSignupChange = (e) => {
    setSignupData({
      ...signupData,
      [e.target.name]: e.target.value
    });
  };

  // Forgot password handlers
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!forgotEmail) {
      setForgotError('Please enter your email!');
      return;
    }

    setForgotLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      });

      if (error) throw error;

      setForgotSuccess('✅ Reset link sent! Check your inbox.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setForgotSuccess('');
        setForgotError('');
      }, 3000);
    } catch (error) {
      console.error('Forgot password error:', error);
      setForgotError(error.message || 'Failed to send reset email.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className={`flip-container ${isFlipped ? 'flipped' : ''}`}>
        <div className="flipper">
          {/* Login Form - Front */}
          <div className="flip-front" ref={frontRef}>
            <div className="auth-card">
              <div className="auth-header">
                <div className="logo-large">
                  <ShoppingCart size={48} />
                </div>
                <h1>Welcome Back</h1>
                <p>Sign in to your VendorBridge account</p>
              </div>

              <form onSubmit={handleLoginSubmit} className="auth-form">
                {loginError && (
                  <div className="alert alert-danger">
                    <AlertCircle size={18} />
                    <span>{loginError}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="login-email">
                    <Mail size={16} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="login-email"
                    name="email"
                    className="form-control"
                    placeholder="Enter your email"
                    value={loginData.email}
                    onChange={handleLoginChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="login-password">
                    <Lock size={16} />
                    Password
                  </label>
                  <input
                    type="password"
                    id="login-password"
                    name="password"
                    className="form-control"
                    placeholder="Enter your password"
                    value={loginData.password}
                    onChange={handleLoginChange}
                    required
                  />
                </div>

                <div className="form-options">
                  <a href="#" onClick={(e) => { e.preventDefault(); setShowForgotPassword(true); }} className="link">Forgot password?</a>
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={loginLoading}>
                  {loginLoading ? (
                    <>
                      <div className="spinner"></div>
                      Signing in...
                    </>
                  ) : (
                    <>
                      Sign In
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className="auth-footer">
                <p>Don't have an account? <a href="#" onClick={handleFlip} className="link">Sign Up</a></p>
              </div>
            </div>
          </div>

          {/* Signup Form - Back */}
          <div className="flip-back" ref={backRef}>
            <div className="auth-card signup-card">
              <div className="auth-header">
                <div className="logo-large">
                  <ShoppingCart size={48} />
                </div>
                <h1>Create Account</h1>
                <p>Join VendorBridge and streamline your procurement</p>
              </div>

              <form onSubmit={handleSignupSubmit} className="auth-form">
                {signupError && (
                  <div className="alert alert-danger">
                    <AlertCircle size={18} />
                    <span>{signupError}</span>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="signup-name">
                      <User size={16} />
                      Full Name
                    </label>
                    <input
                      type="text"
                      id="signup-name"
                      name="name"
                      className="form-control"
                      placeholder="John Doe"
                      value={signupData.name}
                      onChange={handleSignupChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-email">
                      <Mail size={16} />
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="signup-email"
                      name="email"
                      className="form-control"
                      placeholder="john@company.com"
                      value={signupData.email}
                      onChange={handleSignupChange}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="signup-organization">
                    <Briefcase size={16} />
                    Organization
                  </label>
                  <input
                    type="text"
                    id="signup-organization"
                    name="organization"
                    className="form-control"
                    placeholder="Your company name"
                    value={signupData.organization}
                    onChange={handleSignupChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="signup-role">Role</label>
                  <select
                    id="signup-role"
                    name="role"
                    className="form-control"
                    value={signupData.role}
                    onChange={handleSignupChange}
                    required
                  >
                    <option value="procurement_officer">Procurement Officer</option>
                    <option value="vendor">Vendor</option>
                    <option value="manager">Manager/Approver</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="signup-password">
                      <Lock size={16} />
                      Password
                    </label>
                    <input
                      type="password"
                      id="signup-password"
                      name="password"
                      className="form-control"
                      placeholder="Min. 6 characters"
                      value={signupData.password}
                      onChange={handleSignupChange}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="signup-confirmPassword">
                      <Lock size={16} />
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      id="signup-confirmPassword"
                      name="confirmPassword"
                      className="form-control"
                      placeholder="Repeat password"
                      value={signupData.confirmPassword}
                      onChange={handleSignupChange}
                      required
                    />
                  </div>
                </div>

                <div className="terms-checkbox">
                  <label className="checkbox-label">
                    <input type="checkbox" required />
                    <span>I agree to the <a href="#" className="link">Terms of Service</a> and <a href="#" className="link">Privacy Policy</a></span>
                  </label>
                </div>

                <button type="submit" className="btn btn-primary btn-block" disabled={signupLoading}>
                  {signupLoading ? (
                    <>
                      <div className="spinner"></div>
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create Account
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>

              <div className="auth-footer">
                <p>Already have an account? <a href="#" onClick={handleFlip} className="link">Sign In</a></p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="auth-background">
        <div className="gradient-ball ball-1"></div>
        <div className="gradient-ball ball-2"></div>
        <div className="gradient-ball ball-3"></div>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="modal-overlay" onClick={() => setShowForgotPassword(false)}>
          <div className="modal" style={{ maxWidth: '400px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Reset Password</h2>
              <button className="icon-btn" onClick={() => setShowForgotPassword(false)}>×</button>
            </div>
            <form onSubmit={handleForgotPassword}>
              <div className="modal-body">
                {forgotError && (
                  <div className="alert alert-danger">
                    <AlertCircle size={18} />
                    <span>{forgotError}</span>
                  </div>
                )}
                {forgotSuccess && (
                  <div className="alert alert-success">
                    <CheckCircle size={18} />
                    <span>{forgotSuccess}</span>
                  </div>
                )}
                <div className="form-group">
                  <label htmlFor="forgot-email">Email Address</label>
                  <input
                    type="email"
                    id="forgot-email"
                    className="form-control"
                    placeholder="Enter your email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForgotPassword(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={forgotLoading}>
                  {forgotLoading ? (
                    <>
                      <div className="spinner"></div>
                      Sending...
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Auth;
