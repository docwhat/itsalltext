/*
 *  It's All Text - Easy external editing of web forms.
 *  Copyright (C) 2006 Christian Höltje
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License or
 *  any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License along
 *  with this program; if not, write to the Free Software Foundation, Inc.,
 *  51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
 */

/**
 * Creates a mostly unique hash of a string
 * Most of this code is from:
 *    http://developer.mozilla.org/en/docs/nsICryptoHash
 * @param {String} some_string The string to hash.
 * @returns {String} a hashed string.
 */
function hashString(some_string) {
  var converter = Components.classes["@mozilla.org/intl/scriptableunicodeconverter"].createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
  converter.charset = "UTF-8";

  /* result is the result of the hashing.  It's not yet a string,
   * that'll be in retval.
   * result.value will contain the array length
   */
  var result = {};
  
  /* data is an array of bytes */
  var data = converter.convertToByteArray(some_string, result);
  var ch   = Components.classes["@mozilla.org/security/hash;1"].createInstance(Components.interfaces.nsICryptoHash);
  
  ch.init(ch.MD5);
  ch.update(data, data.length);
  var hash = ch.finish(true);
  
  // return the two-digit hexadecimal code for a byte
  toHexString = function(charCode) {
    return ("0" + charCode.toString(36)).slice(-2);
  };
  
  // convert the binary hash data to a hex string.
  var retval = [];
  for(i in hash) {
    retval[i] = toHexString(hash.charCodeAt(i));
  }
  
  return(retval.join(""));
}

