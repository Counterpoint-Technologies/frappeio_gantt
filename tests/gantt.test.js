import Gantt from '../src/index';
import { $, createSVG } from '../src/svg_utils'; // May need for setup if not handled by Gantt constructor

// Mock the DOM environment for tests
// JSDOM is usually default with Jest, but let's ensure a basic setup
if (typeof window !== 'undefined') {
    // Simple SVGElement mock if not fully provided by JSDOM
    if (!window.SVGElement) {
        // @ts-ignore
        window.SVGElement = class SVGElement extends window.HTMLElement {};
    }
}


describe('Gantt Class with Property Mapping', () => {
    let gantt;
    let wrapper;

    beforeEach(() => {
        // Create a div for the Gantt chart to attach to
        wrapper = document.createElement('div');
        wrapper.id = 'gantt-test-wrapper';
        document.body.appendChild(wrapper);
    });

    afterEach(() => {
        // Clean up
        if (gantt && gantt.clear) {
            try {
                gantt.clear();
            } catch (e) {
                // Ignore errors during cleanup if svg was already removed
            }
        }
        if (document.body.contains(wrapper)) {
            document.body.removeChild(wrapper);
        }
        // Reset tasks for next test if necessary by re-initializing gantt
    });

    test('should use default properties when no property_map is provided', () => {
        const tasks = [
            {
                id: 'Task1',
                name: 'Default Name',
                start: '2024-01-01',
                end: '2024-01-03',
                progress: 50,
            },
        ];
        gantt = new Gantt('#gantt-test-wrapper', tasks, {});
        expect(gantt.tasks.length).toBe(1);
        expect(gantt.tasks[0].name).toBe('Default Name');
        expect(gantt.tasks[0].id).toBe('Task1');
        expect(gantt.tasks[0].progress).toBe(50);
        expect(date_utils.to_string(gantt.tasks[0]._start, false)).toBe('2024-01-01');
        expect(date_utils.to_string(gantt.tasks[0]._end, false)).toBe('2024-01-04'); // End date is exclusive, so it becomes start of next day
    });

    test('should use mapped properties when property_map is provided', () => {
        const tasks_data = [
            {
                my_id: 'MappedTask1',
                title: 'Mapped Name',
                begin: '2024-02-01',
                finish: '2024-02-03',
                percentage_complete: 75,
                linked_tasks: 'MappedTask2',
                custom_style: 'bar-highlight',
                is_critical: true,
                is_repeating_task: true,
                repeat_every: '7d',
                repeat_until: 3,
                img_url: 'http://example.com/img.png'
            },
        ];
        const property_map = {
            id: 'my_id',
            name: 'title',
            start: 'begin',
            end: 'finish',
            progress: 'percentage_complete',
            dependencies: 'linked_tasks',
            custom_class: 'custom_style',
            important: 'is_critical',
            repeating: 'is_repeating_task',
            frequency: 'repeat_every',
            until: 'repeat_until',
            thumbnail: 'img_url'
        };
        gantt = new Gantt('#gantt-test-wrapper', tasks_data, { property_map });
        expect(gantt.tasks.length).toBe(1);
        const task = gantt.tasks[0];
        expect(task.id).toBe('MappedTask1');
        expect(task.name).toBe('Mapped Name');
        expect(date_utils.to_string(task._start, false)).toBe('2024-02-01');
        // End date becomes start of the next day due to full day assumption if time isn't specified.
        // And date_utils.add(task._end, 24, 'hour') if end time is 00:00:00
        // Let's check the original end string to be precise based on current logic
        expect(date_utils.format(task._end, 'YYYY-MM-DD')).toBe('2024-02-04');
        expect(task.progress).toBe(75);
        expect(task.dependencies).toEqual(['MappedTask2']);
        expect(task.custom_class).toBe('bar-highlight');
        expect(task.important).toBe(true);
        expect(task.repeating).toBe(true);
        expect(task.frequency).toBe('7d');
        expect(task.until).toBe(3);
        expect(task.thumbnail).toBe('http://example.com/img.png');
    });

    test('should use default properties for unmapped fields when property_map is partial', () => {
        const tasks_data = [
            {
                my_id: 'PartialMap1',
                name: 'Default Name for Partial', // Default 'name' field
                begin: '2024-03-01',
                end: '2024-03-03', // Default 'end' field
                my_progress: 60,
            },
        ];
        const property_map = {
            id: 'my_id',
            start: 'begin',
            // 'end' is not mapped, 'name' is not mapped
            progress: 'my_progress',
        };
        gantt = new Gantt('#gantt-test-wrapper', tasks_data, { property_map });
        expect(gantt.tasks.length).toBe(1);
        const task = gantt.tasks[0];
        expect(task.id).toBe('PartialMap1');
        expect(task.name).toBe('Default Name for Partial'); // Uses default
        expect(date_utils.to_string(task._start, false)).toBe('2024-03-01');
        expect(date_utils.format(task._end, 'YYYY-MM-DD')).toBe('2024-03-04'); // Uses default 'end'
        expect(task.progress).toBe(60);
    });

    test('should handle tasks with duration property correctly with mapping', () => {
        const tasks_data = [
            {
                my_id: 'DurationTask1',
                title: 'Task with Duration',
                begin_date: '2024-04-01',
                length_in_days: '3d', // Mapped to 'duration'
            },
        ];
        const property_map = {
            id: 'my_id',
            name: 'title',
            start: 'begin_date',
            duration: 'length_in_days',
        };
        gantt = new Gantt('#gantt-test-wrapper', tasks_data, { property_map });
        expect(gantt.tasks.length).toBe(1);
        const task = gantt.tasks[0];
        expect(task.name).toBe('Task with Duration');
        expect(date_utils.to_string(task._start, false)).toBe('2024-04-01');
        // Duration '3d' means 3 days from start. Start 01, End 03. _end becomes 04 00:00:00
        expect(date_utils.format(task._end, 'YYYY-MM-DD')).toBe('2024-04-04');
    });

    test('should correctly process dependencies provided as an array with mapping', () => {
        const tasks_data = [
            { task_uid: 'T1', task_title: 'Task 1', task_start: '2024-05-01', task_end: '2024-05-03', child_tasks: ['T2'] },
            { task_uid: 'T2', task_title: 'Task 2', task_start: '2024-05-04', task_end: '2024-05-06' }
        ];
        const property_map = {
            id: 'task_uid',
            name: 'task_title',
            start: 'task_start',
            end: 'task_end',
            dependencies: 'child_tasks'
        };
        gantt = new Gantt('#gantt-test-wrapper', tasks_data, { property_map });
        expect(gantt.tasks[0].dependencies).toEqual(['T2']);
    });

    test('should copy unmapped properties from original task data', () => {
        const tasks_data = [
            {
                id: 'UnmappedPropsTask',
                name: 'Task With Unmapped Data',
                start: '2024-06-01',
                end: '2024-06-03',
                custom_field_1: 'value1',
                another_custom_prop: { nested: true }
            },
        ];
        gantt = new Gantt('#gantt-test-wrapper', tasks_data, {}); // No property_map
        const task = gantt.tasks[0];
        expect(task.custom_field_1).toBe('value1');
        expect(task.another_custom_prop).toEqual({ nested: true });

        const tasks_data_mapped = [
            {
                my_id: 'UnmappedMappedTask',
                title: 'Mapped Task With Unmapped',
                begin: '2024-07-01',
                finish: '2024-07-03',
                extra_data: 'important_info',
                original_id_field_not_mapped: 'original_id_val'
            }
        ];
        const property_map = {
            id: 'my_id',
            name: 'title',
            start: 'begin',
            end: 'finish'
        };
        gantt = new Gantt('#gantt-test-wrapper', tasks_data_mapped, { property_map });
        const mappedTask = gantt.tasks[0];
        expect(mappedTask.extra_data).toBe('important_info');
        // 'original_id_field_not_mapped' should be copied because 'my_id' is the source for 'id'
        // and 'original_id_field_not_mapped' is not itself a target in the map (like 'id', 'name')
        expect(mappedTask.original_id_field_not_mapped).toBe('original_id_val');
    });

    test('should generate an ID if no ID is provided or mapped, using mapped name if available', () => {
        const tasks_data_no_id_mapped_name = [
            {
                task_name: 'Task Needs ID',
                s_date: '2024-08-01',
                e_date: '2024-08-03'
            }
        ];
        const property_map_name_only = {
            name: 'task_name',
            start: 's_date',
            end: 'e_date'
        };
        gantt = new Gantt('#gantt-test-wrapper', tasks_data_no_id_mapped_name, { property_map: property_map_name_only });
        const task1 = gantt.tasks[0];
        expect(task1.id).toBeDefined();
        expect(task1.id).toContain('Task_Needs_ID'); // generate_id uses the name
        expect(task1.name).toBe('Task Needs ID');

        const tasks_data_no_id_no_name = [
            {
                s_date: '2024-09-01',
                e_date: '2024-09-03'
            }
        ];
         const property_map_dates_only = {
            start: 's_date',
            end: 'e_date'
        };
        gantt = new Gantt('#gantt-test-wrapper', tasks_data_no_id_no_name, { property_map: property_map_dates_only});
        const task2 = gantt.tasks[0];
        expect(task2.id).toBeDefined();
        expect(task2.name).toBe('Untitled Task 1'); // Fallback name
        expect(task2.id).toContain('Untitled_Task_1');
    });
});

