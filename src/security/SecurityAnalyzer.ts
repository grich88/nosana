import dotenv from 'dotenv';

dotenv.config();

export interface SecurityAnalysis {
  overallScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  vulnerabilities: Vulnerability[];
  codeQuality: CodeQualityIssue[];
  licenseRisks: LicenseRisk[];
  secrets: SecretDetection[];
  recommendations: string[];
  summary: string;
}

export interface Vulnerability {
  type: 'DEPENDENCY' | 'CODE' | 'CONFIG';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  file?: string;
  line?: number;
  cve?: string;
  fix?: string;
}

export interface CodeQualityIssue {
  type: 'SQL_INJECTION' | 'XSS' | 'HARDCODED_SECRET' | 'INSECURE_CONFIG' | 'WEAK_CRYPTO';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  file: string;
  line?: number;
  pattern: string;
  recommendation: string;
}

export interface LicenseRisk {
  license: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  compatibility: string;
}

export interface SecretDetection {
  type: 'API_KEY' | 'PASSWORD' | 'TOKEN' | 'PRIVATE_KEY' | 'DATABASE_URL';
  file: string;
  line?: number;
  pattern: string;
  confidence: number;
}

export class SecurityAnalyzer {
  private vulnerabilityPatterns = [
    // SQL Injection patterns
    { pattern: /query\s*\+\s*['"]/gi, type: 'SQL_INJECTION', severity: 'HIGH' as const },
    { pattern: /execute\s*\(\s*['"]/gi, type: 'SQL_INJECTION', severity: 'HIGH' as const },
    { pattern: /\$\{.*\}.*query/gi, type: 'SQL_INJECTION', severity: 'MEDIUM' as const },
    
    // XSS patterns
    { pattern: /innerHTML\s*=\s*.*\+/gi, type: 'XSS', severity: 'MEDIUM' as const },
    { pattern: /document\.write\s*\(/gi, type: 'XSS', severity: 'MEDIUM' as const },
    { pattern: /eval\s*\(/gi, type: 'XSS', severity: 'HIGH' as const },
    
    // Hardcoded secrets patterns
    { pattern: /password\s*[=:]\s*['""][^'""\s]{8,}/gi, type: 'HARDCODED_SECRET', severity: 'CRITICAL' as const },
    { pattern: /api[_-]?key\s*[=:]\s*['""][^'""\s]{10,}/gi, type: 'HARDCODED_SECRET', severity: 'CRITICAL' as const },
    { pattern: /secret\s*[=:]\s*['""][^'""\s]{8,}/gi, type: 'HARDCODED_SECRET', severity: 'HIGH' as const },
    { pattern: /token\s*[=:]\s*['""][^'""\s]{10,}/gi, type: 'HARDCODED_SECRET', severity: 'HIGH' as const },
    
    // Insecure configurations
    { pattern: /ssl:\s*false/gi, type: 'INSECURE_CONFIG', severity: 'MEDIUM' as const },
    { pattern: /verify:\s*false/gi, type: 'INSECURE_CONFIG', severity: 'MEDIUM' as const },
    { pattern: /ignore[-_]ssl/gi, type: 'INSECURE_CONFIG', severity: 'MEDIUM' as const },
    
    // Weak cryptography
    { pattern: /md5\s*\(/gi, type: 'WEAK_CRYPTO', severity: 'MEDIUM' as const },
    { pattern: /sha1\s*\(/gi, type: 'WEAK_CRYPTO', severity: 'MEDIUM' as const },
    { pattern: /des\s*\(/gi, type: 'WEAK_CRYPTO', severity: 'HIGH' as const },
  ];

  private secretPatterns = [
    { pattern: /(?:api[_-]?key|apikey)\s*[=:]\s*['"]([a-zA-Z0-9]{20,})['"]/, type: 'API_KEY' as const },
    { pattern: /(?:password|pwd)\s*[=:]\s*['"]([^'"]{8,})['"]/, type: 'PASSWORD' as const },
    { pattern: /(?:token|access[_-]?token)\s*[=:]\s*['"]([a-zA-Z0-9]{15,})['"]/, type: 'TOKEN' as const },
    { pattern: /-----BEGIN\s+(?:RSA\s+)?PRIVATE\s+KEY-----/, type: 'PRIVATE_KEY' as const },
    { pattern: /(?:database[_-]?url|db[_-]?url)\s*[=:]\s*['"]([^'"]+)['"]/, type: 'DATABASE_URL' as const },
  ];

  private riskyLicenses = [
    { name: 'GPL-3.0', risk: 'HIGH' as const, description: 'Copyleft license requiring derivative works to be GPL' },
    { name: 'GPL-2.0', risk: 'HIGH' as const, description: 'Copyleft license requiring derivative works to be GPL' },
    { name: 'AGPL-3.0', risk: 'CRITICAL' as const, description: 'Network copyleft, affects SaaS applications' },
    { name: 'LGPL-3.0', risk: 'MEDIUM' as const, description: 'Limited copyleft, linking restrictions' },
    { name: 'LGPL-2.1', risk: 'MEDIUM' as const, description: 'Limited copyleft, linking restrictions' },
    { name: 'CC-BY-SA', risk: 'MEDIUM' as const, description: 'Share-alike requirement for modifications' },
  ];

  async analyzeRepository(owner: string, repo: string): Promise<SecurityAnalysis> {
    const vulnerabilities: Vulnerability[] = [];
    const codeQuality: CodeQualityIssue[] = [];
    const licenseRisks: LicenseRisk[] = [];
    const secrets: SecretDetection[] = [];

    try {
      // Get repository information
      const repoInfo = await this.getRepositoryInfo(owner, repo);
      
      // Analyze license risks
      if (repoInfo.license?.spdx_id) {
        try {
          const licenseRisk = this.analyzeLicense(repoInfo.license.spdx_id);
          if (licenseRisk) licenseRisks.push(licenseRisk);
        } catch (licenseError) {
          console.warn('License analysis failed:', licenseError);
        }
      }

      // Get repository files for code analysis (with error handling)
      try {
        const files = await this.getRepositoryFiles(owner, repo);
        
        // Analyze code files (limit to prevent timeouts)
        for (const file of files.slice(0, 15)) { // Limit to 15 files max
          if (this.isCodeFile(file.name)) {
            try {
              const content = await this.getFileContent(owner, repo, file.path);
              if (content) {
                // Scan for vulnerabilities
                const fileVulns = this.scanCodeVulnerabilities(content, file.name);
                codeQuality.push(...fileVulns);
                
                // Scan for secrets
                const fileSecrets = this.scanSecrets(content, file.name);
                secrets.push(...fileSecrets);
              }
            } catch (fileError) {
              console.warn(`Failed to analyze file ${file.name}:`, fileError);
              // Continue with other files
            }
          }
        }
      } catch (filesError) {
        console.warn('Failed to fetch repository files for code analysis:', filesError);
        // Continue without code analysis
      }

      // Check for dependency vulnerabilities (with error handling)
      try {
        const depVulns = await this.checkDependencyVulnerabilities(owner, repo);
        vulnerabilities.push(...depVulns);
      } catch (depError) {
        console.warn('Dependency vulnerability check failed:', depError);
        // Continue without dependency analysis
      }

    } catch (error) {
      console.error('Security analysis error:', error);
      // Return basic analysis even if there were errors
    }

    // Calculate overall security score
    const overallScore = this.calculateSecurityScore(vulnerabilities, codeQuality, licenseRisks, secrets);
    const riskLevel = this.determineRiskLevel(overallScore);
    const recommendations = this.generateRecommendations(vulnerabilities, codeQuality, licenseRisks, secrets);
    const summary = this.generateSummary(overallScore, riskLevel, vulnerabilities.length, codeQuality.length);

    return {
      overallScore,
      riskLevel,
      vulnerabilities,
      codeQuality,
      licenseRisks,
      secrets,
      recommendations,
      summary
    };
  }

  private async getRepositoryInfo(owner: string, repo: string): Promise<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Nosana-GitHub-Security-Scanner',
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.warn(`Failed to fetch repository info for ${owner}/${repo}: ${response.status}`);
        return {}; // Return empty object instead of throwing
      }
      return await response.json();
    } catch (error) {
      console.warn(`Error fetching repository info for ${owner}/${repo}:`, error);
      return {}; // Return empty object instead of throwing
    }
  }

  private async getRepositoryFiles(owner: string, repo: string, path: string = ''): Promise<any[]> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Nosana-GitHub-Security-Scanner',
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.warn(`Failed to fetch repository files for ${owner}/${repo}: ${response.status}`);
        return [];
      }
      
      const files = await response.json() as any[];
      let allFiles: any[] = [];
      
      // Limit files to prevent rate limiting and timeouts
      for (const file of files.slice(0, 10)) { // Reduced from 20 to 10
        if (file.type === 'file') {
          allFiles.push(file);
        } else if (file.type === 'dir' && allFiles.length < 20) { // Reduced from 50 to 20
          try {
            const subFiles = await this.getRepositoryFiles(owner, repo, file.path);
            allFiles.push(...subFiles.slice(0, 5)); // Reduced from 10 to 5
          } catch (error) {
            console.warn(`Failed to fetch subdirectory files for ${file.path}:`, error);
            // Continue with other files instead of failing completely
          }
        }
      }
      
      return allFiles;
    } catch (error) {
      console.error(`Error fetching repository files for ${owner}/${repo}:`, error);
      return []; // Return empty array instead of throwing
    }
  }

  private async getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Nosana-GitHub-Security-Scanner',
    };
    
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
    }

    try {
      const response = await fetch(url, { headers });
      if (!response.ok) {
        console.warn(`Failed to fetch file content for ${path}: ${response.status}`);
        return null;
      }
      
      const data = await response.json() as { content?: string; encoding?: string };
      if (data.content && data.encoding === 'base64') {
        try {
          return Buffer.from(data.content, 'base64').toString('utf-8');
        } catch (decodeError) {
          console.warn(`Failed to decode file content for ${path}:`, decodeError);
          return null;
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`Error fetching file content for ${path}:`, error);
      return null; // Return null instead of throwing
    }
  }

  private isCodeFile(filename: string): boolean {
    const codeExtensions = ['.js', '.ts', '.py', '.java', '.php', '.rb', '.go', '.rs', '.cpp', '.c', '.cs', '.sql', '.yaml', '.yml', '.json', '.env'];
    return codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  private scanCodeVulnerabilities(content: string, filename: string): CodeQualityIssue[] {
    const issues: CodeQualityIssue[] = [];
    const lines = content.split('\n');

    for (const vuln of this.vulnerabilityPatterns) {
      const matches = content.matchAll(vuln.pattern);
      for (const match of matches) {
        // Find line number
        const beforeMatch = content.substring(0, match.index || 0);
        const lineNumber = beforeMatch.split('\n').length;
        
        issues.push({
          type: vuln.type as 'SQL_INJECTION' | 'XSS' | 'HARDCODED_SECRET' | 'INSECURE_CONFIG' | 'WEAK_CRYPTO',
          severity: vuln.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
          description: this.getVulnerabilityDescription(vuln.type),
          file: filename,
          line: lineNumber,
          pattern: match[0],
          recommendation: this.getVulnerabilityRecommendation(vuln.type)
        });
      }
    }

    return issues;
  }

  private scanSecrets(content: string, filename: string): SecretDetection[] {
    const secrets: SecretDetection[] = [];

    for (const secret of this.secretPatterns) {
      const matches = content.matchAll(new RegExp(secret.pattern, 'gi'));
      for (const match of matches) {
        const beforeMatch = content.substring(0, match.index || 0);
        const lineNumber = beforeMatch.split('\n').length;
        
        secrets.push({
          type: secret.type,
          file: filename,
          line: lineNumber,
          pattern: match[0].substring(0, 50) + '...',
          confidence: 0.8
        });
      }
    }

    return secrets;
  }

  private analyzeLicense(licenseId: string): LicenseRisk | null {
    const riskyLicense = this.riskyLicenses.find(l => 
      licenseId.toLowerCase().includes(l.name.toLowerCase())
    );
    
    if (riskyLicense) {
      return {
        license: licenseId,
        riskLevel: riskyLicense.risk,
        description: riskyLicense.description,
        compatibility: this.getLicenseCompatibility(riskyLicense.risk)
      };
    }
    return null;
  }

  private async checkDependencyVulnerabilities(owner: string, repo: string): Promise<Vulnerability[]> {
    // This is a simplified vulnerability check
    // In a real implementation, you'd integrate with vulnerability databases
    const vulnerabilities: Vulnerability[] = [];
    
    try {
      // Check for common vulnerable dependencies by checking package files
      const packageFiles = ['package.json', 'requirements.txt', 'Gemfile', 'pom.xml'];
      
      for (const file of packageFiles) {
        try {
          const content = await this.getFileContent(owner, repo, file);
          if (content) {
            // Simple checks for known vulnerable patterns
            if (file === 'package.json' && content.includes('lodash')) {
              // Example vulnerability check
              vulnerabilities.push({
                type: 'DEPENDENCY',
                severity: 'MEDIUM',
                description: 'Potential lodash vulnerability - check for prototype pollution issues'
              });
            }
          }
        } catch (fileError) {
          console.warn(`Failed to check ${file} for vulnerabilities:`, fileError);
          // Continue with other files
        }
      }
    } catch (error) {
      console.warn('Error in dependency vulnerability check:', error);
    }

    return vulnerabilities;
  }

  private calculateSecurityScore(
    vulnerabilities: Vulnerability[],
    codeQuality: CodeQualityIssue[],
    licenseRisks: LicenseRisk[],
    secrets: SecretDetection[]
  ): number {
    let score = 100;

    // Deduct points for vulnerabilities
    vulnerabilities.forEach(vuln => {
      switch (vuln.severity) {
        case 'CRITICAL': score -= 25; break;
        case 'HIGH': score -= 15; break;
        case 'MEDIUM': score -= 8; break;
        case 'LOW': score -= 3; break;
      }
    });

    // Deduct points for code quality issues
    codeQuality.forEach(issue => {
      switch (issue.severity) {
        case 'CRITICAL': score -= 20; break;
        case 'HIGH': score -= 12; break;
        case 'MEDIUM': score -= 6; break;
        case 'LOW': score -= 2; break;
      }
    });

    // Deduct points for license risks
    licenseRisks.forEach(risk => {
      switch (risk.riskLevel) {
        case 'HIGH': score -= 15; break;
        case 'MEDIUM': score -= 8; break;
        case 'LOW': score -= 3; break;
      }
    });

    // Deduct points for secrets
    secrets.forEach(secret => {
      score -= Math.floor(secret.confidence * 20);
    });

    return Math.max(0, Math.min(100, score));
  }

  private determineRiskLevel(score: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (score >= 80) return 'LOW';
    if (score >= 60) return 'MEDIUM';
    if (score >= 40) return 'HIGH';
    return 'CRITICAL';
  }

  private generateRecommendations(
    vulnerabilities: Vulnerability[],
    codeQuality: CodeQualityIssue[],
    licenseRisks: LicenseRisk[],
    secrets: SecretDetection[]
  ): string[] {
    const recommendations: string[] = [];

    if (secrets.length > 0) {
      recommendations.push('🔑 Remove hardcoded secrets and use environment variables or secure vaults');
    }

    if (codeQuality.some(issue => issue.type === 'SQL_INJECTION')) {
      recommendations.push('🛡️ Use parameterized queries to prevent SQL injection attacks');
    }

    if (codeQuality.some(issue => issue.type === 'XSS')) {
      recommendations.push('🧹 Sanitize user input and use safe DOM manipulation methods');
    }

    if (licenseRisks.some(risk => risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL')) {
      recommendations.push('⚖️ Review license compatibility with your project\'s intended use');
    }

    if (codeQuality.some(issue => issue.type === 'WEAK_CRYPTO')) {
      recommendations.push('🔐 Update to use strong cryptographic algorithms (SHA-256, AES)');
    }

    if (recommendations.length === 0) {
      recommendations.push('✅ Great job! No major security issues detected');
    }

    return recommendations;
  }

  private generateSummary(score: number, riskLevel: string, vulnCount: number, codeIssueCount: number): string {
    const totalIssues = vulnCount + codeIssueCount;
    
    if (score >= 90) {
      return `Excellent security posture with minimal risks detected. ${totalIssues} issues found.`;
    } else if (score >= 70) {
      return `Good security overall with some areas for improvement. ${totalIssues} issues found.`;
    } else if (score >= 50) {
      return `Moderate security concerns that should be addressed. ${totalIssues} issues found.`;
    } else {
      return `Significant security risks detected requiring immediate attention. ${totalIssues} issues found.`;
    }
  }

  private getVulnerabilityDescription(type: string): string {
    const descriptions = {
      'SQL_INJECTION': 'Potential SQL injection vulnerability detected',
      'XSS': 'Cross-site scripting (XSS) vulnerability detected',
      'HARDCODED_SECRET': 'Hardcoded secret or credential found',
      'INSECURE_CONFIG': 'Insecure configuration detected',
      'WEAK_CRYPTO': 'Weak cryptographic algorithm in use'
    };
    return descriptions[type as keyof typeof descriptions] || 'Security vulnerability detected';
  }

  private getVulnerabilityRecommendation(type: string): string {
    const recommendations = {
      'SQL_INJECTION': 'Use parameterized queries or prepared statements',
      'XSS': 'Sanitize user input and use safe DOM methods',
      'HARDCODED_SECRET': 'Move secrets to environment variables or secure vault',
      'INSECURE_CONFIG': 'Enable secure configuration options',
      'WEAK_CRYPTO': 'Upgrade to stronger cryptographic algorithms'
    };
    return recommendations[type as keyof typeof recommendations] || 'Follow security best practices';
  }

  private getLicenseCompatibility(riskLevel: string): string {
    switch (riskLevel) {
      case 'CRITICAL': return 'Incompatible with most commercial projects';
      case 'HIGH': return 'Limited commercial compatibility';
      case 'MEDIUM': return 'Some restrictions may apply';
      default: return 'Generally compatible';
    }
  }
} 