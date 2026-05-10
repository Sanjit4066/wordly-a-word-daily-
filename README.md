# Wordly - Master Language with AI-Powered Precision

A refined digital companion for expanding your linguistic repertoire and mastering the nuance of language. **Wordly** combines spaced repetition, contextual learning, and AI-powered insights to transform your vocabulary journey.

![Wordly Screenshots](./screenshots/practice.svg)

## 📸 App Screenshots

| Home & Practice | Word Detail | Daily Discovery |
| --- | --- | --- |
| ![Practice screen](./screenshots/practice.svg) | ![Word detail screen](./screenshots/word-detail.svg) | ![Daily word screen](./screenshots/daily-word.svg) |

## ✨ Key Features

### 🎯 **Curated Growth**
- Hand-selected vocabulary that adapts to your proficiency level
- Progressive difficulty scaling from beginner to advanced
- Personalized learning paths based on your performance
- Daily vocabulary suggestions tailored to your streak and level

### 🧠 **Linguistic Nuance**
- Deeply understand the subtle shades of meaning in every word
- AI-powered etymological insights and contextual usage
- Synonyms, antonyms, and comparative analysis
- Real-world examples from elite literature and contemporary usage
- Interactive sentence refinement with expert feedback

### ⚡ **Daily Ritual**
- Soft, daily practice designed for effortless long-term mastery
- Maintain your learning streak with motivating feedback
- Quick 5-10 minute sessions perfect for busy schedules
- Smart reminders and progress tracking
- XP-based gamification system

### 📚 **Comprehensive Learning Hub**
- **Dashboard**: Track your progress, streak, and XP gains at a glance
- **Library**: Browse and revisit all learned words with full context
- **Practice**: Interactive practice modes with writing guidance
- **Quiz**: Challenging assessments to test contextual understanding
- **Word Details**: Deep-dive into etymology, usage, and advanced insights

### 🤖 **AI-Powered Intelligence**
- **Gemini API Integration**: Real-time writing guidance and feedback
- **Smart Analysis**: Sentence-level evaluation with constructive suggestions
- **Contextual Learning**: AI understands your proficiency level and learning goals
- **Adaptive Feedback**: Personalized insights on what works and what needs improvement

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Firebase project with Authentication enabled
- Google Gemini API key

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Sanjit4066/wordly.git
   cd wordly
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Firebase**
   - Replace `firebase-applet-config.json` with your Firebase configuration
   - Ensure Authentication is enabled with Google as a provider
   - Add `localhost` to Authorized domains in Firebase Console

4. **Set up environment variables**
   ```bash
   # Create a .env file in the root directory
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   Navigate to `http://localhost:3000`

## 📁 Project Structure

```
wordly/
├── src/
│   ├── pages/              # React page components
│   │   ├── Landing.tsx     # Welcome page
│   │   ├── Dashboard.tsx   # User dashboard
│   │   ├── Library.tsx     # Word library
│   │   ├── Practice.tsx    # Practice mode
│   │   ├── Quiz.tsx        # Quiz interface
│   │   └── WordDetail.tsx  # Word detail view
│   ├── hooks/
│   │   └── useAuth.tsx     # Firebase authentication hook
│   ├── services/
│   │   └── geminiService.ts # Gemini API integration
│   ├── lib/
│   │   └── firebase.ts     # Firebase configuration
│   ├── App.tsx             # Main app component
│   └── main.tsx            # Entry point
├── server.ts               # Express server with AI endpoints
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
├── package.json            # Dependencies
└── README.md               # This file
```

## 🔧 Technology Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS, Motion (animations)
- **Backend**: Express.js, Node.js
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth with Google OAuth
- **AI**: Google Gemini API (3.5 Flash)
- **Icons**: Lucide React
- **Notifications**: Sonner

## 🎨 Key Workflows

### User Authentication Flow
1. User lands on the welcome page
2. Clicks "Start your journey"
3. Google OAuth login via Firebase
4. Automatic user profile creation in Firestore
5. Redirect to personalized dashboard

### Learning Workflow
1. User receives a curated daily word suggestion
2. Views comprehensive word details (etymology, usage, examples)
3. Practices with guided sentence writing
4. Receives AI-powered feedback on composition
5. Takes quizzes to verify understanding
6. Earns XP and maintains streak

### AI-Powered Features
- **Writing Guidance**: Real-time suggestions as you compose sentences
- **Sentence Analysis**: Detailed feedback on grammar, naturalness, and effectiveness
- **Contextual Refinement**: AI preserves your original idea while improving expression
- **Quiz Generation**: Intelligent quiz questions testing contextual understanding

## 🔐 Security & Best Practices

- Firebase Security Rules enforce data access control
- Environment variables protect sensitive API keys
- User data is isolated per UID
- OAuth 2.0 authentication for secure login
- CORS and CSP headers configured for safety

## 📊 API Endpoints

### AI Writing Endpoints (Express Backend)

**POST** `/api/ai/writing-guidance`
- Provides quick insights and suggestions for word usage

**POST** `/api/ai/analyze-sentence`
- Detailed analysis of user-written sentences with structured feedback

**POST** `/api/ai/practice-sentence`
- Generates example sentences for practice

**POST** `/api/ai/word-details`
- Comprehensive word information (etymology, usage, difficulty)

**POST** `/api/ai/suggest-daily-word`
- AI-curated daily word suggestions

**POST** `/api/ai/verify-review`
- Assessment of user's understanding through meaning and sentence verification

**POST** `/api/ai/generate-quiz`
- Creates challenging multiple-choice quiz questions

## 🎯 Learning Levels

- **Beginner**: Common words, practical usage, foundational understanding
- **Intermediate**: Nuanced vocabulary, contextual applications, professional usage
- **Advanced**: Sophisticated terms, literary usage, etymological depth
- **Expert**: Rare words, complex contextual nuances, specialized vocabulary

## 🚀 Future Enhancements

- [ ] Spaced repetition algorithm optimization
- [ ] Social learning features (leaderboards, sharing)
- [ ] Mobile app (React Native)
- [ ] Offline mode support
- [ ] Voice pronunciation practice
- [ ] Custom word list imports
- [ ] Integration with reading apps
- [ ] Advanced analytics dashboard

## 📝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙋 Support

If you encounter any issues or have questions:
- Check the [GitHub Issues](https://github.com/Sanjit4066/wordly/issues)
- Review the documentation
- Create a new issue with detailed information

## 🎓 About

**Wordly** was created to bridge the gap between vocabulary learning and practical linguistic mastery. By combining spaced repetition, AI-powered feedback, and contextual learning, we help language enthusiasts develop a truly refined vocabulary.

---

**Made with ❤️ for language lovers** | [Visit Wordly](http://localhost:3000)
