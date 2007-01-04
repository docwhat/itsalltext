// @todo The prefereces dialog should have a filepicker: http://developer.mozilla.org/en/docs/nsIFilePicker
// @todo If the editor fails, we should open preferences. (!)
// @todo MacOSX: add support for "open -a <app> <file>". (!)


/**
 * Open a filepicker to select the value of the editor.
 */
function pref_editor_select() {
  var tb = document.getElementById('editor');
  
  // Note: If jslint could, we'd use const here
  var nsIFilePicker = Components.interfaces.nsIFilePicker;
 
  var fp = Components.classes["@mozilla.org/filepicker;1"].
    createInstance(nsIFilePicker);
  fp.init(window, "Choose your editor", nsIFilePicker.modeOpen);
  fp.appendFilters(nsIFilePicker.filterApps);

  var initdir = Components.classes["@mozilla.org/file/local;1"].
    createInstance(Components.interfaces.nsILocalFile);
  initdir.initWithPath('/usr/bin');
  if (initdir.exists() && initdir.isDirectory()) {
    fp.displayDirectory = initdir;
  }
  
  var rv = fp.show();
  if (rv == nsIFilePicker.returnOK) {
    var file = fp.file;
    tb.value = file.path;
  }
}
