import TaskModel from '../src/model/task_model';
import { test, expect } from 'vitest';

test('TaskModel: builds hierarchy', () => {
    const tasks = [
        { id: '1', name: 'Task 1', start: '2023-01-01', end: '2023-01-05' },
        { id: '1.1', name: 'Task 1.1', start: '2023-01-02', end: '2023-01-03', parentId: '1' },
        { id: '2', name: 'Task 2', start: '2023-01-06', end: '2023-01-10' }
    ];

    const model = new TaskModel(tasks, {});

    expect(model.tasks.length).toBe(3);
    const parent = model.getTask('1');
    expect(parent.children.length).toBe(1);
    expect(parent.children[0].id).toBe('1.1');
    expect(parent.level).toBe(0);
    expect(model.getTask('1.1').level).toBe(1);
});

test('TaskModel: computes rollups', () => {
    const tasks = [
        { id: '1', name: 'Parent', parentId: null }, // No dates
        { id: '1.1', name: 'Child 1', start: '2023-01-01', end: '2023-01-05', parentId: '1' },
        { id: '1.2', name: 'Child 2', start: '2023-01-06', end: '2023-01-10', parentId: '1' }
    ];

    const model = new TaskModel(tasks, {});
    const parent = model.getTask('1');

    // Check inferred dates
    expect(parent._start.toISOString().startsWith('2023-01-01')).toBe(true);
    expect(parent._end.toISOString().startsWith('2023-01-10')).toBe(true);
});

test('TaskModel: handles collapse/expand', () => {
    const tasks = [
        { id: '1', name: 'Parent', start: '2023-01-01', end: '2023-01-10' },
        { id: '1.1', name: 'Child', start: '2023-01-02', end: '2023-01-05', parentId: '1' }
    ];

    const model = new TaskModel(tasks, {});

    let visible = model.getVisibleTasks();
    expect(visible.length).toBe(2);

    model.toggleCollapse('1');
    visible = model.getVisibleTasks();
    expect(visible.length).toBe(1);
    expect(visible[0].id).toBe('1');

    model.toggleCollapse('1');
    visible = model.getVisibleTasks();
    expect(visible.length).toBe(2);
});
