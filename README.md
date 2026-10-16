# AI StudyClub - Frontend Application

**Collaborative Resource Sharing & Exam Preparation Platform**

A modern, production-quality student web application built with React and Vite for collaborative learning, resource sharing, and exam preparation.

---

## 🎯 Project Overview

AI StudyClub is a comprehensive academic platform where students can:
- Discover and share study resources
- Upload notes and documents
- Search and filter resources
- Prepare for exams with interactive quizzes
- Join and participate in study groups
- Track study progress
- Collaborate with classmates

---

## 🛠️ Technology Stack

### Core Technologies
- **React** 19.2.8 - UI library
- **Vite** 8.3.0 - Build tool and dev server
- **React Router DOM** 6.x - Client-side routing
- **Lucide React** - Modern icon library
- **JavaScript (ES6+)** - Programming language
- **CSS3** - Styling with CSS custom properties

### Development Tools
- **ESLint** - Code linting
- **Git** - Version control

---

## 📁 Project Structure

```
ai-studyclub-frontend/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── Sidebar.jsx
│   │   ├── Header.jsx
│   │   ├── StatCard.jsx
│   │   ├── Modal.jsx
│   │   ├── Toast.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── EmptyState.jsx
│   │
│   ├── pages/              # Page components
│   │   ├── Dashboard.jsx
│   │   ├── ResourceLibrary.jsx
│   │   ├── ResourceDetails.jsx
│   │   ├── UploadResource.jsx
│   │   ├── ExamPrep.jsx
│   │   ├── Quiz.jsx
│   │   ├── QuizResults.jsx
│   │   ├── StudyGroups.jsx
│   │   ├── StudyGroupDetails.jsx
│   │   ├── Profile.jsx
│   │   └── Settings.jsx
│   │
│   ├── services/           # Service layer for future AWS integration
│   │   ├── resourceService.js
│   │   ├── quizService.js
│   │   └── groupService.js
│   │
│   ├── data/               # Mock data
│   │   ├── mockResources.js
│   │   ├── mockQuizzes.js
│   │   ├── mockExams.js
│   │   ├── mockGroups.js
│   │   └── mockUsers.js
│   │
│   ├── App.jsx             # Main application component
│   ├── App.css             # Application styles
│   ├── main.jsx            # Application entry point
│   └── index.css           # Global styles and theme
│
├── public/                 # Static assets
├── .env.example           # Environment variable template
├── package.json           # Dependencies and scripts
├── vite.config.js         # Vite configuration
└── README.md              # This file
```

---

## ✨ Key Features

### 1. **Dashboard**
- Welcome message with user greeting
- Statistics cards (Resources, Quizzes, Groups, Progress)
- Recent study resources
- Upcoming exams calendar
- Subject-wise progress tracking
- Quick action buttons
- Recent activity feed

### 2. **Resource Library**
- Search functionality
- Advanced filters (Subject, Type, Semester)
- Sort options (Newest, Popular, Most Liked)
- Resource cards with metadata
- Download and bookmark features
- Pagination support

### 3. **Resource Details**
- Full resource information
- Upload metadata
- Related resources
- Save/bookmark functionality
- Share capability
- Download simulation

### 4. **Upload Resource**
- Complete form with validation
- File picker with type validation
- Drag-and-drop support
- Form field validation
- Success/error handling
- Mock upload simulation

### 5. **Exam Preparation**
- Quiz discovery
- Filter by subject and difficulty
- Quiz cards with metadata
- Start quiz functionality
- Quiz attempt tracking

### 6. **Interactive Quiz System**
- Question navigation
- Multiple choice answers
- Progress tracking
- Question review
- Time tracking
- Answer submission
- Real-time score calculation

### 7. **Quiz Results**
- Score display with percentage
- Performance feedback
- Detailed question review
- Correct/incorrect highlighting
- Retry functionality
- Navigate to other quizzes

### 8. **Study Groups**
- My Groups section
- Discover new groups
- Search groups
- Join/leave functionality
- Group details with tabs
- Discussion board
- Post and comment system
- Like functionality
- Member list

### 9. **Profile Management**
- View profile information
- Edit profile
- Academic information
- Statistics display
- Recent activity
- Bio section

### 10. **Settings**
- Theme switching (Dark/Light mode)
- Notification preferences
- Privacy settings
- Account management
- Persistent theme storage

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone the repository** (if applicable)
   ```bash
   cd ai-studyclub-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Open in browser**
   ```
   http://localhost:5174
   ```

### Available Scripts

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run linter
npm run lint
```

---

## 🎨 Design System

### Color Palette

**Dark Theme (Default)**
- Background Primary: `#0a0a0f`
- Background Secondary: `#13131a`
- Accent Purple: `#a855f7`
- Text Primary: `#e4e4e7`
- Success: `#10b981`
- Warning: `#f59e0b`
- Danger: `#ef4444`

**Light Theme**
- Background Primary: `#ffffff`
- Background Secondary: `#f9fafb`
- (Automatically switches with theme toggle)

### Typography
- Font Family: System UI (system-ui, Segoe UI, Roboto)
- Font Sizes: 13px - 56px (responsive)
- Font Weights: 400, 500, 600, 700

---

## 📱 Responsive Design

The application is fully responsive and tested at:
- 1440px (Desktop)
- 1280px (Desktop)
- 1024px (Tablet landscape)
- 768px (Tablet portrait)
- 480px (Mobile landscape)
- 375px (Mobile portrait)

### Mobile Features
- Hamburger menu navigation
- Collapsible sidebar
- Touch-friendly interfaces
- Optimized layouts
- No horizontal scrolling

---

## 🔌 AWS Integration Readiness

The application is architecturally prepared for AWS services integration:

### Service Layer Architecture
All data operations go through service modules:
- `resourceService.js` - Resource CRUD operations
- `quizService.js` - Quiz and assessment operations
- `groupService.js` - Study group operations

### Future AWS Integration Points

**Current Mock Implementation → Future AWS Implementation**

1. **Authentication**
   - Mock: Local state
   - AWS: Amazon Cognito

2. **API Calls**
   - Mock: Service functions with setTimeout
   - AWS: API Gateway + Lambda

3. **File Storage**
   - Mock: File object handling
   - AWS: S3 with presigned URLs

4. **Database**
   - Mock: JavaScript objects
   - AWS: DynamoDB

### Environment Configuration

Create `.env` file based on `.env.example`:

```env
VITE_API_URL=https://your-api-gateway-url
VITE_COGNITO_USER_POOL_ID=your-user-pool-id
VITE_COGNITO_CLIENT_ID=your-client-id
VITE_AWS_REGION=ap-south-1
```

### Integration Steps

1. **Replace service implementations**
   ```javascript
   // Current
   async getResources(filters) {
     await delay();
     return mockResources;
   }

   // Future
   async getResources(filters) {
     const response = await fetch(`${API_URL}/resources`, {
       headers: { Authorization: `Bearer ${token}` }
     });
     return response.json();
   }
   ```

2. **Add AWS SDK**
   ```bash
   npm install aws-sdk @aws-amplify/auth
   ```

3. **Configure Cognito authentication**

4. **Update service calls to use API Gateway endpoints**

---

## 🧪 Current Functionality

### ✅ Fully Working Features

- **Navigation**: All routes work with browser back/forward
- **Search**: Resource and group search with real filtering
- **Filters**: Subject, type, semester, difficulty filters
- **Sorting**: Multiple sort options
- **Quiz System**: Complete quiz flow with scoring
- **Forms**: Upload form with validation
- **Theme**: Dark/light mode toggle with persistence
- **Interactions**: Like, comment, join, save actions
- **State Management**: Local React state
- **Notifications**: Toast notifications
- **Modals**: Reusable modal system

### 🔄 Mock/Simulated Features

These are fully functional in the UI but use mock data:

- File uploads (simulated)
- File downloads (simulated)
- API calls (300ms delay simulation)
- Authentication (no Cognito yet)
- Database operations (local state)

---

## 🎓 Learning & Understanding

### Code Organization
- **Components**: Reusable UI pieces
- **Pages**: Route-level components
- **Services**: Business logic layer (AWS integration point)
- **Data**: Mock data for development

### Key Patterns Used
- React Hooks (useState, useEffect)
- React Router for navigation
- Service layer abstraction
- CSS custom properties for theming
- Component composition
- Controlled components for forms

---

## 🔒 Security Considerations

### Current Implementation
- No authentication (mock user)
- No authorization
- Client-side only
- Mock data operations

### Future AWS Implementation
- Cognito authentication
- JWT token validation
- API Gateway authorization
- IAM roles and policies
- S3 bucket policies
- DynamoDB access control

**Important**: Never commit AWS credentials to the repository!

---

## 📊 Performance

- Initial bundle size: ~345 KB (gzipped: ~104 KB)
- Build time: ~580ms
- Lazy loading ready
- Optimized images
- Efficient re-renders

---

## 🐛 Known Limitations

1. **No Backend**: Currently frontend-only
2. **Mock Data**: All data is static/simulated
3. **No Persistence**: Data resets on refresh
4. **No Authentication**: Open access
5. **No Real File Upload**: Simulated only

These are intentional for the current development phase.

---

## 🚧 Future Enhancements

### Phase 1: AWS Backend Integration
- [ ] Cognito authentication
- [ ] API Gateway endpoints
- [ ] Lambda functions
- [ ] DynamoDB tables
- [ ] S3 file storage

### Phase 2: Advanced Features
- [ ] Real-time notifications
- [ ] Video resources
- [ ] AI-powered recommendations
- [ ] Study analytics
- [ ] Collaborative editing
- [ ] Calendar integration

### Phase 3: Mobile App
- [ ] React Native version
- [ ] Native mobile features
- [ ] Offline support

---

## 📝 Development Notes

### Adding New Pages
1. Create page component in `src/pages/`
2. Create corresponding CSS file
3. Add route in `App.jsx`
4. Add navigation link in `Sidebar.jsx`

### Adding New Features
1. Create mock data in `src/data/`
2. Create service methods in `src/services/`
3. Build UI components
4. Wire up with React state

### Theme Customization
Edit CSS custom properties in `src/index.css`:
```css
:root {
  --accent-purple: #your-color;
  --bg-primary: #your-color;
  /* etc. */
}
```

---

## 🤝 Contributing

This is a student project. Key principles:
- Keep code clean and readable
- Comment complex logic
- Follow existing patterns
- Test responsive behavior
- Maintain accessibility

---

## 📄 License

Educational project - No specific license

---

## 👤 Author

**Student Project**
- Email: student@example.com
- University: Example University

---

## 🙏 Acknowledgments

- React team for the excellent framework
- Vite for blazing-fast build tooling
- Lucide for beautiful icons
- The open-source community

---

## 📞 Support

For questions or issues:
1. Check this README
2. Review code comments
3. Check browser console for errors
4. Verify all dependencies are installed

---

## 🎉 Quick Start Summary

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open browser to http://localhost:5174

# Explore the application:
# - Dashboard (main overview)
# - Resources (search and filter)
# - Upload (form with validation)
# - Exam Prep (take quizzes)
# - Study Groups (discussions)
# - Profile (user info)
# - Settings (theme toggle)
```

---

**Built with ❤️ for collaborative learning**
