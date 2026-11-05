var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
navigator.saveBlob = navigator.saveBlob || navigator.msSaveBlob || navigator.mozSaveBlob || navigator.webkitSaveBlob;
window.saveAs = window.saveAs || window.webkitSaveAs || window.mozSaveAs || window.msSaveAs;

// Because highlight.js is a bit awkward at times
var languageOverrides = {
    js: 'javascript',
    html: 'xml'
};

var livestyles;

emojify.setConfig({
    img_dir: 'emoji'
});

var md = markdownit({
        html: true,
        highlight: function(code, lang) {
            if (languageOverrides[lang]) lang = languageOverrides[lang];
            if (lang && hljs.getLanguage(lang)) {
                try {
                    return hljs.highlight(lang, code).value;
                } catch (e) {}
            }
            return '';
        }
    })
    .use(markdownitFootnote);

var hashto;
var sharePanel = document.getElementById('share-panel');

function update(e, change) {
    if (!sharePanel.hidden) closeShareLink(false);
    setOutput(e.getValue(), change && change.origin === 'setValue');

    //If a title is added to the document it will be the new document.title, otherwise use default
    var headerElements = document.querySelectorAll('h1');
    if (headerElements.length > 0 && headerElements[0].textContent.length > 0) {
        title = headerElements[0].textContent;
    } else {
        title = 'Markdown Editor'
    }

    //To avoid to much title changing we check if is not the same as before
    oldTitle = document.title;
    if (oldTitle != title) {
        oldTitle = title;
        document.title = title;
    }
    //clearTimeout(hashto);
    //hashto = setTimeout(updateHash, 1000);
}

/*
This function is used to check for task list notation.
If regex matches the string to task-list markdown format,
then the task-list is rendered to its correct form.
User: @austinmm
*/
var render_tasklist = function(str){
    // Checked task-list box match
	if(str.match(/<li>\[x\]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[x\]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
          checked style="list-style-type: none; 
          margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    // Unchecked task-list box match
    if (str.match(/<li>\[ \]\s+\w+/gi)){
        str = str.replace(/(<li)(>\[ \]\s+)(\w+)/gi, 
          `$1 style="list-style-type: none;"><input type="checkbox" 
            style="list-style-type: none; 
            margin: 0 0.2em 0 -1.3em;" disabled> $3`);
    }
    return str
}

function setOutput(val, resetScroll) {
    val = val.replace(/<equation>((.*?\n)*?.*?)<\/equation>/ig, function(a, b) {
        return '<img src="http://latex.codecogs.com/png.latex?' + encodeURIComponent(b) + '" />';
    });

    var out = document.getElementById('out');
    var previous = resetScroll ? [] : Array.from(out.children);
    var scrollTop = out.scrollTop;
    out.innerHTML = render_tasklist(md.render(val));
    emojify.run(out);
    out.scrollTop = resetScroll ? 0 : scrollTop;
    if (!previous.length) return;

    for (var i = 0; i < out.children.length; i++) {
        var block = out.children[i];
        if (previous[i] && previous[i].isEqualNode(block)) continue;
        var bounds = block.getBoundingClientRect();
        var viewport = out.getBoundingClientRect();
        if (bounds.bottom <= viewport.top || bounds.top >= viewport.bottom) {
            out.scrollTop += bounds.top - viewport.top - 12;
        }
        break;
    }
}

CodeMirrorSpellChecker({
    codeMirrorInstance: CodeMirror,
});

var editor = CodeMirror.fromTextArea(document.getElementById('code'), {
    mode: "spell-checker",
    backdrop: "gfm",
    lineNumbers: false,
    matchBrackets: true,
    lineWrapping: true,
    theme: 'base16-light',
    extraKeys: {
        "Enter": "newlineAndIndentContinueMarkdownList"
    }
});

editor.on('change', update);

function selectionChanger(selection,operator,endoperator){
    if(selection == ""){
        return operator;
    }
    if(!endoperator){
        endoperator = operator
    }
    var isApplied = selection.length >= operator.length + endoperator.length &&
        selection.startsWith(operator) && selection.endsWith(endoperator);
    var finaltext = isApplied ? selection.slice(operator.length, -endoperator.length) : operator + selection + endoperator;
    return finaltext;
}

editor.addKeyMap({
    // bold
    'Ctrl-B': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'**'));
    },
    // italic
    'Ctrl-I': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'_'));
    },
    // code
    'Ctrl-K': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'`'));
    },
    // keyboard shortcut
    'Ctrl-L': function(cm) {
        cm.replaceSelection(selectionChanger(cm.getSelection(),'<kbd>','</kbd>'));
    }
});

