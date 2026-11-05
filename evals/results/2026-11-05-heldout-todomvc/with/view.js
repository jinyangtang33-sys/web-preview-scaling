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
        var message = qs('.no-matches span', this.$main);
        if (message) message.textContent = currentPage === 'completed' ? 'No completed tasks.' : 'No active tasks.';
        qsa('.filters a').forEach(function (link) {
            var selected = link.hash === '#/' + currentPage;
            link.classList.toggle('selected', selected);
            if (selected) link.setAttribute('aria-current', 'page');
            else link.removeAttribute('aria-current');
        });
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

        var editor = document.createElement('form');
        editor.className = 'task-editor';
        this._replaceContentWithHtml(editor,
            '<input class="edit" aria-label="Edit task" enterkeyhint="done">' +
            '<small class="edit-hint">An empty title deletes this task.</small>' +
            '<button class="save-edit" type="submit">Save</button>' +
            '<button class="cancel-edit" type="button">Cancel</button>');
        var input = qs('.edit', editor);
        var hint = qs('.edit-hint', editor);
        hint.id = 'edit-hint-' + id;
        input.setAttribute('aria-describedby', hint.id);
        input.value = title;
        listItem.appendChild(editor);
        input.focus();
        input.setSelectionRange(title.length, title.length);
    };

    View.prototype._editItemDone = function (id, title) {
        var listItem = qs(`[data-id="${id}"]`);

        if (!listItem)
            return;

        var editor = qs('.task-editor', listItem);
        if (editor) listItem.removeChild(editor);

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
                self.$main.style.display = parameter.visible || parameter.filtered ? 'block' : 'none';
                self.$footer.style.display = parameter.visible ? 'block' : 'none';
                self.$toggleAllInput.style.display = self.$toggleAll.style.display = parameter.visible ? '' : 'none';
            },
            toggleAll: function () {
                self.$toggleAllInput.checked = parameter.checked;
                self.$toggleAllInput.indeterminate = Boolean(parameter.mixed);
                self.$toggleAll.textContent = parameter.checked ? 'Uncheck all' : 'Complete all';
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
        var rows = this.$todoList.children;
        var index = Array.prototype.indexOf.call(rows, $parent(control, 'li'));
        var hadFocus = document.activeElement === control;
        handler(item);
        if (!hadFocus || this.$todoList.contains(control)) return;

        var row = rows[Math.min(index, rows.length - 1)];
        var next = row ? qs('.toggle', row) : qs('.no-matches a', this.$main);
        (next && next.getClientRects().length ? next : this.$newTodo).focus();
    };

    View.prototype._finishEdit = function (editor, handler, returnFocus) {
        if (editor.dataset.finishing) return;
        editor.dataset.finishing = 'true';
        var id = this._itemId(editor);
        handler({ id: id, title: qs('.edit', editor).value });
        if (returnFocus) {
            var button = qs('[data-id="' + id + '"] .edit-task', this.$todoList);
            (button || this.$newTodo).focus();
        }
    };

    View.prototype._bindItemEditDone = function (handler) {
        var self = this;
        $delegate(self.$todoList, '.task-editor button', 'pointerdown', function (event) {
            // Keep the input focused until the tapped action handles the edit.
            event.preventDefault();
        });
        $delegate(self.$todoList, '.task-editor input, .task-editor button', 'blur', function (event) {
            var editor = this.form;
            if (!editor.contains(event.relatedTarget)) self._finishEdit(editor, handler, false);
        });
        $delegate(self.$todoList, '.task-editor', 'submit', function (event) {
            event.preventDefault();
            self._finishEdit(this, handler, true);
        });

        $delegate(self.$todoList, "li .edit", "keypress", function (event) {
            if (!event.isComposing && event.keyCode === self.ENTER_KEY) {
                event.preventDefault();
                self._finishEdit(this.form, handler, true);
            }
        });
    };

    View.prototype._bindItemEditCancel = function (handler) {
        var self = this;
        $delegate(self.$todoList, '.cancel-edit', 'click', function () {
            self._finishEdit(this.form, handler, true);
        });
        $delegate(self.$todoList, '.task-editor input, .task-editor button', 'keyup', function (event) {
            if (!event.isComposing && event.keyCode === self.ESCAPE_KEY)
                self._finishEdit(this.form, handler, true);
        });
    };

    View.prototype.bind = function (event, handler) {
        var self = this;
        if (event === "newTodo") {
            var input = self.$newTodo;
            var error = qs('#entry-error');
            var addedOnChange = false;
            function showError(invalid) {
                input.setAttribute('aria-invalid', String(invalid));
                if (error) error.textContent = invalid ? 'Enter a task description.' : '';
            }
            $on(input, 'input', function () {
                addedOnChange = false;
                if (input.value.trim()) showError(false);
            });
            $on(input, 'focus', function () { addedOnChange = false; });
            $on(input, 'change', function () {
                addedOnChange = Boolean(input.value.trim());
                showError(!addedOnChange);
                if (addedOnChange) handler(input.value);
            });
            if (self.$newTodo.form) {
                $on(self.$newTodo.form, 'submit', function (event) {
                    event.preventDefault();
                    // Clicking Add can commit the field's change before submit fires.
                    showError(!input.value.trim() && !addedOnChange);
                    if (input.value.trim()) handler(input.value);
                    addedOnChange = false;
                    input.focus();
                });
            }
        } else if (event === "removeCompleted") {
            $on(self.$clearCompleted, "click", function () {
                handler();
            });
        } else if (event === "toggleAll") {
            $on(self.$toggleAllInput, "change", function () {
                handler({ completed: self.$toggleAllInput.checked });
            });
        } else if (event === "itemEdit") {
            $delegate(self.$todoList, '.edit-task', 'click', function () {
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
