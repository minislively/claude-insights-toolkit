# Notification System

> **Status:** Partial implementation (P1-006)

## Overview

The notification system sends alerts about important insights and events to configured channels (Slack, Discord, Email).

## Planned Features

### Slack Integration
- Webhook configuration
- Daily summary reports
- Real-time alerts for critical patterns
- Custom alert rules

### Discord Integration
- Webhook configuration
- Server/channel selection
- Embed message format
- Optional bot commands

### Email Notifications
- SMTP configuration
- Weekly/monthly reports
- HTML templates
- PDF attachments

### Notification Rules
- Trigger conditions:
  - Error rate threshold exceeded
  - Productivity drop pattern detected
  - New bottleneck discovered
- Frequency control
- Quiet hours

## Configuration

Configuration stored in `~/.citrc.json`:

```json
{
  "notifications": {
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/...",
      "channel": "#insights",
      "dailySummary": true,
      "alertThresholds": {
        "errorRate": 0.1,
        "productivityDrop": 0.2
      }
    },
    "discord": {
      "enabled": true,
      "webhook": "https://discord.com/api/webhooks/..."
    },
    "email": {
      "enabled": false,
      "smtp": {
        "host": "smtp.gmail.com",
        "port": 587,
        "secure": false,
        "auth": {
          "user": "your@email.com",
          "pass": "your-password"
        }
      },
      "from": "insights@example.com",
      "to": ["you@example.com"],
      "weeklyReport": true
    }
  }
}
```

## CLI Commands

```bash
# Setup wizard
cit notify setup

# Test notification
cit notify test --channel slack

# Send immediate report
cit notify send --type daily-summary

# List configured channels
cit notify list
```

## Implementation TODO

- [ ] Slack webhook sender
- [ ] Discord webhook sender
- [ ] Email SMTP sender
- [ ] Notification rules engine
- [ ] Config management
- [ ] CLI commands
- [ ] Templates for different report types
- [ ] Rate limiting
- [ ] Error handling and retries