var pendingFileReader;

function readDocumentFile(file) {
    if (!file) return;
    if (pendingFileReader && pendingFileReader.readyState === FileReader.LOADING) pendingFileReader.abort();
    var reader = new FileReader();
    pendingFileReader = reader;
    reader.onload = function() {
        if (pendingFileReader === reader) editor.setValue(reader.result);
    };
    reader.onerror = function() {
        swal('Could not open file', file.name, 'error');
    };
    reader.readAsText(file);
}

document.addEventListener('dragover', function(e) {
    if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1) e.preventDefault();
});
document.addEventListener('drop', function(e) {
    if (!e.dataTransfer || !e.dataTransfer.files.length) return;
    e.preventDefault();
    readDocumentFile(e.dataTransfer.files[0]);
});

//Print the document named as the document title encoded to avoid strange chars and spaces
function saveAsMarkdown() {
    save(editor.getValue(), document.title.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/\s]/gi, '') + ".md");
}

//Print the document named as the document title encoded to avoid strange chars and spaces
function saveAsHtml() {
    save(document.getElementById('out').innerHTML, document.title.replace(/[`~!@#$%^&*()_|+\-=?;:'",.<>\{\}\[\]\\\/\s]/gi, '') + ".html");
}

document.getElementById('saveas-markdown').addEventListener('click', function() {
    saveAsMarkdown();
    hideMenu();
});

document.getElementById('saveas-html').addEventListener('click', function() {
    saveAsHtml();
    hideMenu();
});

function save(code, name) {
    var blob = new Blob([code], {
        type: 'text/plain'
    });
    if (window.saveAs) {
        window.saveAs(blob, name);
    } else if (navigator.saveBlob) {
        navigator.saveBlob(blob, name);
    } else {
        url = URL.createObjectURL(blob);
        var link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", name);
        var event = document.createEvent('MouseEvents');
        event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        link.dispatchEvent(event);
    }
}

var menuVisible = false;
var menu = document.getElementById('menu');

var actionLabels = {openbutton:'Open', savebutton:'Download', browsersavebutton:'Save', sharebutton:'Share', nightbutton:'Night', readbutton:'Reading', spellbutton:'Spelling'};
Object.keys(actionLabels).forEach(function(id) {
    var old = document.getElementById(id);
    var button = document.createElement('button');
    Array.from(old.attributes).forEach(function(attr) { button.setAttribute(attr.name, attr.value); });
    button.innerHTML = old.innerHTML + '<span>' + actionLabels[id] + '</span>';
    button.setAttribute('aria-label', old.title);
    button.firstElementChild.setAttribute('aria-hidden', 'true');
    old.parentNode.replaceChild(button, old);
    if (['nightbutton','readbutton','spellbutton'].indexOf(id) >= 0) {
        button.setAttribute('aria-pressed', button.classList.contains('selected'));
        button.addEventListener('click', function() { button.setAttribute('aria-pressed', button.classList.contains('selected')); });
    }
});
['saveas-markdown','saveas-html'].forEach(function(id) {
    var option = document.getElementById(id);
    option.tabIndex = 0;
    option.setAttribute('role','button');
    option.onkeydown = function(e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); option.click(); }
    };
});
function showMenu() {
    document.getElementById('workspace').inert = true;
    document.getElementById('navbar').inert = true;
    menuVisible = true;
    menu.style.display = 'block';
    document.getElementById('saveas-markdown').focus();
}

function hideMenu() {
    menuVisible = false;
    menu.style.display = 'none';
    document.getElementById('workspace').inert = false;
    document.getElementById('navbar').inert = false;
    document.getElementById('savebutton').focus();
}

function openFile(evt) {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
        readDocumentFile(evt.target.files[0]);
        evt.target.value = '';

    } else {
        alert('The File APIs are not fully supported in this browser.');
    }
}

document.getElementById('close-menu').addEventListener('click', function() {
    hideMenu();
});

document.addEventListener('keydown', function(e) {
    if (e.keyCode == 83 && (e.ctrlKey || e.metaKey)) {
        if (!e.shiftKey && localStorage.getItem('content') == editor.getValue()) {
            e.preventDefault();
            return false;
        }
        e.shiftKey ? showMenu() : saveInBrowser();

        e.preventDefault();
        return false;
    }

    if (e.keyCode === 27 && menuVisible) {
        hideMenu();

        e.preventDefault();
        return false;
    }
});

function clearEditor() {
    editor.setValue("");
}

function saveInBrowser() {
    var text = editor.getValue();
    if (localStorage.getItem('content') !== null) {
        swal({
                title: "Existing Data Detected",
                text: "You will overwrite the data previously saved!",
                type: "warning",
                showCancelButton: true,
                confirmButtonColor: "#DD6B55",
                confirmButtonText: "Yes, overwrite!",
                closeOnConfirm: false
            },
            function(confirmed) {
                if (confirmed === false) return;
                localStorage.setItem('content', text);
                swal("Saved", "Your Document has been saved.", "success");
            });
    } else {
        localStorage.setItem('content', text);
        swal("Saved", "Your Document has been saved.", "success");
    }
}

function toggleNightMode(button) {
    button.classList.toggle('selected');
    document.getElementById('toplevel').classList.toggle('nightmode');
}

function toggleReadMode(button) {
    button.classList.toggle('selected');
    document.getElementById('out').classList.toggle('focused');
    document.getElementById('in').classList.toggle('hidden');
    if (!button.classList.contains('selected')) editor.refresh();
}

function toggleSpellCheck(button) {
    button.classList.toggle('selected');
    document.body.classList.toggle('no-spellcheck');
}

function updateHash() {
    window.location.hash = btoa( // base64 so url-safe
        RawDeflate.deflate( // gzip
            unescape(encodeURIComponent( // convert to utf8
                editor.getValue()
            ))
        )
    );
}

function closeShareLink(restoreFocus) {
    sharePanel.hidden = true;
    var button = document.getElementById('sharebutton');
    button.setAttribute('aria-expanded', 'false');
    if (restoreFocus) button.focus();
    editor.refresh();
}

function toggleShareLink() {
    if (!sharePanel.hidden) {
        closeShareLink(true);
        return;
    }
    updateHash();
    var field = document.getElementById('share-url');
    field.value = window.location.href;
    sharePanel.hidden = false;
    document.getElementById('sharebutton').setAttribute('aria-expanded', 'true');
    field.focus();
    field.select();
    editor.refresh();
}

document.getElementById('close-share').onclick = function() { closeShareLink(true); };
sharePanel.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        e.preventDefault();
        closeShareLink(true);
    }
});

function processQueryParams() {
    var params = window.location.search.split('?')[1];
    if (window.location.hash) {
        document.getElementById('readbutton').click(); // Show reading view
    }
    if (params) {
        var obj = {};
        params.split('&').forEach(function(elem) {
            obj[elem.split('=')[0]] = elem.split('=')[1];
        });
        if (obj.reading === 'false' && document.getElementById('readbutton').classList.contains('selected')) {
            document.getElementById('readbutton').click(); // Hide reading view
        }
        if (obj.dark === 'true') {
            document.getElementById('nightbutton').click(); // Show night view
        }
    }
}

function start() {
    processQueryParams();
    if (window.location.hash) {
        var h = window.location.hash.replace(/^#/, '');
        if (h.slice(0, 5) === 'view:') h = h.slice(5);
        editor.setValue(decodeURIComponent(escape(RawDeflate.inflate(atob(h)))));
    } else if (localStorage.getItem('content') !== null) {
        editor.setValue(localStorage.getItem('content'));
    }
    update(editor);
    if (!matchMedia('(pointer: coarse)').matches && !document.getElementById('in').classList.contains('hidden')) editor.focus();
    document.getElementById('fileInput').addEventListener('change', openFile, false);
}

window.addEventListener("beforeunload", function (e) {
    if (!editor.getValue() || editor.getValue() == localStorage.getItem('content')) {
        return;
    }
    var confirmationMessage = 'It looks like you have been editing something. '
                            + 'If you leave before saving, your changes will be lost.';
    (e || window.event).returnValue = confirmationMessage; //Gecko + IE
    return confirmationMessage; //Gecko + Webkit, Safari, Chrome etc.
});

start();