describe('Gantt Class with Auto Refresh on Reassign', () => {
    let wrapper;

    beforeEach(() => {
        wrapper = document.createElement('div');
        wrapper.id = 'gantt-auto-refresh-wrapper';
        document.body.appendChild(wrapper);
    });

    afterEach(() => {
        if (document.body.contains(wrapper)) {
            document.body.removeChild(wrapper);
        }
    });

    test('should not auto-refresh when tasks are reassigned if auto_refresh_on_reassign is false (default)', () => {
        const initial_tasks = [{ id: 'T1', name: 'Initial Task 1', start: '2024-01-01', end: '2024-01-02' }];
        const gantt = new Gantt('#gantt-auto-refresh-wrapper', initial_tasks, {});

        // Spy on change_view_mode as it's called by the refresh mechanism in the setter
        const refreshSpy = jest.spyOn(gantt, 'change_view_mode');

        const new_tasks = [{ id: 'T2', name: 'New Task 1', start: '2024-02-01', end: '2024-02-02' }];
        gantt.tasks = new_tasks; // Reassign tasks

        expect(refreshSpy).not.toHaveBeenCalled();
        expect(gantt.tasks.length).toBe(1); // tasks getter should return the processed new tasks
        expect(gantt.tasks[0].name).toBe('New Task 1'); // verify new tasks were processed by setup_tasks

        refreshSpy.mockRestore();
    });

    test('should auto-refresh when tasks are reassigned if auto_refresh_on_reassign is true', () => {
        const initial_tasks = [{ id: 'T3', name: 'Initial Task 2', start: '2024-03-01', end: '2024-03-02' }];
        const gantt = new Gantt('#gantt-auto-refresh-wrapper', initial_tasks, {
            auto_refresh_on_reassign: true,
        });

        // Spy on change_view_mode as it's called by the refresh mechanism in the setter
        const refreshSpy = jest.spyOn(gantt, 'change_view_mode');

        const new_tasks = [{ id: 'T4', name: 'New Task 2', start: '2024-04-01', end: '2024-04-02' }];
        gantt.tasks = new_tasks; // Reassign tasks, should trigger refresh via setter

        expect(refreshSpy).toHaveBeenCalled();
        expect(gantt.tasks.length).toBe(1);
        expect(gantt.tasks[0].name).toBe('New Task 2');

        refreshSpy.mockRestore();
    });

    test('refresh method should still work independently and process new raw tasks', () => {
        const initial_tasks = [{ id: 'T5', name: 'Initial Task 3', start: '2024-05-01', end: '2024-05-02' }];
        const gantt = new Gantt('#gantt-auto-refresh-wrapper', initial_tasks, {
            auto_refresh_on_reassign: false, // Explicitly false for this test
        });

        const refreshSpy = jest.spyOn(gantt, 'change_view_mode');
        const setupTasksSpy = jest.spyOn(gantt, 'setup_tasks');

        const new_tasks_for_refresh = [{ id: 'T6', name: 'Refreshed Task', start: '2024-06-01', end: '2024-06-02' }];
        gantt.refresh(new_tasks_for_refresh);

        expect(setupTasksSpy).toHaveBeenCalledWith(new_tasks_for_refresh);
        expect(refreshSpy).toHaveBeenCalled(); // change_view_mode is the core of refresh's rendering part
        expect(gantt.tasks.length).toBe(1);
        expect(gantt.tasks[0].name).toBe('Refreshed Task');

        setupTasksSpy.mockRestore();
        refreshSpy.mockRestore();
    });
});

// Minimal date_utils mock/stub for testing if not already globally available via imports
// This is often needed if date_utils itself is not directly part of the Gantt class
// or if we want to control its behavior during tests.
// However, since Gantt imports it directly, it should be available.
// We just need to make sure the tests can resolve it.
// For now, assuming Jest handles the import of date_utils from src.
// If not, we might need to mock it:
// jest.mock('../src/date_utils', () => ({
//   parse: jest.fn(date => new Date(date)),
//   to_string: jest.fn((date, with_time = false) => date.toISOString().split('T')[0]),
//   format: jest.fn((date, format_string = 'YYYY-MM-DD HH:mm:ss.SSS') => date.toISOString()),
//   add: jest.fn((date, qty, scale) => new Date(date)), // Simplified
//   diff: jest.fn((date_a, date_b, scale) => 1), // Simplified
//   today: jest.fn(() => new Date()),
//   get_date_values: jest.fn(date => [date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()]),
//   parse_duration: jest.fn(duration_str => ({duration: parseInt(duration_str), scale: duration_str.slice(-1) === 'd' ? 'day' : 'hour'}))
// }));
// Actually, date_utils is a concrete dependency, so we should import it for real in tests too for assertions.
import date_utils from '../src/date_utils';

// Make sure createSVG is available or mocked if Gantt constructor tries to use it immediately
// For these tests, we are primarily focused on task data processing, not rendering.
// However, the constructor does call `this.render()` eventually.
// A simple mock for createSVG might be needed if full rendering tests are too complex here.
// For now, the existing beforeEach/afterEach with a wrapper div should suffice for basic instantiation.

