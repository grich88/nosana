# 🚀 Deploying GitHub Insights Agent to Render

This guide will walk you through deploying your enhanced GitHub Insights Agent with security features to Render for production use.

## 📋 Prerequisites

1. **GitHub Repository**: Your code should be pushed to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com) (free tier available)
3. **GitHub Token**: Personal access token for GitHub API (optional but recommended)

## 🎯 Step-by-Step Deployment Process

### Step 1: Connect Your GitHub Repository to Render

1. **Login to Render**:
   - Go to [dashboard.render.com](https://dashboard.render.com)
   - Sign up or log in with your GitHub account

2. **Connect Repository**:
   - Click "New +" in the top navigation
   - Select "Blueprint" from the dropdown
   - Connect your GitHub account if not already connected
   - Find and select your `grich88/nosana` repository

### Step 2: Configure the Blueprint Deployment

1. **Blueprint Configuration**:
   - Render will detect the `render.yaml` file
   - Review the two services that will be created:
     - `nosana-github-insights-backend` (Web Service)
     - `nosana-github-insights-frontend` (Static Site)

2. **Approve the Deployment**:
   - Click "Apply" to start the deployment process
   - Both services will begin building automatically

### Step 3: Configure Environment Variables (Backend)

1. **Navigate to Backend Service**:
   - Go to your Render dashboard
   - Click on the `nosana-github-insights-backend` service

2. **Add Environment Variables**:
   - Go to "Environment" tab
   - Add the following variables:
     ```
     NODE_ENV=production
     PORT=10000
     GITHUB_TOKEN=your_github_personal_access_token_here
     ```

3. **GitHub Token Setup** (Optional but Recommended):
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Generate a new token with `public_repo` scope
   - Copy the token and paste it as the `GITHUB_TOKEN` value in Render

### Step 4: Update Frontend Configuration

1. **Get Backend URL**:
   - Your backend will be deployed at: `https://nosana-github-insights-backend.onrender.com`
   - Copy this exact URL

2. **Update Frontend Config**:
   - The `frontend/src/config.ts` file should automatically use the production URL
   - If needed, update the production API_BASE_URL to match your actual backend URL

### Step 5: Monitor Deployment

1. **Check Build Logs**:
   - Backend: Monitor the build process in the "Logs" tab
   - Frontend: Check the static site build completion

2. **Verify Health Checks**:
   - Backend should show "Healthy" status
   - Health check endpoint: `https://your-backend-url.onrender.com/health`

### Step 6: Test Your Deployed Application

1. **Frontend URL**: 
   - Your frontend will be available at: `https://nosana-github-insights-frontend.onrender.com`

2. **Test Endpoints**:
   ```bash
   # Health Check
   curl https://nosana-github-insights-backend.onrender.com/health
   
   # Agent Info
   curl https://nosana-github-insights-backend.onrender.com/agent-info
   
   # Repository Analysis
   curl -X POST https://nosana-github-insights-backend.onrender.com/chat \
     -H "Content-Type: application/json" \
     -d '{"message":"Show me stats for facebook/react"}'
   
   # Security Analysis
   curl -X POST https://nosana-github-insights-backend.onrender.com/security \
     -H "Content-Type: application/json" \
     -d '{"message":"facebook/react"}'
   ```

## 🔧 Configuration Details

### Backend Service Configuration

- **Environment**: Node.js 18+
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Port**: 10000 (Render default)
- **Health Check**: `/health` endpoint
- **Auto-Deploy**: On every push to main branch

### Frontend Static Site Configuration

- **Build Command**: `cd frontend && npm install && npm run build`
- **Publish Path**: `frontend/build`
- **Auto-Deploy**: On every push to main branch
- **Caching**: Optimized for static assets
- **SPA Support**: Configured for React Router

## 🌟 Production Features

### Automatic HTTPS
- Both services get free SSL certificates
- All traffic is automatically encrypted

### Custom Domains (Paid Plans)
- You can add custom domains for professional deployment
- Perfect for showcasing to Nosana bounty judges

### Monitoring & Logging
- Built-in logging and monitoring
- Performance metrics and uptime tracking

## 🚨 Troubleshooting

### Common Issues:

1. **Build Failures**:
   - Check that all dependencies are in `package.json`
   - Verify Node.js version compatibility

2. **CORS Errors**:
   - Ensure backend CORS is configured for production frontend URL
   - Check environment variable configuration

3. **API Connection Issues**:
   - Verify frontend is using correct backend URL
   - Check that both services are deployed and healthy

4. **GitHub API Rate Limiting**:
   - Add GitHub personal access token to increase rate limits
   - Monitor usage in GitHub settings

## 🎯 For Nosana Bounty Submission

### Deployment URLs:
- **Frontend**: `https://nosana-github-insights-frontend.onrender.com`
- **Backend API**: `https://nosana-github-insights-backend.onrender.com`
- **Health Check**: `https://nosana-github-insights-backend.onrender.com/health`

### Demo Commands:
```bash
# Repository Health Analysis
curl -X POST https://nosana-github-insights-backend.onrender.com/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"Analyze microsoft/vscode"}'

# Security Analysis
curl -X POST https://nosana-github-insights-backend.onrender.com/security \
  -H "Content-Type: application/json" \
  -d '{"message":"Security scan for facebook/react"}'
```

## 🎉 Success!

Your GitHub Insights Agent with security analysis is now live and accessible globally! The deployment showcases:

- ✅ **Production-ready architecture**
- ✅ **Scalable deployment on cloud infrastructure**
- ✅ **Professional-grade security analysis**
- ✅ **Beautiful, responsive user interface**
- ✅ **Enterprise-ready API endpoints**

Perfect for demonstrating the real-world value and professional quality to Nosana bounty judges! 🏆 