/**
 * Pont vers le module EXECUTION : réexport strict de '@/lib/execution' (weeklyTasks, listTasks, updateTaskStatus,
 * seedDemoExec…). Le repli « tâches dérivées de l'audit » vit dans ./deps.ts (tasksFromAudit).
 */
export * from '@/lib/execution';
