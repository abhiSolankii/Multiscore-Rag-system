import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import { ConfigProvider, theme } from 'antd';
import AppRouter from './router';
import { setUser } from './store/authSlice';
import { getMe } from './api/auth';
import { getToken } from './utils/token';
import { APP_NAME } from './constants/app';

const App = () => {
  const dispatch = useDispatch();

  // Sync tab title from constants
  useEffect(() => {
    document.title = APP_NAME;
  }, []);

  // Rehydrate user on app boot if token exists in localStorage
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMe()
      .then((user) => dispatch(setUser(user)))
      .catch(() => {});
  }, [dispatch]);

  return (
    // Ant Design dark theme — fixes white background in modals / dropdowns / selects
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#6366f1',       // indigo-500
          colorBgContainer: '#111827',   // gray-900
          colorBgElevated: '#1f2937',    // gray-800 (popups/modals)
          colorBorder: '#374151',        // gray-700
          colorText: '#f9fafb',          // gray-50
          colorTextSecondary: '#9ca3af', // gray-400
          borderRadius: 8,
          fontFamily: 'inherit',
        },
      }}
    >
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1f2937',
            color: '#f9fafb',
            border: '1px solid #374151',
            fontSize: '14px',
          },
          error: { duration: 5000 },
          success: { duration: 3000 },
        }}
      />
      <AppRouter />
    </ConfigProvider>
  );
};

export default App;
