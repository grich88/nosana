# 🤖 Nosana GitHub Insights Agent

A powerful AI agent built with the [Mastra framework](https://mastra.ai) that provides comprehensive GitHub repository insights and health assessments. This agent fetches live data from GitHub's API and uses AI to analyze repository health, activity patterns, and provide actionable recommendations.

## 🏆 Nosana Builders Challenge: Agents 101

This project is built for the [Nosana Builders Challenge](https://earn.superteam.fun/listing/agent-challenge) - showcasing how AI agents can provide real-world value through intelligent analysis and multi-tool orchestration.

## ✨ Features

### 🔍 **Comprehensive Repository Analysis**
- Fetches live repository statistics (stars, forks, issues, watchers)
- Analyzes contributor information and community engagement
- Provides intelligent health assessments based on activity patterns
- Supports any public GitHub repository

### 🧠 **AI-Powered Insights**
- **Health Assessments**: ACTIVE, WELL-MAINTAINED, POPULAR, STABLE, STALE, ARCHIVED, EXPERIMENTAL
- **Smart Recommendations**: Based on repository metrics and patterns
- **Community Analysis**: Contributor activity and engagement insights
- **Trend Detection**: Identifies activity patterns and project vitality

### 👻 **Phantom Wallet Integration**
- **Wallet Connection**: Seamless Phantom wallet integration
- **Token Balance Display**: Real-time SOL and NOS balance tracking
- **Deployment Cost Calculator**: Estimate Nosana compute costs
- **Faucet Integration**: Direct links to token faucets for challenge participants

### 🚀 **Nosana Network Deployment**
- **Direct Deployment**: Deploy agents to Nosana directly from the web interface
- **GPU Tier Selection**: Choose from NVIDIA RTX 3060, 4090, or A100
- **Real-time Job Monitoring**: Track deployment status and logs
- **Cost Management**: Pre-deployment balance checking and cost estimation

### 🛠️ **Technical Excellence**
- Built with Mastra framework for robust agent orchestration
- Custom tools with proper error handling and rate limiting
- RESTful API with health checks and monitoring
- Docker containerization for easy deployment on Nosana
- TypeScript for type safety and better development experience
- Solana blockchain integration with wallet adapter

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm
- [Ollama](https://ollama.ai) installed for local LLM (qwen2.5:1.5b)
- GitHub Personal Access Token (optional, for higher rate limits)

### Installation

1. **Clone and setup**
   ```bash
   git clone <your-repo-url>
   cd nosana-github-insights-agent
   npm install
   ```

2. **Setup Ollama (Required for Challenge)**
   ```bash
   # Install Ollama first: https://ollama.ai
   ollama serve
   ollama pull qwen2.5:1.5b
   ollama run qwen2.5:1.5b
   ```

3. **Environment Configuration**
   ```bash
   cp env.example .env
   ```
   
   Edit `.env` with your configuration:
   ```env
   # GitHub API (optional - improves rate limits)
   GITHUB_TOKEN=your_github_personal_access_token
   
   # OpenAI API (for local development)
   OPENAI_API_KEY=your_openai_api_key
   
   # Server Configuration
   PORT=3000
   ```

3. **Run locally**
   ```bash
   npm run dev
   ```

### 🧪 Testing the Agent

**Option 1: cURL Commands**
```bash
# Get agent information
curl http://localhost:3000/agent-info

# Analyze a repository
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me stats for microsoft/vscode"}'

# Try different repositories
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Analyze facebook/react"}'
```

**Option 2: Web Interface**
Visit `http://localhost:3000/agent-info` to see available endpoints.

## 🐳 Docker Deployment

### Build and Push to Registry
```bash
# Build and tag (replace 'yourusername' with your Docker Hub username)
docker build -t yourusername/agent-challenge:latest .

# Run locally to test
docker run -p 3000:3000 --env-file .env yourusername/agent-challenge:latest

# Login to Docker Hub
docker login

# Push to registry
docker push yourusername/agent-challenge:latest
```

## 🚀 Nosana Deployment

### Option A: Using Nosana CLI
1. **Edit the job definition**
   ```bash
   # Update nos_job_def/nosana_mastra.json
   # Change "image": "docker.io/yourusername/agent-challenge:latest"
   ```

2. **Install Nosana CLI and deploy**
   ```bash
   npm install -g @nosana/cli
   nosana address  # Get your wallet address
   # Request funds in Discord #nosana-challenge-faucet
   nosana job post --file nos_job_def/nosana_mastra.json --market nvidia-3060 --timeout 30
   ```

### Option B: Using Nosana Dashboard
1. Install [Phantom Wallet](https://phantom.com) browser extension
2. Request funds in Discord #nosana-challenge-faucet (include your repo link)
3. Go to [Nosana Dashboard](https://dashboard.nosana.io)
4. Copy content from `nos_job_def/nosana_mastra.json`
5. Choose appropriate GPU and deploy

## 💬 Usage Examples

### Basic Repository Analysis
```json
{
  "message": "Show me stats for torvalds/linux"
}
```

### URL-based Queries
```json
{
  "message": "Analyze https://github.com/vercel/next.js"
}
```

### Comparative Analysis
```json
{
  "message": "What's the health status of rust-lang/rust?"
}
```

## 🔧 Architecture

### Tools
- **`githubRepoTool`**: Fetches comprehensive repository statistics from GitHub API
- **`githubContributorsTool`**: Analyzes contributor information and community engagement

### Agent
- **`githubInsightsAgent`**: Main AI agent that orchestrates tools and provides intelligent analysis

### API Endpoints
- `GET /health` - Health check
- `GET /agent-info` - Agent capabilities and usage information  
- `POST /chat` - Main agent interaction endpoint

## 🏥 Health Assessment Criteria

The agent evaluates repositories using multiple indicators:

| Status | Criteria |
|--------|----------|
| **ACTIVE** | Recent commits (≤30 days), reasonable issue ratio, multiple contributors |
| **WELL-MAINTAINED** | Regular updates, managed issues, good documentation |
| **POPULAR** | High star count, many forks, active community |
| **STABLE** | Mature project with consistent activity |
| **STALE** | No recent updates (6+ months), high unmanaged issues |
| **ARCHIVED** | Explicitly marked as archived |
| **EXPERIMENTAL** | Recent creation, low activity, or marked experimental |

## 🏆 Nosana Challenge Submission

### Submission Checklist
- ✅ **Fork & Development**: Repository forked and agent developed
- ✅ **Custom Tools**: GitHub API integration with multiple tools
- ✅ **Documentation**: Comprehensive README with setup instructions
- ✅ **Environment Config**: `.env.example` file provided
- ✅ **Docker Container**: Built and ready for registry push
- ✅ **Nosana Job Definition**: `nos_job_def/nosana_mastra.json` configured
- 🔄 **Container Registry**: Push to Docker Hub (update image URL in job definition)
- 🔄 **Nosana Deployment**: Deploy on Nosana network and get job ID
- 🔄 **Video Demo**: Record 1-3 minute demonstration
- 🔄 **Social Media**: Post on X with @nosana_ai and #NosanaAgentChallenge
- 🔄 **Final Submission**: Submit on [SuperTeam platform](https://earn.superteam.fun/agent-challenge)

### Innovation Highlights

#### Multi-Tool Orchestration
The agent seamlessly combines multiple GitHub API calls to provide comprehensive insights - demonstrating the power of AI agent workflows.

#### Intelligent Analysis
Beyond raw statistics, the agent provides context-aware health assessments and actionable recommendations based on repository patterns.

#### Real-World Impact
- **For Developers**: Quick project evaluation for contributions or dependencies
- **For Project Managers**: Repository health monitoring and community insights  
- **For Researchers**: Automated analysis of open source project ecosystems

#### Technical Excellence
- Robust error handling with meaningful user feedback
- Rate limiting awareness and optimization
- Structured data schemas for reliable tool integration
- Production-ready containerization optimized for Nosana

## 🔄 Future Enhancements

- **Trend Analysis**: Historical data tracking and pattern recognition
- **Comparative Insights**: Multi-repository comparison capabilities
- **Security Assessment**: Integration with vulnerability databases
- **Language Ecosystem Analysis**: Framework and dependency insights

## 📊 Sample Output

```
📊 **Repository Overview**
- Name: microsoft/vscode
- Language: TypeScript  
- Description: Visual Studio Code
- Created: 2015-09-03 | Last Updated: 2025-01-09

📈 **Key Metrics**
- ⭐ Stars: 162,547
- 🍴 Forks: 28,734
- 🐛 Open Issues: 5,234
- 👀 Watchers: 3,567

🏥 **Health Assessment: ACTIVE & WELL-MAINTAINED**
This repository shows excellent health indicators:
- Recent activity (last push: 2 hours ago)
- Strong community engagement (162k stars, 28k forks)  
- Manageable issue ratio (5.2k issues vs 162k stars = 3.2%)
- Very active contributor base (1,800+ contributors)

💡 **Insights & Recommendations**
- Extremely popular and actively developed project
- Excellent choice for learning TypeScript and Electron
- Strong community support with responsive maintainers
- Consider contributing - well-organized issue tracking
```

## 🏅 Challenge Compliance

✅ **Custom Tool Integration**: Two specialized GitHub API tools
✅ **Real-World Impact**: Immediate value for developers and project managers  
✅ **Technical Implementation**: Production-ready code with proper error handling
✅ **Innovation**: AI-powered health assessment beyond raw statistics
✅ **Nosana Deployment**: Optimized Docker container for GPU network deployment

## 🤝 Contributing

This project demonstrates best practices for Mastra agent development. Feel free to extend it with additional GitHub API integrations or analysis capabilities.

## 📝 License

MIT License - built for the Nosana Builders Challenge

---

**Built with ❤️ using [Mastra](https://mastra.ai) for the [Nosana Builders Challenge](https://earn.superteam.fun/listing/agent-challenge)** 