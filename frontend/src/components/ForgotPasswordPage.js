import React, { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!email) {
            setError('Please enter your email address.');
            return;
        }
        setLoading(true);
        setMessage('');
        setError('');
        try {
            const response = await axios.post('/api/auth/request-password-reset', { email });
            setMessage(response.data.message || 'If your email is registered, you will receive a password reset link shortly.');
            setEmail('');
        } catch (err) {
            const errorMsg = err.response?.data?.error || err.message || 'An error occurred. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '50px', textAlign: 'center', maxWidth: '400px', margin: 'auto' }}>
            <h2>Forgot Password</h2>
            <p style={{ color: '#555', marginBottom: '20px' }}>
                Enter your email address below, and we'll send you a link to reset your password.
            </p>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Your Email Address"
                    required
                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                    autoComplete="email"
                />
                <button type="submit" disabled={loading} style={{ padding: '12px 20px', cursor: 'pointer', backgroundColor: '#0095f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                    {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
                {message && <p style={{ color: 'green', marginTop: '10px' }}>{message}</p>}
                {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            </form>
            <p style={{ marginTop: '20px' }}>
                Remember your password? <Link to="/login">Login here</Link>
            </p>
        </div>
    );
}

export default ForgotPasswordPage;