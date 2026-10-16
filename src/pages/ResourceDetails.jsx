import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Share2, Bookmark, ExternalLink } from 'lucide-react';
import { resourceService } from '../services/resourceService';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import './ResourceDetails.css';

export default function ResourceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resource, setResource] = useState(null);
  const [relatedResources, setRelatedResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    loadResource();
  }, [id]);

  const loadResource = async () => {
    setLoading(true);
    try {
      const data = await resourceService.getResourceById(id);
      setResource(data);
      setIsSaved(Boolean(data?.saved));
      if (data?.subject) {
        const related = await resourceService.getRelatedResources(id, data.subject);
        setRelatedResources(related);
      }
    } catch (error) {
      console.error('Error loading resource:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (isSaved) {
      setToast({ message: 'Already in your library', type: 'info' });
      return;
    }

    try {
      const result = await resourceService.saveResource(id);
      setIsSaved(true);
      setToast({
        message:
          result?.alreadyOwned
            ? 'This resource is already in your library'
            : 'Resource saved to your library',
        type: 'success',
      });
    } catch (error) {
      setToast({ message: error.message || 'Failed to save resource', type: 'error' });
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url);
    setToast({ message: 'Link copied to clipboard', type: 'success' });
  };

  const handleDownload = () => {
    setToast({ message: 'Download started', type: 'success' });
    // In real app, this would trigger actual download from S3
  };

  if (loading) {
    return <LoadingSpinner text="Loading resource..." />;
  }

  if (!resource) {
    return (
      <div className="resource-details">
        <div className="error-state">
          <h2>Resource not found</h2>
          <button onClick={() => navigate('/resources')}>Back to Resources</button>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-details">
      <button className="back-btn" onClick={() => navigate('/resources')}>
        <ArrowLeft size={20} /> Back to Resources
      </button>

      <div className="resource-details-content">
        <div className="resource-main">
          <div className="resource-header">
            <div className="resource-type-badge">{resource.type}</div>
            <h1>{resource.title}</h1>
            <div className="resource-subject-tag">{resource.subject}</div>
          </div>

          <div className="resource-meta-info">
            <div className="meta-item">
              <span className="meta-label">Uploaded by</span>
              <span className="meta-value">👤 {resource.uploadedBy}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Upload date</span>
              <span className="meta-value">📅 {resource.uploadDate}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">File size</span>
              <span className="meta-value">📦 {resource.fileSize}</span>
            </div>
            <div className="meta-item">
              <span className="meta-label">Semester</span>
              <span className="meta-value">🎓 Semester {resource.semester}</span>
            </div>
          </div>

          <div className="resource-stats-bar">
            <span><Download size={16} /> {resource.downloads} downloads</span>
            <span>❤️ {resource.likes} likes</span>
          </div>

          <div className="resource-description">
            <h3>Description</h3>
            <p>{resource.description}</p>
          </div>

          <div className="resource-actions-bar">
            <button className="action-btn primary" onClick={handleDownload}>
              <Download size={18} /> Download Resource
            </button>
            <button className="action-btn secondary" onClick={handleSave}>
              <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
              {isSaved ? 'Saved' : 'Save'}
            </button>
            <button className="action-btn secondary" onClick={handleShare}>
              <Share2 size={18} /> Share
            </button>
          </div>
        </div>

        <div className="resource-sidebar">
          <div className="related-resources">
            <h3>Related Resources</h3>
            {relatedResources.length === 0 ? (
              <p className="no-related">No related resources found</p>
            ) : (
              <div className="related-list">
                {relatedResources.map((rel) => (
                  <div
                    key={rel.id}
                    className="related-item"
                    onClick={() => navigate(`/resources/${rel.id}`)}
                  >
                    <div className="related-icon">📄</div>
                    <div className="related-info">
                      <h4>{rel.title}</h4>
                      <p>{rel.type} • {rel.uploadedBy}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
