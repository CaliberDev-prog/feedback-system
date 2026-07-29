import { getConfig, sanitizeHTML, setLoading, getAccentColor, showNotification } from './utils.js';

class FeedbackForm {
  constructor() {
    this.config = getConfig();
    if (!this.config) {
      console.error('Feedback config not found.');
      return;
    }

    this.currentStep = 0;
    this.formData = {};
    this.initialize();
  }

  initialize() {
    this.applyBranding();
    this.renderForm();
    this.bindEvents();
    this.applyAccentColor();
  }

  applyBranding() {
    const config = this.config;

    document.title = config.site.title || 'Feedback';

    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon && config.site.favicon) {
      favicon.href = config.site.favicon;
    }

    const logoImg = document.getElementById('form-logo');
    if (logoImg && config.site.logo) {
      logoImg.src = config.site.logo;
      logoImg.alt = config.site.title + ' Logo';
    }

    const titleEl = document.getElementById('form-title');
    if (titleEl) {
      titleEl.textContent = config.site.title;
    }

    const descEl = document.getElementById('form-description');
    if (descEl) {
      descEl.textContent = config.site.description;
    }

    const footerEl = document.getElementById('form-footer');
    if (footerEl) {
      footerEl.textContent = config.site.footer;
    }

    const submitBtn = document.getElementById('submit-btn');
    if (submitBtn && config.form.submitButtonText) {
      submitBtn.textContent = config.form.submitButtonText;
    }
  }

  applyAccentColor() {
    const color = getAccentColor();
    document.documentElement.style.setProperty('--accent-color', color);
    document.documentElement.style.setProperty('--accent-hover', this.adjustColor(color, -20));
    document.documentElement.style.setProperty('--accent-light', this.adjustColor(color, 40));
  }

  adjustColor(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000ff) + amount));
    return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
  }

  renderForm() {
    const container = document.getElementById('questions-container');
    if (!container) return;

    container.innerHTML = '';
    const questions = this.config.questions || [];

    if (this.config.form.showDiscordField) {
      const discordEl = this.createDiscordField();
      container.appendChild(discordEl);
    }

    questions.forEach((question, index) => {
      const el = this.createQuestionField(question, index);
      container.appendChild(el);
    });
  }

  createDiscordField() {
    const config = this.config;
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field';
    wrapper.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-1.5" for="discord-field">
        ${sanitizeHTML(config.form.discordLabel)}
      </label>
      <input
        type="text"
        id="discord-field"
        name="discord"
        class="form-input"
        placeholder="${sanitizeHTML(config.form.discordPlaceholder)}"
        maxlength="37"
        autocomplete="off"
      />
      <p class="form-hint" id="discord-hint">Format: Username#0000</p>
    `;
    return wrapper;
  }

  createQuestionField(question, index) {
    const wrapper = document.createElement('div');
    wrapper.className = 'form-field';
    wrapper.dataset.questionId = question.id;

    const required = question.required ? '<span class="text-red-500 ml-0.5">*</span>' : '';

    switch (question.type) {
      case 'rating':
        this.renderRating(wrapper, question, required);
        break;
      case 'text':
        this.renderText(wrapper, question, required);
        break;
      case 'textarea':
        this.renderTextarea(wrapper, question, required);
        break;
      case 'select':
        this.renderSelect(wrapper, question, required);
        break;
      case 'dropdown':
        this.renderDropdown(wrapper, question, required);
        break;
      case 'checkboxes':
        this.renderCheckboxes(wrapper, question, required);
        break;
      case 'yesno':
        this.renderYesNo(wrapper, question, required);
        break;
    }

    return wrapper;
  }

  renderRating(wrapper, question, required) {
    const max = question.max || 5;
    const min = question.min || 1;
    let stars = '';
    for (let i = max; i >= min; i--) {
      stars += `
        <input type="radio" id="rating-${question.id}-${i}" name="rating-${question.id}" value="${i}" ${i === max ? '' : ''} />
        <label for="rating-${question.id}-${i}" title="${i} star${i > 1 ? 's' : ''}">
          <svg class="star-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </label>
      `;
    }
    wrapper.innerHTML = `
      <fieldset class="rating-group">
        <legend class="block text-sm font-medium text-gray-700 mb-2">
          ${sanitizeHTML(question.label)} ${required}
        </legend>
        <div class="rating-stars flex flex-row-reverse justify-end gap-1">
          ${stars}
        </div>
        <p class="form-hint" id="hint-${question.id}">Select a rating</p>
      </fieldset>
    `;
  }

  renderText(wrapper, question, required) {
    wrapper.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-1.5" for="field-${question.id}">
        ${sanitizeHTML(question.label)} ${required}
      </label>
      <input
        type="text"
        id="field-${question.id}"
        name="${question.id}"
        class="form-input"
        placeholder="${sanitizeHTML(question.placeholder || '')}"
        maxlength="${question.maxLength || 200}"
        ${question.required ? 'required' : ''}
        autocomplete="off"
      />
      <p class="form-hint" id="hint-${question.id}"></p>
    `;
  }

  renderTextarea(wrapper, question, required) {
    wrapper.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-1.5" for="field-${question.id}">
        ${sanitizeHTML(question.label)} ${required}
      </label>
      <textarea
        id="field-${question.id}"
        name="${question.id}"
        class="form-input form-textarea"
        placeholder="${sanitizeHTML(question.placeholder || '')}"
        maxlength="${question.maxLength || 2000}"
        rows="4"
        ${question.required ? 'required' : ''}
      ></textarea>
      <p class="form-hint" id="hint-${question.id}"></p>
    `;
  }

  renderSelect(wrapper, question, required) {
    const options = (question.options || []).map(
      (opt) => `<option value="${sanitizeHTML(opt)}">${sanitizeHTML(opt)}</option>`
    ).join('');
    wrapper.innerHTML = `
      <label class="block text-sm font-medium text-gray-700 mb-1.5" for="field-${question.id}">
        ${sanitizeHTML(question.label)} ${required}
      </label>
      <select
        id="field-${question.id}"
        name="${question.id}"
        class="form-input form-select"
        ${question.required ? 'required' : ''}
      >
        <option value="">Select an option...</option>
        ${options}
      </select>
      <p class="form-hint" id="hint-${question.id}"></p>
    `;
  }

  renderDropdown(wrapper, question, required) {
    this.renderSelect(wrapper, question, required);
  }

  renderCheckboxes(wrapper, question, required) {
    const options = (question.options || []).map(
      (opt) => `
        <label class="checkbox-label">
          <input type="checkbox" name="${question.id}" value="${sanitizeHTML(opt)}" />
          <span class="checkbox-custom"></span>
          <span>${sanitizeHTML(opt)}</span>
        </label>
      `
    ).join('');
    wrapper.innerHTML = `
      <fieldset>
        <legend class="block text-sm font-medium text-gray-700 mb-2">
          ${sanitizeHTML(question.label)} ${required}
        </legend>
        <div class="checkbox-group">
          ${options}
        </div>
        <p class="form-hint" id="hint-${question.id}"></p>
      </fieldset>
    `;
  }

  renderYesNo(wrapper, question, required) {
    wrapper.innerHTML = `
      <fieldset>
        <legend class="block text-sm font-medium text-gray-700 mb-2">
          ${sanitizeHTML(question.label)} ${required}
        </legend>
        <div class="yesno-group">
          <label class="yesno-label">
            <input type="radio" name="${question.id}" value="Yes" ${question.required ? 'required' : ''} />
            <span class="yesno-radio"></span>
            <span>Yes</span>
          </label>
          <label class="yesno-label">
            <input type="radio" name="${question.id}" value="No" />
            <span class="yesno-radio"></span>
            <span>No</span>
          </label>
        </div>
        <p class="form-hint" id="hint-${question.id}"></p>
      </fieldset>
    `;
  }

  bindEvents() {
    const form = document.getElementById('feedback-form');
    if (!form) return;

    form.addEventListener('submit', (e) => this.handleSubmit(e));

    const inputs = form.querySelectorAll('input, textarea, select');
    inputs.forEach((input) => {
      input.addEventListener('input', () => this.clearFieldError(input));
      input.addEventListener('change', () => this.clearFieldError(input));
      if (input.type === 'radio' && input.name.startsWith('rating-')) {
        input.addEventListener('change', (e) => this.onRatingChange(e));
      }
    });
  }

  onRatingChange(e) {
    const name = e.target.name;
    const stars = document.querySelectorAll(`input[name="${name}"]`);
    let selected = '';
    stars.forEach((s) => {
      if (s.checked) selected = s.value;
    });
    const id = name.replace('rating-', '');
    const hint = document.getElementById(`hint-${id}`);
    if (hint) {
      hint.textContent = selected ? `${selected} star${selected > 1 ? 's' : ''} selected` : 'Select a rating';
    }
  }

  clearFieldError(input) {
    const field = input.closest('.form-field') || input.closest('fieldset');
    if (field) {
      field.classList.remove('field-error');
    }
  }

  validate() {
    const config = this.config;
    let isValid = true;
    const errors = [];

    if (config.form.showDiscordField) {
      const discordInput = document.getElementById('discord-field');
      if (discordInput && discordInput.value) {
        const discordPattern = /^.{2,32}#[0-9]{4}$/;
        if (!discordPattern.test(discordInput.value.trim())) {
          errors.push('Discord username must be in the format Username#0000.');
          isValid = false;
        }
      }
    }

    (config.questions || []).forEach((question) => {
      const error = this.validateField(question);
      if (error) {
        errors.push(error);
        isValid = false;
      }
    });

    return { isValid, errors };
  }

  validateField(question) {
    const field = document.getElementById(`field-${question.id}`);
    const ratingInputs = document.querySelectorAll(`input[name="rating-${question.id}"]`);
    const checkboxInputs = document.querySelectorAll(`input[name="${question.id}"]:checked`);
    const yesnoInputs = document.querySelectorAll(`input[name="${question.id}"]:checked`);

    let value;

    switch (question.type) {
      case 'rating': {
        let checked = false;
        ratingInputs.forEach((r) => { if (r.checked) { checked = true; value = r.value; } });
        if (question.required && !checked) {
          this.markFieldError(question.id);
          return `${question.label} is required.`;
        }
        break;
      }
      case 'text':
      case 'textarea':
        if (field) value = field.value.trim();
        if (question.required && !value) {
          this.markFieldError(question.id);
          return `${question.label} is required.`;
        }
        if (value && question.maxLength && value.length > question.maxLength) {
          this.markFieldError(question.id);
          return `${question.label} must be under ${question.maxLength} characters.`;
        }
        break;
      case 'select':
      case 'dropdown':
        if (field) value = field.value;
        if (question.required && (!value || value === '')) {
          this.markFieldError(question.id);
          return `${question.label} is required.`;
        }
        break;
      case 'checkboxes':
        value = [];
        checkboxInputs.forEach((c) => value.push(c.value));
        if (question.required && value.length === 0) {
          this.markFieldError(question.id);
          return `Please select at least one option for ${question.label}.`;
        }
        break;
      case 'yesno':
        if (yesnoInputs.length > 0) value = yesnoInputs[0].value;
        if (question.required && yesnoInputs.length === 0) {
          this.markFieldError(question.id);
          return `${question.label} is required.`;
        }
        break;
    }

    return null;
  }

  markFieldError(id) {
    const field = document.getElementById(`field-${id}`);
    const ratingField = document.querySelector(`[data-question-id="${id}"]`);
    const target = field ? field.closest('.form-field') || field.closest('fieldset') : ratingField;
    if (target) {
      target.classList.add('field-error');
    }
  }

  collectAnswers() {
    const config = this.config;
    const answers = [];

    (config.questions || []).forEach((question) => {
      const answer = this.collectAnswer(question);
      if (answer.value !== undefined) {
        answers.push(answer);
      }
    });

    return answers;
  }

  collectAnswer(question) {
    const answer = {
      id: question.id,
      type: question.type,
      label: question.label,
      required: question.required,
      min: question.min,
      max: question.max,
      options: question.options,
    };

    switch (question.type) {
      case 'rating': {
        const inputs = document.querySelectorAll(`input[name="rating-${question.id}"]`);
        let value = '';
        inputs.forEach((r) => { if (r.checked) value = r.value; });
        answer.value = value ? parseInt(value) : 0;
        break;
      }
      case 'text':
      case 'textarea':
      case 'select':
      case 'dropdown': {
        const field = document.getElementById(`field-${question.id}`);
        answer.value = field ? field.value.trim() : '';
        break;
      }
      case 'checkboxes': {
        const checked = document.querySelectorAll(`input[name="${question.id}"]:checked`);
        answer.value = Array.from(checked).map((c) => c.value);
        break;
      }
      case 'yesno': {
        const checked = document.querySelectorAll(`input[name="${question.id}"]:checked`);
        answer.value = checked.length > 0 ? checked[0].value : '';
        break;
      }
    }

    return answer;
  }

  async handleSubmit(e) {
    e.preventDefault();

    const { isValid, errors } = this.validate();

    if (!isValid) {
      const container = document.getElementById('form-container') || document.body;
      showNotification(errors[0], 'error', container);
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn ? submitBtn.textContent : '';
    setLoading(submitBtn, true, originalText);

    const discordInput = document.getElementById('discord-field');
    const answers = this.collectAnswers();

    const payload = {
      discord: discordInput ? discordInput.value.trim() : '',
      answers: answers,
    };

    try {
      const response = await fetch(this.config.form.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Submission failed.');
      }

      this.showSuccess();
    } catch (err) {
      setLoading(submitBtn, false, originalText);
      const container = document.getElementById('form-container') || document.body;
      showNotification(err.message || 'Something went wrong. Please try again.', 'error', container);
    }
  }

  showSuccess() {
    const form = document.getElementById('feedback-form');
    const success = document.getElementById('success-state');

    if (form) form.classList.add('hidden');
    if (success) {
      success.classList.remove('hidden');
      success.classList.add('flex');
      this.animateCheckmark();
    }

    const config = this.config.success;
    if (config.redirectUrl && config.redirectDelay > 0) {
      setTimeout(() => {
        window.location.href = config.redirectUrl;
      }, config.redirectDelay);
    }
  }

  animateCheckmark() {
    const checkmark = document.querySelector('.checkmark-path');
    if (checkmark) {
      checkmark.style.strokeDasharray = '100';
      checkmark.style.strokeDashoffset = '100';
      checkmark.getBoundingClientRect();
      checkmark.style.transition = 'stroke-dashoffset 0.6s ease-out';
      checkmark.style.strokeDashoffset = '0';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new FeedbackForm();
});
