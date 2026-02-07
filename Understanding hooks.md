Understanding Hooks in Claude Code
Hooks allow you to intercept and control tool execution. There are two types:

Pre-hooks: Run BEFORE a tool executes (can block execution)
Post-hooks: Run AFTER a tool executes (can modify output)

We'll use pre-hooks to block access to sensitive files like .env.

Step 1: Choose Your Hook Scope

mkdir -p .claude/hooks
Create the pre-hook file:

touch ~/.claude/hooks/protect-sensitive-files.js
Add the hook code:
javascript

/**
 * Pre-hook to block access to sensitive files
 * Location: .claude/hooks/protect-sensitive-files.js
 * 
 * This hook prevents Claude from reading environment files,
 * credentials, and other sensitive data.
 */

const path = require('path');

// Define sensitive file patterns
const SENSITIVE_PATTERNS = [
  /\.env$/,                    // .env
  /\.env\..+/,                 // .env.local, .env.production, etc.
  /\.env-.+/,                  // .env-local, .env-prod, etc.
  /config\/secrets/,           // config/secrets directory
  /\.aws\/credentials$/,       // AWS credentials
  /\.ssh\/id_rsa$/,           // SSH private key
  /\.ssh\/id_ed25519$/,       // SSH ED25519 key
  /\.pem$/,                    // Certificate files
  /\.key$/,                    // Private key files
  /credentials\.json$/,        // API credentials
  /\.pgpass$/,                 // PostgreSQL password
  /\.npmrc$/,                  // NPM auth tokens
  /\.pypirc$/,                 // PyPI credentials
  /\.netrc$/,                  // Network credentials
];

// Define sensitive file reasons (for error messages)
const PATTERN_REASONS = {
  '\.env': 'Environment variables file',
  '\.aws': 'AWS credentials',
  '\.ssh': 'SSH private key',
  '\.pem': 'Certificate file',
  'credentials': 'API credentials file',
};

// Get reason for blocked file
function getBlockReason(filePath) {
  for (const [key, reason] of Object.entries(PATTERN_REASONS)) {
    if (filePath.includes(key)) {
      return reason;
    }
  }
  return 'Sensitive file';
}

// Main hook function
module.exports = async function preHook(context) {
  const { tool, parameters } = context;
  
  // Only intercept file read operations
  const READ_TOOLS = ['read', 'view', 'cat', 'str_replace', 'file_editor'];
  
  if (!READ_TOOLS.includes(tool)) {
    return; // Allow other operations
  }
  
  // Extract file path from parameters
  const filePath = parameters.path || parameters.file || parameters.command || '';
  
  if (!filePath) {
    return; // No file path to check
  }
  
  // Normalize path for consistent checking
  const normalizedPath = path.normalize(filePath);
  
  // Check if file matches any sensitive pattern
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(normalizedPath)) {
      const reason = getBlockReason(normalizedPath);
      
      // Log the blocked attempt
      console.error('\n🚫 ACCESS DENIED');
      console.error(`File: ${filePath}`);
      console.error(`Reason: ${reason}`);
      console.error(`Tool: ${tool}\n`);
      
      // Throw error to block execution
      throw new Error(
        `Access to "${filePath}" is blocked for security reasons. ` +
        `This file contains sensitive information (${reason}). ` +
        `If you need to share this information, please do so explicitly.`
      );
    }
  }
};

Step 3: Register the Hook
Create user configuration:
bash
touch .claude/settings.json
Add hook registration:
json
{
  "hooks": {
    "pre": [
      "~/.claude/hooks/protect-sensitive-files.js"
    ]
  }
}
Note: The pre field accepts an array, so you can add multiple hooks.

Step 4: Additional Protection with .claudeignore
Claude Code respects .claudeignore files (similar to .gitignore).
Project-level protection:
bash# In your project root
touch .claudeignore
Add patterns:
bash# Environment files
.env
.env.*
.env-*

# Credentials
.aws/
.ssh/
*.pem
*.key
credentials.json
service-account.json

# Config with secrets
config/secrets/
config/credentials/

# Database
.pgpass
.my.cnf

# Package managers
.npmrc
.pypirc

# Docker
.dockercfg
.docker/config.json

# IDE (may contain tokens)
.idea/
.vscode/settings.json

Step 5: Project-Level Configuration (Optional)
For project-specific rules, create .claude/ directory:
bash# In your project root
mkdir -p .claude/hooks
touch .claude/hooks/project-security.js
Project-specific hook:
javascript/**
 * Project-level security hook
 * Location: .claude/hooks/project-security.js
 * 
 * Additional protection for this specific project
 */

module.exports = async function preHook(context) {
  const { tool, parameters } = context;
  
  // Block access to project-specific sensitive directories
  const projectSensitive = [
    /database\/backups/,
    /exports\/user-data/,
    /logs\/production/,
  ];
  
  const filePath = parameters.path || '';
  
  for (const pattern of projectSensitive) {
    if (pattern.test(filePath)) {
      throw new Error(
        `Project security: Access to "${filePath}" is restricted`
      );
    }
  }
};
Register project hook:
bashtouch .claude/config.json
json{
  "hooks": {
    "pre": [
      ".claude/hooks/project-security.js"
    ]
  }
}

