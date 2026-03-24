import { useSelector } from 'react-redux';
import {
  selectUser,
  selectToken,
  selectIsAuthenticated,
  selectIsLoading,
} from '../store/authSlice';

const useAuth = () => {
  const user = useSelector(selectUser);
  const token = useSelector(selectToken);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectIsLoading);
  return { user, token, isAuthenticated, isLoading };
};

export default useAuth;
