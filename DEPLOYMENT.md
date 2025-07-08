# 🚀 Nosana Deployment Guide

This guide covers deploying the GitHub Insights Agent on Nosana's GPU network.

## 📋 Prerequisites

1. **Nosana Account**: Create an account at [nosana.io](https://nosana.io)
2. **Docker Image**: Built and pushed to a container registry
3. **Environment Variables**: Properly configured for production
4. **GPU Requirements**: This agent works well on basic GPU tiers

## 🔧 Pre-Deployment Setup

### 1. Prepare Environment Variables

Create a production `.env` file:

```env
# GitHub API (recommended for production)
GITHUB_TOKEN=your_github_personal_access_token

# Nosana AI Configuration
NOSANA_MODEL=qwen2.5:32b
NOSANA_ENDPOINT=your_nosana_endpoint

# Server Configuration
PORT=3000
NODE_ENV=production
```

### 2. Build Production Docker Image

```bash
# Build optimized image
docker build -t nosana-github-agent:latest .

# Tag for registry (replace with your registry)
docker tag nosana-github-agent:latest your-registry/nosana-github-agent:latest

# Push to registry
docker push your-registry/nosana-github-agent:latest
```

### 3. Optimize for Nosana

Update `mastra.config.ts` for Nosana deployment:

```typescript
export default createConfig({
  name: 'nosana-github-insights-agent',
  agents: {
    directory: './src/mastra/agents',
  },
  tools: {
    directory: './src/mastra/tools',
  },
  workflows: {
    directory: './src/mastra/workflows',
  },
  engine: {
    provider: 'NOSANA', // Change for Nosana
    model: 'qwen2.5:32b', // Use Nosana's model
    endpoint: process.env.NOSANA_ENDPOINT,
  },
});
```

## 🚀 Deployment Steps

### Method 1: Nosana CLI

```bash
# Install Nosana CLI
npm install -g @nosana/cli

# Login to Nosana
nosana login

# Deploy the agent
nosana deploy \
  --image your-registry/nosana-github-agent:latest \
  --port 3000 \
  --env-file .env \
  --gpu-tier basic \
  --name github-insights-agent
```

### Method 2: Nosana Dashboard

1. **Login** to the Nosana dashboard
2. **Create New Job**:
   - **Image**: `your-registry/nosana-github-agent:latest`
   - **Port**: `3000`
   - **GPU Tier**: `basic` (sufficient for this agent)
   - **Environment Variables**: Upload your `.env` file
3. **Deploy** and monitor startup logs

### Method 3: Nosana API

```bash
curl -X POST https://api.nosana.io/jobs \
  -H "Authorization: Bearer YOUR_NOSANA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "image": "your-registry/nosana-github-agent:latest",
    "port": 3000,
    "gpu_tier": "basic",
    "env": {
      "GITHUB_TOKEN": "your_token",
      "NOSANA_MODEL": "qwen2.5:32b",
      "NODE_ENV": "production"
    }
  }'
```

## 🔍 Post-Deployment Verification

### 1. Health Check

```bash
# Replace with your Nosana job URL
curl https://your-job-id.nosana.io/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "nosana-github-insights-agent",
  "timestamp": "2025-01-XX..."
}
```

### 2. Agent Functionality Test

```bash
# Test repository analysis
curl -X POST https://your-job-id.nosana.io/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me stats for microsoft/vscode"}'
```

### 3. Performance Monitoring

Monitor your deployment:
- **Response Time**: Should be under 10 seconds for most queries
- **Memory Usage**: Typically 256MB-512MB
- **GPU Utilization**: Low to moderate for text generation
- **API Rate Limits**: GitHub API limits (5000/hour without token, 5000/hour with token)

## ⚡ Performance Optimization

### GPU Configuration

For optimal performance on Nosana:

```dockerfile
# Add to Dockerfile for Nosana optimization
ENV CUDA_VISIBLE_DEVICES=0
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility
```

### Model Configuration

Update agent configuration for better performance:

```typescript
// In src/mastra/agents/githubInsights.ts
model: {
  provider: 'NOSANA',
  name: 'qwen2.5:32b', // Optimized for Nosana
  temperature: 0.3,    // Lower for consistent results
  max_tokens: 1000,    // Reasonable limit
}
```

## 🔒 Security Considerations

### Environment Variables
- Never commit `.env` files to git
- Use Nosana's secure environment variable storage
- Rotate GitHub tokens regularly

### API Security
- Implement rate limiting if exposing publicly
- Add authentication for production use
- Monitor for unusual usage patterns

### Network Security
- Configure Nosana firewall rules
- Use HTTPS endpoints only
- Implement request validation

## 📊 Monitoring & Logging

### Application Logs

Monitor your agent's logs through Nosana dashboard:

```bash
# View logs
nosana logs github-insights-agent

# Follow logs in real-time
nosana logs -f github-insights-agent
```

### Key Metrics to Monitor

1. **Request Rate**: Requests per minute
2. **Response Time**: Average processing time
3. **Error Rate**: Failed requests percentage
4. **GitHub API Usage**: Remaining rate limit
5. **Memory Usage**: Container memory consumption
6. **GPU Utilization**: Model inference efficiency

## 🚨 Troubleshooting

### Common Issues

**1. GitHub API Rate Limit**
```
Error: GitHub API rate limit exceeded
```
**Solution**: Add `GITHUB_TOKEN` environment variable

**2. Model Loading Timeout**
```
Error: Model loading timeout
```
**Solution**: Increase GPU tier or optimize model configuration

**3. Memory Issues**
```
Error: Container out of memory
```
**Solution**: Increase memory allocation or optimize code

**4. Port Binding Issues**
```
Error: Port 3000 already in use
```
**Solution**: Change `PORT` environment variable

### Debug Mode

Enable debug logging:

```env
NODE_ENV=development
DEBUG=mastra:*
LOG_LEVEL=debug
```

## 📈 Scaling Considerations

### Horizontal Scaling
- Deploy multiple instances behind a load balancer
- Use shared GitHub token pool for higher rate limits
- Implement request queuing for high traffic

### Vertical Scaling
- Upgrade to higher GPU tiers for better performance
- Increase memory allocation for concurrent requests
- Optimize model parameters for faster inference

## 🎯 Production Checklist

- [ ] Docker image built and pushed to registry
- [ ] Environment variables configured securely
- [ ] GitHub token added with appropriate permissions
- [ ] Nosana job deployed and running
- [ ] Health check endpoint responding
- [ ] Agent functionality tested with sample requests
- [ ] Monitoring and logging configured
- [ ] Security measures implemented
- [ ] Performance optimizations applied
- [ ] Backup and recovery plan in place

## 📞 Support

For Nosana-specific deployment issues:
- **Documentation**: [Nosana Docs](https://docs.nosana.io)
- **Community**: [Nosana Discord](https://discord.gg/nosana)
- **Support**: support@nosana.io

For agent-specific issues:
- Check application logs via Nosana dashboard
- Verify environment variable configuration
- Test GitHub API connectivity
- Review Mastra framework documentation

---

**Happy deploying! 🚀** 