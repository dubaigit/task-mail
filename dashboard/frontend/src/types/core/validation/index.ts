export const validateTask = (task: any) => ({ valid: true, errors: [] });
export const validateTaskFilters = (filters: any) => ({ valid: true, errors: [] });
export const validateTasks = (tasks: any[]) => ({ valid: true, errors: [] });
export type ValidationResult = { valid: boolean; errors: any[] };
export type ValidationError = { message: string; field?: string };
export type ValidationWarning = { message: string; field?: string };
export const ValidationUtils = { validateTask, validateTasks };
