import { useState } from 'react';
import { 
  User, 
  Lock, 
  Bell, 
  Palette, 
  ShieldAlert,
  LogOut,
  Globe,
  Smartphone
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useNotification } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../utils/supabase';

type TabType = 'account' | 'privacy' | 'notifications' | 'appearance';

// Theme-Aware Toggle Component
const ToggleSwitch = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => {
  const { theme } = useTheme();
  
  return (
    <button
      onClick={onChange}
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none shadow-inner"
      style={{
        // Dynamically swap the background track color based on Theme and Checked state
        backgroundColor: checked 
          ? 'var(--color-brand)' 
          : (theme === 'light' ? '#cbd5e1' : '#3f3f46') // Light gray in Light Mode, Dark gray in Dark Mode
      }}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full transition-transform shadow-md ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
        style={{ 
          // Flips the knob color dynamically so it never turns invisible!
          backgroundColor: checked ? 'var(--color-brand-contrast)' : '#ffffff'
        }} 
      />
    </button>
  );
};

export default function Settings() {
  const { showNotification } = useNotification();
  const [activeTab, setActiveTab] = useState<TabType>('account');
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const [settings, setSettings] = useState({
    privateAccount: user?.user_metadata?.privateAccount || false,
    activityStatus: user?.user_metadata?.activityStatus ?? true,
    readReceipts: user?.user_metadata?.readReceipts ?? true,
    pushNotifications: user?.user_metadata?.pushNotifications ?? true,
    emailNotifications: user?.user_metadata?.emailNotifications || false,
    marketingEmails: user?.user_metadata?.marketingEmails || false,
  });

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: settings
      });

      if (error) throw error;
      showNotification('Settings saved successfully', 'success');
    } catch (err: any) {
      showNotification(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    showNotification('Password reset email sent!', 'info');
    // In a real app, this triggers the flow
    await supabase.auth.resetPasswordForEmail(user?.email || '');
  };

  const handleDeleteAccount = () => {
    const confirm = window.confirm("Are you absolutely sure? This will permanently delete your account data.");
    if (confirm) {
      showNotification('Account deletion requested. Our team will process this.', 'warning');
      setTimeout(() => handleLogout(), 2000);
    }
  };

  return (
    <div className="min-h-screen py-6 sm:px-4 lg:px-6 w-full transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col gap-2 px-4 mb-6">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
            Settings & Privacy
          </h1>
          <p className="text-sm text-gray-500">
            Manage your account preferences and security.
          </p>
        </div>

        {/* Scrollable Tabs for Mobile Support */}
        <div className="px-4 mb-6 overflow-x-auto hide-scrollbar">
          <div className="flex border-b border-gray-800 gap-6 relative min-w-max pb-px">
            {[
              { id: 'account', label: 'Account', icon: User },
              { id: 'privacy', label: 'Privacy', icon: Lock },
              { id: 'notifications', label: 'Notifications', icon: Bell },
              { id: 'appearance', label: 'Appearance', icon: Palette },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`pb-3 relative flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-brand' : 'text-gray-500 hover:text-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                  {isActive && (
                    <motion.div 
                      layoutId="settingsTab" 
                      className="absolute -bottom-[1px] left-0 right-0 h-[4px] bg-brand rounded-full" 
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Settings Content Container - Liquid Glass theme */}
        <div className="w-full md:rounded-2xl border border-gray-800 overflow-hidden bg-gray-900 mb-8">
          <AnimatePresence mode="wait">
            
            {activeTab === 'account' && (
              <motion.div
                key="account"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col bg-transparent"
              >
                <div className="p-4 sm:p-6 border-b border-gray-800">
                  <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                     <User className="w-5 h-5 text-gray-500" />
                     Profile Information
                  </h3>
                  
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                          Username
                        </label>
                        <input 
                          type="text" 
                          defaultValue={user?.email?.split('@')[0] || 'username'}
                          className="w-full bg-gray-800 border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:border-brand outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                          Email Address
                        </label>
                        <input 
                          type="email" 
                          defaultValue={user?.email || 'email@example.com'}
                          className="w-full bg-gray-800 border border-gray-800 rounded-xl px-4 py-2.5 text-white focus:border-brand outline-none transition-all"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-4 mt-2">
                      <button 
                        onClick={handleSaveChanges}
                        disabled={isSaving}
                        className="px-6 py-2 bg-brand text-brand-contrast text-sm font-bold rounded-full hover:opacity-90 transition-all disabled:opacity-50"
                      >
                        {isSaving ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-4 sm:p-6 border-b border-gray-800">
                  <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
                    <Lock className="w-5 h-5 text-gray-500" />
                    Password & Security
                  </h3>
                  <button 
                    onClick={handlePasswordChange}
                    className="w-full sm:w-auto px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 border border-gray-800 transition-colors"
                  >
                    Change Password
                  </button>
                </div>

                <div className="p-4 sm:p-6">
                  <h3 className="text-lg font-medium text-red-500 mb-2 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5" />
                    Danger Zone
                  </h3>
                  <p className="text-sm text-gray-500 mb-4">
                    Permanently delete your account and all of your content.
                  </p>
                  <button 
                    onClick={handleDeleteAccount}
                    className="px-4 py-2 border border-red-500/50 text-red-500 text-sm font-medium rounded-lg hover:bg-red-500 hover:text-white transition-colors"
                  >
                    Delete Account
                  </button>
                </div>
              </motion.div>
            )}

            {/* PRIVACY TAB */}
            {activeTab === 'privacy' && (
              <motion.div
                key="privacy"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col bg-transparent"
              >
                <div className="p-4 sm:p-6 border-b border-gray-800">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-medium text-white">Private Account</h3>
                      <p className="text-sm text-gray-500 mt-1">Only approved followers can see your posts and community activity.</p>
                    </div>
                    <ToggleSwitch 
                      checked={settings.privateAccount} 
                      onChange={() => toggleSetting('privateAccount')} 
                    />
                  </div>
                </div>
                
                <div className="p-4 sm:p-6 border-b border-gray-800">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-medium text-white">Show Activity Status</h3>
                      <p className="text-sm text-gray-500 mt-1">Allow accounts you follow to see when you are online.</p>
                    </div>
                    <ToggleSwitch 
                      checked={settings.activityStatus} 
                      onChange={() => toggleSetting('activityStatus')} 
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-medium text-white">Read Receipts</h3>
                      <p className="text-sm text-gray-500 mt-1">Let others know when you have read their messages.</p>
                    </div>
                    <ToggleSwitch 
                      checked={settings.readReceipts} 
                      onChange={() => toggleSetting('readReceipts')} 
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* NOTIFICATIONS TAB */}
            {activeTab === 'notifications' && (
              <motion.div
                key="notifications"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col bg-transparent"
              >
                <div className="p-4 sm:p-6 border-b border-gray-800">
                  <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-gray-500" />
                    Push Notifications
                  </h3>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-medium text-white">Pause All</h3>
                      <p className="text-sm text-gray-500 mt-1">Temporarily pause all push notifications.</p>
                    </div>
                    <ToggleSwitch 
                      checked={!settings.pushNotifications} 
                      onChange={() => toggleSetting('pushNotifications')} 
                    />
                  </div>
                </div>

                <div className="p-4 sm:p-6">
                  <h3 className="text-lg font-medium text-white mb-6 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-gray-500" />
                    Email Notifications
                  </h3>
                  <div className="space-y-6">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-medium text-white">Activity Emails</h3>
                        <p className="text-sm text-gray-500 mt-1">Get emails about new followers, mentions, and messages.</p>
                      </div>
                      <ToggleSwitch 
                        checked={settings.emailNotifications} 
                        onChange={() => toggleSetting('emailNotifications')} 
                      />
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h3 className="text-base font-medium text-white">Marketing Emails</h3>
                        <p className="text-sm text-gray-500 mt-1">Receive updates about new features and promotions.</p>
                      </div>
                      <ToggleSwitch 
                        checked={settings.marketingEmails} 
                        onChange={() => toggleSetting('marketingEmails')} 
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* APPEARANCE TAB */}
            {activeTab === 'appearance' && (
              <motion.div
                key="appearance"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col bg-transparent p-4 sm:p-6"
              >
                <div className="mb-8">
                  <h3 className="text-base font-medium text-white mb-4">Theme</h3>
                  <p className="text-sm text-gray-500 mb-6">
                    Choose how the app looks to you. Your theme preference is saved automatically.
                  </p>
                  
                  {/* Theme Preview Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div 
                      onClick={() => theme === 'light' && toggleTheme()}
                      className={`rounded-xl p-1 bg-gray-900 cursor-pointer transition-all ${
                        theme === 'dark' ? 'border-2 border-brand ring-2 ring-brand/20' : 'border border-gray-800 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="bg-gray-800 rounded-lg h-24 w-full flex flex-col justify-between p-3">
                        <div className="w-1/2 h-3 bg-gray-900 rounded-full" />
                        <div className="w-3/4 h-3 bg-brand rounded-full" />
                      </div>
                      <p className="text-center text-sm font-medium text-white mt-2 mb-1">Dark Mode</p>
                    </div>
                    
                    <div 
                      onClick={() => theme === 'dark' && toggleTheme()}
                      className={`rounded-xl p-1 bg-[#f8fafc] cursor-pointer transition-all ${
                        theme === 'light' ? 'border-2 border-brand ring-2 ring-brand/20' : 'border border-gray-200 opacity-60 hover:opacity-100'
                      }`}
                    >
                      <div className="bg-[#e2e8f0] border border-gray-200 rounded-lg h-24 w-full flex flex-col justify-between p-3">
                        <div className="w-1/2 h-3 bg-[#cbd5e1] rounded-full" />
                        <div className="w-3/4 h-3 bg-brand rounded-full" />
                      </div>
                      <p className="text-center text-sm font-medium text-gray-900 mt-2 mb-1">Light Mode</p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Logout Button */}
        <div className="px-4 pb-8">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-gray-800 bg-gray-900 text-gray-500 hover:text-red-500 hover:bg-red-500/10 transition-all font-bold shadow-sm"
          >
            <LogOut className="w-5 h-5" />
            Log Out
          </button>
        </div>

      </div>
    </div>
  );
}