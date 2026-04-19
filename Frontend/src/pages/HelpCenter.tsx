import { useState } from 'react';
import { 
  Search, 
  ChevronDown, 
  BookOpen, 
  CreditCard, 
  ShieldCheck, 
  Wrench,
  Mail,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Help Categories
const categories = [
  { id: 'getting-started', title: 'Getting Started', icon: <BookOpen className="w-5 h-5 text-blue-500" />, desc: 'Learn the basics and set up your profile.' },
  { id: 'billing', title: 'Billing & Plans', icon: <CreditCard className="w-5 h-5 text-green-500" />, desc: 'Manage your subscription and payment methods.' },
  { id: 'privacy', title: 'Privacy & Security', icon: <ShieldCheck className="w-5 h-5 text-purple-500" />, desc: 'Control your data and account security.' },
  { id: 'troubleshooting', title: 'Troubleshooting', icon: <Wrench className="w-5 h-5 text-amber-500" />, desc: 'Fix common issues and errors.' },
];

// FAQs
const faqs = [
  {
    id: 'faq-1',
    question: 'How do I change my password?',
    answer: 'To change your password, go to your Profile Settings, click on "Security", and select "Change Password". You will need to enter your current password to set a new one.'
  },
  {
    id: 'faq-2',
    question: 'Can I cancel my subscription at any time?',
    answer: 'Yes, you can cancel your subscription at any time from the Billing page. Your premium features will remain active until the end of your current billing cycle.'
  },
  {
    id: 'faq-3',
    question: 'Why are my notifications not showing up?',
    answer: 'Please ensure that you have granted browser permissions for push notifications. You can also check your in-app Notification Preferences to ensure you haven\'t muted specific alert types.'
  },
  {
    id: 'faq-4',
    question: 'How do I contact customer support directly?',
    answer: 'You can reach our support team 24/7 by clicking the "Chat with us" button at the bottom of this page, or by emailing support@communityapp.com.'
  }
];

export default function HelpCenter() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  const toggleFaq = (id: string) => {
    setExpandedFaq(expandedFaq === id ? null : id);
  };

  // Filter FAQs based on search
  const filteredFaqs = faqs.filter(faq => 
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen py-6 sm:px-4 lg:px-6 w-full transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        
        {/* Header Section */}
        <div className="flex flex-col gap-2 px-4 mb-6">
          <h1 className="text-xl md:text-2xl lg:text-3xl font-bold text-white">
            Help Center
          </h1>
          <p className="text-sm text-gray-500">
            How can we help you today?
          </p>
        </div>

        {/* Search Bar */}
        <div className="px-4 mb-8">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500 group-focus-within:text-brand transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-3 border border-gray-800 rounded-xl leading-5 bg-gray-900 text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-all sm:text-sm"
              placeholder="Search for articles, guides, or FAQs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Categories Grid (Hides when searching) */}
        {!searchQuery && (
          <div className="px-4 mb-10">
            <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Categories</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {categories.map((category) => (
                <motion.div
                  key={category.id}
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-4 rounded-xl border border-gray-800 bg-gray-900 cursor-pointer hover:border-brand transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-gray-800 group-hover:bg-brand/10 transition-colors">
                      {category.icon}
                    </div>
                    <div>
                      <h3 className="text-white font-medium text-sm mb-1 group-hover:text-brand transition-colors">
                        {category.title}
                      </h3>
                      <p className="text-xs text-gray-500 leading-snug">
                        {category.desc}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* FAQs Section */}
        <div className="px-4 mb-8">
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
            {searchQuery ? 'Search Results' : 'Frequently Asked Questions'}
          </h2>
          
          <div className="w-full md:rounded-2xl border border-gray-800 overflow-hidden bg-transparent">
            {filteredFaqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center bg-gray-900">
                <div className="bg-gray-800 p-4 rounded-full mb-3">
                  <Search className="w-6 h-6 text-gray-500" />
                </div>
                <h3 className="text-base font-medium text-white">No results found</h3>
                <p className="text-gray-500 mt-1 text-sm">We couldn't find anything matching "{searchQuery}"</p>
              </div>
            ) : (
              <div className="flex flex-col">
                {filteredFaqs.map((faq) => {
                  const isExpanded = expandedFaq === faq.id;
                  return (
                    <div 
                      key={faq.id} 
                      className="border-b border-gray-800 last:border-b-0 bg-transparent"
                    >
                      <button
                        onClick={() => toggleFaq(faq.id)}
                        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-900 transition-colors focus:outline-none"
                      >
                        <span className={`text-sm font-medium pr-4 ${isExpanded ? 'text-brand' : 'text-white'}`}>
                          {faq.question}
                        </span>
                        <motion.div
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          transition={{ duration: 0.2 }}
                          className="flex-shrink-0 text-gray-500"
                        >
                          <ChevronDown className="w-5 h-5" />
                        </motion.div>
                      </button>
                      
                      {/* Accordion Content - FIXED BACKGROUND OPACITY */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden bg-gray-800"
                          >
                            <div className="p-4 text-sm text-gray-500 leading-relaxed">
                              {faq.answer}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Contact Support Banner */}
        <div className="px-4 pb-8">
          <div className="p-6 rounded-2xl border border-gray-800 bg-gray-900 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
            <div>
              <h3 className="text-white font-medium text-base mb-1">Still need help?</h3>
              <p className="text-sm text-gray-500">Our support team is available 24/7 to assist you.</p>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-gray-800 text-gray-500 hover:text-brand hover:bg-gray-800 transition-colors text-sm font-medium">
                <Mail className="w-4 h-4" />
                Email
              </button>
              <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-brand text-white hover:bg-brand/90 transition-colors text-sm font-medium">
                <MessageCircle className="w-4 h-4" />
                Chat
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}