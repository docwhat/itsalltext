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

  var makeLocalFile = function(path) {
    var obj = Components.classes["@mozilla.org/file/local;1"].
      createInstance(Components.interfaces.nsILocalFile);
    obj.initWithPath(path);
    return obj;
  };

  function CacheObj(node) {
    var self = this;
    self.timestamp = 0;
    self.size = 0;
    self.node = node;

    self.uid = hashString([ node.ownerDocument.URL,
                            Math.random(),
                            node.getAttribute("name") ].join(':'));
    node.setAttribute('ItsAllText_UID', self.uid);
    cache[self.uid] = self;
    // TODO: This would be better if it was smarter
    self.filename  = self.uid + '.txt';

    self.toString = function() {
      return [ "CacheObj",
               " uid=",self.uid,
               " timestamp=",self.timestamp,
               " size=",self.size
      ].join('');
    };
  }

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
    return Firebug.Console.logFormatted(arguments);
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
    if (node && node.hasAttribute("ItsAllText_UID")) {
      var val = cache[node.getAttribute("ItsAllText_UID")];
      return val ? val : null; // Return the value or null
    } else {
      return new CacheObj(node);
    }
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
      cobj.node.style.backgroundColor = '#fdd';
    } else {
      cobj._narf = false;
      cobj.node.style.backgroundColor = '#dfd';
    }
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

  that.openEditor = function(textarea) {
    that.debug('openEditor',arguments);
    return;
  }

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
