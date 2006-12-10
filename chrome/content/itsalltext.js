/*
 * Places I learned how to do some of this stuff and used as references:
 *   - Mozex
 *   - Stylish
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
  /* This data is all private, which prevents security problems and it
   * prevents clutter and collection.
   */
  var that = this;
  var cache = {};
  var cron = [null]; // Eat the 0th position

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

  that.debug = function() {
    try { return Firebug.Console.logFormatted(arguments); } 
    catch(e) { return null; }
  };

  var makeLocalFile = function(path) {
    var obj = Components.classes["@mozilla.org/file/local;1"].
      createInstance(Components.interfaces.nsILocalFile);
    obj.initWithPath(path);
    return obj;
  };

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
   * A Preference Option: What character set should the file use?
   * @returns {String} the charset to be used.
   */
  that.getCharset = function() {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].
      getService(Components.interfaces.nsIPrefService);
    var branch = prefs.getBranch("extensions."+MYSTRING+".");
    return branch.getCharPref("charset");
  };

  /**
   * A Preference Option: What editor should we use?
   * @returns {nsILocalFile} A file object of the editor.
   */
  that.getEditor = function() {
    var prefs = Components.classes["@mozilla.org/preferences-service;1"].
      getService(Components.interfaces.nsIPrefService);
    var branch = prefs.getBranch("extensions."+MYSTRING+".");
    var editor = branch.getCharPref("editor");

    // TODO: It'd be nice to have this use PATH.
    // TODO: It should behave better the editor is unset or invalid.

    // create an nsILocalFile for the executable
    var file = Components.
      classes["@mozilla.org/file/local;1"].
      createInstance(Components.interfaces.nsILocalFile);

    file.initWithPath(editor);
    return file;
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

    self.uid = hashString([ node.ownerDocument.URL,
                            Math.random(),
                            node.getAttribute("name") ].join(':'));

    // TODO: This would be better if it autodetected the extension
    self.filename = hashString([ node.ownerDocument.URL,
                                 node.getAttribute("name") ].join(':')) +
      '.txt';

    node.setAttribute(MYSTRING+'_UID', self.uid);
    cache[self.uid] = self;
    
    // NARF TODO: Remove this hack to shorten names
    self.filename = self.filename.slice(0,5) + '.txt';

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

  // TODO: tempdir should be a preference.
  // TODO: tempdir should be a method that makes sure it exists.

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
    //that.log('refreshNode(): '+cobj);

    if(!cobj) { return; }
    if (!cobj._narf) {
      cobj._narf = true;
      cobj.node.style.backgroundColor = '#ddf';
    } else {
      cobj._narf = false;
      cobj.node.style.backgroundColor = '#dfd';
    }
    cobj.update();
  };

  /**
   * Refresh Document.
   * @param {Object} doc The document to refresh.
   */
  that.refreshDocument = function(doc) {
    //that.log('refreshDocument()',doc.URL);
    var nodes = doc.getElementsByTagName('textarea');
    for(var i=0; i < nodes.length; i++) {
      that.refreshTextarea(nodes[i]);
    }
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

    //that.log('onDOMContentLoad: start',id);
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
        setTimeout(cronjob, 3000+(1000*Math.random()));
      }
    };
    cronjob();

    /*
      TODO: Put edit button inside the lower right side of the text area.
    */
    //that.log('onDOMContentLoad: done',id);
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
  var init = function() {
    var appcontent = document.getElementById("appcontent"); // The Browser
    if (appcontent) {
      appcontent.addEventListener("DOMContentLoaded", that.onDOMContentLoad,
                                  true);
    }
    document.getElementById("contentAreaContextMenu").
      addEventListener("popupshowing", that.onContextMenu, false);

  };
  
  window.addEventListener("load", init, true);
}
var itsAllTextOverlay = new ItsAllTextOverlay();