Step 6: Hook Priority and Execution Order
Execution order when both user and project hooks exist:

User hooks (~/.claude/hooks/) run first
Project hooks (.claude/hooks/) run second
Plugin hooks run last

If any hook throws an error, execution stops and the tool is blocked.

Step 7: Advanced Hook with Logging
For audit trails, create an enhanced hook:
bashtouch ~/.claude/hooks/protect-with-logging.js
javascript/**
 * Enhanced pre-hook with audit logging
 * Location: ~/.claude/hooks/protect-with-logging.js
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

// Log directory
const LOG_DIR = path.join(os.homedir(), '.claude', 'logs');
const LOG_FILE = path.join(LOG_DIR, 'blocked-access.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Sensitive patterns (same as before)
const SENSITIVE_PATTERNS = [
  /\.env$/,
  /\.env\..+/,
  /\.aws\/credentials$/,
  /\.ssh\/id_rsa$/,
  /\.pem$/,
  /credentials\.json$/,
];

// Log blocked attempt
function logBlockedAccess(filePath, tool, cwd) {
  const timestamp = new Date().toISOString();
  const logEntry = JSON.stringify({
    timestamp,
    filePath,
    tool,
    cwd,
    event: 'BLOCKED'
  }) + '\n';
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    console.error('Warning: Failed to write audit log:', err.message);
  }
}

module.exports = async function preHook(context) {
  const { tool, parameters } = context;
  
  const READ_TOOLS = ['read', 'view', 'cat', 'str_replace'];
  
  if (!READ_TOOLS.includes(tool)) {
    return;
  }
  
  const filePath = parameters.path || parameters.file || '';
  
  if (!filePath) {
    return;
  }
  
  // Check sensitive patterns
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(filePath)) {
      // Log the attempt
      logBlockedAccess(filePath, tool, process.cwd());
      
      // Block execution
      throw new Error(
        `🚫 Security: Access to "${filePath}" is blocked. ` +
        `This attempt has been logged.`
      );
    }
  }
};
View blocked attempts:
bashcat ~/.claude/logs/blocked-access.log

Step 8: Testing Your Hooks
Create test environment:
bash# Create test project
mkdir test-claude-hooks
cd test-claude-hooks

# Create test .env file
echo "SECRET_KEY=my-secret-123" > .env

# Create .claudeignore
echo ".env" > .claudeignore
Test in Claude Code:
bash# Start Claude Code
claude

# Try to read .env (should be blocked)
> Read the .env file

# Expected output:
# 🚫 ACCESS DENIED
# File: .env
# Reason: Environment variables file
# Tool: read
# Error: Access to ".env" is blocked for security reasons...
Test bypass (for debugging):
If you need to temporarily disable hooks:
bash# Set environment variable
CLAUDE_DISABLE_HOOKS=true claude

# Or in config
{
  "hooks": {
    "enabled": false
  }
}
```

---

## Step 9: Best Practice Project Structure

Here's the recommended structure:
```
your-project/
├── .claude/
│   ├── config.json              # Project-specific config
│   ├── hooks/
│   │   └── project-security.js  # Project-specific hooks
│   └── README.md                # Hook documentation
├── .claudeignore                # File patterns to ignore
├── .env                         # Protected by hooks
├── .env.example                 # Safe template (not protected)
├── .gitignore
└── src/
.claude/README.md (document your setup):
markdown# Claude Code Security Configuration

## Protected Files

This project has security hooks configured to protect:
- Environment files (`.env*`)
- AWS credentials (`.aws/`)
- SSH keys (`.ssh/`)
- Certificate files (`*.pem`, `*.key`)

## How It Works

1. **User-level hook**: `~/.claude/hooks/protect-sensitive-files.js`
   - Blocks access to common sensitive files across all projects

2. **Project-level hook**: `.claude/hooks/project-security.js`
   - Adds project-specific protections

3. **.claudeignore**: Additional file-based blocking

## Testing

To verify protection is working:
```bash
# This should be blocked
claude
> Read the .env file
```

## Bypassing (Emergency Only)

If you need to temporarily disable hooks:
```bash
CLAUDE_DISABLE_HOOKS=true claude
```

## Audit Logs

Blocked access attempts are logged to:
`~/.claude/logs/blocked-access.log`

Step 10: Hook Configuration Reference
Complete ~/.claude/config.json example:
json{
  "hooks": {
    "enabled": true,
    "pre": [
      "~/.claude/hooks/protect-sensitive-files.js",
      "~/.claude/hooks/protect-with-logging.js"
    ],
    "post": []
  },
  "security": {
    "description": "User-level security configuration",
    "auditLog": "~/.claude/logs/blocked-access.log"
  }
}
Complete .claude/config.json example (project):
json{
  "hooks": {
    "pre": [
      ".claude/hooks/project-security.js"
    ]
  },
  "project": {
    "name": "my-secure-project",
    "sensitiveDirectories": [
      "database/backups",
      "exports/user-data"
    ]
  }
}

📋 Q