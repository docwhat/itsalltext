// @todo [6] [pref] Better strategy for getting the default editor: EDITOR env variable or view_source.editor.path
// @todo [8] [pref] Option to make the textarea uneditable when using editor.

/**
 * Open a filepicker to select the value of the editor.
 */
function pref_editor_select() {
    var locale = document.getElementById("strings");

    var pref_editor = document.getElementById('pref_editor');
    var nsIFilePicker = Components.interfaces.nsIFilePicker;

    var fp = Components.classes["@mozilla.org/filepicker;1"].
        createInstance(nsIFilePicker);
    fp.init(window,
            locale.getString('picker.window.title'),
            nsIFilePicker.modeOpen);
    fp.appendFilters(nsIFilePicker.filterApps);

    var initdir = Components.classes["@mozilla.org/file/local;1"].
        createInstance(Components.interfaces.nsILocalFile);
    try {
        initdir.initWithPath(pref_editor.value);
        initdir = initdir.parent;
        if (initdir.exists() && initdir.isDirectory()) {
            fp.displayDirectory = initdir;
        }
    } catch(e) {
        // Ignore error, the pref may not have been set or who knows.
    }

    var rv = fp.show();
    var file;
    var editor;
    if (rv == nsIFilePicker.returnOK) {
        file = fp.file;
        pref_editor.value = file.path;
        editor = document.getElementById('editor');
        editor.style.color = 'inherit';
        editor.style.backgroundColor = 'inherit';
    }
}

function update_hotkey(disp) {
    var str, km = ItsAllText.preferences.hotkey;
    if (typeof(km) === 'undefined') {
        setTimeout(function () { update_hotkey(disp); }, 100);
        return;
    }
    if (km === '') {
        str = '<none>';
    } else {
        str = ItsAllText.keyMarshalToString(km);
    }
    document.getElementById(disp).value = str;
}

function pref_grab(disp, e) {
    e.preventDefault();
    var km  = ItsAllText.marshalKeyEvent(e);
    const empty_re = /:0:0$/;
    if (empty_re.test(km)    ||   // Various Alt/Meta keys
        km === '0:0:0:0:0:8' ||   // Backspace
        km === '0:0:0:0:0:27' ||  // Escape
        km === '0:0:0:0:0:46') {  // Del
        km = '';
    }
    ItsAllText.preferences.private_set('hotkey', km);
    update_hotkey(disp);
}

function setHelp(text) {
    var help = document.getElementById('help');
    while (help.firstChild) {
        help.removeChild(help.firstChild);
    }
    var textnode = document.createTextNode(text);
    help.appendChild(textnode);
}

function pref_onload() {
    var locale = document.getElementById("strings");
    document.getElementById('browse').focus();
    var editor;
    var box;
    var desc;
    var textnode;
    if (window['arguments'] && window['arguments'][0] && window['arguments'][0] == 'badeditor') {
        editor = document.getElementById('editor');
        editor.style.color = 'black';
        editor.style.backgroundColor = '#fb4';
        box = document.getElementById('help');
        // Clean it out
        while (box.firstChild) {
            box.removeChild(box.firstChild);
        }
        desc = document.createElement('description');
        textnode = document.createTextNode(locale.getFormattedString('problem.editor', [editor.value]));
        desc.appendChild(textnode);
        desc.style.maxWidth = '18em';
        box.appendChild(desc);

        desc = document.createElement('description');
        textnode = document.createTextNode(locale.getString('mac.hint'));
        desc.appendChild(textnode);
        desc.style.maxWidth = '18em';
        box.appendChild(desc);
    }

    update_hotkey('disp-hotkey');
}
