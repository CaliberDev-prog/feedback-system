# Contributing

Thank you for your interest in contributing to the Universal Feedback System.

## Code of Conduct

This project is committed to providing a welcoming and inclusive experience for everyone. Be respectful, constructive, and considerate in all interactions.

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in the Issues section
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the bug
   - Expected behavior vs actual behavior
   - Screenshots if applicable
   - Environment details (browser, OS, version)

### Suggesting Features

1. Open a feature request issue
2. Describe the feature and why it would be useful
3. If possible, describe how it might be implemented

### Pull Requests

1. Fork the repository
2. Create a new branch for your changes
3. Make your changes
4. Test your changes thoroughly
5. Submit a pull request with a clear description

## Development Setup

```bash
git clone https://github.com/your-username/feedback-system.git
cd feedback-system
npm install
```

### Local Development

```bash
npm run dev
```

This starts a local development server. Changes to most files are reflected immediately.

## Coding Standards

### General

- Write clean, readable code
- Keep functions focused on one responsibility
- Use meaningful variable and function names
- Add comments for complex logic only
- Do not leave TODO comments or placeholder code
- Avoid code duplication

### Frontend

- Use ES modules for JavaScript
- Follow existing patterns in the codebase
- Use Tailwind CSS classes for styling
- Ensure all UI elements are keyboard accessible
- Test with screen readers

### Worker

- Use ES modules
- Validate all input
- Sanitize all output
- Follow security best practices
- Handle errors gracefully

## Testing

Test your changes before submitting:

1. Run the local development server
2. Test the form submission flow
3. Test the admin dashboard
4. Check the browser console for errors
5. Verify Discord webhook integration
6. Test on mobile viewports

## Pull Request Process

1. Ensure your code follows the coding standards
2. Update documentation if necessary
3. Make sure all existing features still work
4. The PR will be reviewed by a maintainer
5. Address any feedback from the review
6. Once approved, the PR will be merged

## Project Structure

```
feedback-system/
  public/          Frontend files (HTML, CSS, JS, assets)
    admin/         Admin dashboard files
  worker/          Cloudflare Worker backend
  docs/            Documentation
  wrangler.toml    Worker configuration
  package.json     Dependencies and scripts
```

## Questions

If you have questions, open a discussion in the GitHub Discussions section.
