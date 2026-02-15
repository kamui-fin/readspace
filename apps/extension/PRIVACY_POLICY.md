# Privacy Policy for Readspace Browser Extension

## Overview

Readspace is a browser extension that helps users save articles and subscribe to RSS feeds for organized, distraction-free reading. This privacy policy explains how the Readspace browser extension collects, uses, and protects your information.

## Information We Collect

### 1. Authentication Information

- **Access tokens:** Securely stored authentication tokens from your Readspace account to enable communication with your personal Readspace instance
- **User profile data:** Basic account information (username, email) retrieved from your Readspace account for authentication purposes

### 2. Website Content (User-Initiated Only)

When you explicitly choose to save an article or subscribe to a feed, we collect:

- **Article content:** Full text content from web pages you choose to save
- **Article metadata:** Title, description, author, publication date, and featured images
- **Page information:** URL, favicon, and canonical URL of saved pages
- **RSS feed data:** Feed URLs and metadata when you subscribe to RSS feeds

### 3. Extension Settings

- **Server configuration:** Your Readspace server URL and Supabase configuration for self-hosted instances
- **User preferences:** Extension settings like auto-save preferences, theme selection, and default tags
- **Organizational data:** Your personal folders and tags for content organization

## How We Use Your Information

### Primary Purpose

All collected data serves the single purpose of saving articles and RSS feeds to your personal Readspace library. Specifically:

- **Content Processing:** Extract and format article content for optimal reading experience
- **Account Integration:** Authenticate and sync with your Readspace account
- **Content Organization:** Apply your chosen tags, folders, and organization preferences
- **Feed Management:** Subscribe to and manage RSS feeds you've selected

### Data Processing Location

- Data is sent directly to your configured Readspace server (either the official hosted service at api.readspace.ai or your self-hosted instance)
- No data is processed on third-party servers outside of your chosen Readspace instance

## Data Storage and Retention

### Local Storage

The extension stores the following data locally on your device:

- Authentication tokens (encrypted)
- Extension settings and preferences
- Temporary page metadata during the saving process

### Server Storage

Saved articles, RSS feeds, and associated metadata are stored on your Readspace server according to that service's data retention policies.

### Data Removal

- Local data can be removed by uninstalling the extension or clearing browser extension data
- Server-stored content can be managed through your Readspace account settings

## Data Sharing and Third Parties

### No Third-Party Sharing

We do NOT:

- Sell or transfer your data to third parties
- Share your content with advertisers or analytics services
- Use your data for purposes unrelated to the extension's core functionality
- Access your data for marketing or promotional purposes

### Direct Communication Only

The extension communicates exclusively with:

- Your configured Readspace server (api.readspace.ai or your self-hosted instance)
- Supabase authentication service (for account authentication only)
- The specific websites you choose to save content from (to extract article content)

## Permissions Explanation

### Required Permissions

- **activeTab:** Access current tab information (URL, title, favicon) when saving articles
- **storage:** Store authentication tokens and extension settings locally
- **notifications:** Display save confirmations and error messages
- **host*permissions (http://*/_, https://_/\_):** Access any website to extract content when you explicitly save an article or subscribe to a feed

### Permission Usage

Permissions are used exclusively for the extension's core functionality. We do not:

- Monitor your browsing activity
- Collect data from websites you don't explicitly save
- Track your behavior across websites
- Access sensitive information from web pages

## Security Measures

### Data Protection

- Authentication tokens are stored securely using browser extension storage APIs
- All communications with Readspace servers use HTTPS encryption
- No sensitive data is logged or transmitted to unauthorized parties

### Access Control

- The extension only accesses website content when you explicitly trigger a save action
- Authentication is handled through secure OAuth flows with your Readspace account

## Your Rights and Controls

### Data Control

For any requests related to accessing, deleting, exporting, or otherwise controlling your data, please email us at admin@readspace.ai and we will handle your request.

### Extension Management

- **Disable:** Turn off the extension at any time through browser settings
- **Uninstall:** Remove the extension and all local data
- **Permission Review:** Review and understand all requested permissions before installation

## Self-Hosted Instances

If you use a self-hosted Readspace instance:

- Your data is stored entirely on your own servers
- This privacy policy applies to the extension's behavior, not your server's data handling
- You control all aspects of data storage, retention, and security on your self-hosted instance

## Compliance

This privacy policy is designed to comply with:

- Chrome Web Store Developer Program Policies
- Mozilla Add-on Policies
- General Data Protection Regulation (GDPR) principles
- California Consumer Privacy Act (CCPA) principles
