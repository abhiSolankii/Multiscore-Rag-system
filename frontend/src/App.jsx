import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Toaster } from 'react-hot-toast';
import AppRouter from './router';
import { setUser } from './store/authSlice';
import { getMe } from './api/auth';
import { getToken } from './utils/token';

const App = () => {
  const dispatch = useDispatch();

  // Rehydrate user on app boot if token exists in localStorage
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    getMe()
      .then((user) => dispatch(setUser(user)))
      .catch(() => {
        // Token invalid/expired — let the Axios interceptor handle logout
      });
  }, [dispatch]);

  return (
    <>
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
    </>
  );
};

export default App;
