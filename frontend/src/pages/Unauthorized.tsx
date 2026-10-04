import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock, FiArrowLeft } from 'react-icons/fi';
import { motion } from 'framer-motion';

const Unauthorized: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-12 text-center max-w-md w-full"
      >
        <div className="mx-auto w-24 h-24 bg-red-500/20 rounded-full flex items-center justify-center mb-6">
          <FiLock size={48} className="text-red-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">Access Denied</h1>
        <p className="text-gray-400 mb-8">
          You don't have permission to access this page.
        </p>
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 mx-auto px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg font-medium transition-colors"
        >
          <FiArrowLeft size={18} />
          Go to Dashboard
        </button>
      </motion.div>
    </div>
  );
};

export default Unauthorized;
