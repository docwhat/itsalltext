// @todo The prefereces dialog should have a filepicker: http://developer.mozilla.org/en/docs/nsIFilePicker
// @todo If the editor fails, we should open preferences. (!)
// @todo MacOSX: add support for "open -a <app> <file>". (!)


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
  }
}
