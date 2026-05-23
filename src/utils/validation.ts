/**
 * Client-side validation utilities for auth forms.
 */

/**
 * Validates that a password meets the minimum length requirement.
 * Returns true if the password is 8 or more characters, false otherwise.
 */
export function validatePassword(password: string): boolean {
  return password.length >= 8;
}
