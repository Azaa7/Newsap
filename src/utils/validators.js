export const isValidEmail = (value) => /^(?:[^\s@]+)@(?:[^\s@]+)\.(?:[^\s@]+)$/.test(value.trim());

export const isStrongEnoughPassword = (value) => typeof value === 'string' && value.length >= 8;

export const validateAuthForm = ({ email, password, mode = 'signin' }) => {
  if (!email || !password) {
    return 'Email and password are required.';
  }

  if (!isValidEmail(email)) {
    return 'Please enter a valid email address.';
  }

  if (!isStrongEnoughPassword(password)) {
    return mode === 'signup'
      ? 'Password must be at least 8 characters.'
      : 'Invalid password format.';
  }

  return null;
};
