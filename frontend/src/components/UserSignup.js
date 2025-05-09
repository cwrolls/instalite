import React, { useState } from 'react';
import axios from 'axios';

const UserSignup = () => {
    const [profileImage, setProfileImage] = useState(null);
    const [profileImageUrl, setProfileImageUrl] = useState('');
    const [actorMatches, setActorMatches] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedActor, setSelectedActor] = useState(null);

    const handleImageChange = (e) => {
        setProfileImage(e.target.files[0]);
    };

    const handleUploadAndMatch = async () => {
        if (!profileImage) return;

        setLoading(true);
        const formData = new FormData();
        formData.append('image', profileImage);

        try {
            const response = await axios.post('/api/upload-profile-image', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            console.log(response.data);
            setProfileImageUrl(response.data.profileImageUrl);
            setActorMatches(response.data.topActors);
        } catch (error) {
            console.error('Error uploading and matching image:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleActorSelect = (actor) => {
        setSelectedActor(actor);
        console.log('Selected Actor:', actor);
    };

    return (
        <div>
            <h2>User Signup / Profile Photo</h2>
            <div>
                <input type="file" accept="image/*" onChange={handleImageChange} />
                <button onClick={handleUploadAndMatch} disabled={loading}>
                    {loading ? 'Uploading and Matching...' : 'Upload Photo and Find Actor'}
                </button>
            </div>

            {profileImageUrl && (
                <div>
                    <h3>Your Uploaded Photo:</h3>
                    <img src={profileImageUrl} alt="Profile" style={{ maxWidth: '200px' }} />
                </div>
            )}

            {actorMatches.length > 0 && (
                <div>
                    <h3>Top Matching Actors:</h3>
                    <ul>
                        {actorMatches.map((actor) => (
                            <li key={actor.actorId} onClick={() => handleActorSelect(actor)} style={{ cursor: 'pointer' }}>
                                <img src={actor.profilePhotoUrl} alt={actor.name} style={{ maxWidth: '100px', marginRight: '10px' }} />
                                {actor.name} (Similarity: {(actor.similarityScore * 100).toFixed(2)}%)
                            </li>
                        ))}
                    </ul>
                    {selectedActor && (
                        <p>You selected: {selectedActor.name}</p>
                    )}
                </div>
            )}

            {loading && <p>Loading...</p>}

        </div>
    );
};

export default UserSignup;