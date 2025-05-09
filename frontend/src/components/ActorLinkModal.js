import React, { useState } from 'react';

const LinkIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
    </svg>
);

const UserXIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}>
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7" r="4"></circle><line x1="18" y1="8" x2="23" y2="13"></line><line x1="23" y1="8" x2="18" y2="13"></line>
    </svg>
);


const ActorLinkModal = ({
    isOpen,
    onClose,
    candidateActors,
    linkedActorId,
    linkedActorDetails,
    actorInfo,
    onLinkActor,
    onUnlinkActor,
    addToast
}) => {
    const [isLinking, setIsLinking] = useState(null);
    if (!isOpen) return null;

    const handleLinkClick = async (actor) => {
        if (!actor || !actor.actorId) {
            addToast('Cannot link actor: Invalid actor data.', 'error');
            return;
        }
        setIsLinking(actor.actorId);
        try {
            await onLinkActor(actor.actorId, actor.name);
        } catch (e) {
        } finally {
            setIsLinking(null);
        }
    };

    const handleUnlinkClick = async () => {
        setIsLinking('unlinking');
        try {
            await onUnlinkActor();
        } catch (e) {
        } finally {
            setIsLinking(null);
        }
    };
    
    const resolvedCandidateActors = candidateActors.map(candActor => {
        const nconst = candActor.actorId ? candActor.actorId.split('-')[0].replace('.jpg', '') : candActor.nconst;
        const details = actorInfo[nconst] || candActor; 
        return {
            ...details, 
            actorId: candActor.actorId || details.nconst,
            similarityScore: candActor.similarityScore 
        };
    }).filter((actor, index, self) =>
        index === self.findIndex((a) => (
            a.actorId === actor.actorId
        ))
    );


    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.65)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 2010,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}>
            <div style={{
                backgroundColor: '#ffffff', padding: '25px 30px', borderRadius: '12px',
                boxShadow: '0 8px 25px rgba(0,0,0,0.25)', width: 'auto',
                maxWidth: '600px', maxHeight: '80vh', overflowY: 'auto',
                textAlign: 'left',
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 0, fontSize: '1.4em', color: '#333', fontWeight: 600 }}>
                        Manage Actor Link
                    </h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.8em', cursor: 'pointer', color: '#888', padding: '0 5px' }}>×</button>
                </div>

                {linkedActorId && linkedActorDetails && (
                    <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #e0e0e0' }}>
                        <h4 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1.1em', color: '#444' }}>Currently Linked Actor</h4>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '10px', backgroundColor: '#e9f5ff', borderRadius: '6px' }}>
                            <img
                                src={linkedActorDetails.profilePhotoUrl  + ".jpg" || `https://via.placeholder.com/50/007bff/ffffff?text=${linkedActorDetails.name?.charAt(0)}`}
                                alt={linkedActorDetails.name}
                                style={{ width: '50px', height: '50px', borderRadius: '50%', marginRight: '15px', objectFit: 'cover' }}
                            />
                            <div style={{ flexGrow: 1 }}>
                                <p style={{ margin: 0, fontWeight: 'bold', color: '#004085' }}>{linkedActorDetails.name}</p>
                                <p style={{ margin: '2px 0 0 0', fontSize: '0.9em', color: '#005095' }}>This actor is linked to your profile.</p>
                            </div>
                            <button
                                onClick={handleUnlinkClick}
                                disabled={isLinking === 'unlinking'}
                                style={{
                                    padding: '8px 15px', fontSize: '0.9em', color: '#fff',
                                    backgroundColor: '#dc3545', border: 'none', borderRadius: '6px',
                                    cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                    transition: 'background-color 0.2s ease', marginLeft: '10px'
                                }}
                                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#c82333'}
                                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#dc3545'}
                            >
                                <UserXIcon /> {isLinking === 'unlinking' ? 'Unlinking...' : 'Unlink'}
                            </button>
                        </div>
                    </div>
                )}

                <h4 style={{ marginTop: 0, marginBottom: '15px', fontSize: '1.1em', color: '#444' }}>
                    {resolvedCandidateActors.length > 0 ? "Choose an Actor to Link" : "No Other Candidate Actors Found"}
                </h4>

                {resolvedCandidateActors.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        {resolvedCandidateActors.map((actor) => {
                            if (actor.actorId === linkedActorId) return null;

                            return (
                                <div
                                    key={actor.actorId || actor.nconst}
                                    style={{
                                        display: 'flex', alignItems: 'center', backgroundColor: '#f8f9fa',
                                        padding: '12px 15px', borderRadius: '8px', border: '1px solid #e9ecef',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                                    }}
                                >
                                    <img
                                        src={actor.profilePhotoUrl + ".jpg" || `https://via.placeholder.com/40/cccccc/ffffff?text=${actor.name?.charAt(0)}`}
                                        alt={actor.name || 'Actor'}
                                        style={{ width: '40px', height: '40px', borderRadius: '50%', marginRight: '15px', objectFit: 'cover' }}
                                    />
                                    <div style={{ flexGrow: 1, minWidth: 0 }}>
                                        <span style={{ fontSize: '1em', fontWeight: '500', color: '#333', display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {actor.name || "Unknown Actor"}
                                        </span>
                                        {typeof actor.similarityScore === 'number' && (
                                            <span style={{ fontSize: '0.85em', color: '#555' }}>
                                                Similarity: {(actor.similarityScore * 100).toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleLinkClick(actor)}
                                        disabled={isLinking === actor.actorId || !!isLinking}
                                        style={{
                                            padding: '8px 15px', fontSize: '0.9em', color: 'white',
                                            backgroundColor: '#28a745', border: 'none', borderRadius: '6px',
                                            cursor: 'pointer', display: 'inline-flex', alignItems: 'center',
                                            transition: 'background-color 0.2s ease', marginLeft: '10px', whiteSpace: 'nowrap'
                                        }}
                                        onMouseEnter={e => e.currentTarget.style.backgroundColor = '#218838'}
                                        onMouseLeave={e => e.currentTarget.style.backgroundColor = '#28a745'}
                                    >
                                        <LinkIcon /> {isLinking === actor.actorId ? 'Linking...' : 'Link Profile'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p style={{ color: '#666', textAlign: 'center', fontSize: '0.95em' }}>
                        {!linkedActorId ? "Upload a profile picture to find potential actor matches." : "No other candidates available to link."}
                    </p>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '25px', paddingTop: '20px', borderTop: '1px solid #e9ecef' }}>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '9px 18px', borderRadius: '7px', border: '1px solid #ced4da',
                            backgroundColor: '#f8f9fa', color: '#343a40', cursor: 'pointer',
                            fontSize: '0.9em', fontWeight: '500'
                        }}
                         onMouseEnter={e => e.currentTarget.style.backgroundColor = '#e9ecef'}
                         onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActorLinkModal;