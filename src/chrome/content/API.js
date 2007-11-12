/*
  This file is used to allow external editors to work inside your chrome XUL.

  ***** How To Use This API *****
  Add this script line to your .xul file:
  <script type="application/javascript" src="chrome://itsalltext/content/API.js"/>

  If "It's All Text!" isn't installed in the browser, it will fail safely.
  It only generates an info message in the error console.

  You then have two choices.  You can call ItsAllTextopenEditor() directly
  via JavaScript or you can add one or two attributes to a XUL element and
  it'll automatically be set up right.

  The suggested method is to add the correct attributes to your XUL button
  or menuitem and let "It's All Text!" do it for you.

  Attributes:
    'itsalltext-control' -- This should be set to the id of the textbox
                            that you want to edit when command is executed
                            on this XUL element. This is required.
    'itsalltext-extension' -- This is the file extension.  Include the
                              leading dot character.  Example: '.css'
                              It defaults to '.txt' and is optional.

  If you don't want this XUL element to be visible unless "It's All Text!"
  is installed, then you should set it's CSS style display to 'none'.

  Example using attributes (recommended method):
      <hbox>
        <spacer flex="1"/>
        <button label="It's All Text!"
                itsalltext-control="code"
                itsalltext-extension=".css"
                style="display: none;"
        />
      </hbox>

  Example calling openEditor() directly:
     if(some_condition && ItsAllText) {
         ItsAllText.openEditor('id-of-textarea', '.extension');
     }

 */

(function () {
    /* Load up the main It's All Text! file */
    var objScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
    objScriptLoader.loadSubScript('chrome://itsalltext/content/itsalltext.js');

    /**
     * This is part of the public XUL API.
     * Use this to open an editor for a specific textarea or textbox with
     * the id 'id'.  The file will have the extension 'extension'.  Include
     * the leading dot in the extension.
     * @param {String} id The id of textarea or textbody that should be opened in the editor.
     * @param {String} extension The extension of the file used as a temporary file. Example: '.css' (optional)
     */
    var openEditorCommand = function(event) {
        var id = this.getAttribute("itsalltext-control");
        var extension = this.getAttribute("itsalltext-extension");
        var node = document.getElementById(id);
        var narf=ItsAllText.debug;
        narf('oec narf 1', id, extension, node);

        /* The only way I can adjust the background of the textbox is
         * to turn off the -moz-appearance attribute.
         */
        node.style.MozAppearance = 'none';
        narf('oec narf 2');

        var cache_object = node && ItsAllText.getCacheObj(node);
        narf('oec narf 3', cache_object);
        if(!cache_object) { return; }
        narf('oec narf 4');
        cache_object.edit(extension);

        narf('oec narf 5');
        return false;
    };


    var onload = function (event) {
        /* Start watching the document, but force it. */
        ItsAllText.new_monitor.startPage({originalTarget: document}, true);

        /* Turn on all the hidden CSS */
        var nodes = [], i;
        var nodesIter = document.evaluate("//node()[@itsalltext-control]",
                                          document, null,
                                          XPathResult.UNORDERED_NODE_ITERATOR_TYPE, null);

        var node = nodesIter.iterateNext();
        while (node) {
            nodes.push(node);
            node = nodesIter.iterateNext();
        }
        for(i in nodes) {
            if (nodes.hasOwnProperty(i)) {
                node = nodes[i];
                node.addEventListener('command', openEditorCommand, true);
                node.style.display = '-moz-box';
            }
        }

    };
    window.addEventListener("load", onload, true);
})();
