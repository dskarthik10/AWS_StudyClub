import { useState, useEffect, useMemo } from 'react';
import { X, Search, Share2 } from 'lucide-react';
import { resourceService } from '../services/resourceService';
import LoadingSpinner from '../components/LoadingSpinner';
import './ShareResourceModal.css';

export default function ShareResourceModal({ onClose, onShare }) {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sharingId, setSharingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await resourceService.getResources();
        if (!cancelled) setResources(data);
      } catch (error) {
        console.error('Failed to load resources for sharing:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredResources = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return resources;
    return resources.filter((resource) =>
      resource.title.toLowerCase().includes(query) ||
      resource.subject.toLowerCase().includes(query) ||
      resource.type.toLowerCase().includes(query)
    );
  }, [resources, searchQuery]);

  const handleShare = async (resourceId) => {
    setSharingId(resourceId);
    try {
      await onShare(resourceId);
    } finally {
      setSharingId(null);
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="share-modal-header">
          <h2>Share Resource to Group</h2>
          <button className="share-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="share-resource-body">
          <p className="share-resource-hint">
            Choose an existing resource from your library to share with this group.
          </p>

          <div className="share-resource-search">
            <Search size={16} />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {loading ? (
            <LoadingSpinner text="Loading resources..." />
          ) : filteredResources.length === 0 ? (
            <div className="share-resource-empty">
              <p>
                {resources.length === 0
                  ? 'No resources found. Upload resources from the Resource Library before sharing.'
                  : 'No resources match your search.'}
              </p>
            </div>
          ) : (
            <div className="share-resource-list">
              {filteredResources.map((resource) => (
                <div key={resource.id} className="share-resource-item">
                  <div className="share-resource-item-icon">📄</div>
                  <div className="share-resource-item-info">
                    <h4>{resource.title}</h4>
                    <p>{resource.type} • {resource.subject} • {resource.uploadedBy}</p>
                  </div>
                  <button
                    className="share-resource-item-btn"
                    disabled={sharingId === resource.id}
                    onClick={() => handleShare(resource.id)}
                  >
                    {sharingId === resource.id ? 'Sharing...' : (<><Share2 size={16} /> Share</>)}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}