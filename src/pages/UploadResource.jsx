import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload as UploadIcon, File, CheckCircle } from 'lucide-react';
import { resourceService } from '../services/resourceService';
import LoadingSpinner from '../components/LoadingSpinner';
import Toast from '../components/Toast';
import { subjects, resourceTypes, semesters } from '../data/mockResources';
import './UploadResource.css';

export default function UploadResource() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    type: '',
    semester: '',
    description: '',
    file: null,
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.txt'];
      const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

      if (!validTypes.includes(fileExtension)) {
        setErrors(prev => ({ ...prev, file: 'Invalid file type. Please upload PDF, DOC, DOCX, PPT, PPTX, or TXT files.' }));
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setErrors(prev => ({ ...prev, file: 'File size must be less than 50MB.' }));
        return;
      }

      setFormData(prev => ({ ...prev, file }));
      setErrors(prev => ({ ...prev, file: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.subject) {
      newErrors.subject = 'Please select a subject';
    }

    if (!formData.type) {
      newErrors.type = 'Please select a resource type';
    }

    if (!formData.file) {
      newErrors.file = 'Please select a file to upload';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      setToast({ message: 'Please fix the errors in the form', type: 'error' });
      return;
    }

    setLoading(true);

    try {
      // Simulate upload process
      await resourceService.uploadResource(formData);

      setUploadSuccess(true);
      setToast({ message: 'Resource uploaded successfully!', type: 'success' });

      // Reset form after 2 seconds
      setTimeout(() => {
        setFormData({
          title: '',
          subject: '',
          type: '',
          semester: '',
          description: '',
          file: null,
        });
        setUploadSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Upload failed:', error);
      setToast({
        message: error?.message ? `Upload failed: ${error.message}` : 'Upload failed. Please try again.',
        type: 'error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (uploadSuccess) {
    return (
      <div className="upload-resource">
        <div className="upload-success">
          <CheckCircle size={64} color="#10b981" />
          <h2>Upload Successful!</h2>
          <p>Your resource has been uploaded and will be available shortly.</p>
          <div className="success-actions">
            <button className="btn-primary" onClick={() => navigate('/resources')}>
              View Resources
            </button>
            <button className="btn-secondary" onClick={() => setUploadSuccess(false)}>
              Upload Another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="upload-resource">
      <div className="upload-header">
        <h1>Upload Study Resource</h1>
        <p>Share useful study materials with your classmates</p>
      </div>

      <div className="upload-container">
        <form onSubmit={handleSubmit} className="upload-form">
          <div className="form-section">
            <h3>Resource Information</h3>

            <div className="form-group">
              <label htmlFor="title">
                Resource Title <span className="required">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                placeholder="e.g., Data Structures Complete Notes"
                className={errors.title ? 'error' : ''}
              />
              {errors.title && <span className="error-message">{errors.title}</span>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="subject">
                  Subject <span className="required">*</span>
                </label>
                <select
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  className={errors.subject ? 'error' : ''}
                >
                  <option value="">Select subject</option>
                  {subjects.filter(s => s !== 'All Subjects').map(subject => (
                    <option key={subject} value={subject}>{subject}</option>
                  ))}
                </select>
                {errors.subject && <span className="error-message">{errors.subject}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="type">
                  Resource Type <span className="required">*</span>
                </label>
                <select
                  id="type"
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className={errors.type ? 'error' : ''}
                >
                  <option value="">Select type</option>
                  {resourceTypes.filter(t => t !== 'All Types').map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                {errors.type && <span className="error-message">{errors.type}</span>}
              </div>

              <div className="form-group">
                <label htmlFor="semester">Semester</label>
                <select
                  id="semester"
                  name="semester"
                  value={formData.semester}
                  onChange={handleChange}
                >
                  <option value="">Select semester</option>
                  {semesters.filter(s => s !== 'All Semesters').map(semester => (
                    <option key={semester} value={semester}>{semester}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">
                Description <span className="optional">(optional but recommended)</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                placeholder="Provide a brief description of the resource content..."
                rows="4"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>Upload File</h3>

            <div className="file-upload-area">
              <input
                type="file"
                id="file"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
                className="file-input"
              />
              <label htmlFor="file" className={`file-label ${errors.file ? 'error' : ''}`}>
                <UploadIcon size={48} />
                {formData.file ? (
                  <>
                    <File size={24} />
                    <span className="file-name">{formData.file.name}</span>
                    <span className="file-size">
                      {(formData.file.size / 1024 / 1024).toFixed(2)} MB
                    </span>
                  </>
                ) : (
                  <>
                    <span>Click to upload or drag and drop</span>
                    <span className="file-types">PDF, DOC, DOCX, PPT, PPTX, TXT (max 50MB)</span>
                  </>
                )}
              </label>
              {errors.file && <span className="error-message">{errors.file}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => navigate('/resources')}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
            >
              {loading ? <LoadingSpinner size="sm" /> : 'Upload Resource'}
            </button>
          </div>
        </form>

        <div className="upload-tips">
          <h3>📝 Upload Tips</h3>
          <ul>
            <li>Choose a clear, descriptive title</li>
            <li>Select the correct subject and type</li>
            <li>Add a detailed description to help others</li>
            <li>Ensure your file is properly formatted</li>
            <li>Only upload resources you have rights to share</li>
          </ul>
        </div>
      </div>

      {toast && <Toast {...toast} onClose={() => setToast(null)} />}
    </div>
  );
}
