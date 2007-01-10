
/**
 * Open a filepicker to select the value of the editor.
 */
function pref_editor_select() {  
  // Note: If jslint could, we'd use const here
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
 
  var fp = Components.classes["@mozilla.org/filepicker;1"].
    createInstance(nsIFilePicker);
  fp.init(window, "Choose your editor", nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterApps);

  var initdir = Components.classes["@mozilla.org/file/local;1"].
    createInstance(Components.interfaces.nsILocalFile);
  try {
    initdir.initWithPath('/usr/bin');
    if (initdir.exists() && initdir.isDirectory()) {
      fp.displayDirectory = initdir;
    }
  } catch(e) {
    // Ignore error - /usr/bin only useful for unix boxen.
  }
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    var file = fp.file;
    var pref_editor = document.getElementById('pref_editor');
    pref_editor.value = file.path;
    var editor = document.getElementById('editor');
    editor.style.color = 'inherit';
    editor.style.backgroundColor = 'inherit';
  }
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
  document.getElementById('browse').focus();
  if (window['arguments'] && window['arguments'][0] && window['arguments'][0] == 'badeditor') {
    var editor = document.getElementById('editor');
    editor.style.color = 'black';
    editor.style.backgroundColor = '#fb4';
    setHelp("I was unable to run your editor, '"+editor.value+"'.  You the browse button to choose another editor and try again.");
  }
}
