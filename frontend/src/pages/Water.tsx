import React from 'react';
import { motion } from 'framer-motion';
import { FiDroplet, FiAlertTriangle, FiActivity, FiCheckCircle } from 'react-icons/fi';

const Water: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Water Management</h1>
        <p className="text-gray-400">Monitor water levels, quality, and consumption</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Water Level', value: '85%', icon: FiDroplet, color: 'text-blue-400' },
          { label: 'Active Leaks', value: 2, icon: FiAlertTriangle, color: 'text-red-400' },
          { label: 'Daily Consump.', value: '2.4M L', icon: FiActivity, color: 'text-cyan-400' },
          { label: 'Quality', value: 'Good', icon: FiCheckCircle, color: 'text-green-400' }
        ].map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <motion.div key={idx} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.1 }} className="glass-card p-6">
              <Icon size={24} className={stat.color} />
              <p className="text-3xl font-bold mt-3">{stat.value}</p>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default Water;
