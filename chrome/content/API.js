/*
  This file is used to allow external editors to work inside your chrome XUL.

  ***** How To Use This API *****
  Add this script line to your .xul file:
  <script type="application/javascript" src="chrome://itsalltext/content/API.js"/>

  If "It's All Text!" isn't installed in the browser, it will fail safely.
  It only generates an info message in the error console.

  Then you need to create a way to call ItsAllText.openEditor().
  Usage:
    ItsAllText.openEditor('id-of-your-textbox');
      or
    ItsAllText.openEditor('id-of-your-textbox', '.extension');
  The string 'id-of-your-textbox' should be the id of the textbox
  you want to be editable.
  The optional string '.extension' should be the suggested extension
  for the textfile. Include the dot at the beginning.

  If you don't want your button or menu item to show up when It's All Text!
  isn't installed, then give it the class "ShowForItsAllText" and set
  the style to 'none'.

  Example:
      <hbox>
        <spacer flex="1"/>
        <button label="It's All Text!" class="ShowForItsAllText" style="display: none;" oncommand="ItsAllText.openEditor('code', '.c');"/>
      </hbox>

 */

(function () {
    /* Load up the main It's All Text! file */
    var objScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    objScriptLoader.loadSubScript('chrome://itsalltext/content/itsalltext.js');

    var onload = function (event) {
        /* Start watching the document, but force it. */
        ItsAllText.monitor.watch(document, true);

        /* Turn on all the hidden CSS */
        var nodes = [];
        var nodesIter = document.evaluate("//node()[@class]", document, null, XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null); 
        var node = nodesIter.iterateNext(); 
        while (node) {
            nodes.push(node);
            node = nodesIter.iterateNext();
        }
        for(i in nodes) {
            node = nodes[i];
            var classes = node.className.split(/ +/);
            for(i in classes) {
                if(classes[i] == "ShowForItsAllText") {
                    node.style.display = '-moz-box';
                    break;
                }
            }
        }

    };
    window.addEventListener("load", onload, true);
})();

/**
 * This is part of the public XUL API.
 * Use this to open an editor for a specific textarea or textbox with
 * the id 'id'.  The file will have the extension 'extension'.  Include 
 * the leading dot in the extension.
 * @param {String} id The id of textarea or textbody that should be opened in the editor.
 * @param {String} extension The extension of the file used as a temporary file. Example: '.css' (optional) 
 */
ItsAllText.openEditor = function(id, extension) {
    var node = document.getElementById(id);
    /* The only way I can adjust the background of the textbox is
     * to turn off the -moz-appearance attribute.
     */
    node.style.MozAppearance = 'none';
    var cache_object = node && ItsAllText.getCacheObj(node);
    if(!cache_object) { return; }
    cache_object.edit(extension);
};

