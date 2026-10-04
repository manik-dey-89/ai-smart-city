import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiShield, FiSearch, FiPlus, FiEdit2, FiTrash2, FiKey, FiAlertCircle, FiCheckCircle, FiChevronDown } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Permission[];
}

interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
  description?: string;
}

const RoleManagement: React.FC = () => {
  const { token } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/roles/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch roles');

      const data = await response.json();
      setRoles(data);
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to load roles' });
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      const response = await fetch('/api/permissions/', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to fetch permissions');

      const data = await response.json();
      setPermissions(data);
    } catch (err) {
      console.error('Failed to load permissions');
    }
  };

  const handleDelete = async (roleId: string) => {
    if (!confirm('Are you sure you want to delete this role?')) return;

    try {
      const response = await fetch(`/api/roles/${roleId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error('Failed to delete role');

      setMessage({ type: 'success', text: 'Role deleted successfully' });
      fetchRoles();
    } catch (err) {
      setMessage({ type: 'error', text: 'Failed to delete role' });
    }
  };

  const filteredRoles = roles.filter((role) =>
    role.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (role.description && role.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="p-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Role Management</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
          >
            <FiPlus />
            Add Role
          </button>
        </div>

        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`mb-6 p-4 rounded-lg flex items-center gap-3 ${
              message.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-400'
                : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }`}
          >
            {message.type === 'success' ? <FiCheckCircle /> : <FiAlertCircle />}
            <span className="text-sm">{message.text}</span>
          </motion.div>
        )}

        <div className="glass-card p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search roles..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-all"
              />
            </div>
          </div>

          {loading ? (
            <div className="text-center py-8 text-gray-400">Loading roles...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRoles.map((role) => (
                <div key={role.id} className="bg-white/5 border border-white/10 rounded-lg p-4 hover:border-cyan-500/50 transition-colors">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                        <FiShield className="text-white" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{role.name}</h3>
                        <p className="text-gray-400 text-xs">{role.permissions?.length || 0} permissions</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => {
                          setSelectedRole(role);
                          setShowEditModal(true);
                        }}
                        className="p-1.5 rounded hover:bg-white/10 transition-colors"
                      >
                        <FiEdit2 className="text-gray-400 text-sm" />
                      </button>
                      {role.name !== 'super_admin' && (
                        <button
                          onClick={() => handleDelete(role.id)}
                          className="p-1.5 rounded hover:bg-white/10 transition-colors"
                        >
                          <FiTrash2 className="text-red-400 text-sm" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-400 text-sm mb-3">{role.description || 'No description'}</p>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions?.slice(0, 3).map((perm) => (
                      <span key={perm.id} className="px-2 py-0.5 bg-purple-500/10 text-purple-400 rounded text-xs">
                        {perm.name}
                      </span>
                    ))}
                    {(role.permissions?.length || 0) > 3 && (
                      <span className="px-2 py-0.5 bg-white/10 text-gray-400 rounded text-xs">
                        +{(role.permissions?.length || 0) - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {filteredRoles.length === 0 && !loading && (
            <div className="text-center py-8 text-gray-400">No roles found</div>
          )}
        </div>

        <div className="mt-8">
          <h2 className="text-2xl font-bold text-white mb-4">All Permissions</h2>
          <div className="glass-card p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {permissions.map((perm) => (
                <div key={perm.id} className="flex items-center gap-2 p-2 bg-white/5 rounded">
                  <FiKey className="text-cyan-400 text-sm" />
                  <span className="text-gray-300 text-sm">{perm.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {showCreateModal && (
        <CreateRoleModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            fetchRoles();
            setMessage({ type: 'success', text: 'Role created successfully' });
          }}
          token={token}
          availablePermissions={permissions}
        />
      )}

      {showEditModal && selectedRole && (
        <EditRoleModal
          role={selectedRole}
          onClose={() => setShowEditModal(false)}
          onSuccess={() => {
            setShowEditModal(false);
            fetchRoles();
            setMessage({ type: 'success', text: 'Role updated successfully' });
          }}
          token={token}
          availablePermissions={permissions}
        />
      )}
    </div>
  );
};

const CreateRoleModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
  availablePermissions: Permission[];
}> = ({ onClose, onSuccess, token, availablePermissions }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/roles/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to create role');
      }

      const role = await response.json();

      // Assign permissions
      for (const permId of selectedPermissions) {
        await fetch(`/api/roles/${role.id}/permissions/${permId}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const groupedPermissions = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-lg p-6 my-8"
      >
        <h2 className="text-xl font-bold text-white mb-4">Create New Role</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Role Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500 transition-all resize-none"
              rows={3}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white hover:bg-white/10 transition-all"
            >
              <span>Permissions ({selectedPermissions.length} selected)</span>
              <FiChevronDown className={`transition-transform ${showPermissions ? 'rotate-180' : ''}`} />
            </button>

            {showPermissions && (
              <div className="mt-2 space-y-3 max-h-60 overflow-y-auto">
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource}>
                    <h4 className="text-cyan-400 text-sm font-medium mb-2 capitalize">{resource}</h4>
                    <div className="space-y-1">
                      {perms.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPermissions([...selectedPermissions, perm.id]);
                              } else {
                                setSelectedPermissions(selectedPermissions.filter((id) => id !== perm.id));
                              }
                            }}
                            className="rounded bg-white/5 border-white/10 text-cyan-500 focus:ring-cyan-500"
                          />
                          {perm.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white font-medium py-2 rounded-lg transition-all"
            >
              {loading ? 'Creating...' : 'Create Role'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

const EditRoleModal: React.FC<{
  role: Role;
  onClose: () => void;
  onSuccess: () => void;
  token: string | null;
  availablePermissions: Permission[];
}> = ({ role, onClose, onSuccess, token, availablePermissions }) => {
  const [formData, setFormData] = useState({
    name: role.name,
    description: role.description || '',
  });
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(
    role.permissions?.map((p) => p.id) || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPermissions, setShowPermissions] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/roles/${role.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to update role');
      }

      // Get current role permissions
      const currentPerms = await fetch(`/api/roles/${role.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const currentRole = await currentPerms.json();
      const currentPermIds = currentRole.permissions?.map((p: Permission) => p.id) || [];

      // Remove unselected permissions
      for (const permId of currentPermIds) {
        if (!selectedPermissions.includes(permId)) {
          await fetch(`/api/roles/${role.id}/permissions/${permId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      // Add new permissions
      for (const permId of selectedPermissions) {
        if (!currentPermIds.includes(permId)) {
          await fetch(`/api/roles/${role.id}/permissions/${permId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
        }
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const groupedPermissions = availablePermissions.reduce((acc, perm) => {
    if (!acc[perm.resource]) acc[perm.resource] = [];
    acc[perm.resource].push(perm);
    return acc;
  }, {} as Record<string, Permission[]>);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass-card w-full max-w-lg p-6 my-8"
      >
        <h2 className="text-xl font-bold text-white mb-4">Edit Role</h2>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-2">Role Name</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500 transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white focus:outline-none focus:border-cyan-500 transition-all resize-none"
              rows={3}
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => setShowPermissions(!showPermissions)}
              className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg py-2 px-3 text-white hover:bg-white/10 transition-all"
            >
              <span>Permissions ({selectedPermissions.length} selected)</span>
              <FiChevronDown className={`transition-transform ${showPermissions ? 'rotate-180' : ''}`} />
            </button>

            {showPermissions && (
              <div className="mt-2 space-y-3 max-h-60 overflow-y-auto">
                {Object.entries(groupedPermissions).map(([resource, perms]) => (
                  <div key={resource}>
                    <h4 className="text-cyan-400 text-sm font-medium mb-2 capitalize">{resource}</h4>
                    <div className="space-y-1">
                      {perms.map((perm) => (
                        <label key={perm.id} className="flex items-center gap-2 text-sm text-gray-300">
                          <input
                            type="checkbox"
                            checked={selectedPermissions.includes(perm.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPermissions([...selectedPermissions, perm.id]);
                              } else {
                                setSelectedPermissions(selectedPermissions.filter((id) => id !== perm.id));
                              }
                            }}
                            className="rounded bg-white/5 border-white/10 text-cyan-500 focus:ring-cyan-500"
                          />
                          {perm.name}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/50 text-white font-medium py-2 rounded-lg transition-all"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-white/5 hover:bg-white/10 text-white font-medium py-2 rounded-lg transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default RoleManagement;
