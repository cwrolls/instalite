import React, { createContext, useState, useCallback, useContext, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

const ToastContext = createContext(undefined);

export const useGlobalToasts = () => {
    const context = useContext(ToastContext);
    if (context === undefined) {
        throw new Error('useGlobalToasts must be used within a ToastProvider');
    }
    return context;
};

const CloseIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
    <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z"/>
  </svg>
);

export const GlobalToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastTimeoutsRef = useRef({}); 

  const removeToast = useCallback((id) => {
    setToasts((currentToasts) => currentToasts.filter((toast) => toast.id !== id));
    if (toastTimeoutsRef.current[id]) {
      clearTimeout(toastTimeoutsRef.current[id]);
      delete toastTimeoutsRef.current[id];
    }
  }, []);

  const addToast = useCallback(
    (toastConfig) => {
      const id = Date.now() + Math.random();
      const defaults = {
        type: 'default',
        duration: 5000,
        viewText: 'View',
      };
      const newToast = { ...defaults, ...toastConfig, id };
      
      setToasts((currentToasts) => [newToast, ...currentToasts]);

      if (newToast.duration !== null && newToast.duration > 0) {
        const timeoutId = setTimeout(() => {
          removeToast(id);
        }, newToast.duration);
        toastTimeoutsRef.current[id] = timeoutId;
      }
      return id;
    },
    [removeToast]
  );
  useEffect(() => {
    return () => {
      Object.values(toastTimeoutsRef.current).forEach(clearTimeout);
    };
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <GlobalToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
};

const GlobalToastContainer = ({ toasts, removeToast }) => {
  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed',
      top: '70px',
      right: '20px',
      zIndex: 20000,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      width: '100%',
      maxWidth: '360px', 
    }}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} {...toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
};

const ToastItem = ({ id, title, content, type, viewLink, viewText, onDismiss }) => {
  const toastStyles = {
    default: { backgroundColor: '#6c757d', color: 'white', accentColor: '#5a6268' }, 
    success: { backgroundColor: '#198754', color: 'white', accentColor: '#157347' }, 
    error:   { backgroundColor: '#dc3545', color: 'white', accentColor: '#bb2d3b' }, 
    warning: { backgroundColor: '#ffc107', color: '#000',  accentColor: '#ffba00' },
    info:    { backgroundColor: '#0dcaf0', color: '#000',  accentColor: '#0baccc' }, 
  };

  const style = toastStyles[type] || toastStyles.default;

  const itemStyle = {
    padding: '1rem',
    borderRadius: '0.375rem', 
    boxShadow: '0 0.5rem 1rem rgba(0, 0, 0, 0.15)',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: '0.9rem',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
    borderLeft: `5px solid ${style.accentColor}`,
    backgroundColor: style.backgroundColor,
    color: style.color,
    animation: 'toastInRight 0.35s cubic-bezier(0.215, 0.61, 0.355, 1)',
    overflow: 'hidden',
  };

  const closeButtonStyle = {
    position: 'absolute',
    top: '0.5rem',
    right: '0.5rem',
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    opacity: 0.6,
    cursor: 'pointer',
    padding: '0.25rem', 
    lineHeight: 1,
    transition: 'opacity 0.15s ease-in-out',
  };

  const viewButtonStyle = {
    padding: '0.375rem 0.75rem',
    marginTop: '0.75rem',
    borderRadius: '0.25rem', 
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: 'inherit',
    textDecoration: 'none',
    textAlign: 'center',
    fontWeight: 500,
    fontSize: '0.875rem',
    border: '1px solid rgba(255, 255, 255, 0.2)',
    alignSelf: 'flex-start',
    transition: 'background-color 0.15s ease-in-out',
  };

  return (
    <div style={itemStyle} role="alert" aria-live="assertive" aria-atomic="true">
      <button
        onClick={onDismiss}
        aria-label="Close"
        style={closeButtonStyle}
        onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
        onMouseLeave={(e) => e.currentTarget.style.opacity = 0.6}
      >
        <CloseIcon />
      </button>

      {title && <h5 style={{ marginTop: 0, marginBottom: '0.5rem', fontWeight: 'bold', fontSize: '1rem' }}>{title}</h5>}
      
      <div style={{ lineHeight: '1.5' }}>
        {typeof content === 'string' ? <p style={{ margin: 0 }}>{content}</p> : content}
      </div>

      {viewLink && (
        <Link
          to={viewLink}
          onClick={(e) => {  onDismiss(); }} 
          style={viewButtonStyle}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)'}
        >
          {viewText}
        </Link>
      )}
      <style jsx global>{` 
        @keyframes toastInRight {
          from {
            transform: translateX(110%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};