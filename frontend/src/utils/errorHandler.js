import toast from 'react-hot-toast';

/**
 * Parse and display an API or network error.
 * @param {Error} err - Axios error or generic error
 * @param {string} [fallback] - Fallback message if none can be parsed
 */
export const handleError = (err, fallback = 'Something went wrong. Please try again.') => {
  const message =
    err?.response?.data?.detail ||
    (typeof err?.response?.data === 'string' ? err.response.data : null) ||
    err?.message ||
    fallback;

  toast.error(typeof message === 'string' ? message : JSON.stringify(message));
  console.error('[API Error]', err);
};