// Add a dummy implementation for requestAnimationFrame if not present in JSDOM
if (typeof window !== 'undefined' && !window.requestAnimationFrame) {
    window.requestAnimationFrame = (callback) => setTimeout(callback, 0);
}
if (typeof window !== 'undefined' && !window.cancelAnimationFrame) {
    window.cancelAnimationFrame = (id) => clearTimeout(id);
}

// Mock getBBox for SVG elements, as it's called in update_label_position via requestAnimationFrame
if (typeof window !== 'undefined' && window.SVGElement && !window.SVGElement.prototype.getBBox) {
    window.SVGElement.prototype.getBBox = () => ({ x: 0, y: 0, width: 0, height: 0 });
}
if (typeof window !== 'undefined' && window.SVGElement && !window.SVGElement.prototype.getX) {
    SVGElement.prototype.getX = function () { return +this.getAttribute('x'); };
    SVGElement.prototype.getY = function () { return +this.getAttribute('y'); };
    SVGElement.prototype.getWidth = function () { return +this.getAttribute('width'); };
    SVGElement.prototype.getHeight = function () { return +this.getAttribute('height'); };
    SVGElement.prototype.getEndX = function () { return this.getX() + this.getWidth(); };
}

// Mock for element.closest, used by svg_utils $.on if delegated events are triggered by Gantt internal setup
if (typeof Element !== 'undefined' && !Element.prototype.closest) {
  Element.prototype.closest = function(s) {
    var el = this;
    do {
      if (el.matches(s)) return el;
      el = el.parentElement || el.parentNode;
    } while (el !== null && el.nodeType === 1);
    return null;
  };
}

// Mock for element.matches, needed for `closest` polyfill
if (typeof Element !== 'undefined' && !Element.prototype.matches) {
  Element.prototype.matches =
    Element.prototype.matchesSelector ||
    Element.prototype.mozMatchesSelector ||
    Element.prototype.msMatchesSelector ||
    Element.prototype.oMatchesSelector ||
    Element.prototype.webkitMatchesSelector ||
    function(s) {
      var matches = (this.document || this.ownerDocument).querySelectorAll(s),
        i = matches.length;
      while (--i >= 0 && matches.item(i) !== this) {}
      return i > -1;
    };
}

// Need to ensure `date_utils` is available for some assertions.
// It's imported at the top level of this test file now.
// The Gantt class itself imports date_utils, so it should use the real one.

// The `generate_id` function is also in `index.js` but not exported.
// Tests that rely on specific ID generation logic for tasks without IDs might be a bit loose,
// checking only for `toBeDefined` or `toContain` parts of the name.
// This is acceptable as the exact random suffix of generate_id is not critical.

// The end date assertion `toBe('YYYY-MM-04')` for a task ending on `YYYY-MM-03`
// is due to the logic in `setup_tasks` that adds 24 hours if the time is 00:00:00,
// effectively making the task span the entirety of the end day.
// `task._end = date_utils.add(task._end, 24, 'hour');`
// So '2024-01-03' becomes '2024-01-04 00:00:00'.
// The `date_utils.to_string(gantt.tasks[0]._end, false))` will then print '2024-01-04'.
// This is consistent with how the library seems to define task end points for full-day tasks.
// For `format(task._end, 'YYYY-MM-DD')` this will also be '2024-01-04'.
// If the input was '2024-01-03 10:00:00', then it would not add 24h.
// The tests reflect this behavior.
