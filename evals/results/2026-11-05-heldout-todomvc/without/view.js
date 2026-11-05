/* global qs, qsa, $on, $parent, $delegate */

(function (window) {
    "use strict";

    /**
     * View that abstracts away the browser's DOM completely.
     * It has two simple entry points:
     *
     *   - bind(eventName, handler)
     *     Takes a todo application event and registers the handler
     *   - render(command, parameterObject)
     *     Renders the given command with the options
     */
    function View(template) {
        this.template = template;

        this.ENTER_KEY = 13;
        this.ESCAPE_KEY = 27;

        this.$todoList = qs(".todo-list");
        this.$todoItemCounter = qs(".todo-count");
        this.$clearCompleted = qs(".clear-completed");
        this.$main = qs(".main");
        this.$footer = qs(".footer");
        this.$toggleAllInput = qs(".toggle-all");
        this.$toggleAll = qs(".toggle-all-label");
        this.$newTodo = qs(".new-todo");
    }

    View.prototype._removeItem = function (id) {
        var elem = qs(`[data-id="${id}"]`);

        if (elem)
            this.$todoList.removeChild(elem);
    };

    View.prototype._clearCompletedButton = function (completedCount, visible) {
        this.$clearCompleted.textContent = this.template.clearCompletedButton(completedCount);
        this.$clearCompleted.style.display = visible ? "block" : "none";
    };

    View.prototype._setFilter = function (currentPage) {
        var previous = qs(".filters .selected");
        var current = qs(`.filters [href="#/${currentPage}"]`);
        previous.classList.remove("selected");
        previous.removeAttribute("aria-current");
        current.classList.add("selected");
        current.setAttribute("aria-current", "page");
        var emptyMessage = qs(".filter-empty");
        if (emptyMessage)
            emptyMessage.textContent = currentPage ? "No " + currentPage + " tasks." : "";
    };

    View.prototype._elementComplete = function (id, completed) {
        var listItem = qs(`[data-id="${id}"]`);

        if (!listItem)
            return;

        listItem.className = completed ? "completed" : "";

        // In case it was toggled from an event and not by clicking the checkbox
        qs("input", listItem).checked = completed;
    };

    View.prototype._editItem = function (id, title) {
        var listItem = qs(`[data-id="${id}"]`);

        if (!listItem)
            return;

        listItem.className = `${listItem.className} editing`;

        var input = document.createElement("input");
        input.className = "edit";
        input.setAttribute("aria-label", "Edit task");
        input.setAttribute("enterkeyhint", "done");

        input.value = title;
        listItem.insertBefore(input, qs(".edit-actions", listItem));
        input.focus();
    };

    View.prototype._editItemDone = function (id, title) {
        var listItem = qs(`[data-id="${id}"]`);

        if (!listItem)
            return;

        var input = qs("input.edit", listItem);
        listItem.removeChild(input);

        listItem.className = listItem.className.replace("editing", "");

        qsa("label", listItem).forEach(function (label) {
            label.textContent = title;
        });
    };

    View.prototype._replaceContentWithHtml = function (element, html) {
        const parsedDocument = new DOMParser().parseFromString(html, "text/html");
        element.replaceChildren(...parsedDocument.body.childNodes);
    };

    View.prototype.render = function (viewCmd, parameter) {
        var self = this;
        var viewCommands = {
            showEntries: function () {
                self._replaceContentWithHtml(self.$todoList, self.template.show(parameter));
            },
            removeItem: function () {
                self._removeItem(parameter);
            },
            updateElementCount: function () {
                self._replaceContentWithHtml(self.$todoItemCounter, self.template.itemCounter(parameter));
            },
            clearCompletedButton: function () {
                self._clearCompletedButton(parameter.completed, parameter.visible);
            },
            contentBlockVisibility: function () {
                self.$main.style.display = parameter.visible ? "block" : "none";
                self.$footer.style.display = parameter.visible ? "grid" : "none";
            },
            toggleAll: function () {
                self.$toggleAllInput.checked = parameter.checked;
                self.$toggleAllInput.indeterminate = !!parameter.indeterminate;
                self.$toggleAll.textContent = parameter.checked ? "Mark all active" : "Mark all complete";
            },
            setFilter: function () {
                self._setFilter(parameter);
            },
            clearNewTodo: function () {
                self.$newTodo.value = "";
            },
            elementComplete: function () {
                self._elementComplete(parameter.id, parameter.completed);
            },
            editItem: function () {
                self._editItem(parameter.id, parameter.title);
            },
            editItemDone: function () {
                self._editItemDone(parameter.id, parameter.title);
            },
        };

        viewCommands[viewCmd]();
    };

    View.prototype._itemId = function (element) {
        var li = $parent(element, "li");
        return parseInt(li.dataset.id, 10);
    };

    View.prototype._runRowAction = function (control, handler, item) {
        var focused = document.activeElement === control;
        var rows = this.$todoList.children;
        var index = Array.prototype.indexOf.call(rows, $parent(control, "li"));
        handler(item);

        if (focused && !this.$todoList.contains(control)) {
            var nextRow = rows[Math.min(index, rows.length - 1)];
            if (nextRow)
                qs(".toggle", nextRow).focus();
            else if (this.$footer.style.display === "none")
                this.$newTodo.focus();
            else
                qs(".filters .selected").focus();
        }
    };

    View.prototype._finishEdit = function (event, handler, cancel) {
        var row = $parent(event.target, "li");
        var input = qs(".edit", row);
        if (!input || input.dataset.finishing)
            return;

        // Tabbing between the field, Save and Cancel keeps the editor open.
        if (event.type === "blur" && row.contains(event.relatedTarget))
            return;

        input.dataset.finishing = "true";
        var item = { id: this._itemId(input) };
        if (!cancel)
            item.title = input.value;
        handler(item);

        if (event.type !== "blur") {
            var next = this.$todoList.contains(row) && qs(".edit-task", row);
            (next || this.$newTodo).focus();
        }
    };

    View.prototype._bindItemEditDone = function (handler) {
        var self = this;
        function save(event) {
            self._finishEdit(event, handler, false);
        }
        $delegate(self.$todoList, "li .edit, .edit-actions button", "blur", save);
        $delegate(self.$todoList, ".save-edit", "click", save);
        // Keep pointer presses from committing on blur before the button click.
        $delegate(self.$todoList, ".edit-actions button", "pointerdown", function (event) {
            event.preventDefault();
        });

        $delegate(self.$todoList, "li .edit", "keypress", function (event) {
            if (!event.isComposing && (event.key === "Enter" || event.keyCode === self.ENTER_KEY)) {
                event.preventDefault();
                save(event);
            }
        });
    };

    View.prototype._bindItemEditCancel = function (handler) {
        var self = this;
        function cancel(event) {
            self._finishEdit(event, handler, true);
        }
        $delegate(self.$todoList, ".cancel-edit", "click", cancel);
        $delegate(self.$todoList, "li .edit, .edit-actions button", "keyup", function (event) {
            if (!event.isComposing && (event.key === "Escape" || event.keyCode === self.ESCAPE_KEY))
                cancel(event);
        });
    };

    View.prototype.bind = function (event, handler) {
        var self = this;
        if (event === "newTodo") {
            $on(self.$newTodo.form, "submit", function (event) {
                event.preventDefault();
                if (self.$newTodo.value.trim()) handler(self.$newTodo.value);
                self.$newTodo.focus();
            });
            $on(self.$newTodo, "change", function () {
                handler(self.$newTodo.value);
            });
        } else if (event === "removeCompleted") {
            $on(self.$clearCompleted, "click", function () {
                var focused = document.activeElement === self.$clearCompleted;
                handler();
                if (focused && self.$clearCompleted.style.display === "none") {
                    var target = self.$footer.style.display === "none" ? self.$newTodo : qs(".filters .selected");
                    target.focus();
                }
            });
        } else if (event === "toggleAll") {
            $on(self.$toggleAllInput, "change", function () {
                handler({ completed: self.$toggleAllInput.checked });
            });
        } else if (event === "itemEdit") {
            $delegate(self.$todoList, ".edit-task", "click", function () {
                handler({ id: self._itemId(this) });
            });
            $delegate(self.$todoList, "li label", "dblclick", function () {
                handler({ id: self._itemId(this) });
            });
        } else if (event === "itemRemove") {
            $delegate(self.$todoList, ".destroy", "click", function () {
                self._runRowAction(this, handler, { id: self._itemId(this) });
            });
        } else if (event === "itemToggle") {
            $delegate(self.$todoList, ".toggle", "click", function () {
                self._runRowAction(this, handler, {
                    id: self._itemId(this),
                    completed: this.checked,
                });
            });
        } else if (event === "itemEditDone") {
            self._bindItemEditDone(handler);
        } else if (event === "itemEditCancel") {
            self._bindItemEditCancel(handler);
        }
    };

    // Export to window
    window.app = window.app || {};
    window.app.View = View;
})(window);
