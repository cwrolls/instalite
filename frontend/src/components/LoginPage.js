import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function LoginPage({ onLoginSuccess }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!username || !password) {
            setError('Username and password are required.');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const response = await axios.post('/api/auth/login', { username, password });
            console.log("Login API call successful:", response.data);
            onLoginSuccess(response.data.user);
        } catch (err) {
            console.error('Login failed:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Login failed. Please check credentials.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={{ padding: '50px', textAlign: 'center', maxWidth: '400px', margin: 'auto' }}>
            <h2>Login to InstaLite</h2>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Username"
                    required
                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                    autoComplete="username"
                />
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
                    autoComplete="current-password"
                />
                <button type="submit" disabled={loading} style={{ padding: '12px 20px', cursor: 'pointer', backgroundColor: '#0095f6', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
                    {loading ? 'Logging in...' : 'Login'}
                </button>
                {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
            </form>
        </div>
    );
}

export default LoginPage;