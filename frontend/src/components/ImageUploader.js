import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useGlobalToasts } from '../contexts/ToastContext'; 

const UPLOAD_API_URL = '/api/images/upload-profile-image';
const LINK_ACTOR_API_URL = '/api/images/link-actor'; 

function ImageUploader({ onProfileUpdate }) {
  const { addToast } = useGlobalToasts();
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [uploadResult, setUploadResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [linkStatus, setLinkStatus] = useState(""); 
  const [linkingActorId, setLinkingActorId] = useState(null);


  useEffect(() => {
    let objectUrl = null;
    if (selectedFile) {
      objectUrl = URL.createObjectURL(selectedFile);
      setImagePreviewUrl(objectUrl);
    } else {
      setImagePreviewUrl("");
    }
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [selectedFile]);

  const handleFileChange = (event) => {
    setError("");
    setUploadResult(null);
    setLinkStatus(""); 
    setLinkingActorId(null);
    const file = event.target.files[0];
    if (file && file.type.startsWith("image/")) {
      setSelectedFile(file);
    } else {
      setSelectedFile(null);
      if (file) {
        setError("Please select a valid image file (e.g., JPG, PNG, GIF).");
        addToast({
          content: "Invalid file type. Please select an image.",
          type: "error",
        })
      }
    }
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault(); 
    if (!selectedFile) {
      setError("Please select an image file first.");
      addToast({
        content: "Please select an image file.",
        type: "warning",
      })
      return;
    }
    setIsLoading(true);
    setError("");
    setLinkStatus("");
    setLinkingActorId(null);
    setUploadResult(null);
    const formData = new FormData();
    formData.append("image", selectedFile);

    try {
      const response = await axios.post(UPLOAD_API_URL, formData);
      setUploadResult(response.data); 
      addToast({
        content: response.data.message || "Image uploaded successfully.",
        type: response.data.message?.toLowerCase().includes("error")? "error" : "success",
      })
      
      if (onProfileUpdate) {
        console.log( "Calling onProfileUpdate (e.g., checkSession) after successful upload.");
      }
    } catch (err) {
      console.error("Upload failed:", err);
      const errorMsg = err.response?.data?.error || err.message || "Upload failed.";
      setError(errorMsg);
      addToast({
        content: errorMsg,
        type: "error",
      })
      setUploadResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLinkActor = async (actorId, actorName) => {
    if (!actorId) {
      setLinkStatus("Error: Cannot link actor - missing identifier.");
      addToast({
        content: "Cannot link actor: Missing identifier.",
        type: "error",
      })
      return;
    }
    setError("");
    setLinkStatus(`Linking to ${actorName}...`);
    setLinkingActorId(actorId);

    try {
      const response = await axios.post(LINK_ACTOR_API_URL, {
        selectedActorId: actorId,
        selectedActorName: actorName,
      });

      addToast({
        content: response.data.message || `Successfully linked to ${actorName}!`,
        type: response.data.message?.toLowerCase().includes("error")? "error" : "success",
      })
      setLinkStatus(`Successfully linked to ${actorName}!`);

      if (onProfileUpdate) { 
        await onProfileUpdate();
      }
    } catch (err) {
      console.error("Link actor failed:", err);
      const errorMsg = err.response?.data?.error || err.message || "Failed to link actor.";
      setError(errorMsg); 
      addToast({
        content: "Failed to link actor.",
        type: "error",
      })
      setLinkStatus("");
    } finally {
        setLinkingActorId(null);
    }
  };

  return (
    <div style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '20px',
        fontFamily: 'Arial, sans-serif', 
        backgroundColor: '#f9f9f9', 
        borderRadius: '12px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.05)',
        maxWidth: '800px', 
        margin: '20px auto' 
    }}>
      <h3 style={{ 
        marginBottom: '25px', 
        color: '#333', 
        fontSize: '24px', 
        fontWeight: '600',
        textAlign: 'center'
        }}>
        Update Profile Photo & Find Similar Actors
      </h3>
      <form
        onSubmit={handleUploadSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px", 
          width: '100%',
          maxWidth: '500px' 
        }}
      >
        <div style={{ position: "relative", width: "100%" }}>
          <label
            htmlFor="imageFile"
            style={{
              display: "block",
              backgroundColor: "#ffffff", 
              padding: "15px 20px", 
              borderRadius: "10px", 
              textAlign: "center",
              cursor: "pointer",
              fontWeight: "500",
              color: '#555',
              border: "2px dashed #007bff", 
              transition: "all 0.2s ease-in-out",
            }}
            onMouseEnter={(e) => e.target.style.borderColor = '#0056b3'}
            onMouseLeave={(e) => e.target.style.borderColor = '#007bff'}
          >
            {selectedFile ? selectedFile.name : "Choose a Photo"}
          </label>
          <input
            type="file"
            id="imageFile"
            accept="image/*"
            onChange={handleFileChange}
            disabled={isLoading}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              opacity: 0,
              height: "100%",
              width: "100%",
              cursor: "pointer",
            }}
          />
        </div>

        {imagePreviewUrl && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              marginTop: '10px'
            }}
          >
            <p
              style={{
                marginBottom: "8px",
                color: "#333",
                fontSize: "16px",
                fontWeight: "bold",
              }}
            >
              Preview:
            </p>
            <img
              src={imagePreviewUrl}
              alt="Selected preview"
              style={{
                width: "150px", 
                height: "150px",
                objectFit: "cover",
                marginBottom: "10px",
                borderRadius: "50%", 
                boxShadow: "0 6px 12px rgba(0, 0, 0, 0.15)", 
                border: '3px solid white'
              }}
            />
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading || !selectedFile}
          style={{
            padding: "12px 25px", 
            fontSize: "16px",
            fontWeight: 'bold',
            borderRadius: "8px",
            backgroundColor: isLoading || !selectedFile ? "#ccc" : "#007bff", 
            color: "white",
            border: "none",
            cursor: isLoading || !selectedFile ? "not-allowed" : "pointer",
            transition: "background-color 0.2s ease, transform 0.1s ease",
            minWidth: '250px'
          }}
          onMouseEnter={(e) => { if (!(isLoading || !selectedFile)) e.target.style.backgroundColor = '#0056b3'; }}
          onMouseLeave={(e) => { if (!(isLoading || !selectedFile)) e.target.style.backgroundColor = '#007bff'; }}
        >
          {isLoading ? "Uploading..." : "Upload & Match Actors"}
        </button>
      </form>

      {/* Status Messages */}
      {isLoading && (
        <div style={{ marginTop: '20px', color: '#007bff', fontWeight: 'bold' }}>Processing image...</div>
      )}
      {error && <div style={{ marginTop: '20px', color: '#dc3545', fontWeight: 'bold', backgroundColor: '#f8d7da', padding: '10px 15px', borderRadius: '5px', border: '1px solid #f5c6cb' }}>Error: {error}</div>}
      {linkStatus && !error && !linkStatus.toLowerCase().includes("error") && (
          <div style={{ marginTop: '20px', color: '#28a745', fontWeight: 'bold', backgroundColor: '#d4edda', padding: '10px 15px', borderRadius: '5px', border: '1px solid #c3e6cb' }}>
              {linkStatus}
          </div>
      )}

      {uploadResult && (
        <div style={{ marginTop: '30px', width: '100%', textAlign: 'center' }}>

          {uploadResult.profileImageUrl && (
            <p style={{ fontSize: '14px', color: '#555', textAlign: 'center', marginBottom: '25px' }}>
              Your new profile photo is active.
            </p>
          )}

          {uploadResult.topActors && uploadResult.topActors.length > 0 ? (
            <div style={{ 
                marginTop: '30px', 
                width: '100%', 
                padding: '0', 
            }}>
              <h5 style={{
                fontSize: '22px',
                color: '#333',
                marginBottom: '25px', 
                textAlign: 'center',
                fontWeight: '600',
                paddingBottom: '10px',
                borderBottom: '2px solid #eee', 
              }}>
                Top Actor Matches
              </h5>
              <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px', 
                  alignItems: 'center' 
              }}>
                {uploadResult.topActors.map((actor) => (
                  <div 
                    key={actor.actorId || actor.name} 
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        backgroundColor: '#ffffff',
                        padding: '20px', 
                        borderRadius: '12px',
                        boxShadow: '0 6px 18px rgba(0, 0, 0, 0.08)', 
                        width: '100%',
                        maxWidth: '600px', 
                        transition: 'transform 0.2s ease-in-out, boxShadow 0.2s ease-in-out',
                        border: '1px solid #e9ecef' 
                    }}
                  >
                    <div style={{ 
                        position: 'relative', 
                        width: '70px', 
                        height: '70px', 
                        minWidth: '70px', 
                        marginRight: '20px',
                        borderRadius: '50%', 
                        backgroundColor: '#e9ecef', 
                        border: '3px solid #f8f9fa', 
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                        {actor.profilePhotoUrl ? (
                            <img
                                src={actor.profilePhotoUrl + ".jpg"}
                                alt={`${actor.name || 'Actor'} thumbnail`}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    borderRadius: '50%',
                                    objectFit: 'cover',
                                    display: 'block', 
                                }}
                                onError={(e) => {
                                    e.target.style.display = 'none'; 
                                    const placeholder = e.target.nextElementSibling;
                                    if (placeholder && placeholder.classList.contains('actor-placeholder')) {
                                        placeholder.style.display = 'flex';
                                    }
                                }}
                            />
                        ) : null}
                        <div
                            className="actor-placeholder" 
                            style={{
                                display: actor.profilePhotoUrl ? 'none' : 'flex', 
                                width: '100%',
                                height: '100%',
                                borderRadius: '50%',
                                backgroundColor: '#e9ecef', 
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#495057',
                                fontSize: '28px',
                                fontWeight: 'bold',
                            }}
                        >
                            {actor.name ? actor.name.charAt(0).toUpperCase() : '?'}
                        </div>
                    </div>

                    <div style={{ 
                        flexGrow: 1, 
                        display: 'flex', 
                        flexDirection: 'column', 
                        justifyContent: 'center',
                        minWidth: 0, 
                        marginRight: '15px' 
                        }}>
                      <span style={{
                          fontSize: '18px',
                          fontWeight: '600',
                          color: '#2c3e50', 
                          marginBottom: '5px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis' 
                      }}>
                        {actor.name || "Unknown Actor"}
                      </span>
                      {actor.similarityScore !== null && typeof actor.similarityScore !== 'undefined' && (
                        <span style={{
                            fontSize: '14px',
                            color: '#555',
                        }}>
                          Similarity: {(actor.similarityScore * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => handleLinkActor(actor.actorId, actor.name)}
                      disabled={isLoading || linkingActorId === actor.actorId || !!(linkStatus && !linkStatus.toLowerCase().includes("error"))} // Disable if general loading, this specific actor is linking, or a successful link just happened
                      style={{
                        padding: '10px 18px',
                        fontSize: '14px',
                        fontWeight: '500',
                        borderRadius: '8px',
                        backgroundColor: (!actor.actorId || isLoading || linkingActorId === actor.actorId || (linkStatus && !linkStatus.toLowerCase().includes("error"))) ? '#bdc3c7' : '#28a745', 
                        color: 'white',
                        border: 'none',
                        cursor: (!actor.actorId || isLoading || linkingActorId === actor.actorId || (linkStatus && !linkStatus.toLowerCase().includes("error"))) ? 'not-allowed' : 'pointer',
                        transition: 'background-color 0.2s ease, transform 0.1s ease',
                        marginLeft: 'auto', 
                        whiteSpace: 'nowrap', 
                        flexShrink: 0 
                      }}
                      onMouseEnter={(e) => { if (!(!actor.actorId || isLoading || linkingActorId === actor.actorId || (linkStatus && !linkStatus.toLowerCase().includes("error")))) e.target.style.backgroundColor = '#218838'; }} 
                      onMouseLeave={(e) => { if (!(!actor.actorId || isLoading || linkingActorId === actor.actorId || (linkStatus && !linkStatus.toLowerCase().includes("error")))) e.target.style.backgroundColor = '#28a745'; }}
                    >
                      {linkingActorId === actor.actorId ? "Linking..." : "Link to Profile"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            uploadResult.topActors && <p style={{textAlign: 'center', marginTop: '30px', fontSize: '16px', color: '#777'}}>No similar actors found based on the uploaded image.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default ImageUploader;