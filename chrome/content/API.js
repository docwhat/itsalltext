/*
  This file is used to allow external editors to work inside your XUL chrome://

  ***** How To Use This API *****
  At the top of your .xul file, put this script line:
  <script type="application/javascript" src="chrome://itsalltext/content/API.js"/>

  It will fail with only an info message in the Error Console
  if It's All Text! doesn't exist.

  Then you need to create a button for the user to click to execute 
  the editor.  This button must have four properties:
    1) It must be a 'button' element.
    2) The class must be "ItsAllTextEditButton".
    3) The onclick attribute must be the JavaScript snippet:
       ItsAllText.openEditor('id-of-your-textbox');
       The string 'id-of-your-textbox' should be the id of the textbox
       you want to be editable.
    4) The style should include "display: none" so that the button won't
       show up if It's All Text! isn't installed.

  Example:
      <hbox>
        <spacer flex="1"/>
        <button label="It's All Text!" class="ItsAllTextEditButton" style="display: none;" onclick="ItsAllText.openEditor('code');"/>
      </hbox>

 */

(function () {
    /* Load up the main It's All Text! file */
    var objScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    objScriptLoader.loadSubScript('chrome://itsalltext/content/itsalltext.js');
    
    var onload = function (event) {
        /* Start watching the document, but force it. */
        ItsAllText.monitor.watch(document, true);

        /* Turn on all the buttons */
        var nodes = document.getElementsByTagName('button');
        for(var i=0; i < nodes.length; i++) {
            var button = nodes[i];
            if (button.className == "ItsAllTextEditButton") { 
                button.style.display = '';
            }
        }
    };
    window.addEventListener("load", onload, true);

})();

/**
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

