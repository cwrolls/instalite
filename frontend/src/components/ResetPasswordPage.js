import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate, Link } from 'react-router-dom';

function ResetPasswordPage() {
    const { token } = useParams();
    const navigate = useNavigate();

    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [isTokenValid, setIsTokenValid] = useState(true);


    useEffect(() => {
        if (!token) {
            setError("No reset token provided. Please use the link from your email.");
            setIsTokenValid(false);
        }
    }, [token]);


    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newPassword || !confirmPassword) {
            setError('Please enter and confirm your new password.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (newPassword.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }

        setLoading(true);
        setMessage('');
        setError('');

        try {
            const response = await axios.post('/api/auth/reset-password', {
                token,
                newPassword,
                confirmPassword
            });
            setMessage(response.data.message || 'Password reset successfully! You can now log in.');
            setTimeout(() => {
                navigate('/login');
            }, 3000);
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to reset password. The link may be invalid or expired.';
            setError(errorMsg);
            if (err.response?.status === 400 && (errorMsg.includes('Invalid') || errorMsg.includes('expired'))) {
                setIsTokenValid(false);
            }
        } finally {
            setLoading(false);
        }
    };

    if (!isTokenValid && !loading) { 
         return (
            <div style={{ padding: '50px', textAlign: 'center', maxWidth: '400px', margin: 'auto' }}>
                <h2>Reset Password</h2>
                <p style={{ color: 'red' }}>{error || 'This password reset link is invalid or has expired.'}</p>
                <p>Please <Link to="/forgot-password">request a new password reset link</Link>.</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '50px', textAlign: 'center', maxWidth: '400px', margin: 'auto' }}>
            <h2>Reset Your Password</h2>
            {isTokenValid && !message && (
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="New Password"
                        required
                        style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                        autoComplete="new-password"
                    />
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm New Password"
                        required
                        style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                        autoComplete="new-password"
                    />
                    <button type="submit" disabled={loading} style={{ padding: '12px 20px', cursor: 'pointer', backgroundColor: '#0095f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                        {loading ? 'Resetting...' : 'Reset Password'}
                    </button>
                </form>
            )}
            {message && <p style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
            {error && !message && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>} 
            {message && <p style={{ marginTop: '20px' }}><Link to="/login">Proceed to Login</Link></p>}
        </div>
    );
}

export default ResetPasswordPage;