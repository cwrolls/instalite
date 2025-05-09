import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const modalStyle = { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' };
const contentStyle = { backgroundColor: '#ffffff', padding: '25px 30px', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.2)', width: '90%', maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '20px' };
const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #ced4da', boxSizing: 'border-box', fontSize: '1em', marginBottom: '10px' };
const listContainerStyle = { overflowY: 'auto', flexGrow: 1, border: '1px solid #eee', borderRadius: '6px', padding: '10px' };
const listItemStyle = { padding: '8px 12px', cursor: 'pointer', borderRadius: '4px', marginBottom: '5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
const selectedListItemStyle = { ...listItemStyle, backgroundColor: '#e6f7ff', color: '#007bff', fontWeight: '500' };
const suggestionListItemStyle = { ...listItemStyle, backgroundColor: '#f8f9fa' };
const buttonStyle = { padding: '10px 18px', borderRadius: '7px', border: 'none', cursor: 'pointer', fontWeight: '500', fontSize: '0.95em', transition: 'background-color 0.2s' };

function HashtagInterestsModal({ isOpen, onClose, currentInterests, onSave, addToast }) {
    const [selectedInterests, setSelectedInterests] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [suggestedHashtags, setSuggestedHashtags] = useState([]);
    const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
    const [isLoadingSearch, setIsLoadingSearch] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setSelectedInterests(currentInterests.map(interest => ({ ...interest })));
            fetchSuggestedHashtags();
            setSearchTerm('');
            setSearchResults([]);
        } else {
            setSelectedInterests([]);
            setSearchTerm('');
            setSearchResults([]);
            setSuggestedHashtags([]);
        }
    }, [isOpen, currentInterests]);

    const fetchSuggestedHashtags = useCallback(async () => {
        setIsLoadingSuggestions(true);
        try {
            const response = await axios.get('/api/hashtags/suggestions?limit=15');
            setSuggestedHashtags(response.data);
        } catch (err) {
            addToast('Failed to load hashtag suggestions.', 'error');
            console.error('Error fetching suggestions:', err);
        }
        setIsLoadingSuggestions(false);
    }, [addToast]);

    const handleSearch = useCallback(async (term) => {
        if (!term.trim()) {
            setSearchResults([]);
            return;
        }
        setIsLoadingSearch(true);
        try {
            const response = await axios.get(`/api/hashtags/search?q=${encodeURIComponent(term)}&limit=10`);
            setSearchResults(response.data); 
        } catch (err) {
            addToast('Failed to search hashtags.', 'error');
            console.error('Error searching hashtags:', err);
        }
        setIsLoadingSearch(false);
    }, [addToast]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            handleSearch(searchTerm);
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [searchTerm, handleSearch]);

    const toggleInterest = (hashtag) => {
        setSelectedInterests(prev =>
            prev.find(interest => interest.hashtag_id === hashtag.hashtag_id)
                ? prev.filter(interest => interest.hashtag_id !== hashtag.hashtag_id)
                : [...prev, hashtag]
        );
    };

    const handleSave = () => {
        const hashtagTextsToSave = selectedInterests.map(interest => interest.tag_text);
        onSave(hashtagTextsToSave);
    };

    if (!isOpen) return null;

    const renderHashtagList = (hashtags, type) => {
        if (type === 'suggestions' && isLoadingSuggestions) return <p>Loading suggestions...</p>;
        if (type === 'search' && isLoadingSearch && searchTerm) return <p>Searching...</p>; 
        if (type === 'search' && !searchTerm && searchResults.length === 0) return null; 
        if (hashtags.length === 0 && type === 'search' && searchTerm) return <p>No results found for "{searchTerm}".</p>;
        if (hashtags.length === 0 && type === 'suggestions') return <p>No suggestions available currently.</p>;

        return hashtags.map(hashtag => {
            const isSelected = selectedInterests.find(interest => interest.hashtag_id === hashtag.hashtag_id);
            const style = isSelected ? selectedListItemStyle : (type === 'suggestions' ? suggestionListItemStyle : listItemStyle);
            return (
                <div 
                    key={hashtag.hashtag_id} 
                    style={style}
                    onClick={() => toggleInterest({ hashtag_id: hashtag.hashtag_id, tag_text: hashtag.tag_text })}
                >
                    {hashtag.tag_text}
                    {isSelected && <span style={{fontSize: '0.8em', marginLeft: 'auto'}}>✓ Selected</span>}
                    {type === 'suggestions' && hashtag.usage_count && <span style={{fontSize: '0.8em', color: '#6c757d', marginLeft: '10px'}}>(Used {hashtag.usage_count} times)</span>}
                </div>
            );
        });
    };

    return (
        <div style={modalStyle}>
            <div style={contentStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                    <h2 style={{ marginTop: 0, marginBottom: 0, fontSize: '1.5em', color: '#333', fontWeight: 600 }}>Manage Your Hashtag Interests</h2>
                    <button onClick={onClose} style={{ ...buttonStyle, background: 'none', fontSize: '1.8em', color: '#888', padding: '0 5px', border: 'none' }}>&times;</button>
                </div>

                <div>
                    <h3 style={{fontSize: '1.1em', color: '#444', marginBottom: '8px'}}>Selected Interests ({selectedInterests.length})</h3>
                    <div style={{...listContainerStyle, minHeight: '80px', maxHeight: '150px', backgroundColor: '#f8f9fa'}}>
                        {selectedInterests.length > 0 
                            ? renderHashtagList(selectedInterests, 'selected') 
                            : <p style={{color: '#6c757d', textAlign: 'center', marginTop: '20px'}}>Select hashtags below to add to your interests.</p>}
                    </div>
                </div>

                <div>
                    <label htmlFor="hashtagSearchInterests" style={{ fontWeight: '500', fontSize: '1em', color: '#333', display: 'block', marginBottom: '8px' }}>Search & Add Hashtags</label>
                    <input 
                        type="text" 
                        id="hashtagSearchInterests"
                        style={inputStyle} 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)} 
                        placeholder="Search for hashtags (e.g., travel, food)"
                    />
                    {(searchResults.length > 0 || (isLoadingSearch && searchTerm)) && (
                        <div style={{...listContainerStyle, maxHeight: '150px', marginBottom: '15px'}}>
                            {renderHashtagList(searchResults, 'search')}
                        </div>
                    )}
                </div>
                
                <div>
                    <h3 style={{fontSize: '1.1em', color: '#444', marginBottom: '8px'}}>Popular Suggestions</h3>
                    <div style={{...listContainerStyle, maxHeight: '150px'}}>
                        {renderHashtagList(suggestedHashtags, 'suggestions')}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '20px', borderTop: '1px solid #eee' }}>
                    <button onClick={onClose} style={{ ...buttonStyle, backgroundColor: '#6c757d', color: 'white' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#5a6268'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#6c757d'}>Cancel</button>
                    <button onClick={handleSave} style={{ ...buttonStyle, backgroundColor: '#007bff', color: 'white' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#0069d9'} onMouseLeave={e => e.currentTarget.style.backgroundColor = '#007bff'}>Save Interests</button>
                </div>
            </div>
        </div>
    );
}

export default HashtagInterestsModal; 