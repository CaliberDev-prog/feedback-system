window.FEEDBACK_CONFIG = {
  site: {
    title: 'Feedback',
    description: 'We value your input. Share your thoughts to help us improve.',
    logo: 'assets/logo.svg',
    favicon: 'assets/favicon.svg',
    accentColor: '#5865F2',
    theme: 'light',
    footer: 'Powered by Universal Feedback System',
  },

  form: {
    endpoint: '/api/submit',
    successMessage: 'Thank you for your feedback!',
    errorMessage: 'Something went wrong. Please try again.',
    submitButtonText: 'Submit Feedback',
    showDiscordField: true,
    discordLabel: 'Discord Username (optional)',
    discordPlaceholder: 'Username#0000',
  },

  success: {
    title: 'Feedback Submitted',
    message: 'Your feedback has been received. We appreciate your input.',
    showNewButton: true,
    newButtonText: 'Submit Another Response',
    redirectUrl: '',
    redirectDelay: 0,
  },

  admin: {
    title: 'Admin Dashboard',
    path: '/admin/',
  },

  questions: [
    {
      id: 'rating',
      type: 'rating',
      label: 'Rate your experience',
      required: true,
      min: 1,
      max: 5,
    },
    {
      id: 'category',
      type: 'select',
      label: 'Category',
      required: true,
      options: ['Bug Report', 'Feature Request', 'General Feedback', 'Support', 'Other'],
    },
    {
      id: 'subject',
      type: 'text',
      label: 'Subject',
      required: true,
      placeholder: 'Brief summary of your feedback',
      maxLength: 200,
    },
    {
      id: 'message',
      type: 'textarea',
      label: 'Detailed Feedback',
      required: true,
      placeholder: 'Tell us more about your experience...',
      maxLength: 2000,
    },
    {
      id: 'priority',
      type: 'dropdown',
      label: 'Priority',
      required: false,
      options: ['Low', 'Medium', 'High', 'Critical'],
    },
    {
      id: 'topics',
      type: 'checkboxes',
      label: 'Related Topics',
      required: false,
      options: ['UI/UX', 'Performance', 'Reliability', 'Documentation', 'Pricing'],
    },
    {
      id: 'recommend',
      type: 'yesno',
      label: 'Would you recommend us to others?',
      required: true,
    },
  ],
};
