import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { Mail, Lock, UserPlus, ArrowRight, Eye, EyeOff, Globe, Link2 } from 'lucide-react';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const handleGoogleSignIn = async () => {
    try {
      setError('');
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, { full_name: fullName, username });
      navigate('/login');
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
      <div className="absolute top-0 -right-20 w-72 h-72 bg-brand/20 rounded-full blur-[100px] animate-pulse" />
      <div className="absolute bottom-0 -left-20 w-96 h-96 bg-purple-600/10 rounded-full blur-[120px] animate-pulse" />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 max-w-md w-full"
      >
        <div className="bg-gray-900/60 backdrop-blur-xl border border-white/10 p-8 rounded-3xl shadow-2xl">
          <div className="text-center mb-8">
            <motion.div 
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="w-16 h-16 bg-brand rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-brand/20"
            >
              <UserPlus className="text-white w-8 h-8" />
            </motion.div>
            <h2 className="text-3xl font-extrabold text-white tracking-tight">
              Create Account
            </h2>
            <p className="text-gray-400 mt-2 text-sm">
              Join our community and start sharing
            </p>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
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
              <label className="text-sm font-medium text-gray-400 ml-1">Email Address</label>
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

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-400 ml-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm"
                  placeholder="Nagesh Yalparatte"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-400 ml-1">Username</label>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand transition-all text-sm"
                  placeholder="NageshSY"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-400 ml-1">Password</label>
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

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-400 ml-1">Confirm Password</label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-gray-500 group-focus-within:text-brand transition-colors" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-gray-950 border border-gray-800 rounded-xl text-white placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-2 py-3.5 px-4 bg-brand hover:bg-brand/90 text-white text-sm font-bold rounded-xl transition-all shadow-lg shadow-brand/25 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Creating account...
                </div>
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-800"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#111827] px-3 font-medium text-gray-500">Or join with</span>
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

            <p className="text-center text-sm text-gray-500 pt-4">
              Already have an account?{' '}
              <Link to="/login" className="text-brand font-bold hover:underline transition-all">
                Sign In
              </Link>
            </p>
          </form>
        </div>
        
        <p className="mt-8 text-center text-xs text-gray-600">
          By joining, you agree to our <span className="underline cursor-pointer">Community Guidelines</span> and <span className="underline cursor-pointer">Privacy Policy</span>.
        </p>
      </motion.div>
    </div>
  );
}