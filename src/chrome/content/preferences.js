"use strict";
// vim: ts=4 sw=4 sts=4
// @todo [6] [pref] Better strategy for getting the default editor: EDITOR env variable or view_source.editor.path
// @todo [8] [pref] Option to make the textarea uneditable when using editor.

/**
 * Open a filepicker to select the value of the editor.
 */
function pref_editor_select() {
    var locale = document.getElementById("itsalltext-strings"),
    pref_editor = document.getElementById('pref_editor'),
    nsIFilePicker = Components.interfaces.nsIFilePicker,
    fp,
    editor_file,
    rv,
    file,
    editor;

    fp = Components.classes["@mozilla.org/filepicker;1"].
        createInstance(nsIFilePicker);
    fp.init(
        window,
        locale.getString('picker.window.title'),
        nsIFilePicker.modeOpen
    );
    fp.appendFilters(nsIFilePicker.filterApps);

    try {
        editor_file = itsalltext.factoryFile(pref_editor.value);
        if (editor_file.parent.exists() && editor_file.parent.isDirectory()) {
            fp.displayDirectory = editor_file.parent;
        }
        if (editor_file.exists()) {
            fp.defaultString = editor_file.leafName;
        }
    } catch (e) {
        // Ignore error, the pref may not have been set or who knows.
    }

    rv = fp.show();
    if (rv == nsIFilePicker.returnOK) {
        file = fp.file;
        pref_editor.value = file.path;
        editor = document.getElementById('editor');
        editor.style.color = 'inherit';
        editor.style.backgroundColor = 'inherit';
    }
}

function pref_workingdir_select() {
    var locale = document.getElementById("itsalltext-strings"),
    pref_workingdir = document.getElementById('pref_workingdir'),
    nsIFilePicker = Components.interfaces.nsIFilePicker,
    fp,
    workingdir,
    rv,
    file,
    editor;

    fp = Components.classes["@mozilla.org/filepicker;1"].
        createInstance(nsIFilePicker);
    fp.init(
        window,
        locale.getString('workingdir.picker.window.title'),
        nsIFilePicker.modeGetFolder
    );

    try {
        workingdir = itsalltext.factoryFile(pref_workingdir.value);
        if (workingdir.exists() && workingdir.isDirectory()) {
            fp.displayDirectory = workingdir;
        }
    } catch (e) {
        // Ignore error, the pref may not have been set or who knows.
    }

    rv = fp.show();
    if (rv == nsIFilePicker.returnOK) {
        file = fp.file;
        pref_workingdir.value = file.path;
        workingdir = document.getElementById('workingdir');
        workingdir.style.color = 'inherit';
        workingdir.style.backgroundColor = 'inherit';
    }
}

function update_hotkey(disp) {
    var str,
    km = itsalltext.preferences.hotkey;
    if (typeof(km) === 'undefined') {
        setTimeout(function () {
            update_hotkey(disp);
        }, 100);
        return;
    }
    if (km === '') {
        str = '<none>';
    } else {
        str = itsalltext.keyMarshalToString(km);
    }
    document.getElementById(disp).value = str;
}

function pref_grab(disp, e) {
    e.preventDefault();
    var km  = itsalltext.marshalKeyEvent(e);
    const empty_re = /:0:0$/;
    if (
        empty_re.test(km)           // Various Alt/Meta keys
            || km === '0:0:0:0:0:8' // Backspace
        || km === '0:0:0:0:0:27'    // Escape
        || km === '0:0:0:0:0:46'    // Del
    ) {
        km = '';
    }
    itsalltext.preferences.private_set('hotkey', km);
    update_hotkey(disp);
}

function setHelp(text) {
    var help = document.getElementById('help'),
    textnode = document.createTextNode(text);
    while (help.firstChild) {
        help.removeChild(help.firstChild);
    }
    help.appendChild(textnode);
}

function pref_onload() {
    var locale = document.getElementById("itsalltext-strings"),
    editor,
    workingdir,
    box,
    desc,
    textnode;
    document.getElementById('browse').focus();
    if (window['arguments'] && window.arguments[0] && window.arguments[0] == 'badeditor') {
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
    if (window['arguments'] && window.arguments[1]) {
        var button = document.createElement('button');
        button.setAttribute('label', locale.getString('close.button'));
        button.addEventListener('command', function (event) { window.close(); }, true);

        var spacer = document.createElement('spacer');
        spacer.setAttribute('flex', 1);

        var box = document.createElement('hbox');
        box.appendChild(spacer);
        box.appendChild(button);

        var pane = document.getElementById('itsalltext-pane');
        pane.appendChild(box);
    }

    update_hotkey('disp-hotkey');
}
