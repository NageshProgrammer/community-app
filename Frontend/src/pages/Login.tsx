import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Globe, Link2 } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Brought in the 'user' object from context
  const { signIn, signInWithGoogle, user } = useAuth();
  const navigate = useNavigate();

  // NEW: Watch for auth state changes!
  // When you come back from Google, this will detect the user and push them in.
  useEffect(() => {
    if (user) {
      navigate('/community');
    }
  }, [user, navigate]);

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      // We removed navigate('/community') from here because the OAuth flow 
      // forces the page to reload anyway. The useEffect above handles it now!
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
      navigate('/community');
    } catch (err: unknown) {
      if (err instanceof Error) setError(err.message);
      else setError('An unknown error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-dark relative overflow-hidden px-4">
      {/* Background Glows */}
      <div className="absolute top-0 -left-20 w-72 h-72 bg-brand/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-0 -right-20 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 max-w-md w-full"
      >
        <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <motion.div 
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 bg-brand rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-brand/20"
            >
              <Lock className="text-brand-contrast w-8 h-8" />
            </motion.div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Welcome back
            </h2>
            <p className="text-gray-400 mt-2 text-sm">
              Please enter your details to sign in
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-xl text-xs font-medium flex items-center gap-2"
              >
                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                {error}
              </motion.div>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-400 ml-1">Email</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-gray-500 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <label className="text-sm font-medium text-gray-400">Password</label>
                <button type="button" className="text-xs text-brand hover:underline font-medium">Forgot password?</button>
              </div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-500 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-12 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-4 bg-brand hover:bg-brand/90 text-brand-contrast text-sm font-bold rounded-xl transition-all shadow-lg shadow-brand/25 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-brand-contrast/20 border-t-brand-contrast rounded-full animate-spin" />
                  Authenticating...
                </div>
              ) : (
                <>
                  Sign In
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#111827] px-3 font-medium text-gray-500">Or continue with</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button 
                type="button" 
                onClick={handleGoogleSignIn}
                className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-950 border border-gray-800 rounded-xl text-gray-300 text-sm font-medium hover:bg-gray-900 transition-colors"
              >
                <Globe className="w-4 h-4 text-blue-500" />
                Google
              </button>
              <button type="button" className="flex items-center justify-center gap-2 py-2.5 px-4 bg-gray-950 border border-gray-800 rounded-xl text-gray-300 text-sm font-medium hover:bg-gray-900 transition-colors">
                <Link2 className="w-4 h-4 text-gray-400" />
                GitHub
              </button>
            </div>

            <p className="text-center text-sm text-gray-500 pt-2">
              Don't have an account?{' '}
              <Link to="/signup" className="text-brand font-bold hover:underline transition-all">
                Sign Up
              </Link>
            </p>
          </form>
        </div>
        
        <p className="mt-8 text-center text-xs text-gray-600">
          By continuing, you agree to our <span className="underline cursor-pointer">Terms of Service</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}