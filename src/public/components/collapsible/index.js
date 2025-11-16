/**
 * Collapsible Component
 *
 * Usage:
 * <div data-collapsible="unique-id" data-collapsed="true">
 *     <div data-collapsible-trigger="unique-id">
 *         <!-- Trigger content (will show arrow icon) -->
 *     </div>
 *     <div data-collapsible-content="unique-id">
 *         <!-- Collapsible content -->
 *     </div>
 * </div>
 *
 * Attributes:
 * - data-collapsible: Container identifier
 * - data-collapsed: "true" for initially collapsed, "false" for initially expanded
 * - data-collapsible-trigger: Trigger element identifier (matches container)
 * - data-collapsible-content: Content element identifier (matches container)
 */

class CollapsibleManager {
    constructor() {
        this.collapsibles = new Map();
    }

    init() {
        const collapsibles = document.querySelectorAll('[data-collapsible]');

        collapsibles.forEach((container) => {
            const id = container.dataset.collapsible;
            const isCollapsed = container.dataset.collapsed !== 'false';

            const trigger = container.querySelector(`[data-collapsible-trigger="${id}"]`);
            const content = container.querySelector(`[data-collapsible-content="${id}"]`);

            if (!trigger || !content) {
                console.warn(`Collapsible ${id} is missing trigger or content element`);
                return;
            }

            // Set initial state
            if (isCollapsed) {
                trigger.classList.remove('expanded');
                content.classList.remove('expanded');
            } else {
                trigger.classList.add('expanded');
                content.classList.add('expanded');
            }

            // Store reference
            this.collapsibles.set(id, {
                container,
                trigger,
                content,
                isExpanded: !isCollapsed,
            });

            // Add click listener
            trigger.addEventListener('click', (e) => {
                // Don't toggle if clicking on interactive elements within the trigger
                if (e.target.closest('button, a, input, select')) {
                    return;
                }
                this.toggle(id);
            });
        });
    }

    toggle(id) {
        const collapsible = this.collapsibles.get(id);
        if (!collapsible) return;

        const { trigger, content, isExpanded } = collapsible;

        if (isExpanded) {
            this.collapse(id);
        } else {
            this.expand(id);
        }
    }

    expand(id) {
        const collapsible = this.collapsibles.get(id);
        if (!collapsible) return;

        const { trigger, content, container } = collapsible;

        trigger.classList.add('expanded');
        content.classList.add('expanded');
        container.dataset.collapsed = 'false';

        collapsible.isExpanded = true;
    }

    collapse(id) {
        const collapsible = this.collapsibles.get(id);
        if (!collapsible) return;

        const { trigger, content, container } = collapsible;

        trigger.classList.remove('expanded');
        content.classList.remove('expanded');
        container.dataset.collapsed = 'true';

        collapsible.isExpanded = false;
    }

    // Add a new collapsible dynamically
    register(id, collapsed = true) {
        const container = document.querySelector(`[data-collapsible="${id}"]`);
        if (!container) return;

        const trigger = container.querySelector(`[data-collapsible-trigger="${id}"]`);
        const content = container.querySelector(`[data-collapsible-content="${id}"]`);

        if (!trigger || !content) return;

        // Set initial state
        container.dataset.collapsed = String(collapsed);
        if (collapsed) {
            trigger.classList.remove('expanded');
            content.classList.remove('expanded');
        } else {
            trigger.classList.add('expanded');
            content.classList.add('expanded');
        }

        // Store reference
        this.collapsibles.set(id, {
            container,
            trigger,
            content,
            isExpanded: !collapsed,
        });

        // Add click listener
        trigger.addEventListener('click', (e) => {
            if (e.target.closest('button, a, input, select')) {
                return;
            }
            this.toggle(id);
        });
    }

    // Remove a collapsible
    unregister(id) {
        this.collapsibles.delete(id);
    }

    // Expand all
    expandAll() {
        this.collapsibles.forEach((_, id) => this.expand(id));
    }

    // Collapse all
    collapseAll() {
        this.collapsibles.forEach((_, id) => this.collapse(id));
    }
}

// Create global instance
const CollapsibleManagerInstance = new CollapsibleManager();

// Auto-initialize on DOMContentLoaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        CollapsibleManagerInstance.init();
    });
} else {
    CollapsibleManagerInstance.init();
}

// Export for use in other scripts
window.CollapsibleManager = CollapsibleManagerInstance;
