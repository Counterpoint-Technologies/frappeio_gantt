export default class SideView {
    constructor(gantt, options) {
        this.gantt = gantt;
        this.options = options || {};
    }

    render() {
        this.setup_wrapper();
        this.render_header();
        this.render_rows();
    }

    setup_wrapper() {
        if (!this.$wrapper) {
            this.$wrapper = document.createElement('div');
            this.$wrapper.classList.add('gantt-side-view');
            this.gantt.$split_wrapper.prepend(this.$wrapper);
        }
        this.$wrapper.innerHTML = '';
    }

    render_header() {
        this.$header = document.createElement('div');
        this.$header.classList.add('gantt-side-header-row');
        this.$header.style.height = (this.gantt.config.header_height - 1) + 'px'; // -1 for border

        const title = document.createElement('div');
        title.classList.add('gantt-side-header-title');
        title.textContent = 'Name';
        this.$header.appendChild(title);

        this.$wrapper.appendChild(this.$header);
    }

    render_rows() {
        this.$rows_container = document.createElement('div');
        this.$rows_container.classList.add('gantt-side-content');

        // Sync height logic from gantt grid
        // The gantt grid body height starts after the header.

        this.gantt.tasks.forEach(task => {
            const row = document.createElement('div');
            row.classList.add('gantt-side-row');
            row.setAttribute('data-id', task.id);
            row.style.height = (this.gantt.options.bar_height + this.gantt.options.padding) + 'px';

            // Indentation
            const indent = document.createElement('div');
            indent.style.width = (task.level * 20) + 'px';
            indent.classList.add('gantt-side-indent');
            row.appendChild(indent);

            // Toggle
            const toggle = document.createElement('div');
            toggle.classList.add('gantt-side-toggle');
            if (task.children && task.children.length > 0) {
                toggle.textContent = task.isCollapsed ? '▶' : '▼';
                toggle.classList.add('has-children');
                toggle.onclick = (e) => {
                    e.stopPropagation();
                    this.gantt.toggle_collapse(task.id);
                };
            }
            row.appendChild(toggle);

            // Name
            const name = document.createElement('div');
            name.classList.add('gantt-side-text');
            name.textContent = task.name;
            row.appendChild(name);

            this.$rows_container.appendChild(row);
        });

        this.$wrapper.appendChild(this.$rows_container);
    }

    sync_scroll(scrollTop) {
        if (this.$rows_container) {
            this.$rows_container.scrollTop = scrollTop;
        }
    }
}
