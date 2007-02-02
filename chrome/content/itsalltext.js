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

// @todo [idea] dropdown list for charsets (utf-8, western-iso, default)?

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
  var toHexString = function(charCode) {
    return ("0" + charCode.toString(36)).slice(-2);
  };
  
  // convert the binary hash data to a hex string.
  var retval = [];
  for(i in hash) {
    retval[i] = toHexString(hash.charCodeAt(i));
  }
  
  return(retval.join(""));
}

function ItsAllText() {
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

  var gumdrop_width  = 28; 
  var gumdrop_height = 14;
  var gumdrop_url    = 'chrome://itsalltext/content/gumdrop.png';

  /**
   * This is a handy debug message.  I'll remove it or disable it when
   * I release this.
   * @param {Object} message One or more objects can be passed in to display.
   */
  that.log = function() {
    // idiom: Convert arguments to an array for easy handling.
    var args = Array.prototype.slice.apply(arguments,[0]);
    var consoleService = Components.
      classes["@mozilla.org/consoleservice;1"].
      getService(Components.interfaces.nsIConsoleService);
    consoleService.logStringMessage("ItsAllText: " + args.join(' '));
  };

  /**
   * Uses log iff debugging is turned on.  Used for messages that need to
   * globally logged (firebug only logs locally).
   * @param {Object} message One or more objects can be passed in to display.
   */
  that.debuglog = function() {
    if (that.preferences.debug) {
      that.log.apply(that,arguments);
    }
  };

  /**
   * Displays debug information, if debugging is turned on.
   * Requires Firebug.
   * @param {Object} message One or more objects can be passed in to display.
   */
  that.debug = function() {
    if (that.preferences.debug) {
      try { Firebug.Console.logFormatted(arguments); } 
      catch(e) {
        that.log.apply(that,arguments);
      }
    }
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

  /* Load the Color.js file used for the Fade Anything Technique into this object */
  var objScriptLoader = Components.classes["@mozilla.org/moz/jssubscript-loader;1"].getService(Components.interfaces.mozIJSSubScriptLoader);
  objScriptLoader.loadSubScript('chrome://itsalltext/content/Color.js', that);

  /**
   * Dictionary for storing the preferences in.
   * @type Hash
   */
  that.preferences = {};

  /**
   * A Preference Observer.
   */
  that.preference_observer = {
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
        that.preferences[type] = this._branch['get'+(this.types[type])+'Pref'](type);
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
      if (that.preferences) {
        that.preferences[aData] = this._branch['get'+(this.types[aData])+'Pref'](aData);
        if (aData == 'refresh') {
          that.monitor.restart();
        }
      }
    }
  };

  /**
   * A Preference Option: What character set should the file use?
   * @returns {String} the charset to be used.
   */
  that.getCharset = function() {
    return that.preferences.charset;
  };

  /**
   * A Preference Option: How often should we search for new content?
   * @returns {int} The number of seconds between checking for new content.
   */
  that.getRefresh = function() {
    var refresh = that.preferences.refresh;
    var retval = 1000*refresh;
    return retval;

  };

  /**
   * A Preference Option: What editor should we use?
   * @returns {nsILocalFile} A file object of the editor.
   */
  that.getEditor = function() {
    var editor = that.preferences.editor;

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
    return that.preferences.debug;
  };

  /**
   * Returns a unique identifier for the node, within the document.
   * @returns {String} the unique identifier.
   */
  that.getNodeIdentifier = function(node) {
    var id   = node.getAttribute('id');
    if (!id) {
      var name = node.getAttribute('name');
      var doc = node.ownerDocument.getElementsByTagName('html')[0];
      var attr = MYSTRING+'_id_serial';
        
      /* Get a serial that's unique to this document */
      var serial = doc.getAttribute(attr);
      if (serial) { serial = parseInt(serial, 10)+1;
      } else { serial = 1; }
      id = [MYSTRING,'generated_id',name,serial].join('_');
      doc.setAttribute(attr,serial);
      
      node.setAttribute('id',id);
    }
    return id;
  };

  /**
   * Returns a unique identifier for the document.
   * @returns {String} the unique identifier.
   */
  that.getDocumentIdentifier = function(doc) {
    // @todo [low] getDocumentIdentifier should sort arguments and append the post data.
    return doc.URL;
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
    self.initial_color = 'transparent';

    self.node_id = that.getNodeIdentifier(node);
    self.doc_id  = that.getDocumentIdentifier(node.ownerDocument);
    self.uid = hashString([ self.doc_id,
                            Math.random(),
                            self.node_id ].join(':'));

    self.filename = hashString([ self.doc_id,
                                 self.node_id ].join(':')) +
      '.txt';

    node.setAttribute(MYSTRING+'_UID', self.uid);
    cache[self.uid] = self;
    
    /* Since the hash is supposed to be equally distributed, it shouldn't
     * matter how we slice it.  However, this does make it less unique.
     */
    // @todo [security] Detect collisions using the raw key.
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

        /* Reset Timestamp and filesize, to prevent a spurious refresh */
        self.timestamp = self.file.lastModifiedTime;
        self.size      = self.file.fileSize;

        return self.file.path;
      } catch(e) {
        that.debug('write',self.file.path,e);
        return null;
      }
    };
      
    // @todo [idea] Pass in the line number to the editor, arbitrary command?
    // @todo [high] On edit, let user pick the file extension.
    // @todo [idea] allow the user to pick an alternative editor?
    self.edit = function(retried) {
      if (typeof(retried) == 'undefined') { retried = false; }
      var nodeName = self.node.nodeName;
      if (nodeName != "TEXTAREA" /* incase I get chrome running && nodeName != "TEXTBOX"*/) { return; }
      var filename = self.write();
      self.initial_color = self.node.style.backgroundColor;
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
        window.openDialog('chrome://itsalltext/chrome/preferences.xul',
                          "Preferences", 
                          "chrome,titlebar,toolbar,centerscreen,modal",
                          "badeditor");
        if (!retried) {
          self.edit(true); // Try one more time.
        }
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
  
        var istream = Components.
          classes["@mozilla.org/intl/converter-input-stream;1"].
          createInstance(Components.interfaces.nsIConverterInputStream);
        istream.init(fis, that.getCharset(), 4096, DEFAULT_REPLACEMENT_CHARACTER);
  
        var str = {};
        while (istream.readString(4096, str) !== 0) {
          buffer.push(str.value);
        }
        
        istream.close();
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
     * Part of the fading technique.
     * @param {Object} pallet A Color blend pallet object.
     * @param {int}    step   Size of a step.
     * @param {delay}  delay  Delay in microseconds.
     */
    self.fadeStep = function(pallet, step, delay) {
      return function() {
		if (step < pallet.length) {
          self.node.style.backgroundColor = pallet[step++].hex();
          setTimeout(self.fadeStep(pallet, step, delay),delay);
		}
      };
    };

    /**
     * Node fade technique.
     * @param {int} steps  Number of steps in the transition.
     * @param {int} delay  How long to wait between delay (microseconds).
     */
    self.fade = function(steps, delay) {
      var colEnd = new that.Color(self.initial_color);
      var colStart = new that.Color('yellow');//colEnd.invert();
      var pallet = colStart.blend(colEnd, steps);
      setTimeout(self.fadeStep(pallet, 0, delay), delay);
    };

    /**
     * Update the node from the file.
     * @returns {boolean} Returns true ifthe file changed.
     */
    self.update = function() {
      if (self.hasChanged()) {
        var value = self.read();
        if (value !== null) {
          self.fade(15, 100);
          self.node.value = value;
          return true;
        }
      }
      return false; // If we fall through, we 
    };

    /**
     * Updates the position of the gumdrop, incase the textarea shifts around.
     */
    self.adjust = function() {
      var gumdrop  = self.button;
      var el       = self.node;
      var style    = gumdrop.style;
      if (!gumdrop || !el) { return; }
      var display  = '';
      if (el.style.display == 'none') {
        display = 'none';
      }
      if (style.display != display) {
        style.display = display;
      }

      /* Reposition the gumdrops incase the dom changed. */
      var pos = that.getPageOffset(el);
      var left = (pos[0]+Math.max(1,el.offsetWidth-gumdrop_width))+'px';
      var top  = (pos[1]+el.offsetHeight)+'px';
      if(style.left != left) { style.left = left; }
      if(style.top != top) { style.top = top; }
    };

    self.mouseover = function(event) {
      var style = self.button.style;
      style.opacity = '0.7';
    };
    self.mouseout = function(event) {
      var style = self.button.style;
      style.opacity = '0.1';
    };
  }

  // @todo [med] Profiling and optimization.

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
   * Cleans out all old cache objects.
   */
  that.cleanCacheObjs = function() {
    var count = 0;
    for(var id in cache) {
      var cobj = cache[id];
      if (cobj.node.ownerDocument.location === null) {
        that.debug('cleaning %s', id);
        delete cobj.node;
        delete cobj.button;
        delete cache[id];
      } else {
        count += 1;
      }
    }
    that.debuglog('cache count:', count);
  };

  /**
   * Refresh Textarea.
   * @param {Object} node A specific textarea dom object to update.
   */
  that.refreshTextarea = function(node) {
    var cobj = that.getCacheObj(node);
    if(!cobj) { return; }

    cobj.update();
    that.addGumDrop(cobj);
  };

  // @todo [med] If the textarea is focused, we should refresh it.
  // @todo [low] When the editor quits, we should refresh the textarea.
  // @todo [idea] support for input elements as well?

  /**
   * Refresh Document.
   * @param {Object} doc The document to refresh.
   */
  that.refreshDocument = function(doc) {
    // @todo [high] Confirm that we find textareas inside iframes and frames.
    //that.debug('refreshDocument()',doc.URL);
    var nodes = doc.getElementsByTagName('textarea');
    for(var i=0; i < nodes.length; i++) {
      that.refreshTextarea(nodes[i]);
    }
    /* Incase I get chrome running.
    nodes = doc.getElementsByTagName('textbox');
    for(var i=0; i < nodes.length; i++) {
      that.refreshTextarea(nodes[i]);
    }
    */
  };

  /**
   * Returns the real page offset for an element.
   * @param {Object} node A DOM element.
   * @return {Array} The X & Y page offsets
   */
  that.getPageOffset = function(node) {
    var pos = [node.offsetLeft, node.offsetTop];
    var pnode = node.offsetParent;
    while(pnode) {
      pos[0] += pnode.offsetLeft || 0;
      pos[1] += pnode.offsetTop || 0;
      pnode = pnode.offsetParent;
    }
    return pos;
  };


  /**
   * Add the gumdrop to a textarea.
   * @param {Object} cache_object The Cache Object that contains the node.
   */
  that.addGumDrop = function(cache_object) {
    if (cache_object.button !== null) {
      cache_object.adjust();
      return; /*already done*/
    }
    that.debug('addGumDrop',cache_object);

    var node = cache_object.node;
    var doc = node.ownerDocument;
    var offsetNode = node;
    if (!node.parentNode) { return; }

    var XHTMLNS = "http://www.w3.org/1999/xhtml";
    var gumdrop = doc.createElementNS(XHTMLNS, "img");
    gumdrop.setAttribute('src', gumdrop_url);
    if (this.getDebug()) {
      gumdrop.setAttribute('title', cache_object.node_id);
    } else {
      gumdrop.setAttribute('title', "It's All Text!");
    }
    cache_object.button = gumdrop; // Store it for easy finding in the future.

    // Click event handler
    gumdrop.addEventListener("click", function(ev){cache_object.edit();}, false);

    // Image Attributes
    gumdrop.style.cursor           = 'pointer';
    gumdrop.style.display          = 'block';
    gumdrop.style.position         = 'absolute';
    gumdrop.style.padding          = '0';
    gumdrop.style.border           = 'none';
    gumdrop.style.zIndex           = 2147483646; // Max Int - 1

    gumdrop.style.width            = gumdrop_width+'px';
    gumdrop.style.height           = gumdrop_height+'px';

    // Insert it into the document
    var nextSibling = node.nextSibling;
    if (nextSibling) {
      node.parentNode.insertBefore(gumdrop, nextSibling);
    } else {
      node.parentNode.appendChild(gumdrop);
    }
    node.addEventListener("mouseover", cache_object.mouseover, false);
    node.addEventListener("mouseout", cache_object.mouseout, false);
    gumdrop.addEventListener("mouseover", cache_object.mouseover, false);
    gumdrop.addEventListener("mouseout", cache_object.mouseout, false);
    cache_object.mouseout(null);
    cache_object.adjust();
  };

  /**
   * This function is called regularly to watch changes to web documents.
   */
  that.monitor = {
    id: null,
    last_now:0,
    documents: [],
    /**
     * Starts or restarts the document monitor.
     */
    restart: function() {
      var rate = that.getRefresh();
      var id   = that.monitor.id;
      if (id) {
        clearInterval(id);
      }
      that.monitor.id = setInterval(that.monitor.watcher, rate);
    },
    /**
     * watches the document 'doc'.
     * @param {Object} doc The document to watch.
     */
    watch: function(doc) {
      that.refreshDocument(doc);
      that.monitor.documents.push(doc);
    },
    /**
     * Callback to be used by restart()
     * @private
     */
    watcher: function(offset) {
      var monitor = that.monitor;
      var rate = that.getRefresh();
      var now = Date.now();
      if (now - monitor.last_now < Math.round(rate * 0.9)) {
        that.debuglog('monitor.watcher(',offset,') -- skipping catchup refresh');
        return;
      }
      monitor.last_now = now;

      /* Walk the documents looking for changes */
      var documents = monitor.documents;
      that.debuglog('monitor.watcher(',offset,'): ', documents.length);
      var i;
      var did_delete = false;
      for(i in documents) {
        var doc = documents[i];
        that.refreshDocument(doc);
        if (doc.location) {
          that.debuglog('refreshing', doc.location);
          that.refreshDocument(doc);
        } else {
          delete documents[i];
          did_delete = true;
        }
      }

      if(did_delete) {
        /* Remove deleted elements */
        that.cleanCacheObjs();
        for(i=documents.length - 1; i >= 0; i--) {
          if(typeof(documents[i]) == 'undefined') {
            documents.splice(i,1);
          }
        }
      }
    }
  };

  /**
   * Callback whenever the DOM content in a window or tab is loaded.
   * @param {Object} event An event passed in.
   */
  that.onDOMContentLoad = function(event) {
    if (event.originalTarget.nodeName != "#document") { return; }
    var doc = event.originalTarget || document;
    /* Check that this is a document we want to play with. */
    var contentType = doc.contentType;
    var location = doc.location;
    var is_usable = (contentType == 'text/html' ||
                     contentType == 'text/xhtml') && 
      location.protocol != 'about:' &&
      location.protocol != 'chrome:';
    if (!is_usable) { 
      that.debuglog('ignoring:', location, contentType);
      return;
    }

    that.monitor.watch(doc);
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
  var startup = function(event) {
   that.debug("startup(): It's All Text! is watching this window...");
    var appcontent = document.getElementById("appcontent"); // The Browser
    if (appcontent) {
      // Normal web-page.
      appcontent.addEventListener("DOMContentLoaded", that.onDOMContentLoad,
                                  true);
    } else {
      that.onDOMContentLoad(event); 
    }
    // Attach the context menu, if we can.
    var contentAreaContextMenu = document.getElementById("contentAreaContextMenu");
    if (contentAreaContextMenu) {
      contentAreaContextMenu.addEventListener("popupshowing",
                                             that.onContextMenu, false);
    }
  };
  
  // Start watching the preferences.
  that.preference_observer.register();
  
  // Do the startup when things are loaded.
  window.addEventListener("load", startup, true);

  // Start the monitor
  that.monitor.restart();
}

top.ItsAllText = new ItsAllText();
