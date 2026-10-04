import React from 'react';
import { motion } from 'framer-motion';
import { FiTrash2, FiTruck, FiMapPin, FiActivity } from 'react-icons/fi';

const Waste: React.FC = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-2">Smart Waste</h1>
        <p className="text-gray-400">Monitor bins and collection routes</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Bins Needing Collection', value: 42, icon: FiTrash2, color: 'text-yellow-400' },
          { label: 'Active Trucks', value: 12, icon: FiTruck, color: 'text-blue-400' },
          { label: 'Total Bins', value: 156, icon: FiMapPin, color: 'text-cyan-400' },
          { label: 'Daily Collection', value: '85%', icon: FiActivity, color: 'text-green-400' }
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

export default Waste;
