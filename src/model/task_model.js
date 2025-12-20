import date_utils from '../date_utils';

export default class TaskModel {
    constructor(tasks, options) {
        this.options = options || {};
        this.tasks = this.process_tasks(tasks);
        this.build_hierarchy();
        this.compute_rollups();
    }

    process_tasks(tasks) {
        return tasks.map((task, i) => {
            // Clone to avoid mutating original too destructively if needed,
            // though we usually enrich the object.
            task = { ...task };

            // ID generation
            if (!task.id) {
                task.id = this.generate_id(task);
            } else if (typeof task.id === 'string') {
                task.id = task.id.replaceAll(' ', '_');
            } else {
                task.id = `${task.id}`;
            }

            // Date Parsing
            if (!task.start && !task.parentId) {
                // Parent tasks might infer dates later, but leaf tasks need them.
                // For now, we'll be lenient and allow empty dates if it's a summary candidate,
                // but usually we want at least something.
                // We will handle missing dates in normalization.
            }

            if (task.start) {
                task._start = date_utils.parse(task.start);
            }

            if (task.end === undefined && task.duration !== undefined && task._start) {
                task.end = task._start;
                let durations = task.duration.split(' ');

                durations.forEach((tmpDuration) => {
                    let { duration, scale } = date_utils.parse_duration(tmpDuration);
                    task.end = date_utils.add(task.end, duration, scale);
                });
            }

            if (task.end) {
                task._end = date_utils.parse(task.end);
            }

            // Validation Checks
            if (task._start && task._end) {
                let diff = date_utils.diff(task._end, task._start, 'year');
                if (diff < 0) {
                    console.error(
                        `start of task can't be after end of task: in task "${task.id}"`,
                    );
                    // Invalid date range
                    task.invalid = true;
                }

                // make task invalid if duration too large
                if (diff > 10) {
                    console.error(
                        `the duration of task "${task.id}" is too long (above ten years)`,
                    );
                    task.invalid = true;
                }
            }

            // Defaults
            task.dependencies = task.dependencies || [];
            if (typeof task.dependencies === 'string') {
                task.dependencies = task.dependencies
                    .split(',')
                    .map((d) => d.trim().replaceAll(' ', '_'))
                    .filter((d) => d);
            }

            // Hierarchy defaults
            task.children = [];
            task.isCollapsed = task.isCollapsed || false;
            task.level = 0;

            // Cache index (initial)
            task._index = i;

            return task;
        });
    }

    build_hierarchy() {
        const taskMap = {};
        this.tasks.forEach(t => taskMap[t.id] = t);

        const rootTasks = [];

        this.tasks.forEach(task => {
            if (task.parentId && taskMap[task.parentId]) {
                const parent = taskMap[task.parentId];
                parent.children.push(task);
                task._parent = parent;
            } else {
                rootTasks.push(task);
            }
        });

        // Compute levels and sort order if needed (DFS)
        this.visibleTasks = [];
        const visit = (task, level) => {
            task.level = level;
            // logic to set type if not set
            if (task.children.length > 0 && !task.type) {
                task.type = 'summary';
            }

            // Re-assign start/end for summary if needed (basic logic, improved in compute_rollups)

            task.children.forEach(child => visit(child, level + 1));
        };

        rootTasks.forEach(t => visit(t, 0));

        // Re-order tasks array to match hierarchy (flattened tree)
        const flatten = (nodes) => {
            let flat = [];
            nodes.forEach(node => {
                flat.push(node);
                if (node.children.length > 0) {
                    flat = flat.concat(flatten(node.children));
                }
            });
            return flat;
        };

        // Update the main tasks list to be in tree order
        this.tasks = flatten(rootTasks);
        this.tasks.forEach((t, i) => t._index = i);
    }

    compute_rollups() {
        // Bottom-up traversal for rollups
        const compute = (task) => {
            if (task.children.length === 0) {
                return {
                    start: task._start,
                    end: task._end,
                    progress: task.progress || 0,
                    duration: task._start && task._end ? (task._end - task._start) : 0
                };
            }

            let minStart = null;
            let maxEnd = null;
            let totalWeightedProgress = 0;
            let totalDuration = 0;

            task.children.forEach(child => {
                const stats = compute(child);
                if (stats.start) {
                    if (!minStart || stats.start < minStart) minStart = stats.start;
                }
                if (stats.end) {
                    if (!maxEnd || stats.end > maxEnd) maxEnd = stats.end;
                }

                // Duration weighted progress
                if (stats.duration > 0) {
                    totalWeightedProgress += stats.progress * stats.duration;
                    totalDuration += stats.duration;
                }
            });

            if (minStart && maxEnd) {
                // Only override if it's a summary task
                task._start = minStart;
                task._end = maxEnd;
            }

            if (totalDuration > 0) {
                task.progress = totalWeightedProgress / totalDuration;
            } else {
                task.progress = 0;
            }

            return {
                start: task._start,
                end: task._end,
                progress: task.progress,
                duration: totalDuration // Return aggregate duration for higher levels?
                // Or should duration be based on parent's start/end?
                // Usually parent duration is (end - start).
                // But for weighting, we summed children's duration.
                // Let's use (task._end - task._start) for the parent's contribution to its own parent.
            };
        };

        // Revised compute for cleaner recursion return values
        const compute_final = (task) => {
             if (task.children.length === 0) {
                return {
                    start: task._start,
                    end: task._end,
                    progress: task.progress || 0,
                    // Duration in millis
                    duration: (task._start && task._end) ? (task._end.getTime() - task._start.getTime()) : 0
                };
            }

            let minStart = null;
            let maxEnd = null;
            let totalWeightedProgress = 0;
            let totalDuration = 0;

            task.children.forEach(child => {
                const stats = compute_final(child);

                if (stats.start) {
                    if (!minStart || stats.start < minStart) minStart = stats.start;
                }
                if (stats.end) {
                    if (!maxEnd || stats.end > maxEnd) maxEnd = stats.end;
                }

                // Accumulate for weighted average
                if (stats.duration) {
                    totalWeightedProgress += (stats.progress || 0) * stats.duration;
                    totalDuration += stats.duration;
                }
            });

            if (minStart && maxEnd) {
                task._start = minStart;
                task._end = maxEnd;
            }

            if (totalDuration > 0) {
                task.progress = totalWeightedProgress / totalDuration;
            } else {
                // If total duration is 0 (all milestones?), straight average?
                // Or 0? Let's go with straight average if duration is 0.
                if (task.children.length > 0) {
                     const totalP = task.children.reduce((acc, c) => acc + (c.progress || 0), 0);
                     task.progress = totalP / task.children.length;
                }
            }

            return {
                start: task._start,
                end: task._end,
                progress: task.progress,
                duration: (task._start && task._end) ? (task._end.getTime() - task._start.getTime()) : 0
            };
        };

        // Find roots
        const roots = this.tasks.filter(t => !t._parent);
        roots.forEach(root => compute_final(root));
    }

    getVisibleTasks() {
        // Return tasks that are not hidden by a collapsed parent
        const visible = [];
        const visit = (task) => {
            visible.push(task);
            if (!task.isCollapsed && task.children.length > 0) {
                task.children.forEach(child => visit(child));
            }
        };

        const roots = this.tasks.filter(t => !t._parent);
        roots.forEach(r => visit(r));

        // Re-index for rendering
        visible.forEach((t, i) => t._index = i);
        return visible;
    }

    toggleCollapse(taskId) {
        const task = this.getTask(taskId);
        if (task) {
            task.isCollapsed = !task.isCollapsed;
            return true;
        }
        return false;
    }

    getTask(id) {
        return this.tasks.find(t => t.id === id);
    }

    generate_id(task) {
        return (task.name || 'task') + '_' + Math.random().toString(36).slice(2, 12);
    }
}
