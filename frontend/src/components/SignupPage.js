import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';

function SignupPage({ onLoginSuccess }) {
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
        firstName: '',
        lastName: '',
        affiliation: '',
        birthday: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); 
        if (!formData.username || !formData.password || !formData.email || !formData.firstName || !formData.lastName) {
            setError('Please fill in all required fields (Username, Password, Email, First Name, Last Name).');
            return;
        }
        if (formData.password.length < 8) {
            setError('Password must be at least 8 characters long.');
            return;
        }
        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return;
        }
        if (!/\S+@\S+\.\S+/.test(formData.email)) {
            setError('Please enter a valid email address.');
            return;
        }

        setLoading(true);

        const signupData = {
            username: formData.username,
            password: formData.password,
            email: formData.email,
            firstName: formData.firstName,
            lastName: formData.lastName,
            affiliation: formData.affiliation || null,
            birthday: formData.birthday || null, 
        };

        try {
            const response = await axios.post('/api/auth/signup', signupData);
            console.log("Signup API call successful:", response.data);

            onLoginSuccess(response.data.user);

            navigate('/');

        } catch (err) {
            console.error('Signup failed:', err);
            const errorMsg = err.response?.data?.error || err.message || 'Signup failed. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const styles = {
        container: { padding: '30px', textAlign: 'center', maxWidth: '500px', margin: 'auto' },
        form: { display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'stretch' },
        inputGroup: { display: 'flex', flexDirection: 'column', textAlign: 'left' },
        label: { marginBottom: '4px', fontWeight: 'bold', fontSize: '0.9em' },
        input: { padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1em' },
        button: { padding: '12px 20px', cursor: 'pointer', backgroundColor: '#5cb85c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '1em' },
        error: { color: 'red', marginTop: '10px', fontWeight: 'bold' },
        loginLink: { marginTop: '20px' }
    };

    return (
        <div style={styles.container}>
            <h2>Create your InstaLite Account</h2>
            <form onSubmit={handleSubmit} style={styles.form}>
                <div style={styles.inputGroup}>
                    <label htmlFor="username" style={styles.label}>Username*</label>
                    <input type="text" name="username" id="username" value={formData.username} onChange={handleChange} required style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                    <label htmlFor="email" style={styles.label}>Email*</label>
                    <input type="email" name="email" id="email" value={formData.email} onChange={handleChange} required style={styles.input} />
                </div>
                <div style={styles.inputGroup}>
                    <label htmlFor="password" style={styles.label}>Password* (Min. 8 characters)</label>
                    <input type="password" name="password" id="password" value={formData.password} onChange={handleChange} required minLength="8" style={styles.input} />
                </div>
                 <div style={styles.inputGroup}>
                    <label htmlFor="confirmPassword" style={styles.label}>Confirm Password*</label>
                    <input type="password" name="confirmPassword" id="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required minLength="8" style={styles.input} />
                </div>
                 <div style={styles.inputGroup}>
                    <label htmlFor="firstName" style={styles.label}>First Name*</label>
                    <input type="text" name="firstName" id="firstName" value={formData.firstName} onChange={handleChange} required style={styles.input} />
                </div>
                 <div style={styles.inputGroup}>
                    <label htmlFor="lastName" style={styles.label}>Last Name*</label>
                    <input type="text" name="lastName" id="lastName" value={formData.lastName} onChange={handleChange} required style={styles.input} />
                </div>
                 <div style={styles.inputGroup}>
                    <label htmlFor="affiliation" style={styles.label}>Affiliation (Optional)</label>
                    <input type="text" name="affiliation" id="affiliation" value={formData.affiliation} onChange={handleChange} style={styles.input} />
                </div>
                 <div style={styles.inputGroup}>
                    <label htmlFor="birthday" style={styles.label}>Birthday (Optional)</label>
                    <input type="date" name="birthday" id="birthday" value={formData.birthday} onChange={handleChange} style={styles.input} max={new Date().toISOString().split("T")[0]} />
                </div>

                <button type="submit" disabled={loading} style={styles.button}>
                    {loading ? 'Signing up...' : 'Sign Up'}
                </button>

                {error && <p style={styles.error}>{error}</p>}
            </form>
             <p style={styles.loginLink}>
                Already have an account? <Link to="/login">Log In</Link>
             </p>
        </div>
    );
}

export default SignupPage;