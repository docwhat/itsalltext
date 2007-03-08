/**
 * A Cache object is used to manage the node and the file behind it.
 * @constructor
 * @param {Object} node A DOM Node to watch.
 */
function CacheObj(node) {
    var that = this;

    /* Gumdrop Image URL */
    that.gumdrop_url    = 'chrome://itsalltext/locale/gumdrop.png';
    /* Gumdrop Image Width */
    that.gumdrop_width  = ItsAllText.localeString('gumdrop.width'); 
    /* Gumdrop Image Height */
    that.gumdrop_height = ItsAllText.localeString('gumdrop.height');

    that.timestamp = 0;
    that.size = 0;
    that.node = node;
    that.button = null;
    that.initial_background = '';
    that._is_watching = false;
     
    that.node_id = that.getNodeIdentifier(node);
    var doc = node.ownerDocument;

    /* This is a unique identifier for use on the web page to prevent the
     * web page from knowing what it's connected to.
     * @type String
     */
    that.uid = that.hashString([ doc.location.toString(),
                                 Math.random(),
                                 that.node_id ].join(':'));
    // @todo [security] Add a serial to the uid hash.

    node.setAttribute(ItsAllText.MYSTRING+'_UID', that.uid);
    ItsAllText.tracker[that.uid] = that;
    
    /* Figure out where we will store the file.  While the filename can
     * change, the directory that the file is stored in should not!
     */
    var host = window.escape(doc.location.hostname);
    var hash = that.hashString([ doc.location.protocol,
                                 doc.location.port,
                                 doc.location.search,
                                 doc.location.pathname,
                                 that.node_id ].join(':'));
    that.base_filename = [host, hash.slice(0,10)].join('.');
    /* The current extension.
     * @type String
     */
    that.extension = null;

    /* Stores an nsILocalFile pointing to the current filename.
     * @type nsILocalFile
     */
    that.file = null;

    /* Set the default extension and create the nsIFile object. */
    var extension = node.getAttribute('itsalltext-extension');
    if (typeof(extension) != 'string' || !extension.match(/^[.a-z0-9]+$/i)) {
        extension = ItsAllText.getExtensions()[0];
    }
    that.setExtension(extension);

    /**
     * A callback for when the textarea/textbox or button has 
     * the mouse waved over it.
     * @param {Event} event The event object.
     */
    that.mouseover = function(event) {
        var style = that.button?that.button.style:null;
        if (style) {
            style.opacity = '0.7';
            ItsAllText.refreshTextarea(that.node);
        }
    };

    /**
     * A callback for when the textarea/textbox or button has 
     * the mouse waved over it and the moved off.
     * @param {Event} event The event object.
     */
    that.mouseout = function(event) {
        var style = that.button?that.button.style:null;
        if (style) {
            style.opacity = '0.1';
        }
    };
}

/**
 * Set the extension for the file to ext.
 * @param {String} ext The extension.  Must include the dot.  Example: .txt
 */
CacheObj.prototype.setExtension = function(ext) {
    if (ext == this.extension) {
        return; /* It's already set.  No problem. */
    }

    /* Create the nsIFile object */
    var file = Components.classes["@mozilla.org/file/local;1"].
        createInstance(Components.interfaces.nsILocalFile);
    file.initWithFile(ItsAllText.getEditDir());
    file.append([this.base_filename,ext].join(''));

    this.extension = ext;
    this.file = file;
};

/**
 * Returns a unique identifier for the node, within the document.
 * @returns {String} the unique identifier.
 */
CacheObj.prototype.getNodeIdentifier = function(node) {
    var id   = node.getAttribute('id');
    if (!id) {
        var name = node.getAttribute('name');
        var doc = node.ownerDocument.getElementsByTagName('html')[0];
        var attr = ItsAllText.MYSTRING+'_id_serial';
        
        /* Get a serial that's unique to this document */
        var serial = doc.getAttribute(attr);
        if (serial) { serial = parseInt(serial, 10)+1;
        } else { serial = 1; }
        id = [ItsAllText.MYSTRING,'generated_id',name,serial].join('_');
        doc.setAttribute(attr,serial);
        node.setAttribute('id',id);
    }
    return id;
};

/**
 * Convert to this object to a useful string.
 * @returns {String} A string representation of this object.
 */
CacheObj.prototype.toString = function() {
    return [ "CacheObj",
             " uid=",this.uid,
             " timestamp=",this.timestamp,
             " size=",this.size
    ].join('');
};

/**
 * Write out the contents of the node.
 */
CacheObj.prototype.write = function() {
    var foStream = Components.
        classes["@mozilla.org/network/file-output-stream;1"].
        createInstance(Components.interfaces.nsIFileOutputStream);
             
    /* write, create, truncate */
    foStream.init(this.file, 0x02 | 0x08 | 0x20, 
                  parseInt('0600',8), 0); 
             
    /* We convert to charset */
    var conv = Components.
        classes["@mozilla.org/intl/scriptableunicodeconverter"].
        createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    conv.charset = ItsAllText.getCharset();
             
    var text = conv.ConvertFromUnicode(this.node.value);
    foStream.write(text, text.length);
    foStream.close();
             
    /* Reset Timestamp and filesize, to prevent a spurious refresh */
    this.timestamp = this.file.lastModifiedTime;
    this.size      = this.file.fileSize;

    /* Register the file to be deleted on app exit. */
    Components.classes["@mozilla.org/uriloader/external-helper-app-service;1"].
        getService(Components.interfaces.nsPIExternalAppLauncher).
        deleteTemporaryFileOnExit(this.file);
             
    return this.file.path;
};

/**
 * Fetches the computed CSS attribute for a specific node
 * @param {DOM} node The DOM node to get the information for.
 * @param {String} attr The CSS-style attribute to fetch (not DOM name).
 * @returns attribute
 */
CacheObj.prototype.getStyle = function(node, attr) {
    var view  = node ? node.ownerDocument.defaultView : null;
    var style = view.getComputedStyle(node, '');
    return  style.getPropertyCSSValue(attr).cssText;
};
     
// @todo [9] IDEA: Pass in the line number to the editor, arbitrary command?
// @todo [9] IDEA: Allow the user to pick an alternative editor?
// @todo [9] IDEA: A different editor per extension?
/**
 * Edit a textarea as a file.
 * @param {String} extension The extension of the file to edit.
 */
CacheObj.prototype.edit = function(extension) {
    if (typeof(extension) == 'string') {
        this.setExtension(extension);
    }
    var filename = this.write();
    this.initial_background = this.node.style.backgroundColor;
    this.initial_color      = this.node.style.color;
    var program = ItsAllText.getEditor();
             
    try {
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
        this._is_watching = true;
    } catch(e) {
        var params = {out:null,
                      exists: program.exists(),
                      path: program.path,
                      exception: e };
        window.openDialog('chrome://itsalltext/chrome/badeditor.xul',
                          null,
                          "chrome,titlebar,toolbar,centerscreen,modal",
                          params);
        if(params.out.do_preferences) {
            ItsAllText.openPreferences();
            this.edit(extension);
        }
    }
};

/**
 * Delete the file from disk.
 */
CacheObj.prototype.remove = function() {
    if(this.file.exists()) {
        try {
            this.file.remove();
        } catch(e) {
            that.debug('remove(',this.file.path,'): ',e);
            return false;
        }
    }
    return true;
};

/**
 * Read the file from disk.
 */
CacheObj.prototype.read = function() {
    /* read file, reset ts & size */
    var DEFAULT_REPLACEMENT_CHARACTER = 65533;
    var buffer = [];
         
    try {
        var fis = Components.
            classes["@mozilla.org/network/file-input-stream;1"].
            createInstance(Components.interfaces.nsIFileInputStream);
        fis.init(this.file, 0x01, parseInt('00400',8), 0); 
        // MODE_RDONLY | PERM_IRUSR
             
        var istream = Components.
            classes["@mozilla.org/intl/converter-input-stream;1"].
            createInstance(Components.interfaces.nsIConverterInputStream);
        istream.init(fis, ItsAllText.getCharset(), 4096, DEFAULT_REPLACEMENT_CHARACTER);
             
        var str = {};
        while (istream.readString(4096, str) !== 0) {
            buffer.push(str.value);
        }
        
        istream.close();
        fis.close();
             
        this.timestamp = this.file.lastModifiedTime;
        this.size      = this.file.fileSize;
             
        return buffer.join('');
    } catch(e) {
        return null;
    }
};

/**
 * Has the file object changed?
 * @returns {boolean} returns true if the file has changed on disk.
 */
 CacheObj.prototype.hasChanged = function() {
     /* Check exists.  Check ts and size. */
     if(!this._is_watching ||
        !this.file.exists() ||
        !this.file.isReadable() ||
        (this.file.lastModifiedTime == this.timestamp && 
         this.file.fileSize         == this.size)) {
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
CacheObj.prototype.fadeStep = function(background_pallet, color_pallet, step, delay) {
    var that = this;
    return function() {
        if (step < background_pallet.length) {
            that.node.style.backgroundColor = background_pallet[step].hex();
            that.node.style.color = color_pallet[step].hex();
            step++;
            setTimeout(that.fadeStep(background_pallet, color_pallet, step, delay),delay);
        } else {
            that.node.style.backgroundColor = that.initial_background;
            that.node.style.color = that.initial_color;
        }
    };
};

/**
 * Node fade technique.
 * @param {int} steps  Number of steps in the transition.
 * @param {int} delay  How long to wait between delay (microseconds).
 */
CacheObj.prototype.fade = function(steps, delay) {
    var color             = this.getStyle(this.node, 'color');
    var color_stop        = new ItsAllText.Color(color);
    var color_start       = new ItsAllText.Color('black');
    var color_pallet      = color_start.blend(color_stop, steps);

    var background        = this.getStyle(this.node, 'background-color');
    var background_stop   = new ItsAllText.Color(background);
    var background_start  = new ItsAllText.Color('yellow');
    var background_pallet = background_start.blend(background_stop, steps);
    setTimeout(this.fadeStep(background_pallet, color_pallet, 0, delay), delay);
};

/**
 * Update the node from the file.
 * @returns {boolean} Returns true ifthe file changed.
 */
CacheObj.prototype.update = function() {
    if (this.hasChanged()) {
        var value = this.read();
        if (value !== null) {
            this.fade(20, 100);
            this.node.value = value;
            return true;
        }
    }
    return false; // If we fall through, we 
};

/**
 * Add the gumdrop to a textarea.
 * @param {Object} cache_object The Cache Object that contains the node.
 */
CacheObj.prototype.addGumDrop = function() {
    var cache_object = this;
    if (cache_object.button !== null) {
        cache_object.adjust();
        return; /*already done*/
    }
    if (ItsAllText.getDisableGumdrops()) {
        return;
    }
    ItsAllText.debug('addGumDrop()',cache_object.node_id,cache_object.uid);
    
    var node = cache_object.node;
    var doc = node.ownerDocument;
    var offsetNode = node;
    if (!node.parentNode) { return; }
    
    var gumdrop = doc.createElementNS(ItsAllText.XHTMLNS, "img");
    gumdrop.setAttribute('src', this.gumdrop_url);
    if (ItsAllText.getDebug()) {
        gumdrop.setAttribute('title', cache_object.node_id);
    } else {
        gumdrop.setAttribute('title', ItsAllText.localeString('program_name'));
    }
    cache_object.button = gumdrop; // Store it for easy finding in the future.
    
    // Image Attributes
    gumdrop.style.cursor           = 'pointer';
    gumdrop.style.display          = 'block';
    gumdrop.style.position         = 'absolute';
    gumdrop.style.padding          = '0';
    gumdrop.style.border           = 'none';
    gumdrop.style.zIndex           = 1; // we want it just above normal items.
    
    gumdrop.style.width            = this.gumdrop_width+'px';
    gumdrop.style.height           = this.gumdrop_height+'px';

    gumdrop.setAttribute(ItsAllText.MYSTRING+'_UID', cache_object.uid);

    var clickfun = function(event) {
        var use_context  = event.ctrlKey || event.altKey;
        var use_cutpaste = event.shiftKey;
        if (use_context) {
            var target = ItsAllText.rebuildMenu(cache_object.uid);
            target.showPopup(document.documentElement,
                             event.screenX, event.screenY,
                             "bottomleft", "topleft");
        } else if(use_cutpaste) {
            ItsAllText.debug('mouse: use_cutpaste');
        } else {
            cache_object.edit();
        }
        event.stopPropagation();
        return false;
    };
    
    // Click event handler
    gumdrop.addEventListener("click", clickfun, false);
    
    // Insert it into the document
    var parent = node.parentNode;
    var nextSibling = node.nextSibling;
    
    if (nextSibling) {
        parent.insertBefore(gumdrop, nextSibling);
    } else {
        parent.appendChild(gumdrop);
    }
    
    // Add mouseovers/outs
    node.addEventListener("mouseover",    cache_object.mouseover, false);
    node.addEventListener("mouseout",     cache_object.mouseout, false);
    gumdrop.addEventListener("mouseover", cache_object.mouseover, false);
    gumdrop.addEventListener("mouseout",  cache_object.mouseout, false);
    
    cache_object.mouseout(null);
    cache_object.adjust();
};

/**
 * Updates the position of the gumdrop, incase the textarea shifts around.
 */
CacheObj.prototype.adjust = function() {
    var gumdrop  = this.button;
    var el       = this.node;
    if (ItsAllText.getDisableGumdrops()) {
        if(gumdrop && gumdrop.style.display != 'none') {
            gumdrop.style.display = 'none';
        }
        return;
    }
    var style    = gumdrop.style;
    if (!gumdrop || !el) { return; }
    var display  = '';
    if (el.style.display == 'none' ||
        el.getAttribute('readonly') ||
        el.getAttribute('disabled')
        ) {
        display = 'none';
    }
    if (style.display != display) {
        style.display = display;
    }

    /* Reposition the gumdrops incase the dom changed. */
    var left = el.offsetLeft+Math.max(1, el.offsetWidth-this.gumdrop_width);
    var top  = el.offsetTop+el.offsetHeight;
    if(left && top) {
        left = [left,'px'].join('');
        top  = [top,'px'].join('');
        if(style.left != left) { style.left = left; }
        if(style.top != top) { style.top = top; }
    }
};

/**
 * Creates a mostly unique hash of a string
 * Most of this code is from:
 *    http://developer.mozilla.org/en/docs/nsICryptoHash
 * @param {String} some_string The string to hash.
 * @returns {String} a hashed string.
 */
CacheObj.prototype.hashString = function(some_string) {
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
};
