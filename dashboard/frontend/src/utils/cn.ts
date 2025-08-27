/**
 * Class name utility function
 * Simple utility to combine class names with conditional logic
 */

import { clsx, type ClassValue } from 'clsx';

/**
 * Combines class names using clsx
 * @param classes - Class names to combine
 * @returns Combined class name string
 */
export function cn(...classes: ClassValue[]) {
  return clsx(classes);
}

export default cn;