import { NavLink, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  MessageSquare,
  Upload,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Brain,
} from 'lucide-react';
import { logout } from '../../store/authSlice';
import useAuth from '../../hooks/useAuth';
import { Tooltip } from 'antd';

const navItems = [
  { to: '/chats', icon: MessageSquare, label: 'Chats' },
  { to: '/ingest', icon: Upload, label: 'Ingest' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const Sidebar = ({ collapsed, setCollapsed }) => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  return (
    <aside
      className={`flex flex-col h-full bg-gray-900 border-r border-gray-800 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* Logo / Brand */}
      <div className="flex items-center h-16 px-4 border-b border-gray-800 shrink-0">
        <Brain size={22} className="text-indigo-400 shrink-0" />
        {!collapsed && (
          <span className="ml-3 font-bold text-white text-sm tracking-wide truncate">
            Multiscore RAG
          </span>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 py-4 space-y-1 px-2 overflow-hidden">
        {navItems.map(({ to, icon: Icon, label }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </NavLink>
          );
          return collapsed ? (
            <Tooltip key={to} title={label} placement="right">
              {link}
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      {/* User info + Logout */}
      <div className="border-t border-gray-800 p-3 space-y-2 shrink-0">
        {!collapsed && user && (
          <p className="text-xs text-gray-500 truncate px-1">{user.email}</p>
        )}
        <Tooltip title={collapsed ? 'Logout' : ''} placement="right">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-red-900/30 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} className="shrink-0" />
            {!collapsed && <span>Logout</span>}
          </button>
        </Tooltip>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-10 border-t border-gray-800 text-gray-500 hover:text-white hover:bg-gray-800 transition-colors shrink-0"
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </aside>
  );
};

export default Sidebar;