function ItsAllTextOverlay() {
  /**
   * This data is all private, which prevents security problems and it
   * prevents clutter and collection.
   * @type Object
   */
  var that = this;
  /**
   * This holds a cache of all the textareas that we are watching.
   * @type Hash
   */
  var cache = {};
  // @todo The cache should periodically be cleaned up.

  /**
   * Keeps track of all the refreshes we are running.
   * @type Array
   */
  var cron = [null]; // Eat the 0th position

  /**
   * A constant, a string used for things like the preferences.
   * @type String
   */
  var MYSTRING = 'itsalltext';

  /**
   * This is a handy debug message.  I'll remove it or disable it when
   * I release this.
   * @param {String} aMessage The message to log.
   */
  that.log = function() {
    var args = Array.prototype.slice.apply(arguments,[0]);
    var consoleService = Components.
      classes["@mozilla.org/consoleservice;1"].
      getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("ItsAllTextOverlay: " + args.join(' '));
  };

  /**
   * Displays debug information, if debugging is turned on.
   * Requires Firebug.
   * @param Object message One or more objects can be passed in to display.
   */
  that.debug = function() {
    if (that.preferences.data.debug) {
      try { Firebug.Console.logFormatted(arguments); } 
      catch(e) {}
    }
  };

  var makeLocalFile = function(path) {
    var obj = Components.classes["@mozilla.org/file/local;1"].
      createInstance(Components.interfaces.nsILocalFile);
    obj.initWithPath(path);
    return obj;
  };

  /**
   * Returns the directory where we put files to edit.
   * @returns nsILocalFile The location where we should write editable files.
   */
  that.getEditDir = function() {
    /* Where is the directory that we use. */
    var fobj = Components.classes["@mozilla.org/file/directory_service;1"].
      getService(Components.interfaces.nsIProperties).
      get("ProfD", Components.interfaces.nsIFile);
    fobj.append(MYSTRING);
    if (!fobj.exists()) {
      fobj.create(Components.interfaces.nsIFile.DIRECTORY_TYPE,
                  parseInt('0700',8));
    }
    if (!fobj.isDirectory()) {
      that.error('Having a problem finding or creating directory: '+fobj.path);
    }
    return fobj;
  };

  /**
   * Cleans out the edit directory, deleting all files.
   */
  that.cleanEditDir = function() {
    var fobj = that.getEditDir();
    //return dir.directoryEntries;
    // file is the given directory (nsIFile)
    var entries = fobj.directoryEntries;
    while (entries.hasMoreElements()) {
      var entry = entries.getNext();
      entry.QueryInterface(Components.interfaces.nsIFile);
      try{
        entry.remove(false);
      } catch(e) {
        that.debug('unable to remove',entry,'error:',e);
      }
    }
  };
  /* Clean the edit directory right now, on startup. */
  that.cleanEditDir();

  /**
   * A Preference Observer.
   */
  that.preferences = {
    /**
     * Dictionary for storing the preferences in.
     * @type Hash
     */
    data: {
    },
    /**
     * Dictionary of types (well, really the method needed to get/set the
     * type.
     * @type Hash
     */
    types: {
      'charset': 'Char',
      'editor':  'Char',
      'refresh': 'Int',
      'debug':   'Bool'
    },

    /**
     * Register the observer.
     */
    register: function() {
      var prefService = Components.
        classes["@mozilla.org/preferences-service;1"].
        getService(Components.interfaces.nsIPrefService);
      this._branch = prefService.getBranch("extensions."+MYSTRING+".");
      this._branch.QueryInterface(Components.interfaces.nsIPrefBranch2);
      for(var type in this.types) {
        this.data[type] = this._branch['get'+(this.types[type])+'Pref'](type);
      }
      this._branch.addObserver("", this, false);
    },

    /**
     * Unregister the observer. Not currently used, but may be
     * useful in the future.
     */
    unregister: function() {
      if (!this._branch) {return;}
      this._branch.removeObserver("", this);
    },

    /**
     * Observation callback.
     * @param {String} aSubject The nsIPrefBranch we're observing (after appropriate QI)e
     * @param {String} aData The name of the pref that's been changed (relative to the aSubject).
     * @param {String} aTopic The string defined by NS_PREFBRANCH_PREFCHANGE_TOPIC_ID
     */
    observe: function(aSubject, aTopic, aData) {
      if (aTopic != "nsPref:changed") {return;}
      if (this.data.hasOwnProperty(aData)) {
        this.data[aData] = this._branch['get'+(this.types[aData])+'Pref'](aData);
      }
    }
  };

  /**
   * A Preference Option: What character set should the file use?
   * @returns {String} the charset to be used.
   */
  that.getCharset = function() {
    return that.preferences.data.charset;
  };

  /**
   * A Preference Option: How often should we search for new content?
   * @returns {int} The number of seconds between checking for new content.
   */
  that.getRefresh = function() {
    var refresh = that.preferences.data.refresh;
    var retval = Math.round((1000*refresh) + (1000*Math.random()));
    //that.debug('refresh in',retval);
    return retval;

  };

  /**
   * A Preference Option: What editor should we use?
   * @returns {nsILocalFile} A file object of the editor.
   */
  that.getEditor = function() {
    var editor = that.preferences.data.editor;

    // @todo The prefereces dialog should have a filepicker.
    // @todo If the editor fails, we should open preferences. (!)
    // @todo MacOSX: add support for "open -a <app> <file>". (!)

    // create an nsILocalFile for the executable
    var file = Components.
      classes["@mozilla.org/file/local;1"].
      createInstance(Components.interfaces.nsILocalFile);

    file.initWithPath(editor);
    return file;
  };

  /**
   * A Preference Option: should we display debugging info?
   * @returns {bool}
   */
  that.getDebug = function() {
    return that.preferences.data.debug;
  };

  /**
   * A Cache object is used to manage the node and the file behind it.
   * @constructor
   * @param {Object} node A DOM Node to watch.
   */
  function CacheObj(node) {
    var self = this;
    self.timestamp = 0;
    self.size = 0;
    self.node = node;
    self.button = null;

    self.uid = hashString([ node.ownerDocument.URL,
                            Math.random(),
                            node.getAttribute("name") ].join(':'));

    // @todo We should have a menu that lets the user pick the extension. (!)
    self.filename = hashString([ node.ownerDocument.URL,
                                 node.getAttribute("name") ].join(':')) +
      '.txt';

    node.setAttribute(MYSTRING+'_UID', self.uid);
    cache[self.uid] = self;
    
    /* Since the hash is supposed to be equally distributed, it shouldn't
     * matter how we slice it.  However, this does make it less unique.
     */
    // @todo Detect collisions using the raw key.
    self.filename = self.filename.slice(0,15) + '.txt';

    var editdir = that.getEditDir();
    that.debug('editdir',editdir.path);

    /* Get a file */
    self.file = Components.classes["@mozilla.org/file/local;1"].
      createInstance(Components.interfaces.nsILocalFile);
    self.file.initWithFile(editdir);
    self.file.append(self.filename);

    /* Remove any existing files */
    if (self.file.exists()) {
      self.file.remove(false);
    }

    /**
     * Convert to this object to a useful string.
     * @returns {String} A string representation of this object.
     */
    self.toString = function() {
      return [ "CacheObj",
               " uid=",self.uid,
               " timestamp=",self.timestamp,
               " size=",self.size
      ].join('');
    };

    /**
     * Write out the contents of the node.
     */
    self.write = function() {
      try {
        var foStream = Components.
          classes["@mozilla.org/network/file-output-stream;1"].
          createInstance(Components.interfaces.nsIFileOutputStream);
        
        /* write, create, truncate */
        foStream.init(self.file, 0x02 | 0x08 | 0x20, 
                      parseInt('0600',8), 0); 

        /* We convert to charset */
        var conv = Components.
          classes["@mozilla.org/intl/scriptableunicodeconverter"].
          createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
        conv.charset = that.getCharset();

        var text = conv.ConvertFromUnicode(self.node.value);
        foStream.write(text, text.length);
        foStream.close();
        return self.file.path;
      } catch(e) {
        that.debug('write',self.file.path,e);
        return null;
      }
    };
      
    // @todo cool idea, pass in the line number to the editor
    self.edit = function() {
      if (self.node.nodeName != "TEXTAREA") { return; }
      var filename = self.write();
      try {
        var program = that.getEditor();

        // create an nsIProcess
        var process = Components.
          classes["@mozilla.org/process/util;1"].
          createInstance(Components.interfaces.nsIProcess);
        process.init(program);

        // Run the process.
        // If first param is true, calling thread will be blocked until
        // called process terminates.
        // Second and third params are used to pass command-line arguments
        // to the process.
        var args = [filename];
        var result = {};
        process.run(false, args, args.length, result);
      } catch(e) {
        that.debug('edit',filename,e);
      }
    };

    self.read = function() {
      /* read file, reset ts & size */
      var DEFAULT_REPLACEMENT_CHARACTER = 65533;
      var buffer = [];

      try {
        var fis = Components.
          classes["@mozilla.org/network/file-input-stream;1"].
          createInstance(Components.interfaces.nsIFileInputStream);
        fis.init(self.file, 0x01, parseInt('00400',8), 0); 
        // MODE_RDONLY | PERM_IRUSR
  
        var is = Components.
          classes["@mozilla.org/intl/converter-input-stream;1"].
          createInstance(Components.interfaces.nsIConverterInputStream);
        is.init(fis, that.getCharset(), 4096, DEFAULT_REPLACEMENT_CHARACTER);
  
        var str = {};
        while (is.readString(4096, str) !== 0) {
          buffer.push(str.value);
        }
        
        is.close();
        fis.close();
  
        self.timestamp = self.file.lastModifiedTime;
        self.size      = self.file.fileSize;
  
        return buffer.join('');
      } catch(e) {
        return null;
      }
    };

    /**
     * Has the file object changed?
     * @returns {boolean} returns true if the file has changed on disk.
     */
    self.hasChanged = function() {
      /* Check exists.  Check ts and size. */
      if(!self.file.exists() ||
         !self.file.isReadable() ||
         (self.file.lastModifiedTime == self.timestamp && 
          self.file.fileSize         == self.size)) {
        return false;
      } else {
        return true;
      }
    };

    /**
     * Update the node from the file.
     * @returns {boolean} Returns true ifthe file changed.
     */
    self.update = function() {
      // @todo This should really use something like YFT.
      if (self.hasChanged()) {
        var value = self.read();
        if (value !== null) {
          self.node.value = value;
          return true;
        }
      }
      return false; // If we fall through, we 
    };
 
  }

  // @todo Profiling and optimization.

  /**
   * Returns a cache object
   * Note: These UIDs are only unique for Its All Text.
   * @param {Object} node A dom object node.
   * @returns {String} the UID or null.
   */
  that.getCacheObj = function(node) {
    var cobj = null;
    if (node && node.hasAttribute(MYSTRING+"_UID")) {
      cobj = cache[node.getAttribute(MYSTRING+"_UID")];
    }
    if (!cobj) {
      cobj = new CacheObj(node);
    }
    return cobj;
  };

  /**
   * Refresh Textarea.
   * @param {Object} node A specific textarea dom object to update.
   */
  that.refreshTextarea = function(node) {
    var cobj = that.getCacheObj(node);
    //that.debug('refreshNode():',cobj);
    if(!cobj) { return; }

    if (that.getDebug()) {
      if (!cobj._toggle) {
        cobj.node.style.background = '#fed';
        cobj._toggle = true;
      } else {
        cobj.node.style.background = '#def';
        cobj._toggle = false;
      }
    }

    cobj.update();
    that.addGumDrop(cobj);
  };

  // @todo If the textarea is focused, we should refresh it.
  // @todo When the editor quits, we should refresh the textarea.
  // @todo IDEA - support for input elements as well?
  // @todo Remove debugging/narf code.

  /**
   * Refresh Document.
   * @param {Object} doc The document to refresh.
   */
  that.refreshDocument = function(doc) {
    // @todo Confirm that we find textareas inside iframes and the like.
    //that.debug('refreshDocument()',doc.URL);
    var nodes = doc.getElementsByTagName('textarea');
    for(var i=0; i < nodes.length; i++) {
      that.refreshTextarea(nodes[i]);
    }
  };

  /**
   * Add the gumdrop to a textarea.
   * @param {Object} cache_object The Cache Object that contains the node.
   */
  that.addGumDrop = function(cache_object) {
    if (cache_object.button !== null) { return; /*already done*/ }
    that.debug('addGumDrop',cache_object);

    var node = cache_object.node;
    var doc = node.ownerDocument;
    var offsetNode = node;
    if (!node.parentNode) { return; }

    var gumdrop = doc.createElementNS("http://www.w3.org/1999/xhtml", "div");
    gumdrop.appendChild(doc.createTextNode('edit'));
    cache_object.button = gumdrop; // Store it for easy finding in the future.
    gumdrop.style.backgroundColor  = '#24c';
    gumdrop.style.color            = '#fff';
    gumdrop.style.direction        = 'ltr';
    gumdrop.style.border           = 'solid red 1px';
    gumdrop.style.font             = 'normal normal normal 10px/normal sans-serif';
    gumdrop.style.textIndent       = '0px';
    gumdrop.style.textTransform    = 'none';
    gumdrop.style.textAlign        = 'center';
    gumdrop.style.cursor           = 'pointer';
    gumdrop.style.padding          = '0px';
    gumdrop.style.display          = 'block';
    gumdrop.style.position         = 'relative';
    gumdrop.style.width            = '2em';
    gumdrop.style.MozBorderRadius  = '8px';
    gumdrop.style.zIndex           = 65535;
    gumdrop.style.MozOpacity       = "0.7";
    gumdrop.title                  = "It's All Text";

    // This doesn't seem to work because it's not privelidged enough to get
    // to the chrome.
    // var gumdrop = doc.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "image");
    // gumdrop.style.border     = 'none';
    // gumdrop.style.position   = 'relative';
    // gumdrop.src              = 'chrome://itsalltext/chrome/content/gumdrop.png';
    // gumdrop.alt              = 'edit';

    //gumdrop.style.paddingLeft = node.offsetWidth + "px";

    var onEditClick = function(event) {
      ////event.target.showPopup();
      //var menu = document.getElementById('its-all-text-menu');
      //menu.showPopup(cache_object.node,-1,-1,'context');
      cache_object.edit();
    };

    // Click event handler
    gumdrop.addEventListener("click", onEditClick, false);

    // Insert gumdrop into the document
    //gumdrop.style.display = "none";
    var nextSibling = node.nextSibling;
    if (nextSibling) {
      node.parentNode.insertBefore(gumdrop, node.nextSibling);
    } else {
      node.parentNode.appendChild(gumdrop);
    }

    // Position it correctly.
    gumdrop.style.marginTop        = '-' + (gumdrop.offsetHeight-1)+'px';
    gumdrop.style.marginLeft       = (node.offsetWidth-gumdrop.offsetWidth+1)+'px';
  };

  /**
   * Callback whenever the DOM content in a window or tab is loaded.
   * @param {Object} event An event passed in.
   */
  that.onDOMContentLoad = function(event) {
    if (event.originalTarget.nodeName != "#document") { return; }
    var doc = event.originalTarget;
    var id = cron[doc.ItsAllText_CronJobID];
    if (!id) {
      id = cron.push(null);
      doc.ItsAllText_CronJobID = id;
    }

    that.debug('onDOMContentLoad: start',id);
    var lasttime = new Date().valueOf();

    /**
     * This sets up the autorefresh for a given page.
     */
    var cronjob = function () {
      var last = cron[id];
      if(!last || last == lasttime) {
        that.refreshDocument(doc);
        lasttime = new Date().valueOf();
        cron[id] = lasttime;
        setTimeout(cronjob, that.getRefresh());
      }
    };
    cronjob();

    that.debug('onDOMContentLoad: done',id);
    return;
  };

  /**
   * Open the editor for a selected node.
   * @param {Object} node The textarea to get.
   */
  that.onEditNode = function(node) {
    var cobj = that.getCacheObj(node);
    if(!cobj) {
      that.debug('onEditNode','missing cobj for ',node);
    } else {
      that.debug('onEditNode',cobj);
      cobj.edit();
    }
    return;
  };

  /**
   * Triggered when the context menu is shown.
   * @param {Object} event The event passed in by the event handler.
   */
  that.onContextMenu = function(event) {
    that.debug('onContextMenu',document.popupNode.nodeName);
    document.getElementById("its-all-text-edit").
      setAttribute('disabled', (document.popupNode.nodeName != "TEXTAREA"));
    return;
  };

  /**
   * Initialize the module.  Should be called once, when a window is loaded.
   * @private
   */
  var startup = function() {
    var appcontent = document.getElementById("appcontent"); // The Browser
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", that.onDOMContentLoad,
                                  true);
    }
    document.getElementById("contentAreaContextMenu").
      addEventListener("popupshowing", that.onContextMenu, false);
  };
  
  // Start watching the preferences.
  that.preferences.register();
  
  // Do the startup when things are loaded.
  window.addEventListener("load", startup, true);
}
var itsAllTextOverlay = new ItsAllTextOverlay();
