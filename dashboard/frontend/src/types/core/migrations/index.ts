export const migrateTask = (task: any) => task;
export const migrateTaskFilters = (filters: any) => filters;
export const migrateTaskStatus = (status: any) => status;
export const migrateTaskPriority = (priority: any) => priority;
export const migrateTaskCategory = (category: any) => category;
export const migrateTaskObject = (obj: any) => obj;
export const migrateTasks = (tasks: any[]) => tasks.map(migrateTask);
export const MigrationUtils = { migrateTask, migrateTasks };
